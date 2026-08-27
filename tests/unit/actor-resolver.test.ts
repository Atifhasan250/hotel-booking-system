import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { ActorResolver } from "../../src/modules/identity/application/actor-resolver";
import type { ActorGrantRepository, SessionRepository, UserRepository } from "../../src/modules/identity/application/ports";
import type { Session, User } from "../../src/modules/identity/domain/model";

const now = new Date("2026-08-27T10:00:00.000Z");
const rawToken = "opaque-session-token";
const tokenHash = createHash("sha256").update(rawToken).digest("base64url");
const user: User = {
  id: "user-1",
  publicId: "public-user-1",
  displayName: "Amina",
  normalizedEmail: "amina@example.com",
  passwordHash: "irrelevant",
  status: "ACTIVE",
  createdAt: now,
  updatedAt: now,
};
const session: Session = {
  id: "session-1",
  userId: user.id,
  tokenHash,
  familyId: "family-1",
  expiresAt: new Date(now.getTime() + 60_000),
  createdAt: now,
  lastSeenAt: now,
  securityMetadata: {},
};

function resolverWith(overrides: { session?: Session | null; user?: User | null } = {}) {
  const sessions = {
    findActiveByTokenHash: async () => overrides.session === undefined ? session : overrides.session,
  } as unknown as SessionRepository;
  const users = {
    findById: async () => overrides.user === undefined ? user : overrides.user,
  } as unknown as UserRepository;
  const grants: ActorGrantRepository = {
    loadForUser: async () => ({
      vendorMemberships: [{ vendorId: "vendor-1", role: "OWNER", permissions: [], status: "ACTIVE" }],
      adminPermissions: ["admin:marketplace:read"],
      superAdmin: false,
    }),
  };
  return new ActorResolver(sessions, users, grants);
}

describe("actor resolver", () => {
  it("loads current grants server-side instead of trusting cookie claims", async () => {
    await expect(resolverWith().resolve(rawToken, now)).resolves.toEqual(expect.objectContaining({
      userId: "user-1",
      vendorMemberships: [expect.objectContaining({ vendorId: "vendor-1" })],
      adminPermissions: ["admin:marketplace:read"],
    }));
  });

  it("rejects missing/revoked sessions and suspended users", async () => {
    await expect(resolverWith({ session: null }).resolve(rawToken, now)).resolves.toBeNull();
    await expect(resolverWith({ user: { ...user, status: "SUSPENDED" } }).resolve(rawToken, now)).resolves.toBeNull();
    await expect(resolverWith().resolve(undefined, now)).resolves.toBeNull();
  });
});
