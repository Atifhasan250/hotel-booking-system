import "server-only";

import type { Collection, Db } from "mongodb";
import type { MongoTransactionRunner } from "../../../platform/db/mongo-transaction";
import type { BookingRepository, BookingSelectionResolver, ResolvedBookingSelection } from "../application/ports";
import type { CreateBookingDraftInput } from "../domain/schemas";
import type { Booking, BookingInvoice, BookingState, BookingStateEvent } from "../domain/model";

export interface StoredBookingSelection extends ResolvedBookingSelection {
  id: string;
  status: "ACTIVE" | "CONSUMED" | "EXPIRED";
}

export class MongoBookingRepository implements BookingRepository {
  private readonly bookings: Collection<Booking>;
  private readonly events: Collection<BookingStateEvent>;
  private readonly invoices: Collection<BookingInvoice>;

  constructor(private readonly db: Db, private readonly transactions: MongoTransactionRunner) {
    this.bookings = db.collection("bookings"); this.events = db.collection("bookingStateEvents"); this.invoices = db.collection("invoices");
  }
  findByCustomerIdempotencyKey(customerId: string, idempotencyKey: string) { return this.bookings.findOne({ customerId, idempotencyKey }, { session: this.transactions.current() }); }
  async createIfAbsent(booking: Booking) {
    const result = await this.bookings.findOneAndUpdate({ customerId: booking.customerId, idempotencyKey: booking.idempotencyKey }, { $setOnInsert: booking }, { upsert: true, returnDocument: "after", includeResultMetadata: true, session: this.transactions.current() });
    if (!result.value) throw new Error("Booking upsert returned no document");
    return { booking: result.value, created: result.lastErrorObject?.upserted !== undefined };
  }
  findForCustomer(publicReference: string, customerId: string) { return this.bookings.findOne({ publicReference, customerId }, { session: this.transactions.current() }); }
  findByReference(publicReference: string) { return this.bookings.findOne({ publicReference }, { session: this.transactions.current() }); }
  async transition(bookingId: string, from: BookingState, to: BookingState, event: BookingStateEvent, at: Date) {
    const changed = await this.bookings.updateOne({ id: bookingId, state: from }, { $set: { state: to, updatedAt: at.toISOString() } }, { session: this.transactions.current() });
    if (changed.modifiedCount !== 1) return false;
    await this.events.insertOne(event, { session: this.transactions.current() });
    return true;
  }
  async allocateInvoiceSequence(merchantCode: string, year: number) {
    const result = await this.db.collection<{ _id: string; sequence: number }>("invoiceSequences").findOneAndUpdate(
      { _id: `${merchantCode}:${year}` }, { $inc: { sequence: 1 } }, { upsert: true, returnDocument: "after", session: this.transactions.current() },
    );
    if (!result) throw new Error("Invoice sequence allocation failed");
    return result.sequence;
  }
  async createInvoiceIfAbsent(invoice: BookingInvoice) {
    const result = await this.invoices.findOneAndUpdate({ bookingId: invoice.bookingId }, { $setOnInsert: invoice }, { upsert: true, returnDocument: "after", includeResultMetadata: true, session: this.transactions.current() });
    if (!result.value) throw new Error("Invoice upsert returned no document");
    return { invoice: result.value, created: result.lastErrorObject?.upserted !== undefined };
  }
  async findInvoiceForCustomer(publicReference: string, customerId: string) {
    const booking = await this.findForCustomer(publicReference, customerId);
    return booking ? this.invoices.findOne({ bookingId: booking.id }, { session: this.transactions.current() }) : null;
  }
}

export class MongoBookingSelectionResolver implements BookingSelectionResolver {
  constructor(private readonly db: Db, private readonly transactions: MongoTransactionRunner) {}
  async resolve(customerId: string, input: CreateBookingDraftInput, now: Date): Promise<ResolvedBookingSelection | null> {
    return this.db.collection<StoredBookingSelection>("bookingQuoteSnapshots").findOne({
      id: input.quoteId, customerId, propertyId: input.propertyId, roomTypeId: input.roomTypeId, ratePlanId: input.ratePlanId,
      status: "ACTIVE", "quote.expiresAt": { $gt: now.toISOString() },
    }, { session: this.transactions.current() });
  }
}

let indexPromise: Promise<void> | undefined;
export function ensureBookingIndexes(db: Db): Promise<void> {
  indexPromise ??= Promise.all([
    db.collection("bookings").createIndex({ publicReference: 1 }, { unique: true }),
    db.collection("bookings").createIndex({ customerId: 1, idempotencyKey: 1 }, { unique: true }),
    db.collection("bookings").createIndex({ customerId: 1, createdAt: -1 }),
    db.collection("bookings").createIndex({ vendorId: 1, propertyId: 1, state: 1, createdAt: -1 }),
    db.collection("bookingStateEvents").createIndex({ bookingId: 1, occurredAt: 1 }),
    db.collection("invoices").createIndex({ invoiceNumber: 1 }, { unique: true }),
    db.collection("invoices").createIndex({ bookingId: 1 }, { unique: true }),
    db.collection("bookingQuoteSnapshots").createIndex({ id: 1 }, { unique: true }),
    db.collection("bookingQuoteSnapshots").createIndex({ customerId: 1, status: 1, "quote.expiresAt": 1 }),
  ]).then(() => undefined).catch((error) => { indexPromise = undefined; throw error; });
  return indexPromise;
}
