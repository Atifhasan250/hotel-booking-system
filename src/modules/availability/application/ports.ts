import type { AuditEventWriter } from "../../audit/domain/audit-event";
import type { RateLimiter, TransactionRunner } from "../../identity/application/ports";
import type { InventoryDay, InventoryHold } from "../domain/model";

export interface AvailabilityRepository {
  findInventoryDay(roomTypeId: string, localDate: string): Promise<InventoryDay | null>;
  findInventoryDays(roomTypeId: string, startDate: string, endDate: string): Promise<InventoryDay[]>;
  upsertInventoryDay(inventoryDay: InventoryDay): Promise<boolean>;
  claimInventoryDayVersion(inventoryDay: InventoryDay, at: Date): Promise<boolean>;
  
  createHoldIfAbsent(hold: InventoryHold): Promise<{ hold: InventoryHold; created: boolean }>;
  findHoldByIdempotencyKey(idempotencyKey: string): Promise<InventoryHold | null>;
  findHoldByBookingRef(bookingRef: string): Promise<InventoryHold | null>;
  updateHoldStatus(holdId: string, from: InventoryHold["status"], to: InventoryHold["status"], at: Date): Promise<boolean>;
  
  findActiveHoldsForRoomAndDates(roomTypeId: string, startDate: string, endDate: string): Promise<InventoryHold[]>;
}

/**
 * Resolves the vendor that owns a given room type.
 * Used to enforce tenant isolation: mutations must target a room type
 * owned by a vendor the actor is authorized to manage.
 */
export interface RoomTypeVendorResolver {
  resolveVendorId(roomTypeId: string): Promise<string | null>;
}

export interface AvailabilityDependencies {
  repository: AvailabilityRepository;
  audit: AuditEventWriter;
  transactions: TransactionRunner;
  rateLimiter: RateLimiter;
  /** Resolves roomTypeId → vendorId for authorization checks. */
  roomTypeVendorResolver: RoomTypeVendorResolver;
  ids: { create(): string };
  clock: { now(): Date };
}
