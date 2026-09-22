import {
  Building2,
  LayoutDashboard,
  KeyRound,
  LoaderCircle,
  LogOut,
  Menu,
  MessageSquare,
  Users,
  Warehouse,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

import { useCurrentUser, useLogout } from "@/features/auth/auth-hooks";

const navigation = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Properties", to: "/properties", icon: Warehouse },
  { label: "Inbox", to: "/inbox", icon: MessageSquare },
  { label: "Users", to: "/users", icon: Users },
  { label: "API keys", to: "/api-keys", icon: KeyRound },
] as const;

export function DashboardLayout() {
  const currentUser = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  async function handleLogout(): Promise<void> {
    try {
      await logout.mutateAsync();
      toast({ title: "Signed out" });
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
            aria-label="Open navigation menu"
            onClick={() => setMobileMenuOpen(true)}
            size="icon"
            type="button"
            variant="ghost"
          >
            <Menu aria-hidden="true" className="size-5" />
          </Button>
        </header>
        <Outlet />
      </div>

      <Dialog onOpenChange={setMobileMenuOpen} open={mobileMenuOpen}>
        <DialogContent className="left-0 flex h-svh w-[min(320px,calc(100%-3rem))] max-w-none translate-x-0 translate-y-0 flex-col rounded-none border-y-0 border-l-0 p-0">
          <DialogHeader className="border-b px-5 py-5">
            <DialogTitle className="sr-only">Navigation menu</DialogTitle>
            <DialogDescription className="sr-only">
              Navigate the Real Estate Inventory workspace.
            </DialogDescription>
            <Brand compact />
          </DialogHeader>
          <Navigation onNavigate={() => setMobileMenuOpen(false)} />
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
        </DialogContent>
      </Dialog>
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

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
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
          onClick={onNavigate}
          to={to}
        >
          <Icon aria-hidden="true" className="size-4" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
