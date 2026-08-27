import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet, MongoMemoryServer } from "mongodb-memory-server";

import type { AuditEvent } from "../../src/modules/audit/domain/audit-event";
import type { IdentityToken, Session, User } from "../../src/modules/identity/domain/model";
import {
  ensureIdentityIndexes,
  MongoAuditEventWriter,
  MongoIdentityTokenRepository,
  MongoSessionRepository,
  MongoUserRepository,
} from "../../src/modules/identity/infrastructure/mongo-identity-repositories";
import { assertMongoTransactionSupport, MongoTransactionRunner } from "../../src/platform/db/mongo-transaction";

describe("MongoDB identity transaction infrastructure", () => {
  let replicaSet: MongoMemoryReplSet;
  let client: MongoClient;
  let databaseName: string;
  let transactions: MongoTransactionRunner;
  let users: MongoUserRepository;
  let sessions: MongoSessionRepository;
  let tokens: MongoIdentityTokenRepository;
  let audit: MongoAuditEventWriter;

  beforeAll(async () => {
    replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
    client = await MongoClient.connect(replicaSet.getUri());
    databaseName = `book_my_room_test_${randomUUID().replaceAll("-", "")}`;
    const db = client.db(databaseName);
    transactions = new MongoTransactionRunner(client);
    await ensureIdentityIndexes(db);
    await assertMongoTransactionSupport(transactions, db);
    users = new MongoUserRepository(db, transactions);
    sessions = new MongoSessionRepository(db, transactions);
    tokens = new MongoIdentityTokenRepository(db, transactions);
    audit = new MongoAuditEventWriter(db, transactions);
  }, 180_000);

  afterAll(async () => {
    if (client) {
      await client.db(databaseName).dropDatabase();
      await client.close();
    }
    if (replicaSet) await replicaSet.stop();
  }, 30_000);

  it("rolls back identity state and its audit event together", async () => {
    const now = new Date("2026-08-27T10:00:00.000Z");
    const user = userRecord("rollback-user", now);
    await expect(transactions.run(async () => {
      await users.createIfAbsent(user);
      await audit.append(auditRecord("rollback-audit", user.id, now));
      throw new Error("force rollback");
    })).rejects.toThrow("force rollback");

    expect(await users.findById(user.id)).toBeNull();
    expect(await client.db(databaseName).collection<{ _id: string }>("auditEvents").countDocuments({ _id: "rollback-audit" })).toBe(0);
  });

  it("commits an identity mutation and audit atomically", async () => {
    const now = new Date("2026-08-27T10:00:00.000Z");
    const user = userRecord("commit-user", now);
    await transactions.run(async () => {
      await users.createIfAbsent(user);
      await audit.append(auditRecord("commit-audit", user.id, now));
    });
    expect(await users.findById(user.id)).toEqual(expect.objectContaining({ id: user.id }));
    expect(await client.db(databaseName).collection<{ _id: string }>("auditEvents").countDocuments({ _id: "commit-audit" })).toBe(1);
  });

  it("atomically consumes one-time tokens and rotates opaque sessions", async () => {
    const now = new Date("2026-08-27T10:00:00.000Z");
    const token: IdentityToken = {
      id: "token-1",
      userId: "commit-user",
      purpose: "RESET_PASSWORD",
      tokenHash: "token-hash-1",
      createdAt: now,
      expiresAt: new Date(now.getTime() + 60_000),
    };
    await tokens.replaceActive(token);
    await expect(tokens.consume(token.tokenHash, token.purpose, now)).resolves.toEqual(expect.objectContaining({ id: token.id }));
    await expect(tokens.consume(token.tokenHash, token.purpose, now)).resolves.toBeNull();

    const current = sessionRecord("session-1", "session-hash-1", now);
    const replacement = sessionRecord("session-2", "session-hash-2", now);
    await sessions.create(current);
    await expect(sessions.rotate(current.id, replacement, now)).resolves.toBe(true);
    await expect(sessions.findActiveByTokenHash(current.tokenHash, now)).resolves.toBeNull();
    await expect(sessions.findActiveByTokenHash(replacement.tokenHash, now)).resolves.toEqual(expect.objectContaining({ id: replacement.id }));
    await expect(sessions.rotate(current.id, sessionRecord("session-3", "session-hash-3", now), now)).resolves.toBe(false);
  });

  it("creates the required unique, TTL, tenant, and audit indexes", async () => {
    const db = client.db(databaseName);
    const userIndexes = await db.collection("users").indexInformation({ full: true });
    const sessionIndexes = await db.collection("sessions").indexInformation({ full: true });
    const tokenIndexes = await db.collection("identityTokens").indexInformation({ full: true });
    const membershipIndexes = await db.collection("vendorMemberships").indexInformation({ full: true });
    const auditIndexes = await db.collection("auditEvents").indexInformation({ full: true });

    expect(userIndexes).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: { normalizedEmail: 1 }, unique: true }),
      expect.objectContaining({ key: { publicId: 1 }, unique: true }),
    ]));
    expect(sessionIndexes).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: { tokenHash: 1 }, unique: true }),
      expect.objectContaining({ key: { expiresAt: 1 }, expireAfterSeconds: 0 }),
    ]));
    expect(tokenIndexes).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: { tokenHash: 1 }, unique: true }),
      expect.objectContaining({ key: { expiresAt: 1 }, expireAfterSeconds: 0 }),
    ]));
    expect(membershipIndexes).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: { vendorId: 1, userId: 1 }, unique: true }),
    ]));
    expect(auditIndexes).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: { actorId: 1, occurredAt: -1 } }),
      expect.objectContaining({ key: { targetType: 1, targetId: 1, occurredAt: -1 } }),
    ]));
  });

  it("rejects a standalone MongoDB deployment without transaction support", async () => {
    const standalone = await MongoMemoryServer.create();
    const standaloneClient = await MongoClient.connect(standalone.getUri());
    try {
      const unsupportedTransactions = new MongoTransactionRunner(standaloneClient);
      await expect(
        assertMongoTransactionSupport(unsupportedTransactions, standaloneClient.db("unsupported_identity_test")),
      ).rejects.toThrow("MongoDB transaction support is required");
    } finally {
      await standaloneClient.close();
      await standalone.stop();
    }
  }, 60_000);
});

function userRecord(id: string, now: Date): User {
  return {
    id,
    publicId: `public-${id}`,
    displayName: "Transaction Test",
    normalizedEmail: `${id}@example.com`,
    passwordHash: "not-a-real-password-hash",
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  };
}

function sessionRecord(id: string, tokenHash: string, now: Date): Session {
  return {
    id,
    userId: "commit-user",
    tokenHash,
    familyId: "family-1",
    createdAt: now,
    lastSeenAt: now,
    expiresAt: new Date(now.getTime() + 60_000),
    securityMetadata: {},
  };
}

function auditRecord(id: string, targetId: string, now: Date): AuditEvent {
  return {
    id,
    actorId: "system:test",
    action: "identity.transaction.test",
    targetType: "user",
    targetId,
    outcome: "SUCCESS",
    requestId: `request-${id}`,
    occurredAt: now,
    metadata: {},
  };
}
