import { Navigate, createBrowserRouter } from "react-router-dom";

import { App } from "@/App";
import { PagePlaceholder } from "@/components/page-placeholder";
import { ProtectedRoute, PublicOnlyRoute } from "@/features/auth/auth-guards";
import { LoginPage } from "@/features/auth/login-page";
import { InventoryPage } from "@/features/properties/inventory-page";
import {
  CreatePropertyPage,
  EditPropertyPage,
} from "@/features/properties/property-form-pages";
import { DashboardLayout } from "@/layouts/dashboard-layout";

export const router = createBrowserRouter([
  {
    element: <App />,
    children: [
      {
        element: <PublicOnlyRoute />,
        children: [{ path: "/login", element: <LoginPage /> }],
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <DashboardLayout />,
            children: [
              {
                path: "/dashboard",
                element: (
                  <PagePlaceholder
                    description="Inventory statistics will appear here."
                    title="Dashboard"
                  />
                ),
              },
              {
                path: "/properties",
                element: <InventoryPage />,
              },
              {
                path: "/properties/new",
                element: <CreatePropertyPage />,
              },
              {
                path: "/properties/:id/edit",
                element: <EditPropertyPage />,
              },
              {
                path: "/users",
                element: (
                  <PagePlaceholder
                    description="User management will appear here."
                    title="Users"
                  />
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
