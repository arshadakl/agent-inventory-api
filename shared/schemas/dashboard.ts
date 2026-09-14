import { z } from "zod";

export const dashboardStatsSchema = z.object({
  total: z.number().int().nonnegative(),
  available: z.number().int().nonnegative(),
  forSale: z.number().int().nonnegative(),
  forRent: z.number().int().nonnegative(),
  sold: z.number().int().nonnegative(),
  rented: z.number().int().nonnegative(),
});
