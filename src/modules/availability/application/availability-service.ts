import { randomUUID } from "node:crypto";
import type { ActorContext } from "../../identity/domain/model";
import { isAuthorized } from "../../identity/application/authorization";
import type { AvailabilityDependencies } from "./ports";
import { AvailabilityErrors } from "./errors";
import type { AvailabilityMutationInput } from "../domain/schemas";
import type { InventoryDay, InventoryHold } from "../domain/model";
import { expandDateRange, expandNights } from "../../../shared/money/date-range";

export interface AvailabilityRequestContext {
  requestId: string;
}

export class AvailabilityService {
  constructor(private readonly deps: AvailabilityDependencies) {}

  async mutate(actor: ActorContext | null, input: AvailabilityMutationInput, context: AvailabilityRequestContext) {
    if (actor) {
      const key = `availability:${input.action.toLowerCase()}:${actor.userId}`;
      if (!await this.deps.rateLimiter.consume(key, 120, 300)) {
        await this.deps.audit.append({ id: randomUUID(), actorId: actor.userId, action: "availability.rate-limit", targetType: "availability", outcome: "DENIED", requestId: context.requestId, occurredAt: this.deps.clock.now(), metadata: { mutation: input.action } });
        throw new Error("Rate limit exceeded");
      }
    }
    
    switch (input.action) {
      case "UPDATE_INVENTORY_DAY": return this.updateInventoryDay(actor, input, context);
      case "BULK_UPDATE_INVENTORY": return this.bulkUpdateInventory(actor, input, context);
      case "CREATE_HOLD": return this.createHold(actor, input, context);
      case "CONSUME_HOLD": return this.consumeHold(actor, input, context);
      case "RELEASE_HOLD": return this.releaseHold(actor, input, context);
    }
  }

  private async updateInventoryDay(actor: ActorContext | null, input: Extract<AvailabilityMutationInput, { action: "UPDATE_INVENTORY_DAY" }>, context: AvailabilityRequestContext) {
    // Resolve the vendorId for this roomType to enforce tenant isolation.
    const vendorId = await this.deps.roomTypeVendorResolver.resolveVendorId(input.roomTypeId);
    if (!vendorId) throw new Error("Room type not found");

    if (!actor || !isAuthorized(actor, { scope: "vendor", vendorId, permission: "vendor:inventory:manage" })) {
      await this.denyAudit(actor, "availability.inventory.update.denied", "roomType", input.roomTypeId, context);
      throw new Error("Forbidden");
    }
    
    const now = this.deps.clock.now();
    return this.deps.transactions.run(async () => {
      const existing = await this.deps.repository.findInventoryDay(input.roomTypeId, input.localDate);
      
      const inventoryDay: InventoryDay = {
        _id: existing?._id ?? this.deps.ids.create(),
        roomTypeId: input.roomTypeId,
        localDate: input.localDate,
        capacity: input.capacity ?? existing?.capacity ?? 0,
        adjustment: input.adjustment ?? existing?.adjustment ?? 0,
        stopSell: input.stopSell ?? existing?.stopSell ?? false,
        minStay: input.minStay ?? existing?.minStay,
        maxStay: input.maxStay ?? existing?.maxStay,
        version: (existing?.version ?? 0) + 1,
        createdAt: existing?.createdAt ?? now.toISOString(),
        updatedAt: now.toISOString(),
      };
      
      await this.deps.repository.upsertInventoryDay(inventoryDay);
      await this.audit(actor.userId, "availability.inventory.update", "roomType", input.roomTypeId, context, { date: input.localDate });
      
      return { success: true };
    });
  }

  private async bulkUpdateInventory(actor: ActorContext | null, input: Extract<AvailabilityMutationInput, { action: "BULK_UPDATE_INVENTORY" }>, context: AvailabilityRequestContext) {
    // Resolve vendorId for tenant isolation check.
    const vendorId = await this.deps.roomTypeVendorResolver.resolveVendorId(input.roomTypeId);
    if (!vendorId) throw new Error("Room type not found");

    if (!actor || !isAuthorized(actor, { scope: "vendor", vendorId, permission: "vendor:inventory:manage" })) {
      await this.denyAudit(actor, "availability.inventory.bulk_update.denied", "roomType", input.roomTypeId, context);
      throw new Error("Forbidden");
    }

    if (input.endDate < input.startDate) throw new Error("endDate must be >= startDate");

    // Expand the full date range [startDate, endDate] inclusive.
    const dates = expandDateRange(input.startDate, input.endDate);
    const now = this.deps.clock.now();

    return this.deps.transactions.run(async () => {
      // Fetch all existing InventoryDay records for the range in one query.
      const existingDays = await this.deps.repository.findInventoryDays(input.roomTypeId, input.startDate, input.endDate);
      const existingByDate = new Map(existingDays.map((d) => [d.localDate, d]));

      for (const date of dates) {
        const existing = existingByDate.get(date);
        const inventoryDay: InventoryDay = {
          _id: existing?._id ?? this.deps.ids.create(),
          roomTypeId: input.roomTypeId,
          localDate: date,
          capacity: input.capacity ?? existing?.capacity ?? 0,
          adjustment: input.adjustment ?? existing?.adjustment ?? 0,
          stopSell: input.stopSell ?? existing?.stopSell ?? false,
          minStay: input.minStay ?? existing?.minStay,
          maxStay: input.maxStay ?? existing?.maxStay,
          version: (existing?.version ?? 0) + 1,
          createdAt: existing?.createdAt ?? now.toISOString(),
          updatedAt: now.toISOString(),
        };
        await this.deps.repository.upsertInventoryDay(inventoryDay);
      }

      await this.audit(actor.userId, "availability.inventory.bulk_update", "roomType", input.roomTypeId, context, { startDate: input.startDate, endDate: input.endDate, datesCount: dates.length });
      return { success: true, datesUpdated: dates.length };
    });
  }

  private async createHold(actor: ActorContext | null, input: Extract<AvailabilityMutationInput, { action: "CREATE_HOLD" }>, context: AvailabilityRequestContext) {
    const actorId = actor?.userId ?? "SYSTEM";
    const now = this.deps.clock.now();

    // 1. Basic date validation: check-out must be strictly after check-in.
    if (input.checkOutDate <= input.checkInDate) {
      throw AvailabilityErrors.INVALID_DATES();
    }

    // 2. Expand the stay into nightly local-date strings [checkIn, checkOut).
    const nightDates = expandNights(input.checkInDate, input.checkOutDate);
    if (nightDates.length === 0) throw AvailabilityErrors.INVALID_DATES();

    const expiresAt = new Date(now.getTime() + input.holdDurationSeconds * 1000);

    return this.deps.transactions.run(async () => {
      const lastNight = nightDates[nightDates.length - 1];

      const replay = await this.deps.repository.findHoldByIdempotencyKey(input.idempotencyKey);
      if (replay) {
        const holdDurationMilliseconds = new Date(replay.expiresAt).getTime() - new Date(replay.createdAt).getTime();
        const sameRequest = replay.bookingRef === input.bookingRef
          && replay.roomTypeId === input.roomTypeId
          && replay.quantity === input.quantity
          && holdDurationMilliseconds === input.holdDurationSeconds * 1000
          && replay.localDates.length === nightDates.length
          && replay.localDates.every((date, index) => date === nightDates[index]);
        if (!sameRequest) throw AvailabilityErrors.IDEMPOTENCY_CONFLICT();
        return { hold: replay, idempotentReplay: true };
      }

      // One booking reference cannot own multiple holds under different idempotency keys.
      if (await this.deps.repository.findHoldByBookingRef(input.bookingRef)) {
        throw AvailabilityErrors.IDEMPOTENCY_CONFLICT();
      }

      // 3. Read all inventory days for the stay range atomically within the transaction.
      const inventoryDays = await this.deps.repository.findInventoryDays(
        input.roomTypeId,
        input.checkInDate,
        lastNight,
      );
      const dayByDate = new Map(inventoryDays.map((d) => [d.localDate, d]));

      // 4. Read all active holds overlapping the stay range atomically.
      const activeHolds = await this.deps.repository.findActiveHoldsForRoomAndDates(
        input.roomTypeId,
        input.checkInDate,
        lastNight,
      );

      // Count active (non-expired) holds per date.
      const heldByDate = new Map<string, number>();
      for (const hold of activeHolds) {
        // Ignore holds that are already expired — they must not block availability.
        if (new Date(hold.expiresAt) <= now) continue;
        for (const d of hold.localDates) {
          heldByDate.set(d, (heldByDate.get(d) ?? 0) + hold.quantity);
        }
      }

      // 5. For each night, compute sellable inventory and confirm capacity.
      for (const date of nightDates) {
        const day = dayByDate.get(date);
        const capacity = day?.capacity ?? 0;
        const adjustment = day?.adjustment ?? 0;
        const stopSell = day?.stopSell ?? false;

        if (stopSell) {
          throw AvailabilityErrors.NOT_AVAILABLE(`Stop-sell is active for ${date}`);
        }

        const heldQty = heldByDate.get(date) ?? 0;
        const sellable = capacity + adjustment - heldQty;

        if (sellable < input.quantity) {
          throw AvailabilityErrors.NOT_AVAILABLE(`Insufficient availability on ${date}: sellable=${sellable}, requested=${input.quantity}`);
        }
      }

      // Conditionally write every shared inventory day before inserting the hold. Concurrent
      // transactions that read the same versions now contend; MongoDB retries one transaction,
      // which then re-reads active holds and cannot oversell the refreshed snapshot.
      for (const date of nightDates) {
        const day = dayByDate.get(date);
        if (!day || !await this.deps.repository.claimInventoryDayVersion(day, now)) {
          throw AvailabilityErrors.NOT_AVAILABLE(`Inventory changed while holding ${date}`);
        }
      }

      // Create the hold atomically; idempotency key prevents duplicates on replay.
      const hold: InventoryHold = {
        _id: this.deps.ids.create(),
        bookingRef: input.bookingRef,
        roomTypeId: input.roomTypeId,
        localDates: nightDates,  // All nights correctly expanded.
        quantity: input.quantity,
        status: "ACTIVE",
        expiresAt: expiresAt.toISOString(),
        idempotencyKey: input.idempotencyKey,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      const result = await this.deps.repository.createHoldIfAbsent(hold);

      if (result.created) {
        await this.audit(actorId, "availability.hold.create", "booking", input.bookingRef, context, { roomTypeId: input.roomTypeId, quantity: input.quantity, nights: nightDates.length });
      }

      return { hold: result.hold, idempotentReplay: !result.created };
    });
  }
  
  private async consumeHold(actor: ActorContext | null, input: Extract<AvailabilityMutationInput, { action: "CONSUME_HOLD" }>, context: AvailabilityRequestContext) {
      const actorId = actor?.userId ?? "SYSTEM";
      const now = this.deps.clock.now();
      
      return this.deps.transactions.run(async () => {
         const hold = await this.deps.repository.findHoldByBookingRef(input.bookingRef);
         if (!hold) throw AvailabilityErrors.HOLD_NOT_FOUND();
         
         if (hold.status === "CONSUMED") return { success: true, idempotentReplay: true };
         if (hold.status !== "ACTIVE") throw AvailabilityErrors.HOLD_ALREADY_CONSUMED(); // or released
         
         const isExpired = new Date(hold.expiresAt) < now;
         if (isExpired) throw AvailabilityErrors.HOLD_EXPIRED();
         
         const changed = await this.deps.repository.updateHoldStatus(hold._id, "ACTIVE", "CONSUMED", now);
         if (!changed) throw AvailabilityErrors.HOLD_NOT_FOUND();
         
         await this.audit(actorId, "availability.hold.consume", "booking", input.bookingRef, context, { holdId: hold._id });
         return { success: true };
      });
  }

  private async releaseHold(actor: ActorContext | null, input: Extract<AvailabilityMutationInput, { action: "RELEASE_HOLD" }>, context: AvailabilityRequestContext) {
      const actorId = actor?.userId ?? "SYSTEM";
      const now = this.deps.clock.now();
      
      return this.deps.transactions.run(async () => {
         const hold = await this.deps.repository.findHoldByBookingRef(input.bookingRef);
         if (!hold) return { success: true }; // already gone or never existed
         
         if (hold.status === "RELEASED") return { success: true, idempotentReplay: true };
         if (hold.status === "CONSUMED") throw AvailabilityErrors.HOLD_ALREADY_CONSUMED();
         
         const changed = await this.deps.repository.updateHoldStatus(hold._id, "ACTIVE", "RELEASED", now);
         if (changed) {
            await this.audit(actorId, "availability.hold.release", "booking", input.bookingRef, context, { holdId: hold._id });
         }
         return { success: true };
      });
  }

  private async audit(actorId: string, action: string, targetType: string, targetId: string, context: AvailabilityRequestContext, metadata: Record<string, string | number | boolean>) {
    await this.deps.audit.append({
      id: this.deps.ids.create(),
      actorId,
      action,
      targetType,
      targetId,
      outcome: "SUCCESS",
      requestId: context.requestId,
      occurredAt: this.deps.clock.now(),
      metadata,
    });
  }

  private async denyAudit(actor: ActorContext | null, action: string, targetType: string, targetId: string, context: AvailabilityRequestContext) {
    await this.deps.audit.append({
      id: this.deps.ids.create(),
      actorId: actor?.userId ?? "anonymous",
      action,
      targetType,
      targetId,
      outcome: "DENIED",
      requestId: context.requestId,
      occurredAt: this.deps.clock.now(),
      metadata: {},
    });
  }
}
