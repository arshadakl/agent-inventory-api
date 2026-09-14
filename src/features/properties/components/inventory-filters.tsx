import { Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  listingTypes,
  propertyStatuses,
  propertyTypes,
  type PropertyListQuery,
} from "@shared/schemas/property";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatEnumLabel } from "@/lib/format";

import { setPropertyFilter } from "../property-filters";

interface InventoryFiltersProps {
  filters: PropertyListQuery;
  onChange: (
    name: Parameters<typeof setPropertyFilter>[1],
    value: string,
  ) => void;
}

export function InventoryFilters({ filters, onChange }: InventoryFiltersProps) {
  const changeSearch = useCallback(
    (value: string) => onChange("q", value),
    [onChange],
  );

  return (
    <section
      aria-label="Property filters"
      className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_repeat(3,180px)]"
    >
      <SearchFilter
        initialValue={filters.q ?? ""}
        key={filters.q ?? ""}
        onChange={changeSearch}
      />
      <FilterSelect
        label="Listing type"
        onChange={(value) => onChange("listingType", value)}
        options={listingTypes}
        value={filters.listingType ?? ""}
      />
      <FilterSelect
        label="Status"
        onChange={(value) => onChange("status", value)}
        options={propertyStatuses}
        value={filters.status ?? ""}
      />
      <FilterSelect
        label="Property type"
        onChange={(value) => onChange("propertyType", value)}
        options={propertyTypes}
        value={filters.propertyType ?? ""}
      />
    </section>
  );
}

function SearchFilter({
  initialValue,
  onChange,
}: {
  initialValue: string;
  onChange: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (value === initialValue) return;

    const timer = window.setTimeout(() => onChange(value.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [initialValue, onChange, value]);

  return (
    <label className="relative block">
      <span className="sr-only">Search properties</span>
      <Search
        aria-hidden="true"
        className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        className="pl-9"
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search title or location…"
        type="search"
        value={value}
      />
    </label>
  );
}

function FilterSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: readonly string[];
  value: string;
}) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <Select
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">All {label.toLowerCase()}s</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {formatEnumLabel(option)}
          </option>
        ))}
      </Select>
    </label>
  );
}
