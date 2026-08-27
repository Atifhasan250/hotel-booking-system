import { describe, expect, it, vi } from "vitest";

import { AuthorizationDeniedError, authorizeOrThrow, isAuthorized } from "../../src/modules/identity/application/authorization";
import type { ActorContext } from "../../src/modules/identity/domain/model";

const actor: ActorContext = {
  userId: "user-1",
  customerId: "customer-1",
  vendorMemberships: [
    {
      vendorId: "vendor-a",
      role: "MEMBER",
      permissions: ["vendor:bookings:read"],
      status: "ACTIVE",
    },
    {
      vendorId: "vendor-b",
      role: "OWNER",
      permissions: [],
      status: "ACTIVE",
    },
    {
      vendorId: "vendor-suspended",
      role: "OWNER",
      permissions: [],
      status: "SUSPENDED",
    },
  ],
  adminPermissions: ["admin:marketplace:read"],
  superAdmin: false,
};

describe("deny-by-default authorization", () => {
  it("isolates customer records", () => {
    expect(isAuthorized(actor, { scope: "customer", customerId: "customer-1" })).toBe(true);
    expect(isAuthorized(actor, { scope: "customer", customerId: "customer-2" })).toBe(false);
  });

  it("isolates vendors and applies membership permissions", () => {
    expect(isAuthorized(actor, { scope: "vendor", vendorId: "vendor-a", permission: "vendor:bookings:read" })).toBe(true);
    expect(isAuthorized(actor, { scope: "vendor", vendorId: "vendor-a", permission: "vendor:finance:read" })).toBe(false);
    expect(isAuthorized(actor, { scope: "vendor", vendorId: "vendor-b", permission: "vendor:members:manage" })).toBe(true);
    expect(isAuthorized(actor, { scope: "vendor", vendorId: "vendor-suspended", permission: "vendor:properties:manage" })).toBe(false);
    expect(isAuthorized(actor, { scope: "vendor", vendorId: "vendor-c", permission: "vendor:bookings:read" })).toBe(false);
  });

  it("requires explicit admin permissions and reserves super-admin operations", () => {
    expect(isAuthorized(actor, { scope: "admin", permission: "admin:marketplace:read" })).toBe(true);
    expect(isAuthorized(actor, { scope: "admin", permission: "admin:finance:manage" })).toBe(false);
    expect(isAuthorized(actor, { scope: "super-admin" })).toBe(false);
    expect(isAuthorized({ ...actor, superAdmin: true }, { scope: "super-admin" })).toBe(true);
    expect(isAuthorized(null, { scope: "customer", customerId: "customer-1" })).toBe(false);
  });

  it("audits denied use-case authorization", async () => {
    const append = vi.fn();
    await expect(
      authorizeOrThrow({
        actor,
        request: { scope: "vendor", vendorId: "vendor-c", permission: "vendor:finance:read" },
        audit: { append },
        requestId: "request-1",
        action: "vendor.finance.read",
      }),
    ).rejects.toBeInstanceOf(AuthorizationDeniedError);
    expect(append).toHaveBeenCalledWith(expect.objectContaining({ outcome: "DENIED", targetId: "vendor-c" }));
  });
});
