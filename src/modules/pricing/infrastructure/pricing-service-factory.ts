import "server-only";

import { randomUUID } from "node:crypto";

import { PricingService } from "../application/pricing-service";
import { getMongoClient, getMongoDatabase } from "../../../platform/db/mongo-client";
import { assertMongoTransactionSupport, MongoTransactionRunner } from "../../../platform/db/mongo-transaction";
import { MongoAuditEventWriter, MongoRateLimiter } from "../../identity/infrastructure/mongo-identity-repositories";
import { MongoPricingRepository } from "./mongo-pricing-repository";
import type { RoomTypeVendorResolver } from "../../availability/application/ports";
import type { Db } from "mongodb";

class MongoRoomTypeVendorResolver implements RoomTypeVendorResolver {
  constructor(private readonly db: Db) {}

  async resolveVendorId(roomTypeId: string): Promise<string | null> {
    const result = await this.db
      .collection<{ _id: string; vendorId: string }>("roomTypes")
      .findOne({ _id: roomTypeId }, { projection: { vendorId: 1 } });
    return result?.vendorId ?? null;
  }
}

let servicePromise: Promise<PricingService> | undefined;

export function getPricingService(): Promise<PricingService> {
  servicePromise ??= createPricingService().catch((error) => {
    servicePromise = undefined;
    throw error;
  });
  return servicePromise;
}

async function createPricingService(): Promise<PricingService> {
  const [db, client] = await Promise.all([getMongoDatabase(), getMongoClient()]);
  const transactions = new MongoTransactionRunner(client);
  await assertMongoTransactionSupport(transactions, db);

  return new PricingService({
    repository: new MongoPricingRepository(db, transactions),
    audit: new MongoAuditEventWriter(db, transactions),
    transactions,
    rateLimiter: new MongoRateLimiter(db, transactions),
    roomTypeVendorResolver: new MongoRoomTypeVendorResolver(db),
    ids: { create: () => randomUUID() },
    clock: { now: () => new Date() },
  });
}
