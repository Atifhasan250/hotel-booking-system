import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import { AvailabilityService } from "../../availability/application/availability-service";
import type { RoomTypeVendorResolver } from "../../availability/application/ports";
import { MongoAvailabilityRepository, ensureAvailabilityIndexes } from "../../availability/infrastructure/mongo-availability-repository";
import { MongoAuditEventWriter, MongoRateLimiter } from "../../identity/infrastructure/mongo-identity-repositories";
import { getMongoClient, getMongoDatabase } from "../../../platform/db/mongo-client";
import { assertMongoTransactionSupport, MongoTransactionRunner } from "../../../platform/db/mongo-transaction";
import { BookingService } from "../application/booking-service";
import { BookingConfirmationUnavailableError } from "../application/errors";
import type { Booking, BookingConfirmationAdapter, BookingInventoryPort } from "../application/ports";
import { ensureBookingIndexes, MongoBookingRepository, MongoBookingSelectionResolver } from "./mongo-booking-repository";
import type { Db } from "mongodb";

class RoomVendorResolver implements RoomTypeVendorResolver {
  constructor(private readonly db: Db) {}
  async resolveVendorId(roomTypeId: string) { return (await this.db.collection<{ id: string; vendorId: string }>("roomTypes").findOne({ $or: [{ id: roomTypeId }, { _id: roomTypeId }] }, { projection: { vendorId: 1 } }))?.vendorId ?? null; }
}
class AvailabilityBookingAdapter implements BookingInventoryPort {
  constructor(private readonly service: AvailabilityService) {}
  async createHold(input: { bookingReference: string; roomTypeId: string; checkInDate: string; checkOutDate: string; quantity: number; idempotencyKey: string }, requestId: string) {
    const result = await this.service.mutate(null, { action: "CREATE_HOLD", bookingRef: input.bookingReference, roomTypeId: input.roomTypeId, checkInDate: input.checkInDate, checkOutDate: input.checkOutDate, quantity: input.quantity, holdDurationSeconds: 900, idempotencyKey: input.idempotencyKey }, { requestId });
    if (!("hold" in result)) throw new Error("Hold creation failed");
    return { holdId: result.hold._id, expiresAt: result.hold.expiresAt };
  }
  async consumeHold(bookingReference: string, requestId: string) { await this.service.mutate(null, { action: "CONSUME_HOLD", bookingRef: bookingReference }, { requestId }); }
}
class DisabledConfirmationAdapter implements BookingConfirmationAdapter {
  readonly kind = "DISABLED" as const;
  async confirm(_booking: Booking): Promise<{ confirmedAt: Date }> { throw new BookingConfirmationUnavailableError(); }
}

let servicePromise: Promise<BookingService> | undefined;
export function getBookingService() { servicePromise ??= create().catch((error) => { servicePromise = undefined; throw error; }); return servicePromise; }
async function create() {
  const [db, client] = await Promise.all([getMongoDatabase(), getMongoClient()]);
  const transactions = new MongoTransactionRunner(client);
  await Promise.all([ensureBookingIndexes(db), ensureAvailabilityIndexes(db), assertMongoTransactionSupport(transactions, db)]);
  const audit = new MongoAuditEventWriter(db, transactions); const rateLimiter = new MongoRateLimiter(db, transactions);
  const availability = new AvailabilityService({ repository: new MongoAvailabilityRepository(db, transactions), audit, transactions, rateLimiter, roomTypeVendorResolver: new RoomVendorResolver(db), ids: { create: randomUUID }, clock: { now: () => new Date() } });
  return new BookingService({ repository: new MongoBookingRepository(db, transactions), selections: new MongoBookingSelectionResolver(db, transactions), inventory: new AvailabilityBookingAdapter(availability), confirmation: new DisabledConfirmationAdapter(), transactions, rateLimiter, audit, ids: { create: randomUUID, publicReference: () => `BMR-${randomBytes(9).toString("base64url").toUpperCase()}` }, clock: { now: () => new Date() } });
}
