import type { AuditEventWriter } from "../../audit/domain/audit-event";
import type { RateLimiter, TransactionRunner } from "../../identity/application/ports";
import type { Offer, PriceQuote, RateOverride, RatePlan } from "../domain/model";
import type { RoomTypeVendorResolver } from "../../availability/application/ports";

export interface PricingRepository {
  createRatePlanIfAbsent(ratePlan: RatePlan, idempotencyKey: string): Promise<{ ratePlan: RatePlan; created: boolean }>;
  findRatePlan(ratePlanId: string): Promise<RatePlan | null>;
  findRatePlansForRoom(roomTypeId: string): Promise<RatePlan[]>;

  upsertRateOverride(rateOverride: RateOverride): Promise<boolean>;
  findRateOverrides(ratePlanId: string, startDate: string, endDate: string): Promise<RateOverride[]>;

  createOfferIfAbsent(offer: Offer, idempotencyKey: string): Promise<{ offer: Offer; created: boolean }>;
  findActiveOffers(vendorId: string, propertyId: string | undefined, date: string): Promise<Offer[]>;

  savePriceQuote(quote: PriceQuote): Promise<void>;
  findPriceQuote(quoteId: string): Promise<PriceQuote | null>;
}

export interface PricingDependencies {
  repository: PricingRepository;
  audit: AuditEventWriter;
  transactions: TransactionRunner;
  rateLimiter: RateLimiter;
  /** Resolves roomTypeId → vendorId for authorization checks. */
  roomTypeVendorResolver: RoomTypeVendorResolver;
  ids: { create(): string };
  clock: { now(): Date };
}
