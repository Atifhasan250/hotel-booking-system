import type { ActorContext } from "../../identity/domain/model";
import { expandNights } from "../../../shared/money/date-range";
import { createInvoiceSnapshot, formatInvoiceNumber } from "../domain/invoice";
import type { Booking, BookingState, BookingStateEvent } from "../domain/model";
import type { CreateBookingDraftInput } from "../domain/schemas";
import { assertBookingTransition } from "../domain/state-machine";
import { BookingAuthorizationError, BookingConflictError, BookingConfirmationUnavailableError, BookingNotFoundError, BookingRateLimitError } from "./errors";
import type { BookingDependencies, ResolvedBookingSelection } from "./ports";

export class BookingService {
  constructor(private readonly deps: BookingDependencies) {}

  async create(actor: ActorContext | null, input: CreateBookingDraftInput, context: { requestId: string }) {
    if (!actor) throw new BookingAuthorizationError();
    if (!await this.deps.rateLimiter.consume(`booking:create:${actor.customerId}`, 20, 300)) throw new BookingRateLimitError();
    const now = this.deps.clock.now();
    return this.deps.transactions.run(async () => {
      const replay = await this.deps.repository.findByCustomerIdempotencyKey(actor.customerId, input.idempotencyKey);
      if (replay) {
        if (!sameBookingRequest(replay, input)) throw new BookingConflictError("Idempotency key was already used for different booking data");
        return { booking: customerBooking(replay), idempotentReplay: true };
      }
      const selection = await this.deps.selections.resolve(actor.customerId, input, now);
      validateSelection(selection, actor.customerId, input, now);
      const publicReference = this.deps.ids.publicReference();
      const hold = await this.deps.inventory.createHold({
        bookingReference: publicReference, roomTypeId: input.roomTypeId, checkInDate: input.checkInDate,
        checkOutDate: input.checkOutDate, quantity: input.roomQuantity, idempotencyKey: `${input.idempotencyKey}:hold`,
      }, context.requestId);
      const booking: Booking = {
        id: this.deps.ids.create(), publicReference, customerId: actor.customerId, vendorId: selection!.vendorId,
        propertyId: input.propertyId, roomTypeId: input.roomTypeId, ratePlanId: input.ratePlanId,
        checkInDate: input.checkInDate, checkOutDate: input.checkOutDate, roomQuantity: input.roomQuantity,
        guest: Object.freeze({
          primaryGuest: Object.freeze({ ...input.primaryGuest }), occupants: Object.freeze({ ...input.occupants }),
          specialRequests: input.specialRequests,
          consent: Object.freeze({ policyVersion: input.consent.policyVersion, acceptedAt: now.toISOString() }),
        }),
        quote: selection!.quote, policy: selection!.policy, cancellationPolicy: selection!.cancellationPolicy,
        merchant: selection!.merchant, roomDescription: selection!.roomDescription,
        state: "HELD", holdId: hold.holdId, idempotencyKey: input.idempotencyKey,
        createdAt: now.toISOString(), updatedAt: now.toISOString(),
      };
      const result = await this.deps.repository.createIfAbsent(booking);
      if (!result.created) throw new BookingConflictError("Booking idempotency conflict");
      await this.audit(actor.userId, "booking.create", booking, context.requestId, { state: "HELD", holdExpiresAt: hold.expiresAt });
      return { booking: customerBooking(booking), idempotentReplay: false };
    });
  }

  async get(actor: ActorContext | null, reference: string) {
    if (!actor) throw new BookingAuthorizationError();
    const booking = await this.deps.repository.findForCustomer(reference, actor.customerId);
    if (!booking) throw new BookingNotFoundError();
    return customerBooking(booking);
  }

  async confirmWithConfiguredAdapter(actor: ActorContext | null, reference: string, context: { requestId: string }) {
    if (!actor) throw new BookingAuthorizationError();
    if (this.deps.confirmation.kind !== "TEST") throw new BookingConfirmationUnavailableError();
    return this.deps.transactions.run(async () => {
      let booking = await this.deps.repository.findForCustomer(reference, actor.customerId);
      if (!booking) throw new BookingNotFoundError();
      if (booking.state === "CONFIRMED") return { booking: customerBooking(booking), idempotentReplay: true };
      if (booking.state !== "HELD" && booking.state !== "PENDING_PAYMENT") throw new BookingConflictError("Booking cannot be test-confirmed from its current state");
      if (booking.state === "HELD") {
        await this.transition(booking, "PENDING_PAYMENT", actor.userId, "SYSTEM", context.requestId);
        booking = { ...booking, state: "PENDING_PAYMENT", updatedAt: this.deps.clock.now().toISOString() };
      }
      const proof = await this.deps.confirmation.confirm(booking);
      await this.deps.inventory.consumeHold(reference, context.requestId);
      await this.transition(booking, "CONFIRMED", actor.userId, "PAYMENT_PROVIDER", context.requestId, "M5 test adapter");
      booking = { ...booking, state: "CONFIRMED", updatedAt: proof.confirmedAt.toISOString() };
      const year = proof.confirmedAt.getUTCFullYear();
      const merchantCode = booking.merchant.merchantCode;
      const sequence = await this.deps.repository.allocateInvoiceSequence(merchantCode, year);
      const invoice = createInvoiceSnapshot({
        id: this.deps.ids.create(), invoiceNumber: formatInvoiceNumber(merchantCode, year, sequence),
        bookingId: booking.id, bookingReference: booking.publicReference,
        merchant: booking.merchant,
        purchaser: { name: booking.guest.primaryGuest.fullName }, quote: booking.quote,
        roomDescription: booking.roomDescription,
        roomQuantity: booking.roomQuantity, issuedAt: proof.confirmedAt.toISOString(), renderVersion: "invoice_v1",
      });
      await this.deps.repository.createInvoiceIfAbsent(invoice);
      await this.audit(actor.userId, "booking.confirm.test", booking, context.requestId, { invoiceNumber: invoice.invoiceNumber });
      return { booking: customerBooking(booking), invoiceNumber: invoice.invoiceNumber, idempotentReplay: false };
    });
  }

  async getInvoice(actor: ActorContext | null, reference: string) {
    if (!actor) throw new BookingAuthorizationError();
    const invoice = await this.deps.repository.findInvoiceForCustomer(reference, actor.customerId);
    if (!invoice) throw new BookingNotFoundError();
    return invoice;
  }

  private async transition(booking: Booking, to: BookingState, actorId: string, source: BookingStateEvent["source"], requestId: string, reason?: string) {
    assertBookingTransition(booking.state, to);
    const at = this.deps.clock.now();
    const event: BookingStateEvent = { id: this.deps.ids.create(), bookingId: booking.id, actorId, source, from: booking.state, to, reason, occurredAt: at.toISOString(), requestId };
    if (!await this.deps.repository.transition(booking.id, booking.state, to, event, at)) throw new BookingConflictError("Booking state changed concurrently");
  }

  private audit(actorId: string, action: string, booking: Booking, requestId: string, metadata: Record<string, string | number | boolean>) {
    return this.deps.audit.append({ id: this.deps.ids.create(), actorId, action, targetType: "booking", targetId: booking.id, outcome: "SUCCESS", requestId, occurredAt: this.deps.clock.now(), metadata });
  }
}

function validateSelection(selection: ResolvedBookingSelection | null, customerId: string, input: CreateBookingDraftInput, now: Date): asserts selection is ResolvedBookingSelection {
  if (!selection || selection.customerId !== customerId) throw new BookingConflictError("Selected property, room, rate, or quote is unavailable");
  if (selection.propertyId !== input.propertyId || selection.roomTypeId !== input.roomTypeId || selection.ratePlanId !== input.ratePlanId || selection.quote.quoteId !== input.quoteId) throw new BookingConflictError("Quote selection mismatch");
  if (new Date(selection.quote.expiresAt) <= now) throw new BookingConflictError("Quote expired");
  if (input.occupants.adults > selection.maxAdults * input.roomQuantity || input.occupants.children > selection.maxChildren * input.roomQuantity) throw new BookingConflictError("Room occupancy exceeded");
  if (selection.quote.nightlyLines.map((line) => line.localDate).join("|") !== expandNights(input.checkInDate, input.checkOutDate).join("|")) throw new BookingConflictError("Quote dates do not match the stay");
}

function sameBookingRequest(booking: Booking, input: CreateBookingDraftInput) {
  return booking.propertyId === input.propertyId && booking.roomTypeId === input.roomTypeId && booking.ratePlanId === input.ratePlanId
    && booking.quote.quoteId === input.quoteId && booking.checkInDate === input.checkInDate && booking.checkOutDate === input.checkOutDate
    && booking.roomQuantity === input.roomQuantity && booking.guest.occupants.adults === input.occupants.adults
    && booking.guest.occupants.children === input.occupants.children;
}

function customerBooking(booking: Booking) {
  return { publicReference: booking.publicReference, state: booking.state, propertyId: booking.propertyId, roomTypeId: booking.roomTypeId,
    checkInDate: booking.checkInDate, checkOutDate: booking.checkOutDate, roomQuantity: booking.roomQuantity,
    totalMinorUnits: booking.quote.totalMinorUnits, currency: booking.quote.currency, holdExpiresAt: booking.quote.expiresAt };
}
