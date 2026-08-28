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
  const collections = [
    "vendorOrganizations",
    "destinations",
    "properties",
    "roomTypes",
    "ratePlans",
    "mediaAssets",
    "legacyWordpressArchive",
    "legacyImportRuns",
    "legacyImportBackups",
  ];
  for (const name of collections) {
    const count = await db.collection(name).countDocuments({ migrationTag: LEGACY_IMPORT_TAG });
    console.log(`${name}: ${count}`);
  }
  const propertyStatuses = await db.collection("properties").aggregate([
    { $match: { migrationTag: LEGACY_IMPORT_TAG } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]).toArray();
  const mediaStatuses = await db.collection("mediaAssets").aggregate([
    { $match: { migrationTag: LEGACY_IMPORT_TAG } },
    { $group: { _id: "$moderationStatus", count: { $sum: 1 } } },
  ]).toArray();
  const media = await db.collection<{ url: string }>("mediaAssets")
    .find({ migrationTag: LEGACY_IMPORT_TAG }, { projection: { url: 1 } })
    .toArray();
  const reachable = await Promise.all(media.map(async ({ url }) => {
    const response = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(15_000) });
    return response.ok;
  }));
  console.log(`propertyStatuses: ${JSON.stringify(propertyStatuses)}`);
  console.log(`mediaStatuses: ${JSON.stringify(mediaStatuses)}`);
  console.log(`reachableImageKitUrls: ${reachable.filter(Boolean).length}/${reachable.length}`);
  const publicProperties = await db.collection("properties").countDocuments({ migrationTag: LEGACY_IMPORT_TAG, status: "PUBLISHED" });
  const publicDestinations = await db.collection("destinations").countDocuments({ migrationTag: LEGACY_IMPORT_TAG, status: "PUBLISHED" });
  const approvedMedia = await db.collection("mediaAssets").countDocuments({ migrationTag: LEGACY_IMPORT_TAG, moderationStatus: "APPROVED", status: "ACTIVE" });
  console.log(`publicCatalog: ${publicProperties} properties, ${publicDestinations} destinations, ${approvedMedia} approved media`);
} finally {
  await client.close();
}
