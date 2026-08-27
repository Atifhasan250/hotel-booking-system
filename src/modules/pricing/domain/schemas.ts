import { z } from "zod";

const identifier = z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9_-]+$/);
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const idempotencyKey = z.string().trim().min(12).max(120).regex(/^[a-zA-Z0-9:_-]+$/);

export const createRatePlanSchema = z.object({
  action: z.literal("CREATE_RATE_PLAN"),
  idempotencyKey,
  roomTypeId: identifier,
  name: z.string().min(2).max(120),
  cancellationPolicy: z.string().min(5).max(1000),
  mealPlan: z.string().min(2).max(120),
  occupancyRules: z.object({
    adults: z.number().int().min(1).max(20),
    children: z.number().int().min(0).max(20),
  }),
  basePrice: z.number().int().min(0),
}).strict();

export const updateRateOverrideSchema = z.object({
  action: z.literal("UPDATE_RATE_OVERRIDE"),
  ratePlanId: identifier,
  localDate: localDate,
  amount: z.number().int().min(0),
  minStay: z.number().int().min(1).max(30).optional(),
  maxStay: z.number().int().min(1).max(100).optional(),
  closedToArrival: z.boolean().default(false),
  closedToDeparture: z.boolean().default(false),
}).strict();

export const createOfferSchema = z.object({
  action: z.literal("CREATE_OFFER"),
  idempotencyKey,
  vendorId: identifier,
  propertyId: identifier.optional(),
  name: z.string().min(2).max(120),
  bookingWindow: z.object({ start: localDate, end: localDate }),
  stayWindow: z.object({ start: localDate, end: localDate }),
  discountType: z.enum(["PERCENTAGE", "FIXED"]),
  discountValue: z.number().int().min(1),
  stackable: z.boolean().default(false),
}).strict();

export const pricingMutationSchema = z.discriminatedUnion("action", [
  createRatePlanSchema,
  updateRateOverrideSchema,
  createOfferSchema,
]);

export type PricingMutationInput = z.infer<typeof pricingMutationSchema>;
