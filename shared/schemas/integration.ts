import { z } from "zod";

import { listingTypes, propertyStatuses, propertyTypes } from "./property";

const optionalSearchTextSchema = z
  .string()
  .trim()
  .max(120)
  .optional()
  .transform((value) => value || undefined);
const optionalCountSchema = z.number().int().nonnegative().optional();
const optionalPriceSchema = z.number().int().nonnegative().optional();
const actionLimitSchema = z.number().int().min(1).max(20).default(5);

export const searchPropertiesActionSchema = z.object({
  action: z.literal("search_properties"),
  input: z.object({
    q: optionalSearchTextSchema,
    location: optionalSearchTextSchema,
    listingType: z.enum(listingTypes).optional(),
    propertyType: z.enum(propertyTypes).optional(),
    furnished: z.boolean().optional(),
    bedrooms: optionalCountSchema,
    bathrooms: optionalCountSchema,
    minPrice: optionalPriceSchema,
    maxPrice: optionalPriceSchema,
    status: z.enum(propertyStatuses).default("available"),
    limit: actionLimitSchema,
  }),
});

export const propertyActionSchema = z.object({
  propertyId: z.uuid("Enter a valid property ID."),
});

export const getPropertyActionSchema = z.object({
  action: z.literal("get_property"),
  input: propertyActionSchema,
});

export const checkAvailabilityActionSchema = z.object({
  action: z.literal("check_availability"),
  input: propertyActionSchema,
});

export const similarPropertiesActionSchema = z.object({
  action: z.literal("similar_properties"),
  input: propertyActionSchema.extend({ limit: actionLimitSchema }),
});

export const getConversationHistoryActionSchema = z.object({
  action: z.literal("get_conversation_history"),
  input: z.object({
    phoneE164: z
      .string()
      .trim()
      .regex(/^\+[1-9]\d{1,14}$/, "Must be a valid E.164 phone number."),
    limit: z.number().int().min(1).max(50).default(8),
    withinMinutes: z.number().int().min(1).max(1440).default(30),
  }),
});

export const integrationActionSchema = z.discriminatedUnion("action", [
  searchPropertiesActionSchema,
  getPropertyActionSchema,
  checkAvailabilityActionSchema,
  similarPropertiesActionSchema,
  getConversationHistoryActionSchema,
]);

export type IntegrationAction = z.output<typeof integrationActionSchema>;
export type SearchPropertiesActionInput = z.output<
  typeof searchPropertiesActionSchema
>["input"];
