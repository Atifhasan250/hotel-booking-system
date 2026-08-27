import "server-only";

import type { Collection, Db } from "mongodb";

import type { PricingRepository } from "../application/ports";
import type { Offer, PriceQuote, RateOverride, RatePlan } from "../domain/model";
import type { MongoTransactionRunner } from "../../../platform/db/mongo-transaction";

type Stored<T> = T & { idempotencyKey?: string };

export class MongoPricingRepository implements PricingRepository {
  private readonly ratePlans: Collection<Stored<RatePlan>>;
  private readonly rateOverrides: Collection<Stored<RateOverride>>;
  private readonly offers: Collection<Stored<Offer>>;
  private readonly priceQuotes: Collection<Stored<PriceQuote>>;

  constructor(private readonly db: Db, private readonly transactions: MongoTransactionRunner) {
    this.ratePlans = db.collection("ratePlans");
    this.rateOverrides = db.collection("rateOverrides");
    this.offers = db.collection("offers");
    this.priceQuotes = db.collection("priceQuotes");
  }

  async createRatePlanIfAbsent(ratePlan: RatePlan, idempotencyKey: string) {
    const result = await this.ratePlans.findOneAndUpdate(
      { idempotencyKey },
      { $setOnInsert: { ...ratePlan, idempotencyKey } },
      { upsert: true, returnDocument: "after", includeResultMetadata: true, session: this.transactions.current() }
    );
    if (!result.value) throw new Error("RatePlan upsert did not return a document");
    return { ratePlan: result.value, created: result.lastErrorObject?.upserted !== undefined };
  }

  async findRatePlan(ratePlanId: string): Promise<RatePlan | null> {
    return this.ratePlans.findOne({ _id: ratePlanId }, { session: this.transactions.current() });
  }

  async findRatePlansForRoom(roomTypeId: string): Promise<RatePlan[]> {
    return this.ratePlans.find({ roomTypeId, status: "ACTIVE" }, { session: this.transactions.current() }).toArray();
  }

  async upsertRateOverride(rateOverride: RateOverride): Promise<boolean> {
    const result = await this.rateOverrides.updateOne(
      { ratePlanId: rateOverride.ratePlanId, localDate: rateOverride.localDate },
      { $set: rateOverride },
      { upsert: true, session: this.transactions.current() }
    );
    return result.acknowledged;
  }

  async findRateOverrides(ratePlanId: string, startDate: string, endDate: string): Promise<RateOverride[]> {
    return this.rateOverrides.find({
      ratePlanId,
      localDate: { $gte: startDate, $lte: endDate }
    }, { session: this.transactions.current() }).toArray();
  }

  async createOfferIfAbsent(offer: Offer, idempotencyKey: string) {
    const result = await this.offers.findOneAndUpdate(
      { idempotencyKey },
      { $setOnInsert: { ...offer, idempotencyKey } },
      { upsert: true, returnDocument: "after", includeResultMetadata: true, session: this.transactions.current() }
    );
    if (!result.value) throw new Error("Offer upsert did not return a document");
    return { offer: result.value, created: result.lastErrorObject?.upserted !== undefined };
  }

  async findActiveOffers(vendorId: string, propertyId: string | undefined, date: string): Promise<Offer[]> {
    const filter: Record<string, unknown> = {
      vendorId,
      status: "ACTIVE",
      "bookingWindow.start": { $lte: date },
      "bookingWindow.end": { $gte: date }
    };
    if (propertyId) filter.propertyId = propertyId;
    return this.offers.find(filter, { session: this.transactions.current() }).toArray();
  }

  async savePriceQuote(quote: PriceQuote): Promise<void> {
    await this.priceQuotes.insertOne(quote, { session: this.transactions.current() });
  }

  async findPriceQuote(quoteId: string): Promise<PriceQuote | null> {
    return this.priceQuotes.findOne({ _id: quoteId }, { session: this.transactions.current() });
  }
}
