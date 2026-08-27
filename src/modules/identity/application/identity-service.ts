import type { AuditOutcome } from "../../audit/domain/audit-event";
import type { Session, User } from "../domain/model";
import {
  emailInputSchema,
  loginInputSchema,
  normalizeEmail,
  registerInputSchema,
  resetPasswordInputSchema,
  tokenInputSchema,
  type LoginInput,
  type RegisterInput,
  type ResetPasswordInput,
} from "../domain/schemas";
import { AuthenticationError, InvalidIdentityTokenError, RateLimitError } from "./errors";
import type { IdentityDependencies } from "./ports";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const IDENTITY_TOKEN_TTL_MS = 1000 * 60 * 30;

export interface RequestSecurityContext {
  requestId: string;
  abuseKey: string;
  userAgentHash?: string;
  ipHash?: string;
}

export class IdentityService {
  constructor(private readonly deps: IdentityDependencies) {}

  async register(rawInput: RegisterInput, context: RequestSecurityContext): Promise<{ userId: string; created: boolean }> {
    const input = registerInputSchema.parse(rawInput);
    const now = this.deps.clock.now();
    const normalizedEmail = normalizeEmail(input.email);
    await this.enforceSubjectLimits("register", normalizedEmail, 5, 3600, context, "identity.register");
    const user: User = {
      id: this.deps.ids.create(),
      publicId: this.deps.ids.create(),
      displayName: input.displayName,
      normalizedEmail,
      passwordHash: await this.deps.passwordHasher.hash(input.password),
      status: "PENDING_VERIFICATION",
      createdAt: now,
      updatedAt: now,
    };

    return this.deps.transactions.run(async () => {
      const result = await this.deps.users.createIfAbsent(user);
      if (result.user.status === "PENDING_VERIFICATION") {
        await this.issueToken(result.user, "VERIFY_CONTACT");
      }
      await this.audit("identity.register", result.user.id, "SUCCESS", context, { created: result.created }, result.user.id);
      return { userId: result.user.publicId, created: result.created };
    });
  }

  async login(rawInput: LoginInput, context: RequestSecurityContext): Promise<{ sessionToken: string; expiresAt: Date }> {
    const input = loginInputSchema.parse(rawInput);
    const normalizedEmail = normalizeEmail(input.email);
    await this.enforceSubjectLimits("login", normalizedEmail, 10, 900, context, "identity.login");
    const user = await this.deps.users.findByNormalizedEmail(normalizedEmail);
    let passwordValid = false;
    if (user) {
      passwordValid = await this.deps.passwordHasher.verify(user.passwordHash, input.password);
    } else {
      await this.deps.passwordHasher.hash(input.password);
    }

    if (!user || !passwordValid || user.status !== "ACTIVE") {
      await this.deps.transactions.run(() =>
        this.audit("identity.login", user?.id, "DENIED", context, { reason: "invalid_credentials" }, "anonymous"),
      );
      throw new AuthenticationError();
    }

    return this.deps.transactions.run(async () => {
      const result = await this.createSession(user.id, context);
      await this.audit("identity.login", user.id, "SUCCESS", context, {}, user.id);
      return result;
    });
  }

  async rotateSession(rawToken: string, context: RequestSecurityContext): Promise<{ sessionToken: string; expiresAt: Date }> {
    const currentHash = this.hashRawToken(rawToken);
    const now = this.deps.clock.now();
    const outcome = await this.deps.transactions.run(async () => {
      const current = await this.deps.sessions.findActiveByTokenHash(currentHash, now);
      if (!current) {
        await this.audit("identity.session.rotate", undefined, "DENIED", context, { reason: "invalid_session" }, "anonymous");
        return null;
      }
      const token = this.deps.tokenFactory.create();
      const replacement = this.sessionRecord(current.userId, current.familyId, token.hash, context, now);
      if (!(await this.deps.sessions.rotate(current.id, replacement, now))) {
        await this.audit("identity.session.rotate", current.userId, "DENIED", context, { reason: "replay" }, current.userId);
        return null;
      }
      await this.audit("identity.session.rotate", current.userId, "SUCCESS", context, {}, current.userId);
      return { sessionToken: token.raw, expiresAt: replacement.expiresAt };
    });
    if (!outcome) throw new AuthenticationError();
    return outcome;
  }

  async logout(rawToken: string, context: RequestSecurityContext): Promise<void> {
    await this.deps.transactions.run(async () => {
      const now = this.deps.clock.now();
      const tokenHash = this.hashRawToken(rawToken);
      const current = await this.deps.sessions.findActiveByTokenHash(tokenHash, now);
      const revoked = await this.deps.sessions.revokeByTokenHash(tokenHash, now);
      await this.audit("identity.logout", current?.userId, "SUCCESS", context, { revoked }, current?.userId ?? "anonymous");
    });
  }

  async requestPasswordReset(rawEmail: string, context: RequestSecurityContext): Promise<void> {
    const { email } = emailInputSchema.parse({ email: rawEmail });
    const normalizedEmail = normalizeEmail(email);
    await this.enforceSubjectLimits("recover", normalizedEmail, 5, 3600, context, "identity.password-reset.request");
    await this.deps.transactions.run(async () => {
      await this.deps.messages.queuePasswordResetRequest({ email: normalizedEmail, requestedAt: this.deps.clock.now() });
      await this.audit("identity.password-reset.request", undefined, "SUCCESS", context, { accepted: true }, "anonymous");
    });
  }

  async resetPassword(rawInput: ResetPasswordInput, context: RequestSecurityContext): Promise<void> {
    const input = resetPasswordInputSchema.parse(rawInput);
    await this.enforceSubjectLimits("reset", this.hashRawToken(input.token), 10, 3600, context, "identity.password-reset.complete");
    const now = this.deps.clock.now();
    const passwordHash = await this.deps.passwordHasher.hash(input.password);
    const changed = await this.deps.transactions.run(async () => {
      const token = await this.deps.tokens.consume(this.hashRawToken(input.token), "RESET_PASSWORD", now);
      if (!token) {
        await this.audit("identity.password-reset.complete", undefined, "DENIED", context, { reason: "invalid_token" }, "anonymous");
        return false;
      }
      if (!(await this.deps.users.replacePassword(token.userId, passwordHash, now))) {
        await this.audit("identity.password-reset.complete", token.userId, "FAILURE", context, { reason: "user_unavailable" }, token.userId);
        return false;
      }
      await this.deps.sessions.revokeAllForUser(token.userId, now);
      await this.audit("identity.password-reset.complete", token.userId, "SUCCESS", context, {}, token.userId);
      return true;
    });
    if (!changed) throw new InvalidIdentityTokenError();
  }

  async verifyContact(rawToken: string, context: RequestSecurityContext): Promise<void> {
    const { token: validatedToken } = tokenInputSchema.parse({ token: rawToken });
    await this.enforceSubjectLimits("verify", this.hashRawToken(validatedToken), 20, 3600, context, "identity.contact.verify");
    const now = this.deps.clock.now();
    const verified = await this.deps.transactions.run(async () => {
      const token = await this.deps.tokens.consume(this.hashRawToken(validatedToken), "VERIFY_CONTACT", now);
      if (!token) {
        await this.audit("identity.contact.verify", undefined, "DENIED", context, { reason: "invalid_token" }, "anonymous");
        return false;
      }
      if (!(await this.deps.users.markContactVerified(token.userId, now))) {
        await this.audit("identity.contact.verify", token.userId, "FAILURE", context, { reason: "user_unavailable" }, token.userId);
        return false;
      }
      await this.audit("identity.contact.verify", token.userId, "SUCCESS", context, {}, token.userId);
      return true;
    });
    if (!verified) throw new InvalidIdentityTokenError();
  }

  private async createSession(userId: string, context: RequestSecurityContext) {
    const now = this.deps.clock.now();
    const token = this.deps.tokenFactory.create();
    const session = this.sessionRecord(userId, this.deps.ids.create(), token.hash, context, now);
    await this.deps.sessions.create(session);
    return { sessionToken: token.raw, expiresAt: session.expiresAt };
  }

  private sessionRecord(
    userId: string,
    familyId: string,
    tokenHash: string,
    context: RequestSecurityContext,
    now: Date,
  ): Session {
    return {
      id: this.deps.ids.create(),
      userId,
      tokenHash,
      familyId,
      createdAt: now,
      lastSeenAt: now,
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
      securityMetadata: { userAgentHash: context.userAgentHash, ipHash: context.ipHash },
    };
  }

  private async issueToken(user: User, purpose: "VERIFY_CONTACT" | "RESET_PASSWORD"): Promise<void> {
    const now = this.deps.clock.now();
    const secret = this.deps.tokenFactory.create();
    const expiresAt = new Date(now.getTime() + IDENTITY_TOKEN_TTL_MS);
    await this.deps.tokens.replaceActive({
      id: this.deps.ids.create(),
      userId: user.id,
      purpose,
      tokenHash: secret.hash,
      expiresAt,
      createdAt: now,
    });
    if (purpose === "VERIFY_CONTACT") {
      await this.deps.messages.sendContactVerification({ email: user.normalizedEmail, token: secret.raw, expiresAt });
    } else {
      await this.deps.messages.sendPasswordReset({ email: user.normalizedEmail, token: secret.raw, expiresAt });
    }
  }

  private hashRawToken(rawToken: string): string {
    return createHash("sha256").update(rawToken).digest("base64url");
  }

  private async enforceRateLimit(
    key: string,
    limit: number,
    windowSeconds: number,
    context: RequestSecurityContext,
    action: string,
  ): Promise<void> {
    const allowed = await this.deps.transactions.run(async () => {
      if (await this.deps.rateLimiter.consume(key, limit, windowSeconds)) return true;
      await this.audit(action, undefined, "DENIED", context, { reason: "rate_limited" }, "anonymous");
      return false;
    });
    if (!allowed) throw new RateLimitError();
  }

  private async enforceSubjectLimits(
    operation: string,
    subject: string,
    subjectLimit: number,
    subjectWindowSeconds: number,
    context: RequestSecurityContext,
    action: string,
  ): Promise<void> {
    await this.enforceRateLimit(`${operation}:global`, 300, 60, context, action);
    await this.enforceRateLimit(
      `${operation}:subject:${createHash("sha256").update(subject).digest("base64url")}`,
      subjectLimit,
      subjectWindowSeconds,
      context,
      action,
    );
  }

  private async audit(
    action: string,
    targetId: string | undefined,
    outcome: AuditOutcome,
    context: RequestSecurityContext,
    metadata: Record<string, string | number | boolean> = {},
    actorId = "anonymous",
  ): Promise<void> {
    await this.deps.audit.append({
      id: this.deps.ids.create(),
      actorId,
      action,
      targetType: "user",
      targetId,
      outcome,
      requestId: context.requestId,
      occurredAt: this.deps.clock.now(),
      metadata,
    });
  }
}

import { createHash } from "node:crypto";
