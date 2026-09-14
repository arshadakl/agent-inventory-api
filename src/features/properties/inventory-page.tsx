import { LoaderCircle } from "lucide-react";
import { useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";

import type { Property } from "@shared/types/property";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatInteger } from "@/lib/format";

import { DeletePropertyDialog } from "./components/delete-property-dialog";
import { InventoryFilters } from "./components/inventory-filters";
import { InventoryResults } from "./components/inventory-results";
import {
  EmptyInventory,
  InventorySkeleton,
} from "./components/inventory-states";
import {
  hasPropertyFilters,
  readPropertyFilters,
  setPropertyFilter,
} from "./property-filters";
import { useDeleteProperty, useProperties } from "./property-hooks";

export function InventoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [propertyToDelete, setPropertyToDelete] = useState<Property | null>(
    null,
  );
  const filters = readPropertyFilters(searchParams);
  const properties = useProperties(filters);
  const deleteProperty = useDeleteProperty();

  const updateFilter = useCallback(
    (name: Parameters<typeof setPropertyFilter>[1], value: string) => {
      setSearchParams(setPropertyFilter(searchParams, name, value));
    },
    [searchParams, setSearchParams],
  );

  function requestDelete(property: Property): void {
    deleteProperty.reset();
    setPropertyToDelete(property);
  }

  async function confirmDelete(): Promise<void> {
    if (!propertyToDelete) return;

    try {
      await deleteProperty.mutateAsync(propertyToDelete.id);
      setPropertyToDelete(null);
    } catch {
      // Keep the dialog open so the user can retry without losing context.
    }
  }

  return (
    <main className="p-5 sm:p-8 lg:p-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <p className="text-sm font-medium text-primary">Inventory</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Properties
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Search, filter, and maintain your property portfolio.
          </p>
        </header>

        <InventoryFilters filters={filters} onChange={updateFilter} />

        {properties.isPending ? (
          <InventorySkeleton />
        ) : properties.isError ? (
          <Alert className="flex items-center justify-between gap-4 border-destructive/30 bg-destructive/5 text-destructive">
            <span>Unable to load properties.</span>
            <Button
              onClick={() => void properties.refetch()}
              size="sm"
              type="button"
              variant="outline"
            >
              Try again
            </Button>
          </Alert>
        ) : properties.data.items.length === 0 ? (
          <EmptyInventory filtered={hasPropertyFilters(filters)} />
        ) : (
          <>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <p>
                {formatInteger(properties.data.pagination.total)}{" "}
                {properties.data.pagination.total === 1
                  ? "property"
                  : "properties"}
              </p>
              {properties.isFetching ? (
                <span className="flex items-center gap-2">
                  <LoaderCircle
                    aria-hidden="true"
                    className="size-3.5 animate-spin"
                  />
                  Updating
                </span>
              ) : null}
            </div>
            <InventoryResults
              onDelete={requestDelete}
              properties={properties.data.items}
            />
            <Pagination
              currentPage={filters.page}
              onPageChange={(page) => updateFilter("page", String(page))}
              totalPages={properties.data.pagination.totalPages}
            />
          </>
        )}
      </div>

      <DeletePropertyDialog
        error={deleteProperty.isError}
        loading={deleteProperty.isPending}
        onConfirm={() => void confirmDelete()}
        onOpenChange={(open) => {
          if (!open && !deleteProperty.isPending) setPropertyToDelete(null);
        }}
        property={propertyToDelete}
      />
    </main>
  );
}

function Pagination({
  currentPage,
  onPageChange,
  totalPages,
}: {
  currentPage: number;
  onPageChange: (page: number) => void;
  totalPages: number;
}) {
  return (
    <nav
      aria-label="Property pagination"
      className="flex items-center justify-between gap-4"
    >
      <p className="text-sm text-muted-foreground">
        Page {currentPage} of {Math.max(totalPages, 1)}
      </p>
      <div className="flex gap-2">
        <Button
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          type="button"
          variant="outline"
        >
          Previous
        </Button>
        <Button
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          type="button"
          variant="outline"
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
