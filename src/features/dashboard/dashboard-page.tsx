import { Building2, CircleCheck, KeyRound, Tag, Warehouse } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatInteger } from "@/lib/format";

import { useDashboardStats } from "./dashboard-hooks";

const statCards = [
  {
    key: "total",
    label: "Total properties",
    description: "All inventory records",
    icon: Warehouse,
  },
  {
    key: "available",
    label: "Available",
    description: "Ready to list or show",
    icon: CircleCheck,
  },
  {
    key: "forSale",
    label: "For sale",
    description: "Sale listings",
    icon: Tag,
  },
  {
    key: "forRent",
    label: "For rent",
    description: "Rental listings",
    icon: KeyRound,
  },
] as const;

export function DashboardPage() {
  const stats = useDashboardStats();

  return (
    <main className="p-5 sm:p-8 lg:p-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <p className="text-sm font-medium text-primary">Overview</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Dashboard
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A concise view of your current inventory.
          </p>
        </header>

        {stats.isPending ? (
          <DashboardSkeleton />
        ) : stats.isError ? (
          <Alert className="flex items-center justify-between gap-4 border-destructive/30 bg-destructive/5 text-destructive">
            <span>Unable to load inventory statistics.</span>
            <Button
              onClick={() => void stats.refetch()}
              size="sm"
              type="button"
              variant="outline"
            >
              Try again
            </Button>
          </Alert>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {statCards.map(({ description, icon: Icon, key, label }) => (
                <Card key={key}>
                  <CardHeader className="flex-row items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        {label}
                      </p>
                      <CardTitle className="text-3xl tabular-nums">
                        {formatInteger(stats.data[key])}
                      </CardTitle>
                    </div>
                    <span className="grid size-10 place-items-center rounded-lg bg-secondary text-primary">
                      <Icon aria-hidden="true" className="size-5" />
                    </span>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </section>

            <Card className="max-w-xl">
              <CardHeader className="flex-row items-center gap-3">
                <span className="grid size-9 place-items-center rounded-lg bg-secondary text-primary">
                  <Building2 aria-hidden="true" className="size-4" />
                </span>
                <div>
                  <CardTitle className="text-base">Portfolio status</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatInteger(stats.data.sold)} sold and{" "}
                    {formatInteger(stats.data.rented)} rented properties.
                  </p>
                </div>
              </CardHeader>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}

function DashboardSkeleton() {
  return (
    <div
      aria-label="Loading inventory statistics"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton className="h-40 w-full" key={index} />
      ))}
    </div>
  );
}
