import { Warehouse } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";

export function EmptyInventory({ filtered }: { filtered: boolean }) {
  return (
    <div className="rounded-xl border border-dashed bg-card px-6 py-16 text-center">
      <Warehouse
        aria-hidden="true"
        className="mx-auto size-8 text-muted-foreground"
      />
      <h2 className="mt-4 font-semibold">
        {filtered ? "No matching properties" : "No properties yet"}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {filtered
          ? "Try changing or clearing one of your search filters."
          : "Your inventory will appear here after the first property is added."}
      </p>
    </div>
  );
}

export function InventorySkeleton() {
  return (
    <div aria-label="Loading properties" className="space-y-3">
      {Array.from({ length: 5 }, (_, index) => (
        <Skeleton className="h-20 w-full" key={index} />
      ))}
    </div>
  );
}
