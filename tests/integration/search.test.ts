import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";

import { SearchService } from "../../src/modules/availability/application/search-service";

describe("SearchService integration — real MongoDB", () => {
  let mongod: MongoMemoryServer;
  let client: MongoClient;
  let service: SearchService;
  let db: ReturnType<MongoClient["db"]>;

  beforeAll(async () => {
    // SearchService does not need transactions, so a standalone server is sufficient.
    mongod = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongod.getUri());
    const dbName = `search_test_${randomUUID().replaceAll("-", "")}`;
    db = client.db(dbName);
    service = new SearchService(db);

    // Create required indexes for realistic query behavior.
    await db.collection("properties").createIndex({ status: 1, districtId: 1, propertyType: 1 });
    await db.collection("properties").createIndex({ vendorId: 1, slug: 1 }, { unique: true });
    await db.collection("roomTypes").createIndex({ propertyId: 1, status: 1 });

    // Seed two PUBLISHED properties.
    const propId1 = randomUUID();
    const propId2 = randomUUID();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db.collection("properties") as any).insertMany([
      {
        _id: propId1,
        vendorId: "v1",
        name: "Grand Sylhet Hotel",
        slug: `grand-sylhet-${randomUUID()}`,
        propertyType: "HOTEL",
        propertyClass: "STANDARD",
        districtId: "sylhet",
        location: { area: "Sylhet", addressLine: "Airport Road" },
        amenityKeys: ["wifi", "air-conditioning", "swimming-pool"],
        status: "PUBLISHED",
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      },
      {
        _id: propId2,
        vendorId: "v2",
        name: "Sreemangal Eco Resort",
        slug: `sreemangal-eco-${randomUUID()}`,
        propertyType: "ECO_RESORT",
        propertyClass: "BUDGET",
        districtId: "moulvibazar",
        location: { area: "Sreemangal", addressLine: "Lawachara Road" },
        amenityKeys: ["wifi", "nature-view"],
        status: "PUBLISHED",
        createdAt: new Date("2026-02-01"),
        updatedAt: new Date("2026-02-01"),
      },
    ]);

    // Seed room types with base prices.
    const roomId1 = randomUUID();
    const roomId2 = randomUUID();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db.collection("roomTypes") as any).insertMany([
      { _id: roomId1, propertyId: propId1, vendorId: "v1", status: "ACTIVE" },
      { _id: roomId2, propertyId: propId2, vendorId: "v2", status: "ACTIVE" },
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db.collection("ratePlans") as any).insertMany([
      { _id: randomUUID(), roomTypeId: roomId1, basePrice: 5000, status: "ACTIVE" },
      { _id: randomUUID(), roomTypeId: roomId2, basePrice: 2500, status: "ACTIVE" },
    ]);
  }, 60_000);

  afterAll(async () => {
    if (client) await client.close();
    if (mongod) await mongod.stop();
  }, 30_000);

  it("returns all PUBLISHED properties without filters", async () => {
    const result = await service.search({ page: 1, limit: 10, sort: "PRICE_ASC" });
    expect(result.data.length).toBe(2);
    expect(result.pagination.total).toBe(2);
  });

  it("filters by propertyType correctly", async () => {
    const result = await service.search({ propertyTypes: ["HOTEL"], page: 1, limit: 10, sort: "PRICE_ASC" });
    expect(result.data.length).toBe(1);
    expect(result.data[0].propertyType).toBe("HOTEL");
  });

  it("filters by amenityKeys — must satisfy ALL keys", async () => {
    const result = await service.search({
      amenityKeys: ["wifi", "swimming-pool"],
      page: 1,
      limit: 10,
      sort: "PRICE_ASC",
    });
    // Only the hotel has swimming-pool.
    expect(result.data.length).toBe(1);
    expect(result.data[0].name).toMatch(/Grand Sylhet/);
  });

  it("filters by destination (area partial match)", async () => {
    const result = await service.search({ destination: "Sreemangal", page: 1, limit: 10, sort: "PRICE_ASC" });
    expect(result.data.length).toBe(1);
    expect(result.data[0].districtId).toBe("moulvibazar");
  });

  it("sorts PRICE_ASC — lowest startingPrice first", async () => {
    const result = await service.search({ page: 1, limit: 10, sort: "PRICE_ASC" });
    const prices = result.data.map((p) => p.startingPrice);
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
    }
  });

  it("sorts PRICE_DESC — highest startingPrice first", async () => {
    const result = await service.search({ page: 1, limit: 10, sort: "PRICE_DESC" });
    const prices = result.data.map((p) => p.startingPrice);
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeLessThanOrEqual(prices[i - 1]);
    }
  });

  it("price range filter excludes properties outside range", async () => {
    // Only Eco Resort (2500) is within [0, 3000].
    const result = await service.search({ minPrice: 0, maxPrice: 3000, page: 1, limit: 10, sort: "PRICE_ASC" });
    expect(result.data.every((p) => p.startingPrice <= 3000)).toBe(true);
    expect(result.data.some((p) => p.propertyType === "ECO_RESORT")).toBe(true);
  });

  it("pagination returns correct page slices", async () => {
    const page1 = await service.search({ page: 1, limit: 1, sort: "PRICE_ASC" });
    const page2 = await service.search({ page: 2, limit: 1, sort: "PRICE_ASC" });
    expect(page1.data.length).toBe(1);
    expect(page2.data.length).toBe(1);
    expect(page1.data[0].id).not.toBe(page2.data[0].id);
    expect(page1.pagination.totalPages).toBe(2);
  });

  it("returns empty result for unmatched destination", async () => {
    const result = await service.search({ destination: "NONEXISTENT_PLACE_XYZ", page: 1, limit: 10, sort: "PRICE_ASC" });
    expect(result.data.length).toBe(0);
    expect(result.pagination.total).toBe(0);
  });
});
