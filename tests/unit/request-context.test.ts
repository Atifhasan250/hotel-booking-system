import { describe, expect, it } from "vitest";

import { createRequestSecurityContext } from "../../src/platform/request/request-context";

describe("request security context", () => {
  it("does not trust client-controlled forwarding headers for throttling or IP audit metadata", () => {
    const first = createRequestSecurityContext(new Headers({
      "x-request-id": "request-12345",
      "x-real-ip": "198.51.100.10",
      "x-forwarded-for": "198.51.100.20",
      "user-agent": "test-browser",
    }));
    const spoofed = createRequestSecurityContext(new Headers({
      "x-request-id": "request-12345",
      "x-real-ip": "203.0.113.10",
      "x-forwarded-for": "203.0.113.20",
      "user-agent": "test-browser",
    }));
    expect(first.abuseKey).toBe("server-enforced");
    expect(first.ipHash).toBeUndefined();
    expect(spoofed).toEqual(first);
  });
});
