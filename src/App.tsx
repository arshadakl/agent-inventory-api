import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  CheckCircle2,
  Cloud,
  Database,
  RefreshCw,
} from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";

const healthResponseSchema = z.object({
  data: z.object({
    service: z.string(),
    status: z.literal("ok"),
  }),
});

type HealthResponse = z.infer<typeof healthResponseSchema>;

async function getHealth(): Promise<HealthResponse> {
  const response = await fetch("/api/health", { credentials: "same-origin" });

  if (!response.ok) {
    throw new Error("The API health check failed.");
  }

  return healthResponseSchema.parse(await response.json());
}

export function App() {
  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
    retry: 1,
  });

  const isOnline = healthQuery.data?.data.status === "ok";

  return (
    <main className="min-h-svh bg-background px-5 py-10 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-5xl flex-col gap-10">
        <header className="flex items-center gap-3 border-b border-border pb-6">
          <span className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Building2 aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Internal operations
            </p>
            <h1 className="text-xl font-semibold tracking-tight">
              Real Estate Inventory
            </h1>
          </div>
        </header>

        <section className="grid gap-8 lg:grid-cols-[1.45fr_1fr] lg:items-start">
          <div className="space-y-5">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-sm font-medium text-muted-foreground shadow-sm">
              <CheckCircle2
                aria-hidden="true"
                className="size-4 text-emerald-600"
              />
              Foundation ready
            </span>
            <div className="space-y-3">
              <h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
                One reliable workspace for property inventory.
              </h2>
              <p className="max-w-xl text-base leading-7 text-muted-foreground">
                The React application, Cloudflare Worker API, and D1 binding are
                configured as one deployable application. Authentication and
                inventory workflows are next.
              </p>
            </div>
          </div>

          <aside className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">System status</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Worker API connectivity
                </p>
              </div>
              <span
                aria-label={isOnline ? "API online" : "API status unavailable"}
                className={`mt-1 size-2.5 rounded-full ${isOnline ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
              />
            </div>

            <div className="mt-6 space-y-3 text-sm">
              <StatusRow
                icon={Cloud}
                label="Runtime"
                value="Cloudflare Workers"
              />
              <StatusRow
                icon={Database}
                label="Database"
                value="D1 configured"
              />
            </div>

            <div className="mt-6 border-t border-border pt-4">
              {healthQuery.isPending ? (
                <p className="text-sm text-muted-foreground" role="status">
                  Checking API connectivity…
                </p>
              ) : healthQuery.isError ? (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-destructive">
                    API is unavailable.
                  </p>
                  <Button
                    onClick={() => healthQuery.refetch()}
                    size="sm"
                    variant="outline"
                  >
                    <RefreshCw aria-hidden="true" className="size-4" />
                    Retry
                  </Button>
                </div>
              ) : (
                <p
                  className="flex items-center gap-2 text-sm font-medium text-emerald-700"
                  role="status"
                >
                  <CheckCircle2 aria-hidden="true" className="size-4" />
                  API is online
                </p>
              )}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

interface StatusRowProps {
  icon: typeof Cloud;
  label: string;
  value: string;
}

function StatusRow({ icon: Icon, label, value }: StatusRowProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-2 text-muted-foreground">
        <Icon aria-hidden="true" className="size-4" />
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
