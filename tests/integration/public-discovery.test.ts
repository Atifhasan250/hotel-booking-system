import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";

import { PublicCatalogService } from "../../src/modules/catalog/application/public-catalog";
import { MongoPublicCatalogRepository } from "../../src/modules/catalog/infrastructure/mongo-public-catalog-repository";

describe("public discovery integration — real MongoDB", () => {
  let mongod: MongoMemoryServer;
  let client: MongoClient;
  let service: PublicCatalogService;
  let db: ReturnType<MongoClient["db"]>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
    db = client.db(`public_discovery_${randomUUID().replaceAll("-", "")}`);
    service = new PublicCatalogService(new MongoPublicCatalogRepository(db, "https://ik.imagekit.io/book-my-room-test"));

    const now = new Date("2026-08-28T00:00:00Z");
    const policies = { checkInTime: "14:00", checkOutTime: "11:00", cancellationSummary: "Displayed policy", childPolicy: "Children welcome", extraBedPolicy: "On request", petPolicy: "No pets", couplePolicy: "Valid identification required" };
    const location = { addressLine: "Tea Garden Road", area: "Sreemangal", countryCode: "BD", validationStatus: "VERIFIED" };
    await db.collection<{ _id: string; [key: string]: unknown }>("destinations").insertMany([
      { _id: "destination-published", schemaVersion: 1, publicId: "dst-public", name: "Sreemangal", slug: "sreemangal", district: "Moulvibazar", region: "Sylhet", summary: "A verified destination summary.", status: "PUBLISHED", createdAt: now, updatedAt: now },
      { _id: "destination-draft", schemaVersion: 1, publicId: "dst-draft", name: "Draft place", slug: "draft-place", district: "Dhaka", region: "Dhaka", summary: "Private", status: "DRAFT", createdAt: now, updatedAt: now },
    ]);
    await db.collection<{ _id: string; [key: string]: unknown }>("properties").insertMany([
      { _id: "property-published", schemaVersion: 1, publicId: "prop-public", vendorId: "vendor-1", name: "Tea Valley Eco Resort", slug: "tea-valley-eco-resort", propertyType: "ECO_RESORT", propertyClass: "BUDGET", description: "A reviewed eco resort.", districtId: "moulvibazar", destinationId: "destination-published", timezone: "Asia/Dhaka", amenityKeys: ["wifi", "nature-view"], policies, location, status: "PUBLISHED", createdAt: now, updatedAt: now },
      { _id: "property-draft", schemaVersion: 1, publicId: "prop-draft", vendorId: "vendor-1", name: "Private Draft", slug: "private-draft", propertyType: "HOTEL", propertyClass: "STANDARD", description: "Must not leak", districtId: "dhaka", timezone: "Asia/Dhaka", amenityKeys: [], policies, location, status: "DRAFT", createdAt: now, updatedAt: now },
    ]);
    await db.collection<{ _id: string; [key: string]: unknown }>("roomTypes").insertOne({ _id: "room-1", schemaVersion: 1, publicId: "room-public", vendorId: "vendor-1", propertyId: "property-published", name: "Garden room", description: "A reviewed room.", maxAdults: 2, maxChildren: 1, bedConfiguration: "One queen bed", baseQuantity: 2, amenityKeys: ["wifi"], airConditioning: "AC", status: "ACTIVE", createdAt: now, updatedAt: now });
    await db.collection<{ _id: string; [key: string]: unknown }>("ratePlans").insertOne({ _id: "rate-1", roomTypeId: "room-1", basePrice: 125_050, status: "ACTIVE" });
    await db.collection<{ _id: string; [key: string]: unknown }>("reviewAggregates").insertOne({ _id: "property-published", count: 4, average: 4.75 });
    await db.collection<{ _id: string; [key: string]: unknown }>("nearbyPlaces").insertMany([
      { _id: "nearby-verified", schemaVersion: 1, publicId: "nearby-public", vendorId: "vendor-1", propertyId: "property-published", name: "Tea museum", type: "LANDMARK", distanceMeters: 900, validationStatus: "VERIFIED", createdAt: now, updatedAt: now },
      { _id: "nearby-unverified", schemaVersion: 1, publicId: "nearby-private", vendorId: "vendor-1", propertyId: "property-published", name: "Unverified claim", type: "NATURE", distanceMeters: 100, validationStatus: "UNVERIFIED", createdAt: now, updatedAt: now },
    ]);
    await db.collection<{ _id: string; [key: string]: unknown }>("mediaAssets").insertMany([
      { _id: "media-approved", schemaVersion: 1, publicId: "media-public", vendorId: "vendor-1", ownerType: "PROPERTY", ownerId: "property-published", provider: "IMAGEKIT", providerFileId: "ik-1", filePath: "/properties/one.webp", url: "https://ik.imagekit.io/book-my-room-test/properties/one.webp", width: 1200, height: 800, format: "webp", bytes: 1000, altText: "Tea Valley garden", sortOrder: 0, moderationStatus: "APPROVED", status: "ACTIVE", createdAt: now, updatedAt: now },
      { _id: "media-external", schemaVersion: 1, publicId: "media-external", vendorId: "vendor-1", ownerType: "PROPERTY", ownerId: "property-published", provider: "IMAGEKIT", providerFileId: "bad", filePath: "/bad.webp", url: "https://reference.invalid/bad.webp", width: 1200, height: 800, format: "webp", bytes: 1000, altText: "Must not render", sortOrder: 1, moderationStatus: "APPROVED", status: "ACTIVE", createdAt: now, updatedAt: now },
      { _id: "media-pending", schemaVersion: 1, publicId: "media-pending", vendorId: "vendor-1", ownerType: "PROPERTY", ownerId: "property-published", provider: "IMAGEKIT", providerFileId: "pending", filePath: "/properties/pending.webp", url: "https://ik.imagekit.io/book-my-room-test/properties/pending.webp", width: 1200, height: 800, format: "webp", bytes: 1000, altText: "Pending media", sortOrder: 2, moderationStatus: "PENDING", status: "ACTIVE", createdAt: now, updatedAt: now },
    ]);
  }, 60_000);

  afterAll(async () => {
    await client?.close();
    await mongod?.stop();
  }, 30_000);

  it("returns published properties with approved owned ImageKit media only", async () => {
    const home = await service.home();
    expect(home.featuredProperties.map((property) => property.slug)).toEqual(["tea-valley-eco-resort"]);
    expect(home.featuredProperties[0].media?.url).toBe("https://ik.imagekit.io/book-my-room-test/properties/one.webp");
    expect(home.ecoResorts).toHaveLength(1);
    expect(home.budgetProperties).toHaveLength(1);
  });

  it("returns a reproducible public detail without leaking unverified nearby places", async () => {
    const record = await service.property("tea-valley-eco-resort");
    expect(record?.rooms.map((room) => room.id)).toEqual(["room-1"]);
    expect(record?.nearbyPlaces.map((place) => place.id)).toEqual(["nearby-verified"]);
    expect(record?.startingPriceMinorUnits).toBe(125_050);
    expect(record?.reviewSummary).toEqual({ count: 0, average: null });
    expect(record?.media.map((asset) => asset.id)).toEqual(["media-approved"]);
    await expect(service.property("private-draft")).resolves.toBeNull();
  });

  it("includes only published records in sitemap input", async () => {
    await expect(service.sitemapEntries()).resolves.toEqual({
      properties: [{ slug: "tea-valley-eco-resort", updatedAt: new Date("2026-08-28T00:00:00Z") }],
      destinations: [{ slug: "sreemangal", updatedAt: new Date("2026-08-28T00:00:00Z") }],
    });
  });
});
