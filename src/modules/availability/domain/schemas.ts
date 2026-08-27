import { z } from "zod";

const identifier = z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9_-]+$/);
const idempotencyKey = z.string().trim().min(12).max(120).regex(/^[a-zA-Z0-9:_-]+$/);
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const updateInventoryDaySchema = z.object({
  action: z.literal("UPDATE_INVENTORY_DAY"),
  roomTypeId: identifier,
  localDate: localDate,
  capacity: z.number().int().min(0).max(1000).optional(),
  adjustment: z.number().int().min(-1000).max(1000).optional(),
  stopSell: z.boolean().optional(),
  minStay: z.number().int().min(1).max(30).optional(),
  maxStay: z.number().int().min(1).max(100).optional(),
}).strict();

export const bulkUpdateInventorySchema = z.object({
  action: z.literal("BULK_UPDATE_INVENTORY"),
  roomTypeId: identifier,
  startDate: localDate,
  endDate: localDate,
  capacity: z.number().int().min(0).max(1000).optional(),
  adjustment: z.number().int().min(-1000).max(1000).optional(),
  stopSell: z.boolean().optional(),
  minStay: z.number().int().min(1).max(30).optional(),
  maxStay: z.number().int().min(1).max(100).optional(),
}).strict();

export const createHoldSchema = z.object({
  action: z.literal("CREATE_HOLD"),
  idempotencyKey,
  bookingRef: identifier,
  roomTypeId: identifier,
  checkInDate: localDate,
  checkOutDate: localDate,
  quantity: z.number().int().min(1).max(100),
  holdDurationSeconds: z.number().int().min(60).max(3600).default(900),
}).strict();

export const consumeHoldSchema = z.object({
  action: z.literal("CONSUME_HOLD"),
  idempotencyKey,
  bookingRef: identifier,
}).strict();

export const releaseHoldSchema = z.object({
  action: z.literal("RELEASE_HOLD"),
  bookingRef: identifier,
}).strict();

export const availabilityMutationSchema = z.discriminatedUnion("action", [
  updateInventoryDaySchema,
  bulkUpdateInventorySchema,
  createHoldSchema,
  consumeHoldSchema,
  releaseHoldSchema,
]);

export type AvailabilityMutationInput = z.infer<typeof availabilityMutationSchema>;
