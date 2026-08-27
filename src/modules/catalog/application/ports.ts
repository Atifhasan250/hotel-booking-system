import type { AuditEventWriter } from "../../audit/domain/audit-event";
import type { RateLimiter, TransactionRunner } from "../../identity/application/ports";
import type {
  Destination,
  MapPresentation,
  MediaAsset,
  NearbyPlace,
  Property,
  RoomType,
  VendorOrganization,
} from "../domain/model";

export interface CatalogRepository {
  createVendorIfAbsent(vendor: VendorOrganization): Promise<{ vendor: VendorOrganization; created: boolean }>;
  findVendorById(vendorId: string): Promise<VendorOrganization | null>;
  updateVendorStatus(vendorId: string, from: VendorOrganization["status"][], to: VendorOrganization["status"], note: string | undefined, at: Date): Promise<boolean>;
  addOwnerMembership(input: { id: string; userId: string; vendorId: string; createdAt: Date }): Promise<void>;
  createPropertyIfAbsent(property: Property, idempotencyKey: string): Promise<{ property: Property; created: boolean }>;
  findPropertyById(propertyId: string): Promise<Property | null>;
  findPropertyForVendor(propertyId: string, vendorId: string): Promise<Property | null>;
  updateProperty(property: Property): Promise<boolean>;
  updatePropertyStatus(input: { propertyId: string; from: Property["status"][]; to: Property["status"]; note?: string; location?: Property["location"]; at: Date }): Promise<boolean>;
  createRoomTypeIfAbsent(roomType: RoomType, idempotencyKey: string): Promise<{ roomType: RoomType; created: boolean }>;
  createNearbyPlaceIfAbsent(place: NearbyPlace, idempotencyKey: string): Promise<{ place: NearbyPlace; created: boolean }>;
  createDestinationIfAbsent(destination: Destination, idempotencyKey: string): Promise<{ destination: Destination; created: boolean }>;
  createMediaIfAbsent(media: MediaAsset, idempotencyKey: string): Promise<{ media: MediaAsset; created: boolean }>;
  approvePropertyMedia(propertyId: string, at: Date): Promise<number>;
  listActiveRooms(propertyId: string): Promise<RoomType[]>;
  listActiveMedia(propertyId: string): Promise<MediaAsset[]>;
  listNearbyPlaces(propertyId: string): Promise<NearbyPlace[]>;
  listVendorProperties(vendorId: string): Promise<Property[]>;
  listPendingVendors(): Promise<VendorOrganization[]>;
  listPendingProperties(): Promise<Property[]>;
}

export interface UploadAuthorization {
  uploadUrl: "https://upload.imagekit.io/api/v2/files/upload";
  token: string;
  publicKey: string;
  expiresAt: string;
  payload: {
    fileName: string;
    folder: string;
    useUniqueFileName: true;
    checks: string;
    tags: string[];
  };
}

export interface ImageKitUploadSigner {
  authorize(input: { vendorId: string; propertyId: string; fileName: string; now: Date }): UploadAuthorization;
  validateRegisteredAsset(input: { vendorId: string; propertyId: string; filePath: string; url: string }): boolean;
}

export interface MapAdapter {
  present(property: Property): MapPresentation;
}

export interface CatalogDependencies {
  repository: CatalogRepository;
  audit: AuditEventWriter;
  transactions: TransactionRunner;
  rateLimiter: RateLimiter;
  imageKit: ImageKitUploadSigner;
  maps: MapAdapter;
  ids: { create(): string };
  clock: { now(): Date };
}
