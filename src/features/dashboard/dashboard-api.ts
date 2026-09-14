import { dashboardStatsSchema } from "@shared/schemas/dashboard";

import { apiRequest } from "@/lib/api-client";

export async function getDashboardStats() {
  return apiRequest("/api/dashboard/stats", dashboardStatsSchema);
}
