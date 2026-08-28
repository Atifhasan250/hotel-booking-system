import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";

import { MongoAvailabilityRepository, ensureAvailabilityIndexes } from "../../src/modules/availability/infrastructure/mongo-availability-repository";
import { MongoTransactionRunner } from "../../src/platform/db/mongo-transaction";
import { AvailabilityService } from "../../src/modules/availability/application/availability-service";
import { MongoAuditEventWriter, MongoRateLimiter } from "../../src/modules/identity/infrastructure/mongo-identity-repositories";
import type { RoomTypeVendorResolver } from "../../src/modules/availability/application/ports";
import type { ActorContext } from "../../src/modules/identity/domain/model";
import { AvailabilityError } from "../../src/modules/availability/application/errors";

/** Stub resolver — all room types belong to the single test vendor. */
const stubResolver: RoomTypeVendorResolver = {
  resolveVendorId: async () => "vendor-001",
};

/** Vendor actor that belongs to vendor-001. */
function vendorActor(): ActorContext {
  return {
    userId: "user-001",
    customerId: "cust-001",
    vendorMemberships: [{ vendorId: "vendor-001", role: "OWNER", permissions: [], status: "ACTIVE" }],
    adminPermissions: [],
    superAdmin: false,
  };
}

describe("Availability integration — real MongoDB replica set", () => {
  let replicaSet: MongoMemoryReplSet;
  let client: MongoClient;
  let service: AvailabilityService;
  let db: ReturnType<MongoClient["db"]>;

  beforeAll(async () => {
    replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
    client = await MongoClient.connect(replicaSet.getUri());
    const dbName = `book_my_room_avail_test_${randomUUID().replaceAll("-", "")}`;
    db = client.db(dbName);
    const transactions = new MongoTransactionRunner(client);
    await ensureAvailabilityIndexes(db);

    service = new AvailabilityService({
      repository: new MongoAvailabilityRepository(db, transactions),
      audit: new MongoAuditEventWriter(db, transactions),
      transactions,
      rateLimiter: new MongoRateLimiter(db, transactions),
      roomTypeVendorResolver: stubResolver,
      ids: { create: () => randomUUID() },
      clock: { now: () => new Date() },
    });
  }, 180_000);

  afterAll(async () => {
    if (client) await client.close();
    if (replicaSet) await replicaSet.stop();
  }, 30_000);

  // ── helpers ──────────────────────────────────────────────────────────────

  function ctx() {
    return { requestId: randomUUID() };
  }

  async function setInventory(roomTypeId: string, dates: string[], capacity: number, stopSell = false) {
    for (const date of dates) {
      await service.mutate(vendorActor(), {
        action: "UPDATE_INVENTORY_DAY",
        roomTypeId,
        localDate: date,
        capacity,
        adjustment: 0,
        stopSell,
      }, ctx());
    }
  }

  // ── tests ─────────────────────────────────────────────────────────────────

  it("UPDATE_INVENTORY_DAY persists and upserts correctly", async () => {
    const roomId = `room-${randomUUID()}`;
    await service.mutate(vendorActor(), {
      action: "UPDATE_INVENTORY_DAY",
      roomTypeId: roomId,
      localDate: "2026-10-01",
      capacity: 5,
      stopSell: false,
    }, ctx());

    const doc = await db.collection("inventoryDays").findOne({ roomTypeId: roomId, localDate: "2026-10-01" });
    expect(doc?.capacity).toBe(5);
    expect(doc?.stopSell).toBe(false);
    expect(doc?.version).toBe(1);

    // Upsert — version should increment.
    await service.mutate(vendorActor(), {
      action: "UPDATE_INVENTORY_DAY",
      roomTypeId: roomId,
      localDate: "2026-10-01",
      capacity: 8,
    }, ctx());
    const updated = await db.collection("inventoryDays").findOne({ roomTypeId: roomId, localDate: "2026-10-01" });
    expect(updated?.capacity).toBe(8);
    expect(updated?.version).toBe(2);
  });

  it("BULK_UPDATE_INVENTORY creates all dates in [startDate, endDate]", async () => {
    const roomId = `room-${randomUUID()}`;
    const result = await service.mutate(vendorActor(), {
      action: "BULK_UPDATE_INVENTORY",
      roomTypeId: roomId,
      startDate: "2026-11-01",
      endDate: "2026-11-05",
      capacity: 4,
      stopSell: false,
    }, ctx());

    // Expect 5 dates: Nov 1, 2, 3, 4, 5.
    const bulkResult = result as unknown as { datesUpdated: number };
    expect(bulkResult.datesUpdated).toBe(5);
    const count = await db.collection("inventoryDays").countDocuments({ roomTypeId: roomId });
    expect(count).toBe(5);
  });

  it("CREATE_HOLD expands all nights in localDates array", async () => {
    const roomId = `room-${randomUUID()}`;
    await setInventory(roomId, ["2026-12-01", "2026-12-02", "2026-12-03"], 5);

    const res = await service.mutate(null, {
      action: "CREATE_HOLD",
      idempotencyKey: `ik-${randomUUID()}`,
      bookingRef: `bk-${randomUUID()}`,
      roomTypeId: roomId,
      checkInDate: "2026-12-01",
      checkOutDate: "2026-12-04", // 3 nights: Dec 1, 2, 3
      quantity: 1,
      holdDurationSeconds: 900,
    }, ctx()) as { hold: { localDates: string[]; status: string }; idempotentReplay: boolean };

    expect(res?.hold.localDates).toEqual(["2026-12-01", "2026-12-02", "2026-12-03"]);
    expect(res?.hold.status).toBe("ACTIVE");
  });

  it("CREATE_HOLD is idempotent — same idempotencyKey returns existing hold", async () => {
    const roomId = `room-${randomUUID()}`;
    await setInventory(roomId, ["2027-01-10", "2027-01-11"], 5);

    const key = `ik-${randomUUID()}`;
    const bkRef = `bk-${randomUUID()}`;
    const input = {
      action: "CREATE_HOLD" as const,
      idempotencyKey: key,
      bookingRef: bkRef,
      roomTypeId: roomId,
      checkInDate: "2027-01-10",
      checkOutDate: "2027-01-12",
      quantity: 1,
      holdDurationSeconds: 900,
    };

    const first = await service.mutate(null, input, ctx()) as { hold: { _id: string }; idempotentReplay: boolean };
    const second = await service.mutate(null, input, ctx()) as { hold: { _id: string }; idempotentReplay: boolean };

    expect(first?.hold._id).toBe(second?.hold._id);
    expect(second?.idempotentReplay).toBe(true);
  });

  it("CREATE_HOLD blocks when stop-sell is active for any night", async () => {
    const roomId = `room-${randomUUID()}`;
    await setInventory(roomId, ["2027-02-01"], 5);
    await setInventory(roomId, ["2027-02-02"], 5, true); // stop-sell

    await expect(
      service.mutate(null, {
        action: "CREATE_HOLD",
        idempotencyKey: `ik-${randomUUID()}`,
        bookingRef: `bk-${randomUUID()}`,
        roomTypeId: roomId,
        checkInDate: "2027-02-01",
        checkOutDate: "2027-02-03",
        quantity: 1,
        holdDurationSeconds: 900,
      }, ctx()),
    ).rejects.toThrow(AvailabilityError);
  });

  it("CREATE_HOLD prevents oversell — sequential holds beyond capacity are rejected", async () => {
    const roomId = `room-${randomUUID()}`;
    const capacity = 3;
    await setInventory(roomId, ["2027-03-01", "2027-03-02"], capacity);

    let fulfilled = 0;
    let rejected = 0;

    // Sequential attempts: after capacity is exhausted the service MUST reject.
    for (let i = 0; i < 6; i++) {
      try {
        await service.mutate(null, {
          action: "CREATE_HOLD",
          idempotencyKey: `ik-${randomUUID()}-${i}`,
          bookingRef: `bk-${randomUUID()}-${i}`,
          roomTypeId: roomId,
          checkInDate: "2027-03-01",
          checkOutDate: "2027-03-03",
          quantity: 1,
          holdDurationSeconds: 900,
        }, ctx());
        fulfilled++;
      } catch {
        rejected++;
      }
    }

    // Exactly `capacity` holds must succeed; the rest must be rejected.
    expect(fulfilled).toBe(capacity);
    expect(rejected).toBe(6 - capacity);
  });

  it("CREATE_HOLD prevents oversell under gated concurrent transactions", async () => {
    const roomId = `room-${randomUUID()}`;
    const capacity = 3;
    const attempts = 12;
    await setInventory(roomId, ["2027-03-10", "2027-03-11"], capacity);

    let releaseStart!: () => void;
    const start = new Promise<void>((resolve) => { releaseStart = resolve; });
    const pending = Array.from({ length: attempts }, async (_, index) => {
      await start;
      return service.mutate(null, {
        action: "CREATE_HOLD",
        idempotencyKey: `concurrent-ik-${randomUUID()}-${index}`,
        bookingRef: `concurrent-bk-${randomUUID()}-${index}`,
        roomTypeId: roomId,
        checkInDate: "2027-03-10",
        checkOutDate: "2027-03-12",
        quantity: 1,
        holdDurationSeconds: 900,
      }, ctx());
    });

    releaseStart();
    const settled = await Promise.allSettled(pending);
    const fulfilled = settled.filter((result) => result.status === "fulfilled");
    const rejected = settled.filter((result) => result.status === "rejected");
    const activeHolds = await db.collection("inventoryHolds").find({ roomTypeId: roomId, status: "ACTIVE" }).toArray();

    expect(fulfilled).toHaveLength(capacity);
    expect(rejected).toHaveLength(attempts - capacity);
    expect(activeHolds.reduce((sum, hold) => sum + Number(hold.quantity), 0)).toBe(capacity);
    expect(activeHolds.every((hold) => hold.localDates.includes("2027-03-10") && hold.localDates.includes("2027-03-11"))).toBe(true);
  });

  it("CREATE_HOLD binds an idempotency key to the original request", async () => {
    const roomId = `room-${randomUUID()}`;
    await setInventory(roomId, ["2027-03-20"], 2);
    const idempotencyKey = `bound-ik-${randomUUID()}`;
    const bookingRef = `bound-bk-${randomUUID()}`;

    await service.mutate(null, {
      action: "CREATE_HOLD",
      idempotencyKey,
      bookingRef,
      roomTypeId: roomId,
      checkInDate: "2027-03-20",
      checkOutDate: "2027-03-21",
      quantity: 1,
      holdDurationSeconds: 900,
    }, ctx());

    await expect(service.mutate(null, {
      action: "CREATE_HOLD",
      idempotencyKey,
      bookingRef: `${bookingRef}-changed`,
      roomTypeId: roomId,
      checkInDate: "2027-03-20",
      checkOutDate: "2027-03-21",
      quantity: 1,
      holdDurationSeconds: 900,
    }, ctx())).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });

  it("CREATE_HOLD converges concurrent same-key retries to one hold", async () => {
    const roomId = `room-${randomUUID()}`;
    await setInventory(roomId, ["2027-03-25"], 1);
    const input = {
      action: "CREATE_HOLD" as const,
      idempotencyKey: `retry-ik-${randomUUID()}`,
      bookingRef: `retry-bk-${randomUUID()}`,
      roomTypeId: roomId,
      checkInDate: "2027-03-25",
      checkOutDate: "2027-03-26",
      quantity: 1,
      holdDurationSeconds: 900,
    };

    let releaseStart!: () => void;
    const start = new Promise<void>((resolve) => { releaseStart = resolve; });
    const calls = Array.from({ length: 4 }, async () => {
      await start;
      return service.mutate(null, input, ctx()) as Promise<{ hold: { _id: string }; idempotentReplay: boolean }>;
    });
    releaseStart();
    const results = await Promise.all(calls);
    const holdIds = new Set(results.map((result) => result.hold._id));

    expect(holdIds.size).toBe(1);
    expect(await db.collection("inventoryHolds").countDocuments({ idempotencyKey: input.idempotencyKey })).toBe(1);
    expect(results.filter((result) => result.idempotentReplay)).toHaveLength(3);
  });

  it("CREATE_HOLD rejects a second idempotency key for the same booking", async () => {
    const roomId = `room-${randomUUID()}`;
    await setInventory(roomId, ["2027-03-27"], 2);
    const bookingRef = `one-hold-bk-${randomUUID()}`;
    const base = {
      action: "CREATE_HOLD" as const,
      bookingRef,
      roomTypeId: roomId,
      checkInDate: "2027-03-27",
      checkOutDate: "2027-03-28",
      quantity: 1,
      holdDurationSeconds: 900,
    };

    await service.mutate(null, { ...base, idempotencyKey: `first-${randomUUID()}` }, ctx());
    await expect(service.mutate(null, { ...base, idempotencyKey: `second-${randomUUID()}` }, ctx()))
      .rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    expect(await db.collection("inventoryHolds").countDocuments({ bookingRef })).toBe(1);
  });

  it("Expired holds do not block new holds for the same dates", async () => {
    const roomId = `room-${randomUUID()}`;
    await setInventory(roomId, ["2027-04-01"], 2);

    // Create a hold that expires immediately (1 second).
    const expiredKey = `ik-${randomUUID()}`;
    await service.mutate(null, {
      action: "CREATE_HOLD",
      idempotencyKey: expiredKey,
      bookingRef: `bk-${randomUUID()}`,
      roomTypeId: roomId,
      checkInDate: "2027-04-01",
      checkOutDate: "2027-04-02",
      quantity: 2,
      holdDurationSeconds: 1,
    }, ctx());

    // Manually mark the hold as expired so the next read ignores it.
    await db.collection("inventoryHolds").updateMany(
      { idempotencyKey: expiredKey },
      { $set: { expiresAt: new Date(Date.now() - 10_000).toISOString() } },
    );

    // A new hold should succeed because expired holds don't count.
    const newHold = await service.mutate(null, {
      action: "CREATE_HOLD",
      idempotencyKey: `ik-${randomUUID()}`,
      bookingRef: `bk-${randomUUID()}`,
      roomTypeId: roomId,
      checkInDate: "2027-04-01",
      checkOutDate: "2027-04-02",
      quantity: 2,
      holdDurationSeconds: 900,
    }, ctx()) as { hold: { status: string } };

    expect(newHold?.hold.status).toBe("ACTIVE");
  });

  it("CONSUME_HOLD transitions status to CONSUMED", async () => {
    const roomId = `room-${randomUUID()}`;
    await setInventory(roomId, ["2027-05-01"], 5);

    const bkRef = `bk-${randomUUID()}`;
    await service.mutate(null, {
      action: "CREATE_HOLD",
      idempotencyKey: `ik-${randomUUID()}`,
      bookingRef: bkRef,
      roomTypeId: roomId,
      checkInDate: "2027-05-01",
      checkOutDate: "2027-05-02",
      quantity: 1,
      holdDurationSeconds: 900,
    }, ctx());

    await service.mutate(null, {
      action: "CONSUME_HOLD",
      idempotencyKey: `ik-${randomUUID()}`,
      bookingRef: bkRef,
    }, ctx());

    const hold = await db.collection("inventoryHolds").findOne({ bookingRef: bkRef });
    expect(hold?.status).toBe("CONSUMED");
  });

  it("RELEASE_HOLD transitions status to RELEASED", async () => {
    const roomId = `room-${randomUUID()}`;
    await setInventory(roomId, ["2027-06-10"], 5);

    const bkRef = `bk-${randomUUID()}`;
    await service.mutate(null, {
      action: "CREATE_HOLD",
      idempotencyKey: `ik-${randomUUID()}`,
      bookingRef: bkRef,
      roomTypeId: roomId,
      checkInDate: "2027-06-10",
      checkOutDate: "2027-06-11",
      quantity: 1,
      holdDurationSeconds: 900,
    }, ctx());

    await service.mutate(null, { action: "RELEASE_HOLD", bookingRef: bkRef }, ctx());

    const hold = await db.collection("inventoryHolds").findOne({ bookingRef: bkRef });
    expect(hold?.status).toBe("RELEASED");
  });
});
