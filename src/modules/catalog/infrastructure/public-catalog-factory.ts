import "server-only";

import { PublicCatalogService } from "../application/public-catalog";
import { getMongoDatabase } from "../../../platform/db/mongo-client";
import { getServerEnv } from "../../../platform/config/server-env";
import { MongoPublicCatalogRepository } from "./mongo-public-catalog-repository";

let servicePromise: Promise<PublicCatalogService> | undefined;

export function getPublicCatalogService(): Promise<PublicCatalogService> {
  servicePromise ??= getMongoDatabase()
    .then((db) => new PublicCatalogService(new MongoPublicCatalogRepository(db, getServerEnv().IMAGEKIT_URL_ENDPOINT)))
    .catch((error) => {
      servicePromise = undefined;
      throw error;
    });
  return servicePromise;
}
