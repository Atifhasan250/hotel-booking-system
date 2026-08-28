import { randomUUID } from "node:crypto";

import { MongoClient } from "mongodb";

import { LEGACY_IMPORT_TAG } from "./lib/bookmyroom-import.mts";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const client = new MongoClient(required("MONGODB_URI"));
try {
  await client.connect();
  const db = client.db(required("MONGODB_DB_NAME"));
  const topology = await db.command({ hello: 1 });
  if (!topology.setName && topology.msg !== "isdbgrid") {
    throw new Error("The configured MongoDB deployment does not support the transaction required for publication.");
  }

  const [properties, destinations, media] = await Promise.all([
    db.collection("properties").find({ migrationTag: LEGACY_IMPORT_TAG }).toArray(),
    db.collection("destinations").find({ migrationTag: LEGACY_IMPORT_TAG }).toArray(),
    db.collection<{ url: string }>("mediaAssets").find({ migrationTag: LEGACY_IMPORT_TAG }).toArray(),
  ]);
  if (properties.length !== 4 || destinations.length < 11 || media.length !== 14) {
    throw new Error(`Refusing partial publication: found ${properties.length} properties, ${destinations.length} destinations and ${media.length} media assets.`);
  }

  const endpoint = new URL(required("IMAGEKIT_URL_ENDPOINT"));
  const endpointPath = endpoint.pathname.replace(/\/$/, "");
  const reachable = await Promise.all(media.map(async ({ url }) => {
    const assetUrl = new URL(url);
    if (assetUrl.origin !== endpoint.origin || !(assetUrl.pathname === endpointPath || assetUrl.pathname.startsWith(`${endpointPath}/`))) return false;
    const response = await fetch(assetUrl, { method: "HEAD", signal: AbortSignal.timeout(15_000) });
    return response.ok;
  }));
  if (reachable.some((result) => !result)) throw new Error("Refusing publication because one or more ImageKit assets are unavailable or outside the configured endpoint.");

  const now = new Date();
  const requestId = `legacy-publish-${randomUUID()}`;
  const backupId = `${LEGACY_IMPORT_TAG}:publish:${now.toISOString()}`;
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      await db.collection("legacyImportBackups").insertOne({
        _id: backupId,
        migrationTag: LEGACY_IMPORT_TAG,
        kind: "PRE_PUBLICATION",
        createdAt: now,
        previousDocuments: [
          { collection: "properties", documents: properties },
          { collection: "destinations", documents: destinations },
          { collection: "mediaAssets", documents: media },
        ],
      }, { session });
      const propertyResult = await db.collection("properties").updateMany(
        { migrationTag: LEGACY_IMPORT_TAG },
        { $set: { status: "PUBLISHED", moderationNote: "Legacy source content published by direct owner instruction on 2026-08-28.", updatedAt: now } },
        { session },
      );
      const destinationResult = await db.collection("destinations").updateMany(
        { migrationTag: LEGACY_IMPORT_TAG },
        { $set: { status: "PUBLISHED", updatedAt: now } },
        { session },
      );
      const mediaResult = await db.collection("mediaAssets").updateMany(
        { migrationTag: LEGACY_IMPORT_TAG },
        { $set: { moderationStatus: "APPROVED", updatedAt: now } },
        { session },
      );
      await db.collection("auditEvents").insertOne({
        _id: requestId,
        actorId: "owner-directed-legacy-migration",
        action: "catalog.legacy_import.publish",
        targetType: "CATALOG_IMPORT",
        targetId: LEGACY_IMPORT_TAG,
        outcome: "SUCCESS",
        requestId,
        occurredAt: now,
        metadata: {
          properties: propertyResult.modifiedCount,
          destinations: destinationResult.modifiedCount,
          mediaAssets: mediaResult.modifiedCount,
          imageKitUrlsVerified: reachable.length,
        },
      }, { session });
      await db.collection("legacyImportRuns").insertOne({
        _id: backupId,
        migrationTag: LEGACY_IMPORT_TAG,
        sourceOrigin: "https://bookmyroom.site",
        status: "PUBLISHED",
        requestId,
        summary: {
          properties: propertyResult.modifiedCount,
          destinations: destinationResult.modifiedCount,
          mediaAssets: mediaResult.modifiedCount,
        },
        createdAt: now,
      }, { session });
    });
  } finally {
    await session.endSession();
  }
  console.log(`Published ${properties.length} properties, ${destinations.length} destinations and approved ${media.length} ImageKit assets.`);
  console.log(`Recovery snapshot: ${backupId}`);
} finally {
  await client.close();
}
