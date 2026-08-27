import "server-only";

import { randomUUID } from "node:crypto";

import { CatalogService } from "../application/catalog-service";
import { getServerEnv } from "../../../platform/config/server-env";
import { getMongoClient, getMongoDatabase } from "../../../platform/db/mongo-client";
import { assertMongoTransactionSupport, MongoTransactionRunner } from "../../../platform/db/mongo-transaction";
import { MongoAuditEventWriter, MongoRateLimiter } from "../../identity/infrastructure/mongo-identity-repositories";
import { ensureCatalogIndexes, MongoCatalogRepository } from "./mongo-catalog-repository";
import { ImageKitV2UploadSigner } from "./imagekit-upload-signer";
import { UnconfiguredMapAdapter } from "./unconfigured-map-adapter";

let servicePromise: Promise<CatalogService> | undefined;

export function getCatalogService(): Promise<CatalogService> {
  servicePromise ??= createCatalogService().catch((error) => { servicePromise = undefined; throw error; });
  return servicePromise;
}

async function createCatalogService() {
  const [db, client] = await Promise.all([getMongoDatabase(), getMongoClient()]);
  const transactions = new MongoTransactionRunner(client);
  await Promise.all([ensureCatalogIndexes(db), assertMongoTransactionSupport(transactions, db)]);
  const env = getServerEnv();
  return new CatalogService({
    repository: new MongoCatalogRepository(db, transactions),
    audit: new MongoAuditEventWriter(db, transactions),
    transactions,
    rateLimiter: new MongoRateLimiter(db, transactions),
    imageKit: new ImageKitV2UploadSigner({ publicKey: env.IMAGEKIT_PUBLIC_KEY, privateKey: env.IMAGEKIT_PRIVATE_KEY, urlEndpoint: env.IMAGEKIT_URL_ENDPOINT, environment: env.NODE_ENV }),
    maps: new UnconfiguredMapAdapter(),
    ids: { create: () => randomUUID() },
    clock: { now: () => new Date() },
  });
}
