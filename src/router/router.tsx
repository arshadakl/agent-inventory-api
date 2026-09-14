import { Navigate, createBrowserRouter } from "react-router-dom";

import { App } from "@/App";
import { ProtectedRoute, PublicOnlyRoute } from "@/features/auth/auth-guards";
import { LoginPage } from "@/features/auth/login-page";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { InventoryPage } from "@/features/properties/inventory-page";
import {
  CreatePropertyPage,
  EditPropertyPage,
} from "@/features/properties/property-form-pages";
import { DashboardLayout } from "@/layouts/dashboard-layout";
import { UsersPage } from "@/features/users/users-page";

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
                element: <DashboardPage />,
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
                element: <UsersPage />,
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
