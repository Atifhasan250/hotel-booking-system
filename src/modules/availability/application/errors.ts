export class AvailabilityError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "AvailabilityError";
  }
}

export const AvailabilityErrors = {
  NOT_ENOUGH_INVENTORY: () => new AvailabilityError("NOT_ENOUGH_INVENTORY", "Not enough inventory available for the requested dates"),
  HOLD_NOT_FOUND: () => new AvailabilityError("HOLD_NOT_FOUND", "Inventory hold not found"),
  HOLD_EXPIRED: () => new AvailabilityError("HOLD_EXPIRED", "Inventory hold has expired"),
  HOLD_ALREADY_CONSUMED: () => new AvailabilityError("HOLD_ALREADY_CONSUMED", "Inventory hold has already been consumed"),
  INVALID_DATES: () => new AvailabilityError("INVALID_DATES", "Invalid check-in or check-out dates"),
  IDEMPOTENCY_CONFLICT: () => new AvailabilityError("IDEMPOTENCY_CONFLICT", "Idempotency key was already used for a different hold request"),
  ROOM_NOT_AVAILABLE: () => new AvailabilityError("ROOM_NOT_AVAILABLE", "Room is not available (stop-sell or blackout)"),
  NOT_AVAILABLE: (detail?: string) => new AvailabilityError("NOT_AVAILABLE", detail ?? "Requested dates or quantity are not available"),
} as const;
