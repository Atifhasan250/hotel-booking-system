import "server-only";

import type { Collection, Db, Filter } from "mongodb";

import type { CatalogRepository } from "../application/ports";
import type { Destination, MediaAsset, NearbyPlace, Property, RoomType, VendorOrganization } from "../domain/model";
import type { MongoTransactionRunner } from "../../../platform/db/mongo-transaction";

type Stored<T> = Omit<T, "id"> & { _id: string; schemaVersion: 1; idempotencyKey?: string };

function toStored<T extends { id: string }>(value: T, idempotencyKey?: string): Stored<T> {
  const { id, ...rest } = value;
  return { ...rest, _id: id, schemaVersion: 1, ...(idempotencyKey ? { idempotencyKey } : {}) } as Stored<T>;
}

function fromStored<T extends { id: string }>(document: Stored<T>): T {
  const { _id, schemaVersion: _schemaVersion, idempotencyKey: _idempotencyKey, ...rest } = document;
  void _schemaVersion;
  void _idempotencyKey;
  return { ...rest, id: _id } as unknown as T;
}

export class MongoCatalogRepository implements CatalogRepository {
  private readonly vendors: Collection<Stored<VendorOrganization>>;
  private readonly properties: Collection<Stored<Property>>;
  private readonly rooms: Collection<Stored<RoomType>>;
  private readonly nearby: Collection<Stored<NearbyPlace>>;
  private readonly destinations: Collection<Stored<Destination>>;
  private readonly media: Collection<Stored<MediaAsset>>;

  constructor(private readonly db: Db, private readonly transactions: MongoTransactionRunner) {
    this.vendors = db.collection("vendorOrganizations");
    this.properties = db.collection("properties");
    this.rooms = db.collection("roomTypes");
    this.nearby = db.collection("nearbyPlaces");
    this.destinations = db.collection("destinations");
    this.media = db.collection("mediaAssets");
  }

  async createVendorIfAbsent(vendor: VendorOrganization) {
    const result = await this.vendors.findOneAndUpdate(
      { onboardingKey: vendor.onboardingKey },
      { $setOnInsert: toStored(vendor) },
      { upsert: true, returnDocument: "after", includeResultMetadata: true, session: this.transactions.current() },
    );
    if (!result.value) throw new Error("Vendor upsert did not return a document");
    return { vendor: fromStored<VendorOrganization>(result.value), created: result.lastErrorObject?.upserted !== undefined };
  }

  async findVendorById(vendorId: string) {
    const result = await this.vendors.findOne({ _id: vendorId }, { session: this.transactions.current() });
    return result ? fromStored<VendorOrganization>(result) : null;
  }

  async updateVendorStatus(vendorId: string, from: VendorOrganization["status"][], to: VendorOrganization["status"], note: string | undefined, at: Date) {
    const result = await this.vendors.updateOne(
      { _id: vendorId, status: { $in: from } },
      { $set: { status: to, ...(note ? { moderationNote: note } : {}), updatedAt: at } },
      { session: this.transactions.current() },
    );
    return result.modifiedCount === 1;
  }

  async addOwnerMembership(input: { id: string; userId: string; vendorId: string; createdAt: Date }) {
    await this.db.collection("vendorMemberships").updateOne(
      { vendorId: input.vendorId, userId: input.userId },
      { $setOnInsert: { _id: input.id, schemaVersion: 1, userId: input.userId, vendorId: input.vendorId, role: "OWNER", permissions: ["vendor:properties:manage", "vendor:inventory:manage", "vendor:members:manage", "vendor:bookings:read", "vendor:finance:read"], status: "ACTIVE", createdAt: input.createdAt, updatedAt: input.createdAt } },
      { upsert: true, session: this.transactions.current() },
    );
  }

  async createPropertyIfAbsent(property: Property, idempotencyKey: string) { const result = await this.createIfAbsent(this.properties, property, idempotencyKey, "property"); return { property: result.value, created: result.created }; }
  async createRoomTypeIfAbsent(roomType: RoomType, idempotencyKey: string) { const result = await this.createIfAbsent(this.rooms, roomType, idempotencyKey, "roomType"); return { roomType: result.value, created: result.created }; }
  async createNearbyPlaceIfAbsent(place: NearbyPlace, idempotencyKey: string) { const result = await this.createIfAbsent(this.nearby, place, idempotencyKey, "place"); return { place: result.value, created: result.created }; }
  async createDestinationIfAbsent(destination: Destination, idempotencyKey: string) { const result = await this.createIfAbsent(this.destinations, destination, idempotencyKey, "destination"); return { destination: result.value, created: result.created }; }
  async createMediaIfAbsent(media: MediaAsset, idempotencyKey: string) { const result = await this.createIfAbsent(this.media, media, idempotencyKey, "media"); return { media: result.value, created: result.created }; }

  async findPropertyById(propertyId: string) {
    const result = await this.properties.findOne({ _id: propertyId }, { session: this.transactions.current() });
    return result ? fromStored<Property>(result) : null;
  }

  async findPropertyForVendor(propertyId: string, vendorId: string) {
    const result = await this.properties.findOne({ _id: propertyId, vendorId }, { session: this.transactions.current() });
    return result ? fromStored<Property>(result) : null;
  }

  async updateProperty(property: Property) {
    const stored = toStored(property);
    const { _id, schemaVersion, ...set } = stored;
    void schemaVersion;
    const result = await this.properties.updateOne({ _id, vendorId: property.vendorId, status: { $in: ["DRAFT", "CHANGES_REQUESTED"] } }, { $set: set }, { session: this.transactions.current() });
    return result.matchedCount === 1;
  }

  async updatePropertyStatus(input: { propertyId: string; from: Property["status"][]; to: Property["status"]; note?: string; location?: Property["location"]; at: Date }) {
    const result = await this.properties.updateOne(
      { _id: input.propertyId, status: { $in: input.from } },
      { $set: { status: input.to, ...(input.note ? { moderationNote: input.note } : {}), ...(input.location ? { location: input.location } : {}), ...(input.to === "ARCHIVED" ? { archivedAt: input.at } : {}), updatedAt: input.at } },
      { session: this.transactions.current() },
    );
    return result.modifiedCount === 1;
  }

  async approvePropertyMedia(propertyId: string, at: Date) {
    const result = await this.media.updateMany({ ownerType: "PROPERTY", ownerId: propertyId, status: "ACTIVE", moderationStatus: "PENDING" }, { $set: { moderationStatus: "APPROVED", updatedAt: at } }, { session: this.transactions.current() });
    return result.modifiedCount;
  }

  listActiveRooms(propertyId: string) { return this.list(this.rooms, { propertyId, status: "ACTIVE" } as Filter<Stored<RoomType>>); }
  listActiveMedia(propertyId: string) { return this.list(this.media, { ownerId: propertyId, ownerType: "PROPERTY", status: "ACTIVE" } as Filter<Stored<MediaAsset>>, { sortOrder: 1 }); }
  listNearbyPlaces(propertyId: string) { return this.list(this.nearby, { propertyId } as Filter<Stored<NearbyPlace>>); }
  listVendorProperties(vendorId: string) { return this.list(this.properties, { vendorId } as Filter<Stored<Property>>, { updatedAt: -1 }); }
  listPendingVendors() { return this.list(this.vendors, { status: "PENDING_REVIEW" } as Filter<Stored<VendorOrganization>>, { updatedAt: 1 }); }
  listPendingProperties() { return this.list(this.properties, { status: "PENDING_REVIEW" } as Filter<Stored<Property>>, { updatedAt: 1 }); }

  private async createIfAbsent<T extends { id: string }>(collection: Collection<Stored<T>>, value: T, idempotencyKey: string, key: string): Promise<{ value: T; created: boolean }> {
    const result = await collection.findOneAndUpdate(
      { idempotencyKey } as Filter<Stored<T>>,
      { $setOnInsert: toStored(value, idempotencyKey) },
      { upsert: true, returnDocument: "after", includeResultMetadata: true, session: this.transactions.current() },
    );
    if (!result.value) throw new Error(`${key} upsert did not return a document`);
    return { value: fromStored<T>(result.value as Stored<T>), created: result.lastErrorObject?.upserted !== undefined };
  }

  private async list<T extends { id: string }>(collection: Collection<Stored<T>>, filter: Filter<Stored<T>>, sort?: Record<string, 1 | -1>) {
    let cursor = collection.find(filter, { session: this.transactions.current() }).limit(200);
    if (sort) cursor = cursor.sort(sort);
    return (await cursor.toArray()).map((document) => fromStored<T>(document as Stored<T>));
  }
}

let indexPromise: Promise<void> | undefined;

export function ensureCatalogIndexes(db: Db): Promise<void> {
  indexPromise ??= Promise.all([
    db.collection("vendorOrganizations").createIndex({ onboardingKey: 1 }, { unique: true }),
    db.collection("vendorOrganizations").createIndex({ status: 1, updatedAt: 1 }),
    db.collection("properties").createIndex({ publicId: 1 }, { unique: true }),
    db.collection("properties").createIndex({ vendorId: 1, slug: 1 }, { unique: true }),
    db.collection("properties").createIndex({ idempotencyKey: 1 }, { unique: true, sparse: true }),
    db.collection("properties").createIndex({ status: 1, districtId: 1, propertyType: 1 }),
    db.collection("roomTypes").createIndex({ publicId: 1 }, { unique: true }),
    db.collection("roomTypes").createIndex({ idempotencyKey: 1 }, { unique: true, sparse: true }),
    db.collection("roomTypes").createIndex({ propertyId: 1, status: 1 }),
    db.collection("mediaAssets").createIndex({ provider: 1, providerFileId: 1 }, { unique: true }),
    db.collection("mediaAssets").createIndex({ idempotencyKey: 1 }, { unique: true, sparse: true }),
    db.collection("mediaAssets").createIndex({ ownerType: 1, ownerId: 1, status: 1, sortOrder: 1 }),
    db.collection("nearbyPlaces").createIndex({ idempotencyKey: 1 }, { unique: true, sparse: true }),
    db.collection("nearbyPlaces").createIndex({ propertyId: 1, validationStatus: 1 }),
    db.collection("destinations").createIndex({ slug: 1 }, { unique: true }),
    db.collection("destinations").createIndex({ idempotencyKey: 1 }, { unique: true, sparse: true }),
    db.collection("destinations").createIndex({ status: 1, district: 1 }),
  ]).then(() => undefined).catch((error) => { indexPromise = undefined; throw error; });
  return indexPromise;
}
