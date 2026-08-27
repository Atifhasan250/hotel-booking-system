import { z } from "zod";

import { PROPERTY_CLASSES, PROPERTY_TYPES, REQUIRED_AMENITY_KEYS } from "./model";

const identifier = z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9_-]+$/);
const idempotencyKey = z.string().trim().min(12).max(120).regex(/^[a-zA-Z0-9:_-]+$/);
const slug = z.string().trim().min(3).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const safeText = (min: number, max: number) => z.string().trim().min(min).max(max);
const amenityKey = z.string().trim().min(2).max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const propertyPoliciesSchema = z.object({
  checkInTime: time,
  checkOutTime: time,
  cancellationSummary: safeText(10, 1000),
  childPolicy: safeText(10, 1000),
  extraBedPolicy: safeText(10, 1000),
  petPolicy: safeText(10, 1000),
  couplePolicy: safeText(10, 1000),
}).strict();

export const propertyLocationSchema = z.object({
  addressLine: safeText(5, 240),
  area: safeText(2, 120),
  postalCode: z.string().trim().max(20).optional(),
  countryCode: z.literal("BD").default("BD"),
}).strict();

export const onboardVendorSchema = z.object({
  action: z.literal("ONBOARD_VENDOR"),
  idempotencyKey,
  displayName: safeText(2, 120),
  legalName: safeText(2, 180),
  contactEmail: z.email().transform((value) => value.trim().toLowerCase()),
  contactPhone: z.string().trim().regex(/^\+8801[3-9]\d{8}$/),
}).strict();

export const submitVendorSchema = z.object({
  action: z.literal("SUBMIT_VENDOR"),
  vendorId: identifier,
}).strict();

export const reviewVendorSchema = z.object({
  action: z.literal("REVIEW_VENDOR"),
  vendorId: identifier,
  decision: z.enum(["APPROVE", "REQUEST_CHANGES", "SUSPEND"]),
  note: safeText(3, 1000),
}).strict();

export const createPropertySchema = z.object({
  action: z.literal("CREATE_PROPERTY"),
  idempotencyKey,
  vendorId: identifier,
  name: safeText(3, 160),
  slug,
  propertyType: z.enum(PROPERTY_TYPES),
  propertyClass: z.enum(PROPERTY_CLASSES),
  description: safeText(40, 5000),
  districtId: identifier,
  destinationId: identifier.optional(),
  timezone: z.string().trim().regex(/^Asia\/[A-Za-z_]+$/),
  amenityKeys: z.array(amenityKey).max(80).default([]),
  policies: propertyPoliciesSchema,
  location: propertyLocationSchema,
}).strict();

export const updatePropertySchema = createPropertySchema.omit({ action: true, idempotencyKey: true }).extend({
  action: z.literal("UPDATE_PROPERTY"),
  propertyId: identifier,
}).strict();

export const createRoomTypeSchema = z.object({
  action: z.literal("CREATE_ROOM_TYPE"),
  idempotencyKey,
  vendorId: identifier,
  propertyId: identifier,
  name: safeText(2, 120),
  description: safeText(20, 2000),
  maxAdults: z.number().int().min(1).max(20),
  maxChildren: z.number().int().min(0).max(20),
  bedConfiguration: safeText(2, 200),
  baseQuantity: z.number().int().min(1).max(500),
  amenityKeys: z.array(amenityKey).max(80).default([]),
  airConditioning: z.enum(["AC", "NON_AC"]),
}).strict();

export const createNearbyPlaceSchema = z.object({
  action: z.literal("CREATE_NEARBY_PLACE"),
  idempotencyKey,
  vendorId: identifier,
  propertyId: identifier,
  name: safeText(2, 160),
  type: z.enum(["LANDMARK", "NATURE", "TRANSPORT", "DINING", "HEALTHCARE"]),
  distanceMeters: z.number().int().min(0).max(500_000),
}).strict();

export const createDestinationSchema = z.object({
  action: z.literal("CREATE_DESTINATION"),
  idempotencyKey,
  name: safeText(2, 120),
  slug,
  district: safeText(2, 120),
  region: safeText(2, 120),
  summary: safeText(40, 2000),
}).strict();

export const requestMediaUploadSchema = z.object({
  action: z.literal("REQUEST_MEDIA_UPLOAD"),
  vendorId: identifier,
  propertyId: identifier,
  fileName: z.string().trim().min(3).max(120).regex(/^[a-zA-Z0-9._-]+\.(?:jpe?g|png|webp)$/i),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
}).strict();

export const registerMediaSchema = z.object({
  action: z.literal("REGISTER_MEDIA"),
  idempotencyKey,
  vendorId: identifier,
  propertyId: identifier,
  providerFileId: safeText(3, 200),
  filePath: z.string().trim().min(5).max(500).startsWith("/"),
  url: z.url().refine((value) => new URL(value).protocol === "https:", "Media URL must use HTTPS"),
  width: z.number().int().min(1).max(30_000),
  height: z.number().int().min(1).max(30_000),
  format: z.enum(["jpg", "jpeg", "png", "webp"]),
  bytes: z.number().int().min(1).max(10 * 1024 * 1024),
  altText: safeText(8, 240),
  sortOrder: z.number().int().min(0).max(1000),
}).strict();

export const submitPropertySchema = z.object({
  action: z.literal("SUBMIT_PROPERTY"),
  vendorId: identifier,
  propertyId: identifier,
}).strict();

export const reviewPropertySchema = z.object({
  action: z.literal("REVIEW_PROPERTY"),
  propertyId: identifier,
  decision: z.enum(["PUBLISH", "REQUEST_CHANGES"]),
  note: safeText(3, 1000),
  locationVerified: z.boolean(),
  mediaApproved: z.boolean(),
}).strict();

export const archivePropertySchema = z.object({
  action: z.literal("ARCHIVE_PROPERTY"),
  vendorId: identifier,
  propertyId: identifier,
  reason: safeText(3, 500),
}).strict();

export const catalogMutationSchema = z.discriminatedUnion("action", [
  onboardVendorSchema,
  submitVendorSchema,
  reviewVendorSchema,
  createPropertySchema,
  updatePropertySchema,
  createRoomTypeSchema,
  createNearbyPlaceSchema,
  createDestinationSchema,
  requestMediaUploadSchema,
  registerMediaSchema,
  submitPropertySchema,
  reviewPropertySchema,
  archivePropertySchema,
]);

export type CatalogMutationInput = z.infer<typeof catalogMutationSchema>;

export const amenityDefinitions = REQUIRED_AMENITY_KEYS.map((key) => ({ key, requiredFilter: true }));
