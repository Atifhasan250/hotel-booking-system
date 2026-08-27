import { createHash } from "node:crypto";

import type { ActorContext } from "../domain/model";
import type { ActorGrantRepository, SessionRepository, UserRepository } from "./ports";

export class ActorResolver {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly users: UserRepository,
    private readonly grants: ActorGrantRepository,
  ) {}

  async resolve(rawSessionToken: string | undefined, now: Date): Promise<ActorContext | null> {
    if (!rawSessionToken) return null;
    const tokenHash = createHash("sha256").update(rawSessionToken).digest("base64url");
    const session = await this.sessions.findActiveByTokenHash(tokenHash, now);
    if (!session) return null;
    const user = await this.users.findById(session.userId);
    if (!user || user.status !== "ACTIVE") return null;
    const grants = await this.grants.loadForUser(user.id);
    return {
      userId: user.id,
      customerId: user.id,
      vendorMemberships: grants.vendorMemberships,
      adminPermissions: grants.adminPermissions,
      superAdmin: grants.superAdmin,
    };
  }
}
