import { z } from "zod";

import {
  propertySchema,
  type PropertyListQuery,
} from "@shared/schemas/property";

import { apiRequest, apiRequestVoid } from "@/lib/api-client";

const propertyListSchema = z.object({
  items: z.array(propertySchema),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
});

export async function getProperties(query: PropertyListQuery) {
  const searchParams = new URLSearchParams();

  if (query.q) searchParams.set("q", query.q);
  if (query.listingType) searchParams.set("listingType", query.listingType);
  if (query.status) searchParams.set("status", query.status);
  if (query.propertyType) searchParams.set("propertyType", query.propertyType);
  searchParams.set("page", String(query.page));
  searchParams.set("pageSize", String(query.pageSize));

  return apiRequest(
    `/api/properties?${searchParams.toString()}`,
    propertyListSchema,
  );
}

export async function deleteProperty(id: string): Promise<void> {
  return apiRequestVoid(`/api/properties/${id}`, { method: "DELETE" });
}
