import "server-only";

import type { Db } from "mongodb";

import type {
  PublicCatalogRepository,
  PublicDestinationRecord,
  PublicPropertyCard,
  PublicPropertyRecord,
  PublicReviewSummary,
} from "../application/public-catalog";
import type { Destination, MediaAsset, NearbyPlace, Property, RoomType } from "../domain/model";

type Stored<T extends { id: string }> = Omit<T, "id"> & { _id: string; schemaVersion?: number; idempotencyKey?: string };

function fromStored<T extends { id: string }>(document: Stored<T>): T {
  const { _id, schemaVersion: _schemaVersion, idempotencyKey: _idempotencyKey, ...rest } = document;
  void _schemaVersion;
  void _idempotencyKey;
  return { ...rest, id: _id } as unknown as T;
}

const EMPTY_REVIEW: PublicReviewSummary = { count: 0, average: null };

export class MongoPublicCatalogRepository implements PublicCatalogRepository {
  private readonly imageKitBase: URL;

  constructor(private readonly db: Db, imageKitUrlEndpoint: string) {
    this.imageKitBase = new URL(imageKitUrlEndpoint);
  }

  async listFeaturedProperties(limit: number): Promise<PublicPropertyCard[]> {
    const properties = await this.db.collection<Stored<Property>>("properties")
      .find({ status: "PUBLISHED" })
      .sort({ updatedAt: -1, _id: 1 })
      .limit(Math.min(Math.max(limit, 1), 24))
      .toArray();
    return this.cards(properties);
  }

  async listPublishedDestinations(limit: number): Promise<PublicDestinationRecord[]> {
    const destinations = await this.db.collection<Stored<Destination>>("destinations")
      .find({ status: "PUBLISHED" })
      .sort({ name: 1, _id: 1 })
      .limit(Math.min(Math.max(limit, 1), 24))
      .toArray();

    return Promise.all(destinations.map((destination) => this.destinationRecord(destination)));
  }

  async findPublishedPropertyBySlug(slug: string): Promise<PublicPropertyRecord | null> {
    const property = await this.db.collection<Stored<Property>>("properties").findOne({ slug, status: "PUBLISHED" });
    if (!property) return null;

    const [rooms, media, nearbyPlaces, destination, reviewSummary, startingPriceMinorUnits] = await Promise.all([
      this.db.collection<Stored<RoomType>>("roomTypes").find({ propertyId: property._id, status: "ACTIVE" }).sort({ name: 1 }).limit(100).toArray(),
      this.approvedMedia("PROPERTY", property._id),
      this.db.collection<Stored<NearbyPlace>>("nearbyPlaces").find({ propertyId: property._id, validationStatus: "VERIFIED" }).sort({ distanceMeters: 1 }).limit(50).toArray(),
      property.destinationId
        ? this.db.collection<Stored<Destination>>("destinations").findOne({ _id: property.destinationId, status: "PUBLISHED" })
        : Promise.resolve(null),
      this.reviewSummary(property._id),
      this.startingPrice(property._id),
    ]);

    return {
      property: fromStored<Property>(property),
      rooms: rooms.map((room) => fromStored<RoomType>(room)),
      media,
      nearbyPlaces: nearbyPlaces.map((place) => fromStored<NearbyPlace>(place)),
      destination: destination ? fromStored<Destination>(destination) : null,
      reviewSummary,
      startingPriceMinorUnits,
    };
  }

  async findPublishedDestinationBySlug(slug: string): Promise<PublicDestinationRecord | null> {
    const destination = await this.db.collection<Stored<Destination>>("destinations").findOne({ slug, status: "PUBLISHED" });
    return destination ? this.destinationRecord(destination) : null;
  }

  async listPublishedSlugs() {
    const [properties, destinations] = await Promise.all([
      this.db.collection<Stored<Property>>("properties").find(
        { status: "PUBLISHED" },
        { projection: { slug: 1, updatedAt: 1 } },
      ).sort({ _id: 1 }).limit(50_000).toArray(),
      this.db.collection<Stored<Destination>>("destinations").find(
        { status: "PUBLISHED" },
        { projection: { slug: 1, updatedAt: 1 } },
      ).sort({ _id: 1 }).limit(50_000).toArray(),
    ]);
    return {
      properties: properties.map(({ slug, updatedAt }) => ({ slug, updatedAt })),
      destinations: destinations.map(({ slug, updatedAt }) => ({ slug, updatedAt })),
    };
  }

  private async destinationRecord(destination: Stored<Destination>): Promise<PublicDestinationRecord> {
    const [media, properties] = await Promise.all([
      this.approvedMedia("DESTINATION", destination._id),
      this.db.collection<Stored<Property>>("properties").find({ destinationId: destination._id, status: "PUBLISHED" }).sort({ updatedAt: -1, _id: 1 }).limit(12).toArray(),
    ]);
    return { destination: fromStored<Destination>(destination), media, properties: await this.cards(properties) };
  }

  private async cards(properties: Array<Stored<Property>>): Promise<PublicPropertyCard[]> {
    if (properties.length === 0) return [];
    const propertyIds = properties.map((property) => property._id);
    const media = await this.db.collection<Stored<MediaAsset>>("mediaAssets").find({
      ownerType: "PROPERTY",
      ownerId: { $in: propertyIds },
      status: "ACTIVE",
      moderationStatus: "APPROVED",
    }).sort({ sortOrder: 1, _id: 1 }).toArray();
    const mediaByProperty = new Map<string, MediaAsset>();
    for (const asset of media) {
      if (this.isManagedMedia(asset) && !mediaByProperty.has(asset.ownerId)) mediaByProperty.set(asset.ownerId, fromStored<MediaAsset>(asset));
    }

    return Promise.all(properties.map(async (property) => ({
      id: property._id,
      slug: property.slug,
      name: property.name,
      propertyType: property.propertyType,
      propertyClass: property.propertyClass,
      districtId: property.districtId,
      area: property.location.area,
      amenityKeys: property.amenityKeys,
      media: mediaByProperty.get(property._id) ?? null,
      reviewSummary: await this.reviewSummary(property._id),
      startingPriceMinorUnits: await this.startingPrice(property._id),
    })));
  }

  private approvedMedia(ownerType: MediaAsset["ownerType"], ownerId: string) {
    return this.db.collection<Stored<MediaAsset>>("mediaAssets").find({
      ownerType,
      ownerId,
      status: "ACTIVE",
      moderationStatus: "APPROVED",
    }).sort({ sortOrder: 1, _id: 1 }).limit(60).toArray().then((assets) => assets.filter((asset) => this.isManagedMedia(asset)).map((asset) => fromStored<MediaAsset>(asset)));
  }

  private isManagedMedia(asset: Pick<MediaAsset, "provider" | "url">): boolean {
    try {
      const url = new URL(asset.url);
      const basePath = this.imageKitBase.pathname.replace(/\/$/, "");
      return asset.provider === "IMAGEKIT"
        && url.protocol === "https:"
        && url.origin === this.imageKitBase.origin
        && (url.pathname === basePath || url.pathname.startsWith(`${basePath}/`));
    } catch {
      return false;
    }
  }

  private async reviewSummary(propertyId: string): Promise<PublicReviewSummary> {
    void propertyId;
    // M7 establishes verified-stay review provenance. Until then, do not expose or schema-mark aggregate documents.
    return EMPTY_REVIEW;
  }

  private async startingPrice(propertyId: string): Promise<number | null> {
    const rooms = await this.db.collection<Stored<RoomType>>("roomTypes").find({ propertyId, status: "ACTIVE" }, { projection: { _id: 1 } }).limit(100).toArray();
    if (rooms.length === 0) return null;
    const rate = await this.db.collection<{ roomTypeId: string; basePrice: number; status: string }>("ratePlans").find({
      roomTypeId: { $in: rooms.map((room) => room._id) },
      status: "ACTIVE",
      basePrice: { $gte: 0 },
    }).sort({ basePrice: 1 }).limit(1).next();
    return rate && Number.isSafeInteger(rate.basePrice) ? rate.basePrice : null;
  }
}
