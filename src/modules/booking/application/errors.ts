export class BookingAuthorizationError extends Error { constructor() { super("Booking access is forbidden"); this.name = "BookingAuthorizationError"; } }
export class BookingNotFoundError extends Error { constructor() { super("Booking was not found"); this.name = "BookingNotFoundError"; } }
export class BookingConflictError extends Error { constructor(message: string) { super(message); this.name = "BookingConflictError"; } }
export class BookingRateLimitError extends Error { constructor() { super("Too many booking attempts"); this.name = "BookingRateLimitError"; } }
export class BookingConfirmationUnavailableError extends Error { constructor() { super("Payment confirmation is unavailable until the verified provider succeeds"); this.name = "BookingConfirmationUnavailableError"; } }
