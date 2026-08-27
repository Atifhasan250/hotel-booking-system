import { randomUUID } from "node:crypto";

import type { ActorContext } from "../../identity/domain/model";
import { isAuthorized } from "../../identity/application/authorization";
import type { CatalogDependencies } from "./ports";
import { CatalogAuthorizationError, CatalogConflictError, CatalogIncompleteError, CatalogNotFoundError, CatalogRateLimitError } from "./errors";
import { evaluatePublishChecklist } from "./publish-checklist";
import type { CatalogMutationInput } from "../domain/schemas";
import type { MediaAsset, Property, PropertyLocation, RoomType, VendorOrganization } from "../domain/model";

export interface CatalogRequestContext {
  requestId: string;
}

export class CatalogService {
  constructor(private readonly deps: CatalogDependencies) {}

  async mutate(actor: ActorContext | null, input: CatalogMutationInput, context: CatalogRequestContext) {
    if (actor) {
      const limit = input.action === "REQUEST_MEDIA_UPLOAD" ? 20 : 120;
      const key = `catalog:${input.action.toLowerCase()}:${actor.userId}`;
      if (!await this.deps.rateLimiter.consume(key, limit, 300)) {
        await this.deps.audit.append({ id: randomUUID(), actorId: actor.userId, action: "catalog.rate-limit", targetType: "catalog", outcome: "DENIED", requestId: context.requestId, occurredAt: this.deps.clock.now(), metadata: { mutation: input.action } });
        throw new CatalogRateLimitError();
      }
    }
    switch (input.action) {
      case "ONBOARD_VENDOR": return this.onboardVendor(actor, input, context);
      case "SUBMIT_VENDOR": return this.submitVendor(actor, input.vendorId, context);
      case "REVIEW_VENDOR": return this.reviewVendor(actor, input, context);
      case "CREATE_PROPERTY": return this.createProperty(actor, input, context);
      case "UPDATE_PROPERTY": return this.updateProperty(actor, input, context);
      case "CREATE_ROOM_TYPE": return this.createRoomType(actor, input, context);
      case "CREATE_NEARBY_PLACE": return this.createNearbyPlace(actor, input, context);
      case "CREATE_DESTINATION": return this.createDestination(actor, input, context);
      case "REQUEST_MEDIA_UPLOAD": return this.requestMediaUpload(actor, input, context);
      case "REGISTER_MEDIA": return this.registerMedia(actor, input, context);
      case "SUBMIT_PROPERTY": return this.submitProperty(actor, input.vendorId, input.propertyId, context);
      case "REVIEW_PROPERTY": return this.reviewProperty(actor, input, context);
      case "ARCHIVE_PROPERTY": return this.archiveProperty(actor, input, context);
    }
  }

  async vendorWorkspace(actor: ActorContext | null, vendorId: string, context: CatalogRequestContext) {
    await this.requireVendor(actor, vendorId, context, "catalog.workspace.read");
    const vendor = await this.deps.repository.findVendorById(vendorId);
    if (!vendor) throw new CatalogNotFoundError();
    const properties = await this.deps.repository.listVendorProperties(vendorId);
    return {
      vendor: vendorDto(vendor),
      properties: properties.map((property) => propertyDto(property, this.deps.maps.present(property))),
    };
  }

  async reviewQueue(actor: ActorContext | null, context: CatalogRequestContext) {
    await this.requireAdmin(actor, context, "catalog.review-queue.read", "admin:marketplace:read");
    const [vendors, properties] = await Promise.all([
      this.deps.repository.listPendingVendors(),
      this.deps.repository.listPendingProperties(),
    ]);
    return { vendors: vendors.map(vendorDto), properties: properties.map((property) => propertyDto(property, this.deps.maps.present(property))) };
  }

  private async onboardVendor(actor: ActorContext | null, input: Extract<CatalogMutationInput, { action: "ONBOARD_VENDOR" }>, context: CatalogRequestContext) {
    if (!actor) return this.deny(actor, context, "catalog.vendor.onboard", "vendor");
    const now = this.deps.clock.now();
    const vendor: VendorOrganization = {
      id: this.deps.ids.create(),
      publicId: this.deps.ids.create(),
      ownerUserId: actor.userId,
      displayName: input.displayName,
      legalName: input.legalName,
      normalizedContactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      status: "DRAFT",
      onboardingKey: `${actor.userId}:${input.idempotencyKey}`,
      createdAt: now,
      updatedAt: now,
    };
    return this.deps.transactions.run(async () => {
      const result = await this.deps.repository.createVendorIfAbsent(vendor);
      if (result.created) {
        await this.deps.repository.addOwnerMembership({ id: this.deps.ids.create(), userId: actor.userId, vendorId: result.vendor.id, createdAt: now });
        await this.audit(actor.userId, "catalog.vendor.onboard", "vendor", result.vendor.id, context, { status: "DRAFT" });
      }
      return { vendor: vendorDto(result.vendor), idempotentReplay: !result.created };
    });
  }

  private async submitVendor(actor: ActorContext | null, vendorId: string, context: CatalogRequestContext) {
    await this.requireVendor(actor, vendorId, context, "catalog.vendor.submit");
    const now = this.deps.clock.now();
    return this.deps.transactions.run(async () => {
      const vendor = await this.deps.repository.findVendorById(vendorId);
      if (!vendor) throw new CatalogNotFoundError();
      if (vendor.status === "PENDING_REVIEW") return { vendor: vendorDto(vendor), idempotentReplay: true };
      const changed = await this.deps.repository.updateVendorStatus(vendorId, ["DRAFT", "CHANGES_REQUESTED"], "PENDING_REVIEW", undefined, now);
      if (!changed) throw new CatalogConflictError("Vendor cannot be submitted from its current state");
      await this.audit(actor!.userId, "catalog.vendor.submit", "vendor", vendorId, context, { status: "PENDING_REVIEW" });
      return { vendorId, status: "PENDING_REVIEW" as const };
    });
  }

  private async reviewVendor(actor: ActorContext | null, input: Extract<CatalogMutationInput, { action: "REVIEW_VENDOR" }>, context: CatalogRequestContext) {
    await this.requireAdmin(actor, context, "catalog.vendor.review", "admin:vendors:approve", input.vendorId);
    const to = input.decision === "APPROVE" ? "APPROVED" : input.decision === "SUSPEND" ? "SUSPENDED" : "CHANGES_REQUESTED";
    const now = this.deps.clock.now();
    return this.deps.transactions.run(async () => {
      const vendor = await this.deps.repository.findVendorById(input.vendorId);
      if (!vendor) throw new CatalogNotFoundError();
      if (vendor.status === to && vendor.moderationNote === input.note) return { vendorId: input.vendorId, status: to, idempotentReplay: true };
      const allowedFrom: VendorOrganization["status"][] = input.decision === "SUSPEND" ? ["PENDING_REVIEW", "APPROVED"] : ["PENDING_REVIEW"];
      if (!await this.deps.repository.updateVendorStatus(input.vendorId, allowedFrom, to, input.note, now)) throw new CatalogConflictError();
      await this.audit(actor!.userId, "catalog.vendor.review", "vendor", input.vendorId, context, { decision: input.decision, status: to });
      return { vendorId: input.vendorId, status: to };
    });
  }

  private async createProperty(actor: ActorContext | null, input: Extract<CatalogMutationInput, { action: "CREATE_PROPERTY" }>, context: CatalogRequestContext) {
    await this.requireApprovedVendor(actor, input.vendorId, context, "catalog.property.create");
    const now = this.deps.clock.now();
    const property: Property = {
      id: this.deps.ids.create(), publicId: this.deps.ids.create(), vendorId: input.vendorId,
      name: input.name, slug: input.slug, propertyType: input.propertyType, propertyClass: input.propertyClass,
      description: input.description, districtId: input.districtId, destinationId: input.destinationId,
      timezone: input.timezone, amenityKeys: [...new Set(input.amenityKeys)], policies: input.policies,
      location: { ...input.location, countryCode: "BD", validationStatus: "UNVERIFIED" },
      status: "DRAFT", createdAt: now, updatedAt: now,
    };
    return this.deps.transactions.run(async () => {
      await this.assertVendorApproved(input.vendorId);
      const result = await this.deps.repository.createPropertyIfAbsent(property, `${input.vendorId}:${input.idempotencyKey}`);
      if (result.created) await this.audit(actor!.userId, "catalog.property.create", "property", result.property.id, context, { vendorId: input.vendorId });
      return { property: propertyDto(result.property, this.deps.maps.present(result.property)), idempotentReplay: !result.created };
    });
  }

  private async updateProperty(actor: ActorContext | null, input: Extract<CatalogMutationInput, { action: "UPDATE_PROPERTY" }>, context: CatalogRequestContext) {
    await this.requireApprovedVendor(actor, input.vendorId, context, "catalog.property.update");
    return this.deps.transactions.run(async () => {
      await this.assertVendorApproved(input.vendorId);
      const current = await this.deps.repository.findPropertyForVendor(input.propertyId, input.vendorId);
      if (!current) throw new CatalogNotFoundError();
      if (!["DRAFT", "CHANGES_REQUESTED"].includes(current.status)) throw new CatalogConflictError("Published or pending properties cannot be edited");
      const property: Property = {
        ...current, name: input.name, slug: input.slug, propertyType: input.propertyType, propertyClass: input.propertyClass,
        description: input.description, districtId: input.districtId, destinationId: input.destinationId,
        timezone: input.timezone, amenityKeys: [...new Set(input.amenityKeys)], policies: input.policies,
        location: { ...input.location, countryCode: "BD", validationStatus: "UNVERIFIED" },
        status: "DRAFT", moderationNote: undefined, updatedAt: this.deps.clock.now(),
      };
      if (!await this.deps.repository.updateProperty(property)) throw new CatalogConflictError();
      await this.audit(actor!.userId, "catalog.property.update", "property", property.id, context, { vendorId: input.vendorId });
      return { property: propertyDto(property, this.deps.maps.present(property)) };
    });
  }

  private async createRoomType(actor: ActorContext | null, input: Extract<CatalogMutationInput, { action: "CREATE_ROOM_TYPE" }>, context: CatalogRequestContext) {
    await this.requireApprovedVendor(actor, input.vendorId, context, "catalog.room.create");
    const now = this.deps.clock.now();
    const roomType: RoomType = {
      id: this.deps.ids.create(), publicId: this.deps.ids.create(), vendorId: input.vendorId, propertyId: input.propertyId,
      name: input.name, description: input.description, maxAdults: input.maxAdults, maxChildren: input.maxChildren,
      bedConfiguration: input.bedConfiguration, baseQuantity: input.baseQuantity, amenityKeys: [...new Set(input.amenityKeys)],
      airConditioning: input.airConditioning, status: "ACTIVE", createdAt: now, updatedAt: now,
    };
    return this.deps.transactions.run(async () => {
      await this.assertVendorApproved(input.vendorId);
      const property = await this.deps.repository.findPropertyForVendor(input.propertyId, input.vendorId);
      if (!property) throw new CatalogNotFoundError();
      if (property.status === "ARCHIVED") throw new CatalogConflictError();
      const result = await this.deps.repository.createRoomTypeIfAbsent(roomType, `${input.vendorId}:${input.idempotencyKey}`);
      if (result.created) await this.audit(actor!.userId, "catalog.room.create", "roomType", result.roomType.id, context, { propertyId: input.propertyId });
      return { roomType: roomDto(result.roomType), idempotentReplay: !result.created };
    });
  }

  private async createNearbyPlace(actor: ActorContext | null, input: Extract<CatalogMutationInput, { action: "CREATE_NEARBY_PLACE" }>, context: CatalogRequestContext) {
    await this.requireApprovedVendor(actor, input.vendorId, context, "catalog.nearby.create");
    const now = this.deps.clock.now();
    const place = { id: this.deps.ids.create(), publicId: this.deps.ids.create(), vendorId: input.vendorId, propertyId: input.propertyId, name: input.name, type: input.type, distanceMeters: input.distanceMeters, validationStatus: "UNVERIFIED" as const, createdAt: now, updatedAt: now };
    return this.deps.transactions.run(async () => {
      await this.assertVendorApproved(input.vendorId);
      if (!await this.deps.repository.findPropertyForVendor(input.propertyId, input.vendorId)) throw new CatalogNotFoundError();
      const result = await this.deps.repository.createNearbyPlaceIfAbsent(place, `${input.vendorId}:${input.idempotencyKey}`);
      if (result.created) await this.audit(actor!.userId, "catalog.nearby.create", "nearbyPlace", result.place.id, context, { propertyId: input.propertyId });
      return { nearbyPlace: result.place, idempotentReplay: !result.created };
    });
  }

  private async createDestination(actor: ActorContext | null, input: Extract<CatalogMutationInput, { action: "CREATE_DESTINATION" }>, context: CatalogRequestContext) {
    await this.requireAdmin(actor, context, "catalog.destination.create", "admin:content:manage");
    const now = this.deps.clock.now();
    const destination = { id: this.deps.ids.create(), publicId: this.deps.ids.create(), name: input.name, slug: input.slug, district: input.district, region: input.region, summary: input.summary, status: "DRAFT" as const, createdAt: now, updatedAt: now };
    return this.deps.transactions.run(async () => {
      const result = await this.deps.repository.createDestinationIfAbsent(destination, input.idempotencyKey);
      if (result.created) await this.audit(actor!.userId, "catalog.destination.create", "destination", result.destination.id, context, { status: "DRAFT" });
      return { destination: result.destination, idempotentReplay: !result.created };
    });
  }

  private async requestMediaUpload(actor: ActorContext | null, input: Extract<CatalogMutationInput, { action: "REQUEST_MEDIA_UPLOAD" }>, context: CatalogRequestContext) {
    await this.requireApprovedVendor(actor, input.vendorId, context, "catalog.media.authorize");
    return this.deps.transactions.run(async () => {
      await this.assertVendorApproved(input.vendorId);
      if (!await this.deps.repository.findPropertyForVendor(input.propertyId, input.vendorId)) throw new CatalogNotFoundError();
      const extension = input.fileName.split(".").pop()?.toLowerCase();
      const compatible = input.mimeType === "image/jpeg" ? ["jpg", "jpeg"].includes(extension ?? "") : extension === input.mimeType.split("/")[1];
      if (!compatible) throw new CatalogConflictError("File extension does not match MIME type");
      const authorization = this.deps.imageKit.authorize({ vendorId: input.vendorId, propertyId: input.propertyId, fileName: input.fileName, now: this.deps.clock.now() });
      await this.audit(actor!.userId, "catalog.media.authorize", "property", input.propertyId, context, { vendorId: input.vendorId, mimeType: input.mimeType });
      return { authorization };
    });
  }

  private async registerMedia(actor: ActorContext | null, input: Extract<CatalogMutationInput, { action: "REGISTER_MEDIA" }>, context: CatalogRequestContext) {
    await this.requireApprovedVendor(actor, input.vendorId, context, "catalog.media.register");
    const now = this.deps.clock.now();
    const media: MediaAsset = {
      id: this.deps.ids.create(), publicId: this.deps.ids.create(), vendorId: input.vendorId, ownerType: "PROPERTY", ownerId: input.propertyId,
      provider: "IMAGEKIT", providerFileId: input.providerFileId, filePath: input.filePath, url: input.url,
      width: input.width, height: input.height, format: input.format, bytes: input.bytes, altText: input.altText,
      sortOrder: input.sortOrder, moderationStatus: "PENDING", status: "ACTIVE", createdAt: now, updatedAt: now,
    };
    return this.deps.transactions.run(async () => {
      await this.assertVendorApproved(input.vendorId);
      if (!await this.deps.repository.findPropertyForVendor(input.propertyId, input.vendorId)) throw new CatalogNotFoundError();
      if (!this.deps.imageKit.validateRegisteredAsset(input)) throw new CatalogConflictError("ImageKit asset is outside the authorized property scope");
      const result = await this.deps.repository.createMediaIfAbsent(media, `${input.vendorId}:${input.idempotencyKey}`);
      if (result.created) await this.audit(actor!.userId, "catalog.media.register", "mediaAsset", result.media.id, context, { propertyId: input.propertyId });
      return { media: mediaDto(result.media), idempotentReplay: !result.created };
    });
  }

  private async submitProperty(actor: ActorContext | null, vendorId: string, propertyId: string, context: CatalogRequestContext) {
    await this.requireApprovedVendor(actor, vendorId, context, "catalog.property.submit");
    return this.deps.transactions.run(async () => {
      await this.assertVendorApproved(vendorId);
      const property = await this.deps.repository.findPropertyForVendor(propertyId, vendorId);
      if (!property) throw new CatalogNotFoundError();
      if (property.status === "PENDING_REVIEW") return { propertyId, status: "PENDING_REVIEW" as const, idempotentReplay: true };
      const [rooms, media] = await Promise.all([this.deps.repository.listActiveRooms(propertyId), this.deps.repository.listActiveMedia(propertyId)]);
      const vendor = await this.deps.repository.findVendorById(vendorId);
      if (!vendor) throw new CatalogNotFoundError();
      const draftChecklist = evaluatePublishChecklist({ vendor, property: { ...property, location: { ...property.location, validationStatus: "VERIFIED" } }, rooms, media: media.map((asset) => ({ ...asset, moderationStatus: "APPROVED" })) });
      const vendorMissing = draftChecklist.missing.filter((item) => !["verified location", "approved property media with alt text"].includes(item));
      if (vendorMissing.length) throw new CatalogIncompleteError(vendorMissing);
      if (!await this.deps.repository.updatePropertyStatus({ propertyId, from: ["DRAFT", "CHANGES_REQUESTED"], to: "PENDING_REVIEW", at: this.deps.clock.now() })) throw new CatalogConflictError();
      await this.audit(actor!.userId, "catalog.property.submit", "property", propertyId, context, { vendorId });
      return { propertyId, status: "PENDING_REVIEW" as const };
    });
  }

  private async reviewProperty(actor: ActorContext | null, input: Extract<CatalogMutationInput, { action: "REVIEW_PROPERTY" }>, context: CatalogRequestContext) {
    await this.requireAdmin(actor, context, "catalog.property.review", "admin:vendors:approve", input.propertyId);
    return this.deps.transactions.run(async () => {
      const property = await this.deps.repository.findPropertyById(input.propertyId);
      if (!property) throw new CatalogNotFoundError();
      if (input.decision === "PUBLISH" && property.status === "PUBLISHED") {
        return { propertyId: input.propertyId, status: "PUBLISHED" as const, idempotentReplay: true };
      }
      if (input.decision === "REQUEST_CHANGES" && property.status === "CHANGES_REQUESTED" && property.moderationNote === input.note) {
        return { propertyId: input.propertyId, status: "CHANGES_REQUESTED" as const, idempotentReplay: true };
      }
      if (input.decision === "REQUEST_CHANGES") {
        if (!await this.deps.repository.updatePropertyStatus({ propertyId: input.propertyId, from: ["PENDING_REVIEW"], to: "CHANGES_REQUESTED", note: input.note, at: this.deps.clock.now() })) throw new CatalogConflictError();
        await this.audit(actor!.userId, "catalog.property.review", "property", input.propertyId, context, { decision: input.decision });
        return { propertyId: input.propertyId, status: "CHANGES_REQUESTED" as const };
      }
      if (!input.locationVerified || !input.mediaApproved) throw new CatalogIncompleteError([!input.locationVerified ? "verified location" : "", !input.mediaApproved ? "approved property media" : ""].filter(Boolean));
      const now = this.deps.clock.now();
      const location: PropertyLocation = { ...property.location, validationStatus: "VERIFIED", validatedBy: actor!.userId, validatedAt: now };
      await this.deps.repository.approvePropertyMedia(input.propertyId, now);
      const [vendor, rooms, media] = await Promise.all([
        this.deps.repository.findVendorById(property.vendorId),
        this.deps.repository.listActiveRooms(input.propertyId),
        this.deps.repository.listActiveMedia(input.propertyId),
      ]);
      if (!vendor) throw new CatalogNotFoundError();
      const checklist = evaluatePublishChecklist({ vendor, property: { ...property, location }, rooms, media });
      if (!checklist.complete) throw new CatalogIncompleteError(checklist.missing);
      if (!await this.deps.repository.updatePropertyStatus({ propertyId: input.propertyId, from: ["PENDING_REVIEW"], to: "PUBLISHED", note: input.note, location, at: now })) throw new CatalogConflictError();
      await this.audit(actor!.userId, "catalog.property.review", "property", input.propertyId, context, { decision: input.decision });
      return { propertyId: input.propertyId, status: "PUBLISHED" as const, checklist };
    });
  }

  private async archiveProperty(actor: ActorContext | null, input: Extract<CatalogMutationInput, { action: "ARCHIVE_PROPERTY" }>, context: CatalogRequestContext) {
    await this.requireVendor(actor, input.vendorId, context, "catalog.property.archive");
    return this.deps.transactions.run(async () => {
      const property = await this.deps.repository.findPropertyForVendor(input.propertyId, input.vendorId);
      if (!property) throw new CatalogNotFoundError();
      if (property.status === "ARCHIVED") return { propertyId: input.propertyId, status: "ARCHIVED" as const, idempotentReplay: true };
      if (!await this.deps.repository.updatePropertyStatus({ propertyId: input.propertyId, from: ["DRAFT", "PENDING_REVIEW", "PUBLISHED", "CHANGES_REQUESTED"], to: "ARCHIVED", note: input.reason, at: this.deps.clock.now() })) throw new CatalogConflictError();
      await this.audit(actor!.userId, "catalog.property.archive", "property", input.propertyId, context, { vendorId: input.vendorId, reasonRecorded: true });
      return { propertyId: input.propertyId, status: "ARCHIVED" as const };
    });
  }

  private async requireApprovedVendor(actor: ActorContext | null, vendorId: string, context: CatalogRequestContext, action: string) {
    await this.requireVendor(actor, vendorId, context, action);
    await this.assertVendorApproved(vendorId);
  }

  private async assertVendorApproved(vendorId: string) {
    const vendor = await this.deps.repository.findVendorById(vendorId);
    if (!vendor) throw new CatalogNotFoundError();
    if (vendor.status !== "APPROVED") throw new CatalogConflictError("Vendor approval is required");
  }

  private async requireVendor(actor: ActorContext | null, vendorId: string, context: CatalogRequestContext, action: string) {
    if (!isAuthorized(actor, { scope: "vendor", vendorId, permission: "vendor:properties:manage" })) {
      return this.deny(actor, context, action, "vendor", vendorId);
    }
  }

  private async requireAdmin(actor: ActorContext | null, context: CatalogRequestContext, action: string, permission: "admin:marketplace:read" | "admin:vendors:approve" | "admin:content:manage", targetId?: string) {
    if (!isAuthorized(actor, { scope: "admin", permission })) return this.deny(actor, context, action, "catalog", targetId);
  }

  private async deny(actor: ActorContext | null, context: CatalogRequestContext, action: string, targetType: string, targetId?: string): Promise<never> {
    await this.deps.audit.append({ id: randomUUID(), actorId: actor?.userId ?? "anonymous", action, targetType, targetId, outcome: "DENIED", requestId: context.requestId, occurredAt: this.deps.clock.now(), metadata: {} });
    throw new CatalogAuthorizationError();
  }

  private audit(actorId: string, action: string, targetType: string, targetId: string, context: CatalogRequestContext, metadata: Record<string, string | number | boolean>) {
    return this.deps.audit.append({ id: randomUUID(), actorId, action, targetType, targetId, outcome: "SUCCESS", requestId: context.requestId, occurredAt: this.deps.clock.now(), metadata });
  }
}

function vendorDto(vendor: VendorOrganization) {
  return { id: vendor.id, publicId: vendor.publicId, displayName: vendor.displayName, status: vendor.status, moderationNote: vendor.moderationNote, updatedAt: vendor.updatedAt.toISOString() };
}

function propertyDto(property: Property, map: { provider: "UNCONFIGURED"; label: string; externalUrl?: string }) {
  return { id: property.id, publicId: property.publicId, vendorId: property.vendorId, name: property.name, slug: property.slug, propertyType: property.propertyType, propertyClass: property.propertyClass, districtId: property.districtId, status: property.status, moderationNote: property.moderationNote, map, updatedAt: property.updatedAt.toISOString() };
}

function roomDto(room: RoomType) {
  return { id: room.id, publicId: room.publicId, propertyId: room.propertyId, name: room.name, maxAdults: room.maxAdults, maxChildren: room.maxChildren, baseQuantity: room.baseQuantity, airConditioning: room.airConditioning, status: room.status };
}

function mediaDto(media: MediaAsset) {
  return { id: media.id, publicId: media.publicId, ownerId: media.ownerId, url: media.url, width: media.width, height: media.height, altText: media.altText, sortOrder: media.sortOrder, moderationStatus: media.moderationStatus, status: media.status };
}
