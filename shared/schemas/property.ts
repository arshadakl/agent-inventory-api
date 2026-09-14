import { z } from "zod";

export const propertyTypes = [
  "apartment",
  "villa",
  "house",
  "land",
  "commercial",
  "other",
] as const;
export const listingTypes = ["sale", "rent"] as const;
export const propertyStatuses = ["available", "sold", "rented"] as const;

const nullableCountSchema = z
  .number()
  .int("Enter a whole number.")
  .nonnegative("Value cannot be negative.")
  .max(Number.MAX_SAFE_INTEGER, "Value is too large.")
  .nullable();

const optionalCountSchema = nullableCountSchema
  .optional()
  .transform((value) => value ?? null);

const nullableDescriptionSchema = z
  .string()
  .trim()
  .max(1000, "Description must be 1000 characters or fewer.")
  .nullable();

const optionalDescriptionSchema = nullableDescriptionSchema
  .optional()
  .transform((value) => value || null);

export const propertyInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Title must be at least 2 characters.")
    .max(120, "Title must be 120 characters or fewer."),
  propertyType: z.enum(propertyTypes),
  listingType: z.enum(listingTypes),
  furnished: z.boolean(),
  location: z
    .string()
    .trim()
    .min(2, "Location must be at least 2 characters.")
    .max(120, "Location must be 120 characters or fewer."),
  price: z
    .number()
    .int("Price must be a whole number.")
    .nonnegative("Price cannot be negative.")
    .max(Number.MAX_SAFE_INTEGER, "Price is too large."),
  areaSqft: optionalCountSchema,
  bedrooms: optionalCountSchema,
  bathrooms: optionalCountSchema,
  status: z.enum(propertyStatuses),
  description: optionalDescriptionSchema,
});

export const propertyUpdateSchema = z
  .object({
    title: propertyInputSchema.shape.title.optional(),
    propertyType: propertyInputSchema.shape.propertyType.optional(),
    listingType: propertyInputSchema.shape.listingType.optional(),
    furnished: propertyInputSchema.shape.furnished.optional(),
    location: propertyInputSchema.shape.location.optional(),
    price: propertyInputSchema.shape.price.optional(),
    areaSqft: nullableCountSchema.optional(),
    bedrooms: nullableCountSchema.optional(),
    bathrooms: nullableCountSchema.optional(),
    status: propertyInputSchema.shape.status.optional(),
    description: nullableDescriptionSchema
      .transform((value) => value || null)
      .optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "Provide at least one property field.",
  });

export const propertyListQuerySchema = z.object({
  q: z.string().trim().max(120).optional().transform(emptyToUndefined),
  listingType: z.enum(listingTypes).optional(),
  status: z.enum(propertyStatuses).optional(),
  propertyType: z.enum(propertyTypes).optional(),
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const propertySchema = z.object({
  id: z.uuid(),
  title: propertyInputSchema.shape.title,
  propertyType: propertyInputSchema.shape.propertyType,
  listingType: propertyInputSchema.shape.listingType,
  furnished: propertyInputSchema.shape.furnished,
  location: propertyInputSchema.shape.location,
  price: propertyInputSchema.shape.price,
  areaSqft: nullableCountSchema,
  bedrooms: nullableCountSchema,
  bathrooms: nullableCountSchema,
  status: propertyInputSchema.shape.status,
  description: nullableDescriptionSchema,
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

export type PropertyInput = z.output<typeof propertyInputSchema>;
export type PropertyUpdate = z.output<typeof propertyUpdateSchema>;
export type PropertyListQuery = z.output<typeof propertyListQuerySchema>;

function emptyToUndefined(value: string | undefined): string | undefined {
  return value || undefined;
}
