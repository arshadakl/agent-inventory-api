import { z } from "zod";

export const apiKeyNameSchema = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters.")
  .max(64, "Name must be 64 characters or fewer.");

export const createApiKeySchema = z.object({ name: apiKeyNameSchema });

export const apiKeySchema = z.object({
  id: z.uuid(),
  name: apiKeyNameSchema,
  prefix: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
  lastUsedAt: z.number().int().nonnegative().nullable(),
  revokedAt: z.number().int().nonnegative().nullable(),
});

export type CreateApiKeyInput = z.output<typeof createApiKeySchema>;
