import { describe, expect, it } from "vitest";

import { isAllowedRequestOrigin } from "../../src/platform/request/origin-policy";

describe("same-origin mutation policy", () => {
  it("accepts only an exact scheme/host/port origin", () => {
    expect(isAllowedRequestOrigin("https://bookmyroom.site", "https://bookmyroom.site")).toBe(true);
    expect(isAllowedRequestOrigin("https://bookmyroom.site/path", "https://bookmyroom.site")).toBe(true);
    expect(isAllowedRequestOrigin("http://bookmyroom.site", "https://bookmyroom.site")).toBe(false);
    expect(isAllowedRequestOrigin("https://evil.example", "https://bookmyroom.site")).toBe(false);
    expect(isAllowedRequestOrigin(null, "https://bookmyroom.site")).toBe(false);
    expect(isAllowedRequestOrigin("not-a-url", "https://bookmyroom.site")).toBe(false);
  });
});
