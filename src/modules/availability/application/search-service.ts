import "server-only";

import type { Db } from "mongodb";
import { getMongoDatabase } from "../../../platform/db/mongo-client";

// ─── Search result shape returned by the search API ────────────────────────

export interface SearchResultProperty {
  id: string;
  name: string;
  slug: string;
  propertyType: string;
  propertyClass: string;
  districtId: string;
  location: {
    area: string;
    addressLine: string;
  };
  amenityKeys: string[];
  rating: number;
  ratingCount: number;
  /** Starting price in BDT integer minor units (paise-equivalent). */
  startingPrice: number;
  currency: "BDT";
  isAvailable: boolean;
  offers: Array<{ name: string; discountValue: number; discountType: "PERCENTAGE" | "FIXED" }>;
  thumbnailUrl: string | null;
}

export interface SearchQuery {
  destination?: string;
  checkIn?: string;   // YYYY-MM-DD
  checkOut?: string;  // YYYY-MM-DD
  adults?: number;
  children?: number;
  rooms?: number;
  minPrice?: number;
  maxPrice?: number;
  propertyTypes?: string[];    // e.g. ["HOTEL","ECO_RESORT"]
  amenityKeys?: string[];      // e.g. ["wifi","swimming-pool"]
  propertyClass?: string;      // e.g. "LUXURY"
  page: number;
  limit: number;
  sort: "PRICE_ASC" | "PRICE_DESC" | "RATING_DESC" | "NEWEST" | "MOST_BOOKED";
}

// ─── Search service ─────────────────────────────────────────────────────────

export class SearchService {
  constructor(private readonly db: Db) {}

  async search(query: SearchQuery): Promise<{
    data: SearchResultProperty[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const filter: Record<string, unknown> = { status: "PUBLISHED" };

    // Location / destination filter (district name, area, or slug).
    if (query.destination) {
      const dest = query.destination.trim();
      filter.$or = [
        { districtId: { $regex: dest, $options: "i" } },
        { "location.area": { $regex: dest, $options: "i" } },
        { slug: { $regex: dest, $options: "i" } },
      ];
    }

    // Property type filter.
    if (query.propertyTypes && query.propertyTypes.length > 0) {
      filter.propertyType = { $in: query.propertyTypes };
    }

    // Property class filter (LUXURY / STANDARD / BUDGET).
    if (query.propertyClass) {
      filter.propertyClass = query.propertyClass;
    }

    // Amenity filter: property must have ALL requested amenity keys.
    if (query.amenityKeys && query.amenityKeys.length > 0) {
      filter.amenityKeys = { $all: query.amenityKeys };
    }

    // Fetch matching properties (no unbounded scans — limit applied).
    const skip = (query.page - 1) * query.limit;

    const [properties, total] = await Promise.all([
      this.db
        .collection<{
          _id: string;
          vendorId: string;
          name: string;
          slug: string;
          propertyType: string;
          propertyClass: string;
          districtId: string;
          location: { area: string; addressLine: string };
          amenityKeys: string[];
          status: string;
        }>("properties")
        .find(filter)
        .sort(this.buildSortStage(query.sort))
        .skip(skip)
        .limit(query.limit)
        .toArray(),
      this.db.collection("properties").countDocuments(filter),
    ]);

    if (properties.length === 0) {
      return { data: [], pagination: { page: query.page, limit: query.limit, total: 0, totalPages: 0 } };
    }

    const propertyIds = properties.map((p) => p._id);

    // ── Fetch active rate plans per property's room types in one aggregation ─
    // roomTypes → ratePlans join via roomTypeId; pick lowest basePrice per property.
    const roomTypeDocs = await this.db
      .collection<{ _id: string; propertyId: string; status: string }>("roomTypes")
      .find({ propertyId: { $in: propertyIds }, status: "ACTIVE" }, { projection: { _id: 1, propertyId: 1 } })
      .toArray();

    const roomIdsByProperty = new Map<string, string[]>();
    for (const rt of roomTypeDocs) {
      const existing = roomIdsByProperty.get(rt.propertyId) ?? [];
      existing.push(rt._id);
      roomIdsByProperty.set(rt.propertyId, existing);
    }

    const allRoomIds = roomTypeDocs.map((rt) => rt._id);

    const ratePlanDocs = await this.db
      .collection<{ _id: string; roomTypeId: string; basePrice: number }>("ratePlans")
      .find({ roomTypeId: { $in: allRoomIds }, status: "ACTIVE" }, { projection: { _id: 1, roomTypeId: 1, basePrice: 1 } })
      .toArray();

    // Build a map of propertyId → lowest basePrice across all active room types.
    const roomToProperty = new Map(roomTypeDocs.map((rt) => [rt._id, rt.propertyId]));
    const startingPriceByProperty = new Map<string, number>();
    for (const rp of ratePlanDocs) {
      const propId = roomToProperty.get(rp.roomTypeId);
      if (!propId) continue;
      const current = startingPriceByProperty.get(propId) ?? Infinity;
      if (rp.basePrice < current) startingPriceByProperty.set(propId, rp.basePrice);
    }

    // ── Fetch availability state for date-range search ───────────────────────
    // If checkIn/checkOut are provided, mark properties as unavailable
    // if any of their room types have stop-sell on ALL nights or zero capacity.
    const availablePropertyIds = new Set(propertyIds);
    if (query.checkIn && query.checkOut) {
      const stoppedRoomIds = await this.db
        .collection<{ roomTypeId: string }>("inventoryDays")
        .distinct("roomTypeId", {
          roomTypeId: { $in: allRoomIds },
          localDate: { $gte: query.checkIn, $lt: query.checkOut },
          stopSell: true,
        });

      // Properties where ALL room types are stop-sold become unavailable.
      for (const [propId, roomIds] of roomIdsByProperty) {
        const allStopped = roomIds.every((rid) => stoppedRoomIds.includes(rid));
        if (allStopped && roomIds.length > 0) availablePropertyIds.delete(propId);
      }
    }

    // ── Fetch active offers for today ────────────────────────────────────────
    const today = new Date().toISOString().slice(0, 10);
    const offerDocs = await this.db
      .collection<{
        _id: string;
        propertyId?: string;
        name: string;
        discountValue: number;
        discountType: "PERCENTAGE" | "FIXED";
        "bookingWindow.start": string;
        "bookingWindow.end": string;
        status: string;
      }>("offers")
      .find({
        status: "ACTIVE",
        "bookingWindow.start": { $lte: today },
        "bookingWindow.end": { $gte: today },
        $or: [
          { propertyId: { $in: propertyIds } },
          { propertyId: { $exists: false } },
        ],
      })
      .toArray();

    const offersByProperty = new Map<string, typeof offerDocs>();
    for (const offer of offerDocs) {
      if (offer.propertyId) {
        const existing = offersByProperty.get(offer.propertyId) ?? [];
        existing.push(offer);
        offersByProperty.set(offer.propertyId, existing);
      }
    }

    // ── Fetch thumbnail media ─────────────────────────────────────────────────
    const mediaDocs = await this.db
      .collection<{ _id: string; ownerId: string; url: string; sortOrder: number }>("mediaAssets")
      .find({
        ownerId: { $in: propertyIds },
        ownerType: "PROPERTY",
        status: "ACTIVE",
        moderationStatus: "APPROVED",
      })
      .sort({ sortOrder: 1 })
      .toArray();

    // Keep only the first (lowest sortOrder) media per property.
    const thumbnailByProperty = new Map<string, string>();
    for (const m of mediaDocs) {
      if (!thumbnailByProperty.has(m.ownerId)) {
        thumbnailByProperty.set(m.ownerId, m.url);
      }
    }

    // ── Fetch rating aggregates ───────────────────────────────────────────────
    const ratingDocs = await this.db
      .collection<{ _id: string; count: number; average: number }>("reviewAggregates")
      .find({ _id: { $in: propertyIds } }, { projection: { count: 1, average: 1 } })
      .toArray();
    const ratingByProperty = new Map(ratingDocs.map((r) => [r._id, r]));

    // ── Assemble results ──────────────────────────────────────────────────────
    let results: SearchResultProperty[] = properties.map((p) => {
      const startingPrice = startingPriceByProperty.get(p._id) ?? 0;
      const rating = ratingByProperty.get(p._id);
      const propertyOffers = offersByProperty.get(p._id) ?? [];

      return {
        id: p._id,
        name: p.name,
        slug: p.slug,
        propertyType: p.propertyType,
        propertyClass: p.propertyClass,
        districtId: p.districtId,
        location: { area: p.location.area, addressLine: p.location.addressLine },
        amenityKeys: p.amenityKeys,
        rating: rating ? parseFloat(rating.average.toFixed(1)) : 0,
        ratingCount: rating?.count ?? 0,
        startingPrice,
        currency: "BDT",
        isAvailable: availablePropertyIds.has(p._id),
        offers: propertyOffers.map((o) => ({
          name: o.name,
          discountValue: o.discountValue,
          discountType: o.discountType,
        })),
        thumbnailUrl: thumbnailByProperty.get(p._id) ?? null,
      };
    });

    // ── Apply price range filter (post-join, since prices come from ratePlans) ─
    if (query.minPrice !== undefined) {
      results = results.filter((r) => r.startingPrice >= query.minPrice!);
    }
    if (query.maxPrice !== undefined) {
      results = results.filter((r) => r.startingPrice <= query.maxPrice!);
    }

    // ── Apply price-based secondary sort (needed after filtering) ─────────────
    if (query.sort === "PRICE_ASC") {
      results.sort((a, b) => a.startingPrice - b.startingPrice);
    } else if (query.sort === "PRICE_DESC") {
      results.sort((a, b) => b.startingPrice - a.startingPrice);
    }

    return {
      data: results,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  private buildSortStage(sort: SearchQuery["sort"]): Record<string, 1 | -1> {
    switch (sort) {
      case "RATING_DESC": return { "rating.average": -1, createdAt: -1 };
      case "NEWEST": return { createdAt: -1 };
      case "MOST_BOOKED": return { bookingCount: -1, createdAt: -1 };
      case "PRICE_ASC":
      case "PRICE_DESC":
      default:
        // Price sort is done after the join; use creation order as tie-breaker.
        return { createdAt: -1 };
    }
  }
}

// ─── Singleton factory ───────────────────────────────────────────────────────

let servicePromise: Promise<SearchService> | undefined;

export function getSearchService(): Promise<SearchService> {
  servicePromise ??= getMongoDatabase()
    .then((db) => new SearchService(db))
    .catch((error) => { servicePromise = undefined; throw error; });
  return servicePromise;
}
