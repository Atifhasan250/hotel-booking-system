import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";

import type { Property, VendorOrganization } from "../../src/modules/catalog/domain/model";
import { ensureCatalogIndexes, MongoCatalogRepository } from "../../src/modules/catalog/infrastructure/mongo-catalog-repository";
import { MongoAuditEventWriter } from "../../src/modules/identity/infrastructure/mongo-identity-repositories";
import { MongoTransactionRunner } from "../../src/platform/db/mongo-transaction";

describe("MongoDB catalog transaction and index infrastructure", () => {
  let replicaSet: MongoMemoryReplSet;
  let client: MongoClient;
  let databaseName: string;
  let transactions: MongoTransactionRunner;
  let repository: MongoCatalogRepository;

  beforeAll(async () => {
    replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
    client = await MongoClient.connect(replicaSet.getUri());
    databaseName = `book_my_room_catalog_${randomUUID().replaceAll("-", "")}`;
    const db = client.db(databaseName);
    transactions = new MongoTransactionRunner(client);
    await ensureCatalogIndexes(db);
    repository = new MongoCatalogRepository(db, transactions);
  }, 180_000);

  afterAll(async () => {
    if (client) { await client.db(databaseName).dropDatabase(); await client.close(); }
    if (replicaSet) await replicaSet.stop();
  }, 30_000);

  it("rolls back catalog state and audit together", async () => {
    const vendor = vendorRecord("vendor-rollback");
    const audit = new MongoAuditEventWriter(client.db(databaseName), transactions);
    await expect(transactions.run(async () => {
      await repository.createVendorIfAbsent(vendor);
      await audit.append({ id: "audit-rollback", actorId: "owner-1", action: "catalog.vendor.onboard", targetType: "vendor", targetId: vendor.id, outcome: "SUCCESS", requestId: "request-rollback", occurredAt: vendor.createdAt, metadata: {} });
      throw new Error("force catalog rollback");
    })).rejects.toThrow("force catalog rollback");
    expect(await repository.findVendorById(vendor.id)).toBeNull();
    expect(await client.db(databaseName).collection<{ _id: string }>("auditEvents").countDocuments({ _id: "audit-rollback" })).toBe(0);
  });

  it("enforces vendor-scoped property reads and idempotent creates", async () => {
    const property = propertyRecord("property-1", "vendor-1");
    const created = await repository.createPropertyIfAbsent(property, "vendor-1:property-request-1");
    const replay = await repository.createPropertyIfAbsent({ ...property, id: "property-2" }, "vendor-1:property-request-1");
    expect(created.created).toBe(true);
    expect(replay).toMatchObject({ property: { id: "property-1" }, created: false });
    expect(await repository.findPropertyForVendor("property-1", "vendor-1")).toMatchObject({ id: "property-1" });
    expect(await repository.findPropertyForVendor("property-1", "vendor-2")).toBeNull();
  });

  it("creates catalog uniqueness and operational query indexes", async () => {
    const db = client.db(databaseName);
    const vendorIndexes = await db.collection("vendorOrganizations").indexInformation({ full: true });
    const propertyIndexes = await db.collection("properties").indexInformation({ full: true });
    const mediaIndexes = await db.collection("mediaAssets").indexInformation({ full: true });
    expect(vendorIndexes).toEqual(expect.arrayContaining([expect.objectContaining({ key: { onboardingKey: 1 }, unique: true })]));
    expect(propertyIndexes).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: { vendorId: 1, slug: 1 }, unique: true }),
      expect.objectContaining({ key: { status: 1, districtId: 1, propertyType: 1 } }),
    ]));
    expect(mediaIndexes).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: { provider: 1, providerFileId: 1 }, unique: true }),
      expect.objectContaining({ key: { ownerType: 1, ownerId: 1, status: 1, sortOrder: 1 } }),
    ]));
  });
});

function vendorRecord(id: string): VendorOrganization {
  const now = new Date("2026-08-27T10:00:00.000Z");
  return { id, publicId: `public-${id}`, ownerUserId: "owner-1", displayName: "Catalog Test", legalName: "Catalog Test Ltd", normalizedContactEmail: "owner@example.test", contactPhone: "+8801712345678", status: "DRAFT", onboardingKey: `owner-1:${id}`, createdAt: now, updatedAt: now };
}

function propertyRecord(id: string, vendorId: string): Property {
  const now = new Date("2026-08-27T10:00:00.000Z");
  return { id, publicId: `public-${id}`, vendorId, name: "Catalog Property", slug: "catalog-property", propertyType: "HOTEL", propertyClass: "STANDARD", description: "A complete test description for the catalog property workflow.", districtId: "district-test", timezone: "Asia/Dhaka", amenityKeys: ["wifi"], policies: { checkInTime: "14:00", checkOutTime: "11:00", cancellationSummary: "Cancellation policy for the test property.", childPolicy: "Child policy for the test property.", extraBedPolicy: "Extra bed policy for the test property.", petPolicy: "Pet policy for the test property.", couplePolicy: "Couple policy for the test property." }, location: { addressLine: "Test Road", area: "Test Area", countryCode: "BD", validationStatus: "UNVERIFIED" }, status: "DRAFT", createdAt: now, updatedAt: now };
}
