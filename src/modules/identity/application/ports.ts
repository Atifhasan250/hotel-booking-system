import type { AuditEventWriter } from "../../audit/domain/audit-event";
import type {
  AdminPermission,
  IdentityToken,
  IdentityTokenPurpose,
  Session,
  User,
  VendorMembership,
} from "../domain/model";

export interface UserRepository {
  findByNormalizedEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  createIfAbsent(user: User): Promise<{ user: User; created: boolean }>;
  markContactVerified(userId: string, at: Date): Promise<boolean>;
  replacePassword(userId: string, passwordHash: string, at: Date): Promise<boolean>;
}

export interface SessionRepository {
  create(session: Session): Promise<void>;
  findActiveByTokenHash(tokenHash: string, now: Date): Promise<Session | null>;
  rotate(currentId: string, replacement: Session, at: Date): Promise<boolean>;
  revokeByTokenHash(tokenHash: string, at: Date): Promise<boolean>;
  revokeAllForUser(userId: string, at: Date): Promise<number>;
}

export interface IdentityTokenRepository {
  replaceActive(token: IdentityToken): Promise<void>;
  consume(tokenHash: string, purpose: IdentityTokenPurpose, now: Date): Promise<IdentityToken | null>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
}

export interface SecretTokenFactory {
  create(): { raw: string; hash: string };
}

export interface IdFactory {
  create(): string;
}

export interface Clock {
  now(): Date;
}

export interface IdentityMessagePort {
  queuePasswordResetRequest(input: { email: string; requestedAt: Date }): Promise<void>;
  sendContactVerification(input: { email: string; token: string; expiresAt: Date }): Promise<void>;
  sendPasswordReset(input: { email: string; token: string; expiresAt: Date }): Promise<void>;
}

export interface RateLimiter {
  consume(key: string, limit: number, windowSeconds: number): Promise<boolean>;
}

export interface TransactionRunner {
  run<T>(work: () => Promise<T>): Promise<T>;
}

export interface ActorGrantRepository {
  loadForUser(userId: string): Promise<{
    vendorMemberships: VendorMembership[];
    adminPermissions: AdminPermission[];
    superAdmin: boolean;
  }>;
}

export interface IdentityDependencies {
  users: UserRepository;
  sessions: SessionRepository;
  tokens: IdentityTokenRepository;
  passwordHasher: PasswordHasher;
  tokenFactory: SecretTokenFactory;
  ids: IdFactory;
  clock: Clock;
  messages: IdentityMessagePort;
  rateLimiter: RateLimiter;
  audit: AuditEventWriter;
  transactions: TransactionRunner;
}
