import {
  propertyListQuerySchema,
  type PropertyListQuery,
} from "@shared/schemas/property";

export function readPropertyFilters(
  searchParams: URLSearchParams,
): PropertyListQuery {
  const parsedFilters = propertyListQuerySchema.safeParse(
    Object.fromEntries(searchParams),
  );

  return parsedFilters.success
    ? parsedFilters.data
    : propertyListQuerySchema.parse({});
}

export function hasPropertyFilters(filters: PropertyListQuery): boolean {
  return Boolean(
    filters.q || filters.listingType || filters.status || filters.propertyType,
  );
}

export function setPropertyFilter(
  current: URLSearchParams,
  name: "q" | "listingType" | "status" | "propertyType" | "page" | "pageSize",
  value: string,
): URLSearchParams {
  const next = new URLSearchParams(current);

  if (value) {
    next.set(name, value);
  } else {
    next.delete(name);
  }

  if (name !== "page") {
    next.delete("page");
  }

  return next;
}
