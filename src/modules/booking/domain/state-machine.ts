import type { BookingState } from "./model";

const transitions: Readonly<Record<BookingState, ReadonlySet<BookingState>>> = {
  DRAFT: new Set(["HELD"]),
  HELD: new Set(["PENDING_PAYMENT", "EXPIRED"]),
  PENDING_PAYMENT: new Set(["CONFIRMED", "PAYMENT_FAILED", "EXPIRED"]),
  CONFIRMED: new Set(["CHECKED_IN", "CANCEL_REQUESTED", "NO_SHOW"]),
  CHECKED_IN: new Set(["COMPLETED"]),
  COMPLETED: new Set(),
  PAYMENT_FAILED: new Set(["PENDING_PAYMENT", "EXPIRED"]),
  EXPIRED: new Set(),
  CANCEL_REQUESTED: new Set(["CONFIRMED", "CANCELLED", "REFUND_PENDING"]),
  CANCELLED: new Set(),
  REFUND_PENDING: new Set(["REFUNDED", "CANCELLED"]),
  REFUNDED: new Set(),
  NO_SHOW: new Set(),
};

export class InvalidBookingTransitionError extends Error {
  readonly code = "INVALID_BOOKING_TRANSITION";

  constructor(from: BookingState, to: BookingState) {
    super(`Booking cannot transition from ${from} to ${to}`);
    this.name = "InvalidBookingTransitionError";
  }
}

export function canTransitionBooking(from: BookingState, to: BookingState): boolean {
  return transitions[from].has(to);
}

export function assertBookingTransition(from: BookingState, to: BookingState): void {
  if (!canTransitionBooking(from, to)) throw new InvalidBookingTransitionError(from, to);
}
