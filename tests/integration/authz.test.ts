import { describe, expect, it, vi } from "vitest";

import { AuthorizationDeniedError, authorizeOrThrow } from "../../src/modules/identity/application/authorization";
import type { ActorContext } from "../../src/modules/identity/domain/model";

describe("authorized use-case boundary", () => {
  const actor: ActorContext = {
    userId: "user-1",
    customerId: "customer-1",
    vendorMemberships: [{
      vendorId: "vendor-1",
      role: "MEMBER",
      permissions: ["vendor:bookings:read"],
      status: "ACTIVE",
    }],
    adminPermissions: [],
    superAdmin: false,
  };

  it("allows an owned customer mutation and rejects cross-customer and cross-vendor IDs with audit evidence", async () => {
    const append = vi.fn();
    await expect(authorizeOrThrow({
      actor,
      request: { scope: "customer", customerId: "customer-1" },
      audit: { append },
      requestId: "request-owned",
      action: "customer.profile.update",
    })).resolves.toBeUndefined();

    for (const request of [
      { scope: "customer", customerId: "customer-2" } as const,
      { scope: "vendor", vendorId: "vendor-2", permission: "vendor:bookings:read" } as const,
    ]) {
      await expect(authorizeOrThrow({
        actor,
        request,
        audit: { append },
        requestId: "request-cross-tenant",
        action: "tenant.resource.read",
      })).rejects.toBeInstanceOf(AuthorizationDeniedError);
    }
    expect(append).toHaveBeenCalledTimes(2);
    expect(append).toHaveBeenCalledWith(expect.objectContaining({ outcome: "DENIED", requestId: "request-cross-tenant" }));
  });
});
