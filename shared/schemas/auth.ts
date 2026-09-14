import { z } from "zod";

export const MAX_PASSWORD_LENGTH = 128;
export const MIN_PASSWORD_LENGTH = 12;

export const normalizedEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "Email must be 254 characters or fewer.")
  .pipe(z.email("Enter a valid email address."));

const boundedPasswordSchema = z
  .string()
  .max(
    MAX_PASSWORD_LENGTH,
    `Password must be ${MAX_PASSWORD_LENGTH} characters or fewer.`,
  );

export const loginSchema = z.object({
  email: normalizedEmailSchema,
  password: z
    .string()
    .min(1, "Password is required.")
    .max(
      MAX_PASSWORD_LENGTH,
      `Password must be ${MAX_PASSWORD_LENGTH} characters or fewer.`,
    ),
});

export const createUserSchema = z.object({
  email: normalizedEmailSchema,
  password: boundedPasswordSchema.min(
    MIN_PASSWORD_LENGTH,
    `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
  ),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
