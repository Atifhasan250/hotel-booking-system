import type { AuditEventWriter } from "../../audit/domain/audit-event";
import type { RateLimiter, TransactionRunner } from "../../identity/application/ports";
import type { CreateBookingDraftInput } from "../domain/schemas";
import type { Booking, BookingInvoice, BookingPolicySnapshot, BookingQuoteSnapshot, BookingState, BookingStateEvent, InvoiceMerchantSnapshot } from "../domain/model";
import type { CancellationPolicyRuleSnapshot } from "../domain/cancellation-policy";

export interface ResolvedBookingSelection {
  customerId: string;
  vendorId: string;
  propertyId: string;
  roomTypeId: string;
  ratePlanId: string;
  maxAdults: number;
  maxChildren: number;
  quote: BookingQuoteSnapshot;
  policy: BookingPolicySnapshot;
  cancellationPolicy: CancellationPolicyRuleSnapshot;
  merchant: InvoiceMerchantSnapshot;
  roomDescription: string;
}

export interface BookingSelectionResolver {
  resolve(customerId: string, input: CreateBookingDraftInput, now: Date): Promise<ResolvedBookingSelection | null>;
}

export interface BookingRepository {
  findByCustomerIdempotencyKey(customerId: string, key: string): Promise<Booking | null>;
  createIfAbsent(booking: Booking): Promise<{ booking: Booking; created: boolean }>;
  findForCustomer(publicReference: string, customerId: string): Promise<Booking | null>;
  findByReference(publicReference: string): Promise<Booking | null>;
  transition(bookingId: string, from: BookingState, to: BookingState, event: BookingStateEvent, at: Date): Promise<boolean>;
  allocateInvoiceSequence(merchantCode: string, year: number): Promise<number>;
  createInvoiceIfAbsent(invoice: BookingInvoice): Promise<{ invoice: BookingInvoice; created: boolean }>;
  findInvoiceForCustomer(publicReference: string, customerId: string): Promise<BookingInvoice | null>;
}

export interface BookingInventoryPort {
  createHold(input: { bookingReference: string; roomTypeId: string; checkInDate: string; checkOutDate: string; quantity: number; idempotencyKey: string }, requestId: string): Promise<{ holdId: string; expiresAt: string }>;
  consumeHold(bookingReference: string, requestId: string): Promise<void>;
}

export interface BookingConfirmationAdapter {
  readonly kind: "DISABLED" | "TEST";
  confirm(booking: Booking): Promise<{ confirmedAt: Date }>;
}

export interface BookingDependencies {
  repository: BookingRepository;
  selections: BookingSelectionResolver;
  inventory: BookingInventoryPort;
  confirmation: BookingConfirmationAdapter;
  transactions: TransactionRunner;
  rateLimiter: RateLimiter;
  audit: AuditEventWriter;
  ids: { create(): string; publicReference(): string };
  clock: { now(): Date };
}
