import { z } from "zod";

import {
  propertySchema,
  type PropertyInput,
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
const propertyResponseSchema = z.object({ property: propertySchema });

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

export async function getProperty(id: string) {
  return apiRequest(`/api/properties/${id}`, propertyResponseSchema);
}

export async function createProperty(input: PropertyInput) {
  return apiRequest("/api/properties", propertyResponseSchema, {
    method: "POST",
    body: input,
  });
}

export async function updateProperty(id: string, input: PropertyInput) {
  return apiRequest(`/api/properties/${id}`, propertyResponseSchema, {
    method: "PATCH",
    body: input,
  });
}
