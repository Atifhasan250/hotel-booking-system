import { describe, expect, it } from "vitest";

import { CatalogService } from "../../src/modules/catalog/application/catalog-service";
import { CatalogAuthorizationError, CatalogIncompleteError } from "../../src/modules/catalog/application/errors";
import type { CatalogRepository } from "../../src/modules/catalog/application/ports";
import type { Destination, MediaAsset, NearbyPlace, Property, RoomType, VendorOrganization } from "../../src/modules/catalog/domain/model";
import { catalogMutationSchema } from "../../src/modules/catalog/domain/schemas";
import { ImageKitV2UploadSigner } from "../../src/modules/catalog/infrastructure/imagekit-upload-signer";
import { UnconfiguredMapAdapter } from "../../src/modules/catalog/infrastructure/unconfigured-map-adapter";
import type { AuditEvent } from "../../src/modules/audit/domain/audit-event";
import type { ActorContext } from "../../src/modules/identity/domain/model";

describe("catalog onboarding, tenant isolation, and publish workflow", () => {
  it("onboards idempotently, blocks cross-tenant access, and publishes only after the admin checklist", async () => {
    const harness = createHarness();
    const onboarding = await harness.service.mutate(customerActor, parse({
      action: "ONBOARD_VENDOR", idempotencyKey: "onboard-request-0001", displayName: "Megh Bari",
      legalName: "Megh Bari Hospitality Ltd", contactEmail: "owner@example.test", contactPhone: "+8801712345678",
    }), context) as { vendor: { id: string } };
    const vendorId = onboarding.vendor.id;
    const owner = vendorActor(vendorId);

    const replay = await harness.service.mutate(customerActor, parse({
      action: "ONBOARD_VENDOR", idempotencyKey: "onboard-request-0001", displayName: "Megh Bari",
      legalName: "Megh Bari Hospitality Ltd", contactEmail: "owner@example.test", contactPhone: "+8801712345678",
    }), context) as { idempotentReplay: boolean };
    expect(replay.idempotentReplay).toBe(true);

    await harness.service.mutate(owner, parse({ action: "SUBMIT_VENDOR", vendorId }), context);
    await harness.service.mutate(adminActor, parse({ action: "REVIEW_VENDOR", vendorId, decision: "APPROVE", note: "Ownership documents verified" }), context);

    const created = await harness.service.mutate(owner, parse(propertyInput(vendorId)), context) as { property: { id: string } };
    const propertyId = created.property.id;
    await expect(harness.service.vendorWorkspace(vendorActor("another-vendor"), vendorId, context)).rejects.toBeInstanceOf(CatalogAuthorizationError);
    await expect(harness.service.mutate(owner, parse({ action: "SUBMIT_PROPERTY", vendorId, propertyId }), context)).rejects.toBeInstanceOf(CatalogIncompleteError);

    await harness.service.mutate(owner, parse({
      action: "CREATE_ROOM_TYPE", idempotencyKey: "room-request-000001", vendorId, propertyId,
      name: "Garden King", description: "A bright garden-facing king room.", maxAdults: 2, maxChildren: 1,
      bedConfiguration: "1 king bed", baseQuantity: 3, amenityKeys: ["wifi"], airConditioning: "AC",
    }), context);
    await harness.service.mutate(owner, parse({
      action: "REGISTER_MEDIA", idempotencyKey: "media-request-00001", vendorId, propertyId,
      providerFileId: "ik-file-1", filePath: `/book-my-room/test/vendors/${vendorId}/properties/${propertyId}/garden.webp`,
      url: `https://ik.imagekit.io/bookmyroom/book-my-room/test/vendors/${vendorId}/properties/${propertyId}/garden.webp`,
      width: 1600, height: 1000, format: "webp", bytes: 450000,
      altText: "Garden-facing room at Megh Bari", sortOrder: 0,
    }), context);
    await harness.service.mutate(owner, parse({ action: "SUBMIT_PROPERTY", vendorId, propertyId }), context);
    const published = await harness.service.mutate(adminActor, parse({
      action: "REVIEW_PROPERTY", propertyId, decision: "PUBLISH", note: "Location and media verified",
      locationVerified: true, mediaApproved: true,
    }), context) as { status: string; checklist: { complete: boolean } };

    expect(published).toMatchObject({ status: "PUBLISHED", checklist: { complete: true } });
    expect(harness.repository.properties.get(propertyId)?.status).toBe("PUBLISHED");
    expect(harness.audits.some((event) => event.action === "catalog.property.review" && event.outcome === "SUCCESS")).toBe(true);
  });

  it("binds ImageKit authorization to one property folder, file name, MIME set, and 10 MiB limit", async () => {
    const signer = new ImageKitV2UploadSigner({ publicKey: "public-test", privateKey: "private-test", urlEndpoint: "https://ik.imagekit.io/bookmyroom", environment: "test" });
    const authorization = signer.authorize({ vendorId: "vendor-1", propertyId: "property-1", fileName: "suite.webp", now: new Date("2026-08-27T10:00:00.000Z") });
    const [header, payload] = authorization.token.split(".").slice(0, 2).map((value) => JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
    expect(header).toMatchObject({ alg: "HS256", kid: "public-test" });
    expect(payload).toMatchObject({ fileName: "suite.webp", folder: "/book-my-room/test/vendors/vendor-1/properties/property-1" });
    expect(payload.checks).toContain("'file.size' <= 10485760");
    expect(payload.checks).toContain("image/webp");
    expect(authorization.expiresAt).toBe("2026-08-27T10:10:00.000Z");
    expect(signer.validateRegisteredAsset({ vendorId: "vendor-1", propertyId: "property-1", filePath: "/book-my-room/test/vendors/vendor-1/properties/property-1/suite.webp", url: "https://ik.imagekit.io/bookmyroom/book-my-room/test/vendors/vendor-1/properties/property-1/suite.webp" })).toBe(true);
    expect(signer.validateRegisteredAsset({ vendorId: "vendor-2", propertyId: "property-1", filePath: "/book-my-room/test/vendors/vendor-1/properties/property-1/suite.webp", url: "https://ik.imagekit.io/bookmyroom/book-my-room/test/vendors/vendor-1/properties/property-1/suite.webp" })).toBe(false);
  });
});

const context = { requestId: "catalog-request-0001" };
const customerActor: ActorContext = { userId: "user-owner", customerId: "user-owner", vendorMemberships: [], adminPermissions: [], superAdmin: false };
const adminActor: ActorContext = { userId: "admin-1", customerId: "admin-1", vendorMemberships: [], adminPermissions: ["admin:vendors:approve", "admin:marketplace:read", "admin:content:manage"], superAdmin: false };
function vendorActor(vendorId: string): ActorContext { return { ...customerActor, vendorMemberships: [{ vendorId, role: "OWNER", permissions: [], status: "ACTIVE" }] }; }
function parse(input: unknown) { return catalogMutationSchema.parse(input); }

function propertyInput(vendorId: string) {
  return {
    action: "CREATE_PROPERTY", idempotencyKey: "property-request-001", vendorId,
    name: "Megh Bari Eco Resort", slug: "megh-bari-eco-resort", propertyType: "ECO_RESORT", propertyClass: "STANDARD",
    description: "A quiet tea-country stay with verified rooms and a carefully described guest experience.",
    districtId: "district-moulvibazar", timezone: "Asia/Dhaka", amenityKeys: ["wifi", "nature-view", "free-breakfast"],
    location: { addressLine: "Tea Garden Road", area: "Sreemangal", countryCode: "BD" },
    policies: { checkInTime: "14:00", checkOutTime: "11:00", cancellationSummary: "Cancellation is reviewed under the displayed property policy.", childPolicy: "Children are welcome within the stated room occupancy.", extraBedPolicy: "Extra beds require prior property confirmation.", petPolicy: "Pets require prior written property approval.", couplePolicy: "All guests must provide legally required identification." },
  };
}

function createHarness() {
  const repository = new MemoryCatalogRepository();
  const audits: AuditEvent[] = [];
  let nextId = 0;
  const service = new CatalogService({
    repository,
    audit: { append: async (event) => { audits.push(event); } },
    transactions: { run: async (work) => work() },
    rateLimiter: { consume: async () => true },
    imageKit: new ImageKitV2UploadSigner({ publicKey: "public-test", privateKey: "private-test", urlEndpoint: "https://ik.imagekit.io/bookmyroom", environment: "test" }),
    maps: new UnconfiguredMapAdapter(),
    ids: { create: () => `generated-${++nextId}` },
    clock: { now: () => new Date("2026-08-27T10:00:00.000Z") },
  });
  return { repository, audits, service };
}

class MemoryCatalogRepository implements CatalogRepository {
  vendors = new Map<string, VendorOrganization>(); properties = new Map<string, Property>(); rooms = new Map<string, RoomType>();
  media = new Map<string, MediaAsset>(); nearby = new Map<string, NearbyPlace>(); destinations = new Map<string, Destination>(); keys = new Map<string, string>();
  async createVendorIfAbsent(value: VendorOrganization) { const id = this.keys.get(value.onboardingKey); if (id) return { vendor: this.vendors.get(id)!, created: false }; this.keys.set(value.onboardingKey, value.id); this.vendors.set(value.id, value); return { vendor: value, created: true }; }
  async findVendorById(id: string) { return this.vendors.get(id) ?? null; }
  async updateVendorStatus(id: string, from: VendorOrganization["status"][], to: VendorOrganization["status"], note: string | undefined, at: Date) { const value = this.vendors.get(id); if (!value || !from.includes(value.status)) return false; this.vendors.set(id, { ...value, status: to, moderationNote: note, updatedAt: at }); return true; }
  async addOwnerMembership() {}
  async createPropertyIfAbsent(value: Property, key: string) { const result = this.create(this.properties, value, key); return { property: result.value, created: result.created }; }
  async findPropertyById(id: string) { return this.properties.get(id) ?? null; }
  async findPropertyForVendor(id: string, vendorId: string) { const value = this.properties.get(id); return value?.vendorId === vendorId ? value : null; }
  async updateProperty(value: Property) { if (!this.properties.has(value.id)) return false; this.properties.set(value.id, value); return true; }
  async updatePropertyStatus(input: { propertyId: string; from: Property["status"][]; to: Property["status"]; note?: string; location?: Property["location"]; at: Date }) { const value = this.properties.get(input.propertyId); if (!value || !input.from.includes(value.status)) return false; this.properties.set(value.id, { ...value, status: input.to, moderationNote: input.note, location: input.location ?? value.location, updatedAt: input.at, ...(input.to === "ARCHIVED" ? { archivedAt: input.at } : {}) }); return true; }
  async createRoomTypeIfAbsent(value: RoomType, key: string) { const result = this.create(this.rooms, value, key); return { roomType: result.value, created: result.created }; }
  async createNearbyPlaceIfAbsent(value: NearbyPlace, key: string) { const result = this.create(this.nearby, value, key); return { place: result.value, created: result.created }; }
  async createDestinationIfAbsent(value: Destination, key: string) { const result = this.create(this.destinations, value, key); return { destination: result.value, created: result.created }; }
  async createMediaIfAbsent(value: MediaAsset, key: string) { const result = this.create(this.media, value, key); return { media: result.value, created: result.created }; }
  async approvePropertyMedia(propertyId: string, at: Date) { let count = 0; for (const [id, value] of this.media) if (value.ownerId === propertyId && value.status === "ACTIVE") { this.media.set(id, { ...value, moderationStatus: "APPROVED", updatedAt: at }); count++; } return count; }
  async listActiveRooms(propertyId: string) { return [...this.rooms.values()].filter((value) => value.propertyId === propertyId && value.status === "ACTIVE"); }
  async listActiveMedia(propertyId: string) { return [...this.media.values()].filter((value) => value.ownerId === propertyId && value.status === "ACTIVE"); }
  async listNearbyPlaces(propertyId: string) { return [...this.nearby.values()].filter((value) => value.propertyId === propertyId); }
  async listVendorProperties(vendorId: string) { return [...this.properties.values()].filter((value) => value.vendorId === vendorId); }
  async listPendingVendors() { return [...this.vendors.values()].filter((value) => value.status === "PENDING_REVIEW"); }
  async listPendingProperties() { return [...this.properties.values()].filter((value) => value.status === "PENDING_REVIEW"); }
  private create<T extends { id: string }>(map: Map<string, T>, value: T, key: string): { value: T; created: boolean } { const existingId = this.keys.get(key); if (existingId) return { value: map.get(existingId)!, created: false }; this.keys.set(key, value.id); map.set(value.id, value); return { value, created: true }; }
}
