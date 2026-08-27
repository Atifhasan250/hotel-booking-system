import "server-only";

import type { Collection, Db } from "mongodb";

import type { AuditEvent, AuditEventWriter } from "../../audit/domain/audit-event";
import type {
  ActorGrantRepository,
  IdentityTokenRepository,
  RateLimiter,
  SessionRepository,
  UserRepository,
} from "../application/ports";
import type { IdentityToken, IdentityTokenPurpose, Session, User } from "../domain/model";
import type { AdminPermission, VendorMembership, VendorPermission, VendorRole } from "../domain/model";
import type { MongoTransactionRunner } from "../../../platform/db/mongo-transaction";

type Stored<T> = Omit<T, "id"> & { _id: string; schemaVersion: 1 };

function fromStored<T extends { id: string }>(document: Stored<T>): T {
  const { _id, schemaVersion: _schemaVersion, ...rest } = document;
  void _schemaVersion;
  return { ...rest, id: _id } as unknown as T;
}

function toStored<T extends { id: string }>(value: T): Stored<T> {
  const { id, ...rest } = value;
  return { ...rest, _id: id, schemaVersion: 1 } as Stored<T>;
}

export class MongoUserRepository implements UserRepository {
  private readonly collection: Collection<Stored<User>>;

  constructor(db: Db, private readonly transactions: MongoTransactionRunner) {
    this.collection = db.collection<Stored<User>>("users");
  }

  async findByNormalizedEmail(email: string): Promise<User | null> {
    const result = await this.collection.findOne({ normalizedEmail: email }, { session: this.transactions.current() });
    return result ? fromStored<User>(result) : null;
  }

  async findById(id: string): Promise<User | null> {
    const result = await this.collection.findOne({ _id: id }, { session: this.transactions.current() });
    return result ? fromStored<User>(result) : null;
  }

  async createIfAbsent(user: User): Promise<{ user: User; created: boolean }> {
    const stored = toStored(user);
    const result = await this.collection.findOneAndUpdate(
      { normalizedEmail: user.normalizedEmail },
      { $setOnInsert: stored },
      { upsert: true, returnDocument: "after", includeResultMetadata: true, session: this.transactions.current() },
    );
    if (!result.value) throw new Error("User upsert did not return a document");
    return { user: fromStored<User>(result.value), created: result.lastErrorObject?.upserted !== undefined };
  }

  async markContactVerified(userId: string, at: Date): Promise<boolean> {
    const result = await this.collection.updateOne(
      { _id: userId, status: "PENDING_VERIFICATION" },
      { $set: { status: "ACTIVE", contactVerifiedAt: at, updatedAt: at } },
      { session: this.transactions.current() },
    );
    return result.modifiedCount === 1;
  }

  async replacePassword(userId: string, passwordHash: string, at: Date): Promise<boolean> {
    const result = await this.collection.updateOne(
      { _id: userId, status: { $ne: "SUSPENDED" } },
      { $set: { passwordHash, updatedAt: at } },
      { session: this.transactions.current() },
    );
    return result.modifiedCount === 1;
  }
}

export class MongoSessionRepository implements SessionRepository {
  private readonly collection: Collection<Stored<Session>>;

  constructor(db: Db, private readonly transactions: MongoTransactionRunner) {
    this.collection = db.collection<Stored<Session>>("sessions");
  }

  async create(session: Session): Promise<void> {
    await this.collection.insertOne(toStored(session), { session: this.transactions.current() });
  }

  async findActiveByTokenHash(tokenHash: string, now: Date): Promise<Session | null> {
    const result = await this.collection.findOne(
      { tokenHash, revokedAt: { $exists: false }, expiresAt: { $gt: now } },
      { session: this.transactions.current() },
    );
    return result ? fromStored<Session>(result) : null;
  }

  async rotate(currentId: string, replacement: Session, at: Date): Promise<boolean> {
    return this.transactions.run(async () => {
        const current = await this.collection.updateOne(
          { _id: currentId, revokedAt: { $exists: false }, expiresAt: { $gt: at } },
          { $set: { revokedAt: at, replacedById: replacement.id } },
          { session: this.transactions.current() },
        );
        if (current.modifiedCount !== 1) return false;
        await this.collection.insertOne(toStored(replacement), { session: this.transactions.current() });
        return true;
    });
  }

  async revokeByTokenHash(tokenHash: string, at: Date): Promise<boolean> {
    const result = await this.collection.updateOne(
      { tokenHash, revokedAt: { $exists: false } },
      { $set: { revokedAt: at } },
      { session: this.transactions.current() },
    );
    return result.modifiedCount === 1;
  }

  async revokeAllForUser(userId: string, at: Date): Promise<number> {
    const result = await this.collection.updateMany(
      { userId, revokedAt: { $exists: false } },
      { $set: { revokedAt: at } },
      { session: this.transactions.current() },
    );
    return result.modifiedCount;
  }
}

export class MongoIdentityTokenRepository implements IdentityTokenRepository {
  private readonly collection: Collection<Stored<IdentityToken>>;

  constructor(db: Db, private readonly transactions: MongoTransactionRunner) {
    this.collection = db.collection<Stored<IdentityToken>>("identityTokens");
  }

  async replaceActive(token: IdentityToken): Promise<void> {
    await this.transactions.run(async () => {
        await this.collection.updateMany(
          { userId: token.userId, purpose: token.purpose, consumedAt: { $exists: false } },
          { $set: { consumedAt: token.createdAt } },
          { session: this.transactions.current() },
        );
        await this.collection.insertOne(toStored(token), { session: this.transactions.current() });
    });
  }

  async consume(tokenHash: string, purpose: IdentityTokenPurpose, now: Date): Promise<IdentityToken | null> {
    const result = await this.collection.findOneAndUpdate(
      { tokenHash, purpose, consumedAt: { $exists: false }, expiresAt: { $gt: now } },
      { $set: { consumedAt: now } },
      { returnDocument: "after", session: this.transactions.current() },
    );
    return result ? fromStored<IdentityToken>(result) : null;
  }
}

type StoredAuditEvent = Stored<AuditEvent>;

export class MongoAuditEventWriter implements AuditEventWriter {
  private readonly collection: Collection<StoredAuditEvent>;

  constructor(db: Db, private readonly transactions: MongoTransactionRunner) {
    this.collection = db.collection<StoredAuditEvent>("auditEvents");
  }

  async append(event: AuditEvent): Promise<void> {
    await this.collection.insertOne(toStored(event), { session: this.transactions.current() });
  }
}

interface RateLimitBucket {
  _id: string;
  count: number;
  expiresAt: Date;
}

export class MongoRateLimiter implements RateLimiter {
  private readonly collection: Collection<RateLimitBucket>;

  constructor(db: Db, private readonly transactions: MongoTransactionRunner) {
    this.collection = db.collection<RateLimitBucket>("rateLimitBuckets");
  }

  async consume(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + windowSeconds * 1000);
    const existing = await this.collection.findOneAndUpdate(
      { _id: key, expiresAt: { $gt: now }, count: { $lt: limit } },
      { $inc: { count: 1 } },
      { returnDocument: "after", session: this.transactions.current() },
    );
    if (existing) return true;

    const reset = await this.collection.updateOne(
      { _id: key, $or: [{ expiresAt: { $lte: now } }, { expiresAt: { $exists: false } }] },
      { $set: { count: 1, expiresAt } },
      { upsert: true, session: this.transactions.current() },
    ).catch((error: unknown) => {
      if (typeof error === "object" && error && "code" in error && error.code === 11000) return null;
      throw error;
    });
    if (reset !== null) return reset.modifiedCount === 1 || reset.upsertedCount === 1;
    const raced = await this.collection.findOneAndUpdate(
      { _id: key, expiresAt: { $gt: now }, count: { $lt: limit } },
      { $inc: { count: 1 } },
      { returnDocument: "after", session: this.transactions.current() },
    );
    return raced !== null;
  }
}

interface StoredVendorMembership {
  _id: string;
  schemaVersion: 1;
  userId: string;
  vendorId: string;
  role: VendorRole;
  permissions: VendorPermission[];
  status: "ACTIVE" | "SUSPENDED";
}

interface StoredAdminRoleBinding {
  _id: string;
  schemaVersion: 1;
  userId: string;
  permissions: AdminPermission[];
  superAdmin: boolean;
  status: "ACTIVE" | "SUSPENDED";
}

export class MongoActorGrantRepository implements ActorGrantRepository {
  private readonly memberships: Collection<StoredVendorMembership>;
  private readonly adminBindings: Collection<StoredAdminRoleBinding>;

  constructor(db: Db) {
    this.memberships = db.collection<StoredVendorMembership>("vendorMemberships");
    this.adminBindings = db.collection<StoredAdminRoleBinding>("adminRoleBindings");
  }

  async loadForUser(userId: string) {
    const [memberships, adminBinding] = await Promise.all([
      this.memberships.find({ userId, status: "ACTIVE" }).project<StoredVendorMembership>({
        _id: 1,
        vendorId: 1,
        role: 1,
        permissions: 1,
        status: 1,
      }).toArray(),
      this.adminBindings.findOne({ userId, status: "ACTIVE" }),
    ]);
    const vendorMemberships: VendorMembership[] = memberships.map((entry) => ({
      vendorId: entry.vendorId,
      role: entry.role,
      permissions: entry.permissions,
      status: entry.status,
    }));
    return {
      vendorMemberships,
      adminPermissions: adminBinding?.permissions ?? [],
      superAdmin: adminBinding?.superAdmin ?? false,
    };
  }
}

let indexPromise: Promise<void> | undefined;

export function ensureIdentityIndexes(db: Db): Promise<void> {
  indexPromise ??= Promise.all([
    db.collection("users").createIndex({ normalizedEmail: 1 }, { unique: true }),
    db.collection("users").createIndex({ publicId: 1 }, { unique: true }),
    db.collection("vendorMemberships").createIndex({ vendorId: 1, userId: 1 }, { unique: true }),
    db.collection("vendorMemberships").createIndex({ userId: 1, status: 1 }),
    db.collection("adminRoleBindings").createIndex({ userId: 1 }, { unique: true }),
    db.collection("sessions").createIndex({ tokenHash: 1 }, { unique: true }),
    db.collection("sessions").createIndex({ userId: 1, expiresAt: 1 }),
    db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("identityTokens").createIndex({ tokenHash: 1 }, { unique: true }),
    db.collection("identityTokens").createIndex({ userId: 1, purpose: 1, consumedAt: 1 }),
    db.collection("identityTokens").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("auditEvents").createIndex({ targetType: 1, targetId: 1, occurredAt: -1 }),
    db.collection("auditEvents").createIndex({ actorId: 1, occurredAt: -1 }),
    db.collection("rateLimitBuckets").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("identityMessageDeliveries").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("identityMessageDeliveries").createIndex({ status: 1, createdAt: 1 }),
  ]).then(() => undefined).catch((error) => {
    indexPromise = undefined;
    throw error;
  });
  return indexPromise;
}
