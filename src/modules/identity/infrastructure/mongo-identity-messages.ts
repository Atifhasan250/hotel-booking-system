import "server-only";

import { createCipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import type { Collection, Db } from "mongodb";

import type { IdentityMessagePort } from "../application/ports";
import type { MongoTransactionRunner } from "../../../platform/db/mongo-transaction";

interface QueuedIdentityMessage {
  _id: string;
  schemaVersion: 1;
  kind: "CONTACT_VERIFICATION" | "PASSWORD_RESET" | "PASSWORD_RESET_REQUEST";
  normalizedEmail?: string;
  recipientHash?: string;
  encryptedToken: string;
  iv: string;
  authTag: string;
  expiresAt: Date;
  createdAt: Date;
  status: "PENDING_PROVIDER_CONFIGURATION";
}

export class MongoIdentityMessageOutbox implements IdentityMessagePort {
  private readonly collection: Collection<QueuedIdentityMessage>;
  private readonly key: Buffer;

  constructor(db: Db, base64Key: string, private readonly transactions: MongoTransactionRunner) {
    this.collection = db.collection<QueuedIdentityMessage>("identityMessageDeliveries");
    this.key = Buffer.from(base64Key, "base64");
    if (this.key.byteLength !== 32) throw new Error("Invalid identity delivery encryption key");
  }

  async queuePasswordResetRequest(input: { email: string; requestedAt: Date }): Promise<void> {
    const encrypted = this.encrypt(input.email);
    await this.collection.insertOne({
      _id: randomUUID(),
      schemaVersion: 1,
      kind: "PASSWORD_RESET_REQUEST",
      recipientHash: createHash("sha256").update(input.email).digest("base64url"),
      encryptedToken: encrypted.value,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      expiresAt: new Date(input.requestedAt.getTime() + 30 * 60 * 1000),
      createdAt: input.requestedAt,
      status: "PENDING_PROVIDER_CONFIGURATION",
    }, { session: this.transactions.current() });
  }

  sendContactVerification(input: { email: string; token: string; expiresAt: Date }): Promise<void> {
    return this.queue("CONTACT_VERIFICATION", input);
  }

  sendPasswordReset(input: { email: string; token: string; expiresAt: Date }): Promise<void> {
    return this.queue("PASSWORD_RESET", input);
  }

  private async queue(
    kind: QueuedIdentityMessage["kind"],
    input: { email: string; token: string; expiresAt: Date },
  ): Promise<void> {
    const encrypted = this.encrypt(input.token);
    await this.collection.insertOne({
      _id: randomUUID(),
      schemaVersion: 1,
      kind,
      normalizedEmail: input.email,
      encryptedToken: encrypted.value,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      expiresAt: input.expiresAt,
      createdAt: new Date(),
      status: "PENDING_PROVIDER_CONFIGURATION",
    }, { session: this.transactions.current() });
  }

  private encrypt(value: string): { value: string; iv: string; authTag: string } {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return {
      value: encrypted.toString("base64"),
      iv: iv.toString("base64"),
      authTag: cipher.getAuthTag().toString("base64"),
    };
  }
}
