import {
  Building2,
  CheckCircle2,
  Cloud,
  Database,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export function App() {
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
            <Badge className="gap-2 px-3 py-1 text-sm" variant="outline">
              <CheckCircle2
                aria-hidden="true"
                className="size-4 text-emerald-600"
              />
              Authentication backend ready
            </Badge>
            <div className="space-y-3">
              <h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
                One reliable workspace for property inventory.
              </h2>
              <p className="max-w-xl text-base leading-7 text-muted-foreground">
                The React application, Cloudflare Worker API, and D1 binding are
                configured as one deployable application. Initial-user
                provisioning and the authenticated dashboard shell are next.
              </p>
            </div>
          </div>

          <aside aria-label="System status">
            <Card>
              <CardHeader className="flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>System status</CardTitle>
                  <CardDescription className="mt-1">
                    Worker API connectivity
                  </CardDescription>
                </div>
                <span
                  aria-label="Protected API configured"
                  className="mt-1 size-2.5 rounded-full bg-emerald-500"
                />
              </CardHeader>

              <CardContent>
                <div className="space-y-3 text-sm">
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

                <Separator className="my-5" />

                <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                  <ShieldCheck aria-hidden="true" className="size-4" />
                  Session authentication enabled
                </p>
              </CardContent>
            </Card>
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
