import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";

import type { AuditEvent, AuditEventWriter } from "../../src/modules/audit/domain/audit-event";
import { AuthenticationError, InvalidIdentityTokenError, RateLimitError } from "../../src/modules/identity/application/errors";
import { IdentityService, type RequestSecurityContext } from "../../src/modules/identity/application/identity-service";
import type {
  IdentityMessagePort,
  IdentityTokenRepository,
  PasswordHasher,
  RateLimiter,
  SessionRepository,
  UserRepository,
} from "../../src/modules/identity/application/ports";
import type { IdentityToken, IdentityTokenPurpose, Session, User } from "../../src/modules/identity/domain/model";

const hashToken = (raw: string) => createHash("sha256").update(raw).digest("base64url");

class MemoryUsers implements UserRepository {
  records = new Map<string, User>();
  emailLookupCount = 0;
  async findByNormalizedEmail(email: string) {
    this.emailLookupCount += 1;
    return [...this.records.values()].find((user) => user.normalizedEmail === email) ?? null;
  }
  async findById(id: string) { return this.records.get(id) ?? null; }
  async createIfAbsent(user: User) {
    const existing = await this.findByNormalizedEmail(user.normalizedEmail);
    if (existing) return { user: existing, created: false };
    this.records.set(user.id, user);
    return { user, created: true };
  }
  async markContactVerified(userId: string, at: Date) {
    const user = this.records.get(userId);
    if (!user || user.status !== "PENDING_VERIFICATION") return false;
    this.records.set(userId, { ...user, status: "ACTIVE", contactVerifiedAt: at, updatedAt: at });
    return true;
  }
  async replacePassword(userId: string, passwordHash: string, at: Date) {
    const user = this.records.get(userId);
    if (!user || user.status === "SUSPENDED") return false;
    this.records.set(userId, { ...user, passwordHash, updatedAt: at });
    return true;
  }
}

class MemorySessions implements SessionRepository {
  records = new Map<string, Session>();
  async create(session: Session) { this.records.set(session.id, session); }
  async findActiveByTokenHash(tokenHash: string, now: Date) {
    return [...this.records.values()].find((item) => item.tokenHash === tokenHash && !item.revokedAt && item.expiresAt > now) ?? null;
  }
  async rotate(currentId: string, replacement: Session, at: Date) {
    const current = this.records.get(currentId);
    if (!current || current.revokedAt || current.expiresAt <= at) return false;
    this.records.set(currentId, { ...current, revokedAt: at, replacedById: replacement.id });
    this.records.set(replacement.id, replacement);
    return true;
  }
  async revokeByTokenHash(tokenHash: string, at: Date) {
    const current = [...this.records.values()].find((item) => item.tokenHash === tokenHash && !item.revokedAt);
    if (!current) return false;
    this.records.set(current.id, { ...current, revokedAt: at });
    return true;
  }
  async revokeAllForUser(userId: string, at: Date) {
    let count = 0;
    for (const session of this.records.values()) {
      if (session.userId === userId && !session.revokedAt) {
        this.records.set(session.id, { ...session, revokedAt: at });
        count += 1;
      }
    }
    return count;
  }
}

class MemoryTokens implements IdentityTokenRepository {
  records = new Map<string, IdentityToken>();
  async replaceActive(token: IdentityToken) {
    for (const current of this.records.values()) {
      if (current.userId === token.userId && current.purpose === token.purpose && !current.consumedAt) {
        this.records.set(current.id, { ...current, consumedAt: token.createdAt });
      }
    }
    this.records.set(token.id, token);
  }
  async consume(tokenHash: string, purpose: IdentityTokenPurpose, now: Date) {
    const token = [...this.records.values()].find((item) => item.tokenHash === tokenHash && item.purpose === purpose && !item.consumedAt && item.expiresAt > now);
    if (!token) return null;
    const consumed = { ...token, consumedAt: now };
    this.records.set(token.id, consumed);
    return consumed;
  }
}

class FakePasswords implements PasswordHasher {
  hashed: string[] = [];
  async hash(password: string) { this.hashed.push(password); return `hash:${password}`; }
  async verify(hash: string, password: string) { return hash === `hash:${password}`; }
}

class CapturingMessages implements IdentityMessagePort {
  verification?: { email: string; token: string; expiresAt: Date };
  reset?: { email: string; token: string; expiresAt: Date };
  recoveryRequests: string[] = [];
  async queuePasswordResetRequest(input: { email: string }) { this.recoveryRequests.push(input.email); }
  async sendContactVerification(input: { email: string; token: string; expiresAt: Date }) { this.verification = input; }
  async sendPasswordReset(input: { email: string; token: string; expiresAt: Date }) { this.reset = input; }
}

class MemoryRateLimiter implements RateLimiter {
  allowed = true;
  async consume() { return this.allowed; }
}

class MemoryAudit implements AuditEventWriter {
  events: AuditEvent[] = [];
  failAction?: string;
  async append(event: AuditEvent) {
    if (this.failAction === event.action) throw new Error("simulated audit failure");
    this.events.push(event);
  }
}

class MemoryTransactions {
  constructor(
    private readonly users: MemoryUsers,
    private readonly sessions: MemorySessions,
    private readonly tokens: MemoryTokens,
    private readonly audit: MemoryAudit,
  ) {}

  async run<T>(work: () => Promise<T>): Promise<T> {
    const userSnapshot = structuredClone(this.users.records);
    const sessionSnapshot = structuredClone(this.sessions.records);
    const tokenSnapshot = structuredClone(this.tokens.records);
    const auditSnapshot = structuredClone(this.audit.events);
    try {
      return await work();
    } catch (error) {
      this.users.records = userSnapshot;
      this.sessions.records = sessionSnapshot;
      this.tokens.records = tokenSnapshot;
      this.audit.events = auditSnapshot;
      throw error;
    }
  }
}

describe("identity lifecycle integration", () => {
  let users: MemoryUsers;
  let sessions: MemorySessions;
  let tokens: MemoryTokens;
  let messages: CapturingMessages;
  let limiter: MemoryRateLimiter;
  let audit: MemoryAudit;
  let passwords: FakePasswords;
  let service: IdentityService;
  let id = 0;
  let now: Date;
  const context: RequestSecurityContext = { requestId: "request-123", abuseKey: "ip-hash" };

  beforeEach(() => {
    users = new MemoryUsers();
    sessions = new MemorySessions();
    tokens = new MemoryTokens();
    messages = new CapturingMessages();
    limiter = new MemoryRateLimiter();
    audit = new MemoryAudit();
    passwords = new FakePasswords();
    now = new Date("2026-08-27T10:00:00.000Z");
    id = 0;
    service = new IdentityService({
      users,
      sessions,
      tokens,
      messages,
      rateLimiter: limiter,
      audit,
      passwordHasher: passwords,
      ids: { create: () => `id-${++id}` },
      clock: { now: () => now },
      transactions: new MemoryTransactions(users, sessions, tokens, audit),
      tokenFactory: {
        create: () => {
          const raw = `token-${String(++id).padStart(32, "x")}`;
          return { raw, hash: hashToken(raw) };
        },
      },
    });
  });

  it("registers idempotently, verifies once, signs in, rotates, and revokes a session", async () => {
    const input = { displayName: "Amina Rahman", email: " AMINA@Example.com ", password: "StrongPassword!42" };
    const created = await service.register(input, context);
    const retried = await service.register(input, context);
    expect(created.created).toBe(true);
    expect(retried).toEqual({ userId: created.userId, created: false });
    expect(users.records).toHaveLength(1);
    expect(messages.verification?.email).toBe("amina@example.com");

    await expect(service.login({ email: input.email, password: input.password }, context)).rejects.toBeInstanceOf(AuthenticationError);
    await service.verifyContact(messages.verification!.token, context);
    await expect(service.verifyContact(messages.verification!.token, context)).rejects.toBeInstanceOf(InvalidIdentityTokenError);

    const login = await service.login({ email: input.email, password: input.password }, context);
    expect(login.sessionToken).not.toContain("hash");
    expect([...sessions.records.values()][0].tokenHash).toBe(hashToken(login.sessionToken));
    const rotated = await service.rotateSession(login.sessionToken, context);
    await expect(service.rotateSession(login.sessionToken, context)).rejects.toBeInstanceOf(AuthenticationError);
    await service.logout(rotated.sessionToken, context);
    await expect(service.rotateSession(rotated.sessionToken, context)).rejects.toBeInstanceOf(AuthenticationError);
    expect(audit.events.map((event) => event.action)).toContain("identity.session.rotate");
    expect(audit.events.every((event) => event.actorId.length > 0)).toBe(true);
    expect(audit.events.find((event) => event.action === "identity.logout")).toEqual(
      expect.objectContaining({ actorId: expect.stringMatching(/^id-/), targetId: expect.stringMatching(/^id-/) }),
    );
  });

  it("keeps recovery enumeration-safe, consumes reset once, and revokes every session", async () => {
    await service.register({ displayName: "Amina Rahman", email: "amina@example.com", password: "StrongPassword!42" }, context);
    await service.verifyContact(messages.verification!.token, context);
    const login = await service.login({ email: "amina@example.com", password: "StrongPassword!42" }, context);
    users.emailLookupCount = 0;
    await service.requestPasswordReset("missing@example.com", context);
    await service.requestPasswordReset("amina@example.com", context);
    expect(messages.recoveryRequests).toEqual(["missing@example.com", "amina@example.com"]);
    expect(users.emailLookupCount).toBe(0);
    await seedResetToken("reset-token-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");

    await service.resetPassword({ token: messages.reset!.token, password: "NewStrongPassword!43" }, context);
    await expect(service.resetPassword({ token: messages.reset!.token, password: "AnotherPassword!44" }, context)).rejects.toBeInstanceOf(InvalidIdentityTokenError);
    await expect(service.rotateSession(login.sessionToken, context)).rejects.toBeInstanceOf(AuthenticationError);
    await expect(service.login({ email: "amina@example.com", password: "StrongPassword!42" }, context)).rejects.toBeInstanceOf(AuthenticationError);
    await expect(service.login({ email: "amina@example.com", password: "NewStrongPassword!43" }, context)).resolves.toBeDefined();
  });

  it("rejects abusive requests before mutation", async () => {
    limiter.allowed = false;
    await expect(service.register({ displayName: "Amina Rahman", email: "amina@example.com", password: "StrongPassword!42" }, context)).rejects.toBeInstanceOf(RateLimitError);
    expect(users.records).toHaveLength(0);
  });

  it("performs memory-hard-equivalent password work for an unknown account", async () => {
    await expect(service.login({ email: "missing@example.com", password: "StrongPassword!42" }, context)).rejects.toBeInstanceOf(AuthenticationError);
    expect(passwords.hashed).toContain("StrongPassword!42");
  });

  it("rolls back password, token, session, and audit state together when the audit append fails", async () => {
    await service.register({ displayName: "Amina Rahman", email: "amina@example.com", password: "StrongPassword!42" }, context);
    await service.verifyContact(messages.verification!.token, context);
    const login = await service.login({ email: "amina@example.com", password: "StrongPassword!42" }, context);
    await service.requestPasswordReset("amina@example.com", context);
    await seedResetToken("reset-token-yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy");
    audit.failAction = "identity.password-reset.complete";

    await expect(service.resetPassword({ token: messages.reset!.token, password: "NewStrongPassword!43" }, context)).rejects.toThrow("simulated audit failure");
    audit.failAction = undefined;

    await expect(service.rotateSession(login.sessionToken, context)).resolves.toBeDefined();
    await expect(service.login({ email: "amina@example.com", password: "StrongPassword!42" }, context)).resolves.toBeDefined();
    await expect(service.resetPassword({ token: messages.reset!.token, password: "NewStrongPassword!43" }, context)).resolves.toBeUndefined();
  });

  async function seedResetToken(raw: string) {
    const user = [...users.records.values()][0];
    messages.reset = { email: user.normalizedEmail, token: raw, expiresAt: new Date(now.getTime() + 60_000) };
    await tokens.replaceActive({
      id: `reset-${raw.slice(-4)}`,
      userId: user.id,
      purpose: "RESET_PASSWORD",
      tokenHash: hashToken(raw),
      createdAt: now,
      expiresAt: messages.reset.expiresAt,
    });
  }
});
