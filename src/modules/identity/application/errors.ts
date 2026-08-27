export class AuthenticationError extends Error {
  constructor() {
    super("Invalid credentials");
    this.name = "AuthenticationError";
  }
}

export class RateLimitError extends Error {
  constructor() {
    super("Too many attempts");
    this.name = "RateLimitError";
  }
}

export class InvalidIdentityTokenError extends Error {
  constructor() {
    super("The token is invalid or expired");
    this.name = "InvalidIdentityTokenError";
  }
}
