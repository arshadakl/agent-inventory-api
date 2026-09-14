import {
  Building2,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Users,
  Warehouse,
} from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useCurrentUser, useLogout } from "@/features/auth/auth-hooks";

const navigation = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Properties", to: "/properties", icon: Warehouse },
  { label: "Users", to: "/users", icon: Users },
] as const;

export function DashboardLayout() {
  const currentUser = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();

  async function handleLogout(): Promise<void> {
    try {
      await logout.mutateAsync();
      navigate("/login", { replace: true });
    } catch {
      // Keep the active session visible so the user can retry.
    }
  }

  return (
    <div className="min-h-svh bg-muted/35 md:grid md:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="hidden border-r bg-card md:fixed md:inset-y-0 md:flex md:w-60 md:flex-col">
        <Brand />
        <Navigation />
        <div className="mt-auto border-t p-4">
          <p className="truncate text-sm font-medium">
            {currentUser.data?.email}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Authenticated user
          </p>
          <Button
            className="mt-3 w-full justify-start"
            disabled={logout.isPending}
            onClick={() => void handleLogout()}
            type="button"
            variant="ghost"
          >
            {logout.isPending ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin"
              />
            ) : (
              <LogOut aria-hidden="true" className="size-4" />
            )}
            Log out
          </Button>
          {logout.isError ? (
            <p className="mt-2 text-xs text-destructive" role="alert">
              Logout failed. Please try again.
            </p>
          ) : null}
        </div>
      </aside>

      <div className="md:col-start-2">
        <header className="flex min-h-16 items-center justify-between border-b bg-card px-4 md:hidden">
          <Brand compact />
          <Button
            aria-label="Log out"
            disabled={logout.isPending}
            onClick={() => void handleLogout()}
            size="icon"
            type="button"
            variant="ghost"
          >
            {logout.isPending ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin"
              />
            ) : (
              <LogOut aria-hidden="true" className="size-4" />
            )}
          </Button>
        </header>
        <nav
          aria-label="Primary navigation"
          className="flex border-b bg-card px-2 md:hidden"
        >
          {navigation.map(({ icon: Icon, label, to }) => (
            <NavLink
              className={({ isActive }) =>
                cn(
                  "flex flex-1 items-center justify-center gap-2 border-b-2 px-2 py-3 text-sm font-medium",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground",
                )
              }
              key={to}
              to={to}
            >
              <Icon aria-hidden="true" className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <Outlet />
      </div>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3", compact ? "" : "h-20 px-5")}>
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
        <Building2 aria-hidden="true" className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">Real Estate</p>
        <p className="truncate text-xs text-muted-foreground">Inventory</p>
      </div>
    </div>
  );
}

function Navigation() {
  return (
    <nav aria-label="Primary navigation" className="space-y-1 px-3">
      {navigation.map(({ icon: Icon, label, to }) => (
        <NavLink
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-secondary text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )
          }
          key={to}
          to={to}
        >
          <Icon aria-hidden="true" className="size-4" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
