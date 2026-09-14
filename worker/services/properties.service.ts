import { z } from "zod";

import type {
  PropertyInput,
  PropertyListQuery,
  PropertyUpdate,
} from "@shared/schemas/property";
import type { SearchPropertiesActionInput } from "@shared/schemas/integration";
import {
  listingTypes,
  propertyStatuses,
  propertyTypes,
} from "@shared/schemas/property";
import type { Property, PropertyList } from "@shared/types/property";

const propertyRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  property_type: z.enum(propertyTypes),
  listing_type: z.enum(listingTypes),
  furnished: z.union([z.literal(0), z.literal(1)]),
  location: z.string(),
  price: z.number().int().nonnegative(),
  area_sqft: z.number().int().nonnegative().nullable(),
  bedrooms: z.number().int().nonnegative().nullable(),
  bathrooms: z.number().int().nonnegative().nullable(),
  status: z.enum(propertyStatuses),
  description: z.string().nullable(),
  created_at: z.number().int().nonnegative(),
  updated_at: z.number().int().nonnegative(),
});

const countRowSchema = z.object({ total: z.number().int().nonnegative() });

const selectColumns = `
  id,
  title,
  property_type,
  listing_type,
  furnished,
  location,
  price,
  area_sqft,
  bedrooms,
  bathrooms,
  status,
  description,
  created_at,
  updated_at
`;

export async function listProperties(
  database: D1Database,
  query: PropertyListQuery,
): Promise<PropertyList> {
  const filters = createListFilters(query);
  const whereClause = filters.clauses.length
    ? `WHERE ${filters.clauses.join(" AND ")}`
    : "";
  const offset = (query.page - 1) * query.pageSize;

  const countRow = await database
    .prepare(`SELECT COUNT(*) AS total FROM properties ${whereClause}`)
    .bind(...filters.values)
    .first();
  const total = countRowSchema.parse(countRow).total;

  const result = await database
    .prepare(
      `SELECT ${selectColumns}
       FROM properties
       ${whereClause}
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
    )
    .bind(...filters.values, query.pageSize, offset)
    .all();

  return {
    items: result.results.map(mapPropertyRow),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
    },
  };
}

export async function findPropertyById(
  database: D1Database,
  id: string,
): Promise<Property | null> {
  const row = await database
    .prepare(`SELECT ${selectColumns} FROM properties WHERE id = ?`)
    .bind(id)
    .first();

  return row ? mapPropertyRow(row) : null;
}

export async function searchPropertiesForIntegration(
  database: D1Database,
  input: SearchPropertiesActionInput,
): Promise<Property[]> {
  const filters = createIntegrationFilters(input);
  const whereClause = `WHERE ${filters.clauses.join(" AND ")}`;
  const result = await database
    .prepare(
      `SELECT ${selectColumns}
       FROM properties
       ${whereClause}
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
    )
    .bind(...filters.values, input.limit)
    .all();

  return result.results.map(mapPropertyRow);
}

export async function findSimilarProperties(
  database: D1Database,
  property: Property,
  limit: number,
): Promise<Property[]> {
  const minimumPrice = Math.floor(property.price * 0.8);
  const maximumPrice = Math.ceil(property.price * 1.2);
  const result = await database
    .prepare(
      `SELECT ${selectColumns}
       FROM properties
       WHERE id != ?
         AND status = 'available'
         AND listing_type = ?
         AND property_type = ?
         AND price >= ?
         AND price <= ?
       ORDER BY ABS(price - ?) ASC, created_at DESC, id DESC
       LIMIT ?`,
    )
    .bind(
      property.id,
      property.listingType,
      property.propertyType,
      minimumPrice,
      maximumPrice,
      property.price,
      limit,
    )
    .all();

  return result.results.map(mapPropertyRow);
}

export async function createProperty(
  database: D1Database,
  input: PropertyInput,
): Promise<Property> {
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1_000);

  await database
    .prepare(
      `INSERT INTO properties (
        id, title, property_type, listing_type, furnished, location, price,
        area_sqft, bedrooms, bathrooms, status, description, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.title,
      input.propertyType,
      input.listingType,
      input.furnished ? 1 : 0,
      input.location,
      input.price,
      input.areaSqft,
      input.bedrooms,
      input.bathrooms,
      input.status,
      input.description,
      now,
      now,
    )
    .run();

  return {
    id,
    ...input,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateProperty(
  database: D1Database,
  id: string,
  input: PropertyUpdate,
): Promise<Property | null> {
  const existingProperty = await findPropertyById(database, id);

  if (!existingProperty) {
    return null;
  }

  const updatedProperty: Property = {
    ...existingProperty,
    title: input.title ?? existingProperty.title,
    propertyType: input.propertyType ?? existingProperty.propertyType,
    listingType: input.listingType ?? existingProperty.listingType,
    furnished: input.furnished ?? existingProperty.furnished,
    location: input.location ?? existingProperty.location,
    price: input.price ?? existingProperty.price,
    areaSqft:
      input.areaSqft === undefined ? existingProperty.areaSqft : input.areaSqft,
    bedrooms:
      input.bedrooms === undefined ? existingProperty.bedrooms : input.bedrooms,
    bathrooms:
      input.bathrooms === undefined
        ? existingProperty.bathrooms
        : input.bathrooms,
    description:
      input.description === undefined
        ? existingProperty.description
        : input.description,
    status: input.status ?? existingProperty.status,
    updatedAt: Math.floor(Date.now() / 1_000),
  };

  await database
    .prepare(
      `UPDATE properties SET
        title = ?, property_type = ?, listing_type = ?, furnished = ?,
        location = ?, price = ?, area_sqft = ?, bedrooms = ?, bathrooms = ?,
        status = ?, description = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      updatedProperty.title,
      updatedProperty.propertyType,
      updatedProperty.listingType,
      updatedProperty.furnished ? 1 : 0,
      updatedProperty.location,
      updatedProperty.price,
      updatedProperty.areaSqft,
      updatedProperty.bedrooms,
      updatedProperty.bathrooms,
      updatedProperty.status,
      updatedProperty.description,
      updatedProperty.updatedAt,
      id,
    )
    .run();

  return updatedProperty;
}

export async function deleteProperty(
  database: D1Database,
  id: string,
): Promise<boolean> {
  const result = await database
    .prepare("DELETE FROM properties WHERE id = ?")
    .bind(id)
    .run();

  return result.meta.changes > 0;
}

interface ListFilters {
  clauses: string[];
  values: unknown[];
}

function createListFilters(query: PropertyListQuery): ListFilters {
  const clauses: string[] = [];
  const values: unknown[] = [];

  if (query.q) {
    const searchTerm = `%${escapeLikePattern(query.q)}%`;
    clauses.push(
      "(title LIKE ? ESCAPE '\\' COLLATE NOCASE OR location LIKE ? ESCAPE '\\' COLLATE NOCASE)",
    );
    values.push(searchTerm, searchTerm);
  }

  addEqualityFilter(clauses, values, "listing_type", query.listingType);
  addEqualityFilter(clauses, values, "status", query.status);
  addEqualityFilter(clauses, values, "property_type", query.propertyType);

  return { clauses, values };
}

function createIntegrationFilters(
  input: SearchPropertiesActionInput,
): ListFilters {
  const clauses = ["status = ?"];
  const values: unknown[] = [input.status];

  if (input.q) {
    addPropertyTextSearchFilter(clauses, values, input.q);
  }

  if (input.location) {
    clauses.push("location LIKE ? ESCAPE '\\' COLLATE NOCASE");
    values.push(`%${escapeLikePattern(input.location)}%`);
  }

  addEqualityFilter(clauses, values, "listing_type", input.listingType);
  addEqualityFilter(clauses, values, "property_type", input.propertyType);

  if (input.furnished !== undefined) {
    clauses.push("furnished = ?");
    values.push(input.furnished ? 1 : 0);
  }

  addNumericEqualityFilter(clauses, values, "bedrooms", input.bedrooms);
  addNumericEqualityFilter(clauses, values, "bathrooms", input.bathrooms);
  addMinimumFilter(clauses, values, "price", input.minPrice);
  addMaximumFilter(clauses, values, "price", input.maxPrice);

  return { clauses, values };
}

function addEqualityFilter(
  clauses: string[],
  values: unknown[],
  column: "listing_type" | "status" | "property_type",
  value: string | undefined,
): void {
  if (value) {
    clauses.push(`${column} = ?`);
    values.push(value);
  }
}

function addPropertyTextSearchFilter(
  clauses: string[],
  values: unknown[],
  value: string,
): void {
  const searchTerm = `%${escapeLikePattern(value)}%`;
  clauses.push(
    "(title LIKE ? ESCAPE '\\' COLLATE NOCASE OR location LIKE ? ESCAPE '\\' COLLATE NOCASE)",
  );
  values.push(searchTerm, searchTerm);
}

function addNumericEqualityFilter(
  clauses: string[],
  values: unknown[],
  column: "bedrooms" | "bathrooms",
  value: number | undefined,
): void {
  if (value !== undefined) {
    clauses.push(`${column} = ?`);
    values.push(value);
  }
}

function addMinimumFilter(
  clauses: string[],
  values: unknown[],
  column: "price",
  value: number | undefined,
): void {
  if (value !== undefined) {
    clauses.push(`${column} >= ?`);
    values.push(value);
  }
}

function addMaximumFilter(
  clauses: string[],
  values: unknown[],
  column: "price",
  value: number | undefined,
): void {
  if (value !== undefined) {
    clauses.push(`${column} <= ?`);
    values.push(value);
  }
}

function escapeLikePattern(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
}

function mapPropertyRow(row: Record<string, unknown>): Property {
  const property = propertyRowSchema.parse(row);

  return {
    id: property.id,
    title: property.title,
    propertyType: property.property_type,
    listingType: property.listing_type,
    furnished: property.furnished === 1,
    location: property.location,
    price: property.price,
    areaSqft: property.area_sqft,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    status: property.status,
    description: property.description,
    createdAt: property.created_at,
    updatedAt: property.updated_at,
  };
}
