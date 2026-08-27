import { describe, expect, it } from "vitest";

import { SESSION_COOKIE, sessionCookieOptions } from "../../src/modules/identity/presentation/http";

describe("session cookie contract", () => {
  it("uses an opaque host-wide HttpOnly SameSite cookie with explicit expiry", () => {
    const expiresAt = new Date("2026-09-26T10:00:00.000Z");
    expect(SESSION_COOKIE).toBe("bmr_session");
    expect(sessionCookieOptions(expiresAt)).toEqual(expect.objectContaining({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
      priority: "high",
    }));
  });
});
