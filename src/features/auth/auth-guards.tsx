import { Navigate, Outlet, useLocation } from "react-router-dom";

import { FullPageStatus } from "@/components/full-page-status";

import { useCurrentUser } from "./auth-hooks";

export function ProtectedRoute() {
  const currentUser = useCurrentUser();
  const location = useLocation();

  if (currentUser.isPending) {
    return (
      <FullPageStatus
        message="Checking your secure session."
        title="Loading your workspace"
      />
    );
  }

  if (currentUser.isError) {
    return (
      <FullPageStatus
        actionLabel="Try again"
        message="We could not verify your session."
        onAction={() => void currentUser.refetch()}
        title="Unable to load the workspace"
        variant="error"
      />
    );
  }

  if (!currentUser.data) {
    const returnTo = `${location.pathname}${location.search}`;
    return <Navigate replace state={{ returnTo }} to="/login" />;
  }

  return <Outlet />;
}

export function PublicOnlyRoute() {
  const currentUser = useCurrentUser();

  if (currentUser.isPending) {
    return (
      <FullPageStatus message="Checking your secure session." title="Loading" />
    );
  }

  if (currentUser.data) {
    return <Navigate replace to="/dashboard" />;
  }

  return <Outlet />;
}
