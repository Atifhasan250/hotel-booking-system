import "server-only";

import { randomUUID } from "node:crypto";

import { AvailabilityService } from "../application/availability-service";
import type { RoomTypeVendorResolver } from "../application/ports";
import { getMongoClient, getMongoDatabase } from "../../../platform/db/mongo-client";
import { assertMongoTransactionSupport, MongoTransactionRunner } from "../../../platform/db/mongo-transaction";
import { MongoAuditEventWriter, MongoRateLimiter } from "../../identity/infrastructure/mongo-identity-repositories";
import { MongoAvailabilityRepository, ensureAvailabilityIndexes } from "./mongo-availability-repository";
import type { Db } from "mongodb";

/**
 * Reads the vendorId directly from the roomTypes collection.
 * Lightweight — only fetches the vendorId projection.
 */
class MongoRoomTypeVendorResolver implements RoomTypeVendorResolver {
  constructor(private readonly db: Db) {}

  async resolveVendorId(roomTypeId: string): Promise<string | null> {
    const result = await this.db
      .collection<{ _id: string; vendorId: string }>("roomTypes")
      .findOne({ _id: roomTypeId }, { projection: { vendorId: 1 } });
    return result?.vendorId ?? null;
  }
}

let servicePromise: Promise<AvailabilityService> | undefined;

export function getAvailabilityService(): Promise<AvailabilityService> {
  servicePromise ??= createAvailabilityService().catch((error) => {
    servicePromise = undefined;
    throw error;
  });
  return servicePromise;
}

async function createAvailabilityService(): Promise<AvailabilityService> {
  const [db, client] = await Promise.all([getMongoDatabase(), getMongoClient()]);
  const transactions = new MongoTransactionRunner(client);
  await Promise.all([ensureAvailabilityIndexes(db), assertMongoTransactionSupport(transactions, db)]);

  return new AvailabilityService({
    repository: new MongoAvailabilityRepository(db, transactions),
    audit: new MongoAuditEventWriter(db, transactions),
    transactions,
    rateLimiter: new MongoRateLimiter(db, transactions),
    roomTypeVendorResolver: new MongoRoomTypeVendorResolver(db),
    ids: { create: () => randomUUID() },
    clock: { now: () => new Date() },
  });
}
