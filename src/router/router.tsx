/* eslint-disable react-refresh/only-export-components -- Route configuration intentionally defines lazy component bindings. */
import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";

import { App } from "@/App";
import { FullPageStatus } from "@/components/full-page-status";
import { ProtectedRoute, PublicOnlyRoute } from "@/features/auth/auth-guards";

const LoginPage = lazy(async () => ({
  default: (await import("@/features/auth/login-page")).LoginPage,
}));
const DashboardLayout = lazy(async () => ({
  default: (await import("@/layouts/dashboard-layout")).DashboardLayout,
}));
const DashboardPage = lazy(async () => ({
  default: (await import("@/features/dashboard/dashboard-page")).DashboardPage,
}));
const InventoryPage = lazy(async () => ({
  default: (await import("@/features/properties/inventory-page")).InventoryPage,
}));
const CreatePropertyPage = lazy(async () => ({
  default: (await import("@/features/properties/property-form-pages"))
    .CreatePropertyPage,
}));
const EditPropertyPage = lazy(async () => ({
  default: (await import("@/features/properties/property-form-pages"))
    .EditPropertyPage,
}));
const UsersPage = lazy(async () => ({
  default: (await import("@/features/users/users-page")).UsersPage,
}));

export const router = createBrowserRouter([
  {
    element: <App />,
    children: [
      {
        element: <PublicOnlyRoute />,
        children: [
          {
            path: "/login",
            element: (
              <LazyRoute>
                <LoginPage />
              </LazyRoute>
            ),
          },
        ],
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: (
              <LazyRoute>
                <DashboardLayout />
              </LazyRoute>
            ),
            children: [
              {
                path: "/dashboard",
                element: (
                  <LazyRoute>
                    <DashboardPage />
                  </LazyRoute>
                ),
              },
              {
                path: "/properties",
                element: (
                  <LazyRoute>
                    <InventoryPage />
                  </LazyRoute>
                ),
              },
              {
                path: "/properties/new",
                element: (
                  <LazyRoute>
                    <CreatePropertyPage />
                  </LazyRoute>
                ),
              },
              {
                path: "/properties/:id/edit",
                element: (
                  <LazyRoute>
                    <EditPropertyPage />
                  </LazyRoute>
                ),
              },
              {
                path: "/users",
                element: (
                  <LazyRoute>
                    <UsersPage />
                  </LazyRoute>
                ),
              },
            ],
          },
        ],
      },
      { path: "/", element: <Navigate replace to="/dashboard" /> },
      { path: "*", element: <Navigate replace to="/dashboard" /> },
    ],
  },
]);

function LazyRoute({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <FullPageStatus message="Preparing your workspace." title="Loading" />
      }
    >
      {children}
    </Suspense>
  );
}
