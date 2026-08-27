import { randomUUID } from "node:crypto";
import type { ActorContext } from "../../identity/domain/model";
import { isAuthorized } from "../../identity/application/authorization";
import type { PricingDependencies } from "./ports";
import type { PricingMutationInput } from "../domain/schemas";
import type { Offer, RateOverride, RatePlan } from "../domain/model";

export interface PricingRequestContext {
  requestId: string;
}

export class PricingService {
  constructor(private readonly deps: PricingDependencies) {}

  async mutate(actor: ActorContext | null, input: PricingMutationInput, context: PricingRequestContext) {
    if (actor) {
      const key = `pricing:${input.action.toLowerCase()}:${actor.userId}`;
      if (!await this.deps.rateLimiter.consume(key, 120, 300)) {
        await this.deps.audit.append({ id: randomUUID(), actorId: actor.userId, action: "pricing.rate-limit", targetType: "pricing", outcome: "DENIED", requestId: context.requestId, occurredAt: this.deps.clock.now(), metadata: { mutation: input.action } });
        throw new Error("Rate limit exceeded");
      }
    }
    
    switch (input.action) {
      case "CREATE_RATE_PLAN": return this.createRatePlan(actor, input, context);
      case "UPDATE_RATE_OVERRIDE": return this.updateRateOverride(actor, input, context);
      case "CREATE_OFFER": return this.createOffer(actor, input, context);
    }
  }

  private async createRatePlan(actor: ActorContext | null, input: Extract<PricingMutationInput, { action: "CREATE_RATE_PLAN" }>, context: PricingRequestContext) {
    // Resolve the owning vendorId from the roomType for tenant isolation.
    const vendorId = await this.deps.roomTypeVendorResolver.resolveVendorId(input.roomTypeId);
    if (!vendorId) throw new Error("Room type not found");

    if (!actor || !isAuthorized(actor, { scope: "vendor", vendorId, permission: "vendor:inventory:manage" })) {
      await this.denyAudit(actor, "pricing.rate_plan.create.denied", "ratePlan", input.roomTypeId, context);
      throw new Error("Forbidden");
    }
    
    const now = this.deps.clock.now();
    return this.deps.transactions.run(async () => {
      const ratePlan: RatePlan = {
        _id: this.deps.ids.create(),
        roomTypeId: input.roomTypeId,
        name: input.name,
        cancellationPolicy: input.cancellationPolicy,
        mealPlan: input.mealPlan,
        occupancyRules: input.occupancyRules,
        basePrice: input.basePrice,
        status: "ACTIVE",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      
      const result = await this.deps.repository.createRatePlanIfAbsent(ratePlan, input.idempotencyKey);
      
      if (result.created) {
        await this.audit(actor.userId, "pricing.rate_plan.create", "ratePlan", result.ratePlan._id, context, { roomTypeId: input.roomTypeId });
      }
      
      return { ratePlan: result.ratePlan, idempotentReplay: !result.created };
    });
  }

  private async updateRateOverride(actor: ActorContext | null, input: Extract<PricingMutationInput, { action: "UPDATE_RATE_OVERRIDE" }>, context: PricingRequestContext) {
    // Resolve the owning vendor via the rate plan's roomTypeId.
    const ratePlan = await this.deps.repository.findRatePlan(input.ratePlanId);
    if (!ratePlan) throw new Error("Rate plan not found");

    const vendorId = await this.deps.roomTypeVendorResolver.resolveVendorId(ratePlan.roomTypeId);
    if (!vendorId) throw new Error("Room type not found");

    if (!actor || !isAuthorized(actor, { scope: "vendor", vendorId, permission: "vendor:inventory:manage" })) {
      await this.denyAudit(actor, "pricing.override.update.denied", "ratePlan", input.ratePlanId, context);
      throw new Error("Forbidden");
    }
    
    const now = this.deps.clock.now();
    return this.deps.transactions.run(async () => {
      const rateOverride: RateOverride = {
        _id: this.deps.ids.create(),
        ratePlanId: input.ratePlanId,
        localDate: input.localDate,
        amount: input.amount,
        minStay: input.minStay,
        maxStay: input.maxStay,
        closedToArrival: input.closedToArrival,
        closedToDeparture: input.closedToDeparture,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      
      await this.deps.repository.upsertRateOverride(rateOverride);
      await this.audit(actor.userId, "pricing.override.update", "ratePlan", input.ratePlanId, context, { date: input.localDate });
      
      return { success: true };
    });
  }

  private async createOffer(actor: ActorContext | null, input: Extract<PricingMutationInput, { action: "CREATE_OFFER" }>, context: PricingRequestContext) {
    // vendorId comes directly from the input — the actor must be a member of that vendor.
    if (!actor || !isAuthorized(actor, { scope: "vendor", vendorId: input.vendorId, permission: "vendor:inventory:manage" })) {
      await this.denyAudit(actor, "pricing.offer.create.denied", "offer", input.vendorId, context);
      throw new Error("Forbidden");
    }
    
    const now = this.deps.clock.now();
    return this.deps.transactions.run(async () => {
      const offer: Offer = {
        _id: this.deps.ids.create(),
        vendorId: input.vendorId,
        propertyId: input.propertyId,
        name: input.name,
        bookingWindow: input.bookingWindow,
        stayWindow: input.stayWindow,
        discountType: input.discountType,
        discountValue: input.discountValue,
        stackable: input.stackable,
        status: "ACTIVE",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      
      const result = await this.deps.repository.createOfferIfAbsent(offer, input.idempotencyKey);
      
      if (result.created) {
        await this.audit(actor.userId, "pricing.offer.create", "offer", result.offer._id, context, { vendorId: input.vendorId });
      }
      
      return { offer: result.offer, idempotentReplay: !result.created };
    });
  }

  private async audit(actorId: string, action: string, targetType: string, targetId: string, context: PricingRequestContext, metadata: Record<string, string | number | boolean>) {
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

  private async denyAudit(actor: ActorContext | null, action: string, targetType: string, targetId: string, context: PricingRequestContext) {
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
