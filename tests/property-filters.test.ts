import { describe, expect, it } from "vitest";

import {
  hasPropertyFilters,
  readPropertyFilters,
  setPropertyFilter,
} from "../src/features/properties/property-filters";

describe("property URL filters", () => {
  it("parses valid filters and pagination", () => {
    const filters = readPropertyFilters(
      new URLSearchParams(
        "q=marina&listingType=sale&status=available&propertyType=apartment&page=3&pageSize=10",
      ),
    );

    expect(filters).toEqual({
      q: "marina",
      listingType: "sale",
      status: "available",
      propertyType: "apartment",
      page: 3,
      pageSize: 10,
    });
    expect(hasPropertyFilters(filters)).toBe(true);
  });

  it("falls back to safe defaults for malformed URLs", () => {
    expect(
      readPropertyFilters(new URLSearchParams("page=-2&status=invalid")),
    ).toEqual({
      page: 1,
      pageSize: 20,
    });
  });

  it("preserves other filters and resets the page when a filter changes", () => {
    const current = new URLSearchParams(
      "q=marina&listingType=sale&page=4&pageSize=10",
    );
    const next = setPropertyFilter(current, "status", "available");

    expect(next.get("q")).toBe("marina");
    expect(next.get("listingType")).toBe("sale");
    expect(next.get("status")).toBe("available");
    expect(next.get("pageSize")).toBe("10");
    expect(next.has("page")).toBe(false);
  });

  it("changes the page without clearing it", () => {
    const next = setPropertyFilter(new URLSearchParams("q=villa"), "page", "2");

    expect(next.toString()).toBe("q=villa&page=2");
  });
});
