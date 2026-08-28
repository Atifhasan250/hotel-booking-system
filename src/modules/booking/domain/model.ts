import type { Currency } from "../../../shared/money/money";
import type { CancellationPolicyRuleSnapshot } from "./cancellation-policy";

export const BOOKING_STATES = [
  "DRAFT",
  "HELD",
  "PENDING_PAYMENT",
  "CONFIRMED",
  "CHECKED_IN",
  "COMPLETED",
  "PAYMENT_FAILED",
  "EXPIRED",
  "CANCEL_REQUESTED",
  "CANCELLED",
  "REFUND_PENDING",
  "REFUNDED",
  "NO_SHOW",
] as const;

export type BookingState = (typeof BOOKING_STATES)[number];

export interface BookingGuestSnapshot {
  primaryGuest: Readonly<{
    fullName: string;
    email: string;
    phone: string;
  }>;
  occupants: Readonly<{
    adults: number;
    children: number;
  }>;
  specialRequests?: string;
  consent: Readonly<{
    policyVersion: string;
    acceptedAt: string;
  }>;
}

export interface BookingPolicySnapshot {
  version: string;
  propertyPolicyRevision: string;
  ratePlanPolicyRevision: string;
  checkInTime: string;
  checkOutTime: string;
  cancellationPolicy: string;
  childPolicy: string;
  extraBedPolicy: string;
  petPolicy: string;
  couplePolicy: string;
  capturedAt: string;
}

export interface BookingQuoteSnapshot {
  quoteId: string;
  currency: Currency;
  nightlyLines: ReadonlyArray<Readonly<{
    localDate: string;
    ratePlanId: string;
    baseMinorUnits: number;
    discountMinorUnits: number;
    finalMinorUnits: number;
  }>>;
  taxLines: ReadonlyArray<Readonly<{
    code: string;
    label: string;
    minorUnits: number;
    ruleRevision: string;
    refundableOnCancellation: boolean;
  }>>;
  feeLines: ReadonlyArray<Readonly<{
    code: string;
    label: string;
    minorUnits: number;
    ruleRevision: string;
    refundableOnCancellation: boolean;
  }>>;
  subtotalMinorUnits: number;
  discountMinorUnits: number;
  taxMinorUnits: number;
  feeMinorUnits: number;
  totalMinorUnits: number;
  expiresAt: string;
  capturedAt: string;
}

export interface MerchantTaxProfile {
  id: string;
  merchantId: string;
  revision: string;
  status: "DRAFT" | "APPROVED" | "RETIRED";
  priceMode: "TAX_EXCLUSIVE";
  effectiveFrom: string;
  effectiveTo?: string;
  rules: ReadonlyArray<Readonly<{
    code: string;
    label: string;
    rateBasisPoints: number;
    basis: "ROOM_SUBTOTAL" | "SUBTOTAL_PLUS_PREVIOUS_TAX";
    refundableOnCancellation: boolean;
  }>>;
  approvedBy?: string;
  approvedAt?: string;
}

export interface InvoiceMerchantSnapshot {
  merchantId: string;
  merchantCode: string;
  legalName: string;
  issueAddress: string;
  vatRegistered: boolean;
  bin?: string;
  profileRevision: string;
}

export interface BookingInvoice {
  id: string;
  invoiceNumber: string;
  bookingId: string;
  bookingReference: string;
  merchant: InvoiceMerchantSnapshot;
  purchaser: Readonly<{ name: string; bin?: string }>;
  lineItems: ReadonlyArray<Readonly<{
    description: string;
    quantity: number;
    unitMinorUnits: number;
    totalMinorUnits: number;
  }>>;
  quote: BookingQuoteSnapshot;
  issuedAt: string;
  currency: Currency;
  renderVersion: string;
}

export interface Booking {
  id: string;
  publicReference: string;
  customerId: string;
  vendorId: string;
  propertyId: string;
  roomTypeId: string;
  ratePlanId: string;
  checkInDate: string;
  checkOutDate: string;
  roomQuantity: number;
  guest: BookingGuestSnapshot;
  quote: BookingQuoteSnapshot;
  policy: BookingPolicySnapshot;
  cancellationPolicy: CancellationPolicyRuleSnapshot;
  merchant: InvoiceMerchantSnapshot;
  roomDescription: string;
  state: BookingState;
  holdId: string;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookingStateEvent {
  id: string;
  bookingId: string;
  actorId: string;
  source: "CUSTOMER" | "VENDOR" | "ADMIN" | "SYSTEM" | "PAYMENT_PROVIDER";
  from: BookingState;
  to: BookingState;
  reason?: string;
  occurredAt: string;
  requestId: string;
}
