import "server-only";

import type { Collection, Db } from "mongodb";

import type { AvailabilityRepository } from "../application/ports";
import type { InventoryDay, InventoryHold } from "../domain/model";
import type { MongoTransactionRunner } from "../../../platform/db/mongo-transaction";

type Stored<T> = T;

export class MongoAvailabilityRepository implements AvailabilityRepository {
  private readonly inventoryDays: Collection<Stored<InventoryDay>>;
  private readonly inventoryHolds: Collection<Stored<InventoryHold>>;

  constructor(private readonly db: Db, private readonly transactions: MongoTransactionRunner) {
    this.inventoryDays = db.collection("inventoryDays");
    this.inventoryHolds = db.collection("inventoryHolds");
  }

  async findInventoryDay(roomTypeId: string, localDate: string): Promise<InventoryDay | null> {
    const result = await this.inventoryDays.findOne({ roomTypeId, localDate }, { session: this.transactions.current() });
    return result;
  }

  async findInventoryDays(roomTypeId: string, startDate: string, endDate: string): Promise<InventoryDay[]> {
    const result = await this.inventoryDays
      .find({ roomTypeId, localDate: { $gte: startDate, $lte: endDate } }, { session: this.transactions.current() })
      .toArray();
    return result;
  }

  async upsertInventoryDay(inventoryDay: InventoryDay): Promise<boolean> {
    const result = await this.inventoryDays.updateOne(
      { roomTypeId: inventoryDay.roomTypeId, localDate: inventoryDay.localDate },
      { $set: inventoryDay },
      { upsert: true, session: this.transactions.current() }
    );
    return result.acknowledged;
  }

  async claimInventoryDayVersion(inventoryDay: InventoryDay, at: Date): Promise<boolean> {
    const result = await this.inventoryDays.updateOne(
      {
        _id: inventoryDay._id,
        roomTypeId: inventoryDay.roomTypeId,
        localDate: inventoryDay.localDate,
        version: inventoryDay.version,
      },
      { $inc: { version: 1 }, $set: { updatedAt: at.toISOString() } },
      { session: this.transactions.current() },
    );
    return result.modifiedCount === 1;
  }

  async createHoldIfAbsent(hold: InventoryHold) {
    const result = await this.inventoryHolds.findOneAndUpdate(
      { idempotencyKey: hold.idempotencyKey },
      { $setOnInsert: hold },
      { upsert: true, returnDocument: "after", includeResultMetadata: true, session: this.transactions.current() }
    );
    if (!result.value) throw new Error("Hold upsert did not return a document");
    return { hold: result.value, created: result.lastErrorObject?.upserted !== undefined };
  }

  async findHoldByIdempotencyKey(idempotencyKey: string): Promise<InventoryHold | null> {
    return this.inventoryHolds.findOne({ idempotencyKey }, { session: this.transactions.current() });
  }

  async findHoldByBookingRef(bookingRef: string): Promise<InventoryHold | null> {
    return this.inventoryHolds.findOne({ bookingRef }, { session: this.transactions.current() });
  }

  async updateHoldStatus(holdId: string, from: InventoryHold["status"], to: InventoryHold["status"], at: Date): Promise<boolean> {
    const result = await this.inventoryHolds.updateOne(
      { _id: holdId, status: from },
      { $set: { status: to, updatedAt: at.toISOString() } },
      { session: this.transactions.current() }
    );
    return result.modifiedCount > 0;
  }

  async findActiveHoldsForRoomAndDates(roomTypeId: string, startDate: string, endDate: string): Promise<InventoryHold[]> {
    return this.inventoryHolds.find({
      roomTypeId,
      status: "ACTIVE",
      localDates: { $elemMatch: { $gte: startDate, $lte: endDate } },
    }, { session: this.transactions.current() }).toArray();
  }
}

let indexPromise: Promise<void> | undefined;

export function ensureAvailabilityIndexes(db: Db): Promise<void> {
  indexPromise ??= Promise.all([
    // Unique constraint prevents double-upsert for same (roomType, date).
    db.collection("inventoryDays").createIndex({ roomTypeId: 1, localDate: 1 }, { unique: true }),
    // Range scan support for availability checks.
    db.collection("inventoryDays").createIndex({ roomTypeId: 1, localDate: 1, stopSell: 1 }),
    // Hold lookups by booking reference.
    db.collection("inventoryHolds").createIndex({ bookingRef: 1 }, { unique: true }),
    // Idempotency key uniqueness for hold creation.
    db.collection("inventoryHolds").createIndex({ idempotencyKey: 1 }, { unique: true }),
    // Overlapping-hold check: room type, status, and dates array.
    db.collection("inventoryHolds").createIndex({ roomTypeId: 1, status: 1, localDates: 1 }),
    // TTL safety net for expired holds (cleanup only, not correctness).
    db.collection("inventoryHolds").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]).then(() => undefined).catch((error) => { indexPromise = undefined; throw error; });
  return indexPromise;
}
