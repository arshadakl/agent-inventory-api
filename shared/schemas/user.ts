import { z } from "zod";

export const authenticatedUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
});

export const userSchema = authenticatedUserSchema.extend({
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});
