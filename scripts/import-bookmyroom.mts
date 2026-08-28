import { createHash } from "node:crypto";

import { MongoClient, type ClientSession, type Db } from "mongodb";

import { fetchLegacyCatalog, LEGACY_IMPORT_TAG, type SourceMedia } from "./lib/bookmyroom-import.mts";

const apply = process.argv.includes("--apply");
const folder = "/book-my-room/legacy/bookmyroom-site";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required when using --apply`);
  return value;
}

function extension(url: string): "jpg" | "jpeg" | "png" | "webp" {
  const match = new URL(url).pathname.toLowerCase().match(/\.(jpe?g|png|webp)$/);
  if (!match) throw new Error(`Unsupported legacy image format: ${new URL(url).pathname}`);
  return match[1] as "jpg" | "jpeg" | "png" | "webp";
}

function fileName(asset: SourceMedia): string {
  const ext = extension(asset.sourceUrl);
  const stem = asset.sourceKey.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 72);
  const fingerprint = createHash("sha256").update(asset.sourceUrl).digest("hex").slice(0, 12);
  return `${stem}-${fingerprint}.${ext}`;
}

async function uploadImage(asset: SourceMedia, privateKey: string, endpoint: string) {
  const body = new FormData();
  body.set("file", asset.sourceUrl);
  body.set("fileName", fileName(asset));
  body.set("folder", folder);
  body.set("useUniqueFileName", "false");
  body.set("overwriteFile", "true");
  body.set("tags", "legacy-bookmyroom,wordpress-import");
  const response = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${privateKey}:`).toString("base64")}` },
    body,
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(`ImageKit upload failed for ${new URL(asset.sourceUrl).pathname}: ${String(payload.message ?? response.status)}`);
  const url = String(payload.url ?? "");
  const imageKitBase = new URL(endpoint);
  const uploaded = new URL(url);
  const basePath = imageKitBase.pathname.replace(/\/$/, "");
  if (uploaded.origin !== imageKitBase.origin || !(uploaded.pathname === basePath || uploaded.pathname.startsWith(`${basePath}/`))) {
    throw new Error(`ImageKit returned a URL outside IMAGEKIT_URL_ENDPOINT for ${asset.sourceKey}`);
  }
  return {
    _id: `legacy-media-${asset.sourceKey.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`,
    publicId: `legacy-media-public-${asset.sourceKey.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`,
    vendorId: "legacy-bookmyroom-site",
    ownerType: asset.ownerType,
    ownerId: asset.ownerId,
    provider: "IMAGEKIT",
    providerFileId: String(payload.fileId),
    filePath: String(payload.filePath),
    url,
    width: Number(payload.width ?? asset.width ?? 1),
    height: Number(payload.height ?? asset.height ?? 1),
    format: extension(url),
    bytes: Number(payload.size ?? asset.bytes ?? 1),
    altText: asset.altText,
    sortOrder: asset.sortOrder,
    moderationStatus: "PENDING",
    status: "ACTIVE",
    schemaVersion: 1,
    migrationTag: LEGACY_IMPORT_TAG,
    legacySource: { url: asset.sourceUrl, key: asset.sourceKey },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

async function existingMedia(db: Db, sourceKey: string) {
  return db.collection("mediaAssets").findOne({ migrationTag: LEGACY_IMPORT_TAG, "legacySource.key": sourceKey });
}

async function upsertSetOnInsert(db: Db, collection: string, documents: Record<string, unknown>[], session: ClientSession) {
  if (documents.length === 0) return { inserted: 0, matched: 0 };
  const result = await db.collection(collection).bulkWrite(documents.map((document) => ({
    updateOne: {
      filter: { _id: document._id },
      update: { $setOnInsert: document },
      upsert: true,
    },
  })), { ordered: true, session });
  return { inserted: result.upsertedCount, matched: result.matchedCount };
}

const catalog = await fetchLegacyCatalog();
console.log(`Fetched ${catalog.properties.length} hotels, ${catalog.rooms.length} rooms, ${catalog.destinations.length} destinations and ${catalog.media.length} source images.`);
for (const warning of catalog.warnings) console.warn(`Review: ${warning}`);

if (!apply) {
  console.log("Dry run complete. Re-run with --apply to upload images and seed MongoDB.");
  process.exit(0);
}

const mongoUri = required("MONGODB_URI");
const databaseName = required("MONGODB_DB_NAME");
const imageKitPrivateKey = required("IMAGEKIT_PRIVATE_KEY");
const imageKitEndpoint = required("IMAGEKIT_URL_ENDPOINT");
const client = new MongoClient(mongoUri);

try {
  await client.connect();
  const db = client.db(databaseName);
  const topology = await db.command({ hello: 1 });
  if (!topology.setName && topology.msg !== "isdbgrid") {
    throw new Error("The configured MongoDB deployment does not support the transaction required for this import.");
  }

  const destinationIdReplacements = new Map<string, unknown>();
  for (const destination of catalog.destinations) {
    const existing = await db.collection("destinations").findOne({ slug: destination.slug });
    if (existing && existing._id !== destination._id) destinationIdReplacements.set(String(destination._id), existing._id);
  }
  if (destinationIdReplacements.size > 0) {
    catalog.destinations = catalog.destinations.filter((destination) => !destinationIdReplacements.has(String(destination._id)));
    for (const property of catalog.properties) {
      const replacement = destinationIdReplacements.get(String(property.destinationId ?? ""));
      if (replacement) property.destinationId = replacement;
    }
    for (const asset of catalog.media) {
      const replacement = destinationIdReplacements.get(String(asset.ownerId));
      if (replacement) asset.ownerId = String(replacement);
    }
  }

  const uploadedMedia: Record<string, unknown>[] = [];
  for (const asset of catalog.media) {
    const existing = await existingMedia(db, asset.sourceKey);
    if (existing) {
      uploadedMedia.push(existing);
      console.log(`Image already imported: ${asset.sourceKey}`);
      continue;
    }
    uploadedMedia.push(await uploadImage(asset, imageKitPrivateKey, imageKitEndpoint));
    console.log(`Uploaded image: ${asset.sourceKey}`);
  }

  const runId = `${LEGACY_IMPORT_TAG}:${new Date().toISOString()}`;
  const collections: Array<[string, Record<string, unknown>[]]> = [
    ["vendorOrganizations", [catalog.vendor]],
    ["destinations", catalog.destinations],
    ["properties", catalog.properties],
    ["roomTypes", catalog.rooms],
    ["ratePlans", catalog.ratePlans],
    ["mediaAssets", uploadedMedia],
  ];
  const idsByCollection = Object.fromEntries(collections.map(([name, documents]) => [name, documents.map((document) => document._id)]));
  const backupDocuments = [];
  for (const [name, documents] of collections) {
    const ids = documents.map((document) => document._id);
    const existing = ids.length ? await db.collection(name).find({ _id: { $in: ids } }).toArray() : [];
    backupDocuments.push({ collection: name, documents: existing });
  }

  const session = client.startSession();
  const summary: Record<string, { inserted: number; matched: number }> = {};
  try {
    await session.withTransaction(async () => {
      await db.collection("legacyImportBackups").insertOne({
        _id: runId,
        migrationTag: LEGACY_IMPORT_TAG,
        createdAt: new Date(),
        idsByCollection,
        previousDocuments: backupDocuments,
      }, { session });
      await db.collection("legacyWordpressArchive").bulkWrite(catalog.archive.map((document) => ({
        updateOne: {
          filter: { _id: document._id },
          update: { $set: { ...document, migrationTag: LEGACY_IMPORT_TAG, fetchedAt: new Date() } },
          upsert: true,
        },
      })), { ordered: true, session });
      for (const [name, documents] of collections) {
        summary[name] = await upsertSetOnInsert(db, name, documents, session);
      }
      await db.collection("legacyImportRuns").insertOne({
        _id: runId,
        migrationTag: LEGACY_IMPORT_TAG,
        sourceOrigin: "https://bookmyroom.site",
        status: "COMPLETED",
        summary,
        warnings: catalog.warnings,
        createdAt: new Date(),
      }, { session });
    });
  } finally {
    await session.endSession();
  }
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Import completed with run id ${runId}. Records are staged for review and were not auto-published.`);
} finally {
  await client.close();
}
