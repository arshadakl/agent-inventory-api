import { z } from "zod";

import type { DashboardStats } from "@shared/types/dashboard";

const dashboardStatsRowSchema = z.object({
  total: z.number().int().nonnegative(),
  available: z.number().int().nonnegative(),
  for_sale: z.number().int().nonnegative(),
  for_rent: z.number().int().nonnegative(),
  sold: z.number().int().nonnegative(),
  rented: z.number().int().nonnegative(),
});

export async function getDashboardStats(
  database: D1Database,
): Promise<DashboardStats> {
  const row = await database
    .prepare(
      `SELECT
        COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END), 0) AS available,
        COALESCE(SUM(CASE WHEN listing_type = 'sale' THEN 1 ELSE 0 END), 0) AS for_sale,
        COALESCE(SUM(CASE WHEN listing_type = 'rent' THEN 1 ELSE 0 END), 0) AS for_rent,
        COALESCE(SUM(CASE WHEN status = 'sold' THEN 1 ELSE 0 END), 0) AS sold,
        COALESCE(SUM(CASE WHEN status = 'rented' THEN 1 ELSE 0 END), 0) AS rented
       FROM properties`,
    )
    .first();
  const stats = dashboardStatsRowSchema.parse(row);

  return {
    total: stats.total,
    available: stats.available,
    forSale: stats.for_sale,
    forRent: stats.for_rent,
    sold: stats.sold,
    rented: stats.rented,
  };
}
