import type { AuditEventWriter } from "../../audit/domain/audit-event";
import type { ActorContext, AdminPermission, VendorPermission } from "../domain/model";

export type AuthorizationRequest =
  | { scope: "customer"; customerId: string }
  | { scope: "vendor"; vendorId: string; permission: VendorPermission }
  | { scope: "admin"; permission: AdminPermission }
  | { scope: "super-admin" };

export class AuthorizationDeniedError extends Error {
  constructor() {
    super("Authorization denied");
    this.name = "AuthorizationDeniedError";
  }
}

export function isAuthorized(actor: ActorContext | null, request: AuthorizationRequest): boolean {
  if (!actor) return false;
  if (request.scope === "customer") return actor.customerId === request.customerId;
  if (request.scope === "super-admin") return actor.superAdmin;
  if (request.scope === "admin") {
    return actor.superAdmin || actor.adminPermissions.includes(request.permission);
  }

  const membership = actor.vendorMemberships.find(
    (entry) => entry.vendorId === request.vendorId && entry.status === "ACTIVE",
  );
  if (!membership) return false;
  if (membership.role === "OWNER") return true;
  return membership.permissions.includes(request.permission);
}

export async function authorizeOrThrow(input: {
  actor: ActorContext | null;
  request: AuthorizationRequest;
  audit: AuditEventWriter;
  requestId: string;
  action: string;
}): Promise<void> {
  const allowed = isAuthorized(input.actor, input.request);
  if (!allowed) {
    await input.audit.append({
      id: crypto.randomUUID(),
      actorId: input.actor?.userId ?? "anonymous",
      action: input.action,
      targetType: input.request.scope,
      targetId:
        input.request.scope === "customer"
          ? input.request.customerId
          : input.request.scope === "vendor"
            ? input.request.vendorId
            : undefined,
      outcome: "DENIED",
      requestId: input.requestId,
      occurredAt: new Date(),
      metadata: {},
    });
    throw new AuthorizationDeniedError();
  }
}
