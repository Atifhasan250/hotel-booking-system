import { z } from "zod";

const strongPassword = z
  .string()
  .min(12)
  .max(128)
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[0-9]/, "Password must contain a number")
  .regex(/[^A-Za-z0-9]/, "Password must contain a symbol");

export const registerInputSchema = z.object({
  displayName: z.string().trim().min(2).max(100),
  email: z.string().trim().max(254).pipe(z.email()),
  password: strongPassword,
});

export const loginInputSchema = z.object({
  email: z.string().trim().max(254).pipe(z.email()),
  password: z.string().min(1).max(128),
});

export const emailInputSchema = z.object({
  email: z.string().trim().max(254).pipe(z.email()),
});

export const tokenInputSchema = z.object({
  token: z.string().min(32).max(512),
});

export const resetPasswordInputSchema = tokenInputSchema.extend({
  password: strongPassword,
});

export type RegisterInput = z.infer<typeof registerInputSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordInputSchema>;

export function normalizeEmail(email: string): string {
  return email.trim().toLocaleLowerCase("en-US");
}
