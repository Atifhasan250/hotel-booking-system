import { ZodError } from "zod";

import { AuthenticationError, InvalidIdentityTokenError, RateLimitError } from "../application/errors";

export const SESSION_COOKIE = "bmr_session";

export function safeAuthError(error: unknown): Response {
  if (error instanceof Error && error.name === "InvalidRequestOriginError") {
    return Response.json({ error: { code: "INVALID_ORIGIN", message: "Request origin was rejected." } }, { status: 403 });
  }
  if (error instanceof RateLimitError) {
    return Response.json({ error: { code: "RATE_LIMITED", message: "Too many attempts. Try again later." } }, { status: 429 });
  }
  if (error instanceof AuthenticationError) {
    return Response.json({ error: { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect." } }, { status: 401 });
  }
  if (error instanceof InvalidIdentityTokenError) {
    return Response.json({ error: { code: "INVALID_TOKEN", message: "This link is invalid or expired." } }, { status: 400 });
  }
  if (error instanceof ZodError || error instanceof SyntaxError) {
    return Response.json({ error: { code: "INVALID_INPUT", message: "Check the submitted fields." } }, { status: 400 });
  }
  return Response.json({ error: { code: "UNAVAILABLE", message: "The service is temporarily unavailable." } }, { status: 503 });
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
    priority: "high" as const,
  };
}
