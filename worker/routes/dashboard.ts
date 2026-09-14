import type { ApiData } from "@shared/types/api";
import type { DashboardStats } from "@shared/types/dashboard";
import { Hono } from "hono";

import type { WorkerEnvironment } from "../env";
import { getDashboardStats } from "../services/dashboard.service";

export const dashboardRoutes = new Hono<WorkerEnvironment>();

dashboardRoutes.get("/stats", async (context) => {
  const stats = await getDashboardStats(context.env.DB);
  return context.json<ApiData<DashboardStats>>({ data: stats });
});
