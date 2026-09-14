import type { Property } from "./property";

export const priceContext = {
  currency: "AED",
  rentalPeriod: "annual",
} as const;

export type PriceContext = typeof priceContext;

export interface PropertySearchResult {
  properties: Property[];
  priceContext: PriceContext;
}

export interface AvailabilityResult {
  propertyId: string;
  status: Property["status"];
  available: boolean;
  priceContext: PriceContext;
}
