export const PROPERTY_TYPES = ["HOTEL", "RESORT", "ECO_RESORT", "HOMESTAY", "COTTAGE", "VILLA"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const PROPERTY_CLASSES = ["LUXURY", "STANDARD", "BUDGET"] as const;
export type PropertyClass = (typeof PROPERTY_CLASSES)[number];

export const REQUIRED_AMENITY_KEYS = [
  "air-conditioning",
  "non-air-conditioning",
  "swimming-pool",
  "free-breakfast",
  "couple-friendly",
  "family-friendly",
  "wifi",
  "parking",
  "pet-friendly",
  "nature-view",
] as const;
export type RequiredAmenityKey = (typeof REQUIRED_AMENITY_KEYS)[number];

export type VendorStatus = "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "CHANGES_REQUESTED" | "SUSPENDED" | "ARCHIVED";
export type PropertyStatus = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "CHANGES_REQUESTED" | "ARCHIVED";
export type DestinationStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface VendorOrganization {
  id: string;
  publicId: string;
  ownerUserId: string;
  displayName: string;
  legalName: string;
  normalizedContactEmail: string;
  contactPhone: string;
  status: VendorStatus;
  onboardingKey: string;
  moderationNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PropertyPolicies {
  checkInTime: string;
  checkOutTime: string;
  cancellationSummary: string;
  childPolicy: string;
  extraBedPolicy: string;
  petPolicy: string;
  couplePolicy: string;
}

export interface PropertyLocation {
  addressLine: string;
  area: string;
  postalCode?: string;
  countryCode: "BD";
  validationStatus: "UNVERIFIED" | "VERIFIED";
  validatedBy?: string;
  validatedAt?: Date;
  mapReference?: string;
}

export interface Property {
  id: string;
  publicId: string;
  vendorId: string;
  name: string;
  slug: string;
  propertyType: PropertyType;
  propertyClass: PropertyClass;
  description: string;
  districtId: string;
  destinationId?: string;
  timezone: string;
  amenityKeys: string[];
  policies: PropertyPolicies;
  location: PropertyLocation;
  status: PropertyStatus;
  moderationNote?: string;
  createdAt: Date;
  updatedAt: Date;
  archivedAt?: Date;
}

export interface RoomType {
  id: string;
  publicId: string;
  vendorId: string;
  propertyId: string;
  name: string;
  description: string;
  maxAdults: number;
  maxChildren: number;
  bedConfiguration: string;
  baseQuantity: number;
  amenityKeys: string[];
  airConditioning: "AC" | "NON_AC";
  status: "ACTIVE" | "ARCHIVED";
  createdAt: Date;
  updatedAt: Date;
  archivedAt?: Date;
}

export interface Destination {
  id: string;
  publicId: string;
  name: string;
  slug: string;
  district: string;
  region: string;
  summary: string;
  status: DestinationStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface NearbyPlace {
  id: string;
  publicId: string;
  vendorId: string;
  propertyId: string;
  name: string;
  type: "LANDMARK" | "NATURE" | "TRANSPORT" | "DINING" | "HEALTHCARE";
  distanceMeters: number;
  validationStatus: "UNVERIFIED" | "VERIFIED";
  createdAt: Date;
  updatedAt: Date;
}

export interface MediaAsset {
  id: string;
  publicId: string;
  vendorId: string;
  ownerType: "PROPERTY" | "ROOM_TYPE" | "DESTINATION";
  ownerId: string;
  provider: "IMAGEKIT";
  providerFileId: string;
  filePath: string;
  url: string;
  width: number;
  height: number;
  format: "jpg" | "jpeg" | "png" | "webp";
  bytes: number;
  altText: string;
  sortOrder: number;
  moderationStatus: "PENDING" | "APPROVED" | "REJECTED";
  status: "ACTIVE" | "ARCHIVED";
  createdAt: Date;
  updatedAt: Date;
  archivedAt?: Date;
}

export interface PublishChecklist {
  complete: boolean;
  missing: string[];
}

export interface MapPresentation {
  provider: "UNCONFIGURED";
  label: string;
  externalUrl?: string;
}
