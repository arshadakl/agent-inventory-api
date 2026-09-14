import type {
  listingTypes,
  propertyStatuses,
  propertyTypes,
} from "../schemas/property";

export type PropertyType = (typeof propertyTypes)[number];
export type ListingType = (typeof listingTypes)[number];
export type PropertyStatus = (typeof propertyStatuses)[number];

export interface Property {
  id: string;
  title: string;
  propertyType: PropertyType;
  listingType: ListingType;
  furnished: boolean;
  location: string;
  price: number;
  areaSqft: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  status: PropertyStatus;
  description: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PropertyList {
  items: Property[];
  pagination: Pagination;
}
