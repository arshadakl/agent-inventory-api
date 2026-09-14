import { z } from "zod";

export const MAX_PASSWORD_LENGTH = 128;

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "Email must be 254 characters or fewer.")
    .pipe(z.email("Enter a valid email address.")),
  password: z
    .string()
    .min(1, "Password is required.")
    .max(
      MAX_PASSWORD_LENGTH,
      `Password must be ${MAX_PASSWORD_LENGTH} characters or fewer.`,
    ),
});

export type LoginInput = z.infer<typeof loginSchema>;
