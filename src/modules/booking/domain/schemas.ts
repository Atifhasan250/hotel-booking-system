import { z } from "zod";

const identifier = z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9_-]+$/);
const idempotencyKey = z.string().trim().min(12).max(120).regex(/^[a-zA-Z0-9:_-]+$/);
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const safeText = (minimum: number, maximum: number) => z.string().trim().min(minimum).max(maximum)
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "Control characters are not allowed");

export const createBookingDraftSchema = z.object({
  propertyId: identifier,
  roomTypeId: identifier,
  ratePlanId: identifier,
  quoteId: identifier,
  checkInDate: localDate,
  checkOutDate: localDate,
  roomQuantity: z.number().int().min(1).max(20),
  occupants: z.object({
    adults: z.number().int().min(1).max(40),
    children: z.number().int().min(0).max(40),
  }).strict(),
  primaryGuest: z.object({
    fullName: safeText(2, 120),
    email: z.email().max(254).transform((value) => value.trim().toLowerCase()),
    phone: z.string().trim().min(7).max(24).regex(/^\+?[0-9][0-9 ()-]*$/),
  }).strict(),
  specialRequests: safeText(1, 500).optional(),
  consent: z.object({
    accepted: z.literal(true),
    policyVersion: identifier,
  }).strict(),
  idempotencyKey,
}).strict().superRefine((input, context) => {
  if (input.checkOutDate <= input.checkInDate) {
    context.addIssue({ code: "custom", path: ["checkOutDate"], message: "Check-out must be after check-in" });
  }
});

export type CreateBookingDraftInput = z.infer<typeof createBookingDraftSchema>;
