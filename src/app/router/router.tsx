import type { ReactNode } from "react";
import { createBrowserRouter } from "react-router-dom";
import { MainLayout } from "@/app/layouts/MainLayout";
import { ProtectedRoute } from "@/app/router/ProtectedRoute";
import { LoginPage } from "@/features/auth/LoginPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { UsersPage } from "@/features/users/UsersPage";
import { ProductsPage } from "@/features/products/ProductsPage";
import { ServicesPage } from "@/features/services/ServicesPage";
import { MechanicsPage } from "@/features/mechanics/MechanicsPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { PosPage } from "@/features/pos/PosPage";
import { StockPage } from "@/features/stock/StockPage";
import { TransactionsPage } from "@/features/transactions/TransactionsPage";
import { ReportsPage } from "@/features/reports/ReportsPage";

function protectedElement(node: ReactNode, roles?: ("superadmin" | "admin")[]) {
  return <ProtectedRoute roles={roles}>{node}</ProtectedRoute>;
}

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: protectedElement(<MainLayout />),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "pos", element: <PosPage /> },
      { path: "products", element: <ProductsPage /> },
      { path: "stock", element: <StockPage /> },
      { path: "services", element: <ServicesPage /> },
      { path: "mechanics", element: <MechanicsPage /> },
      { path: "transactions", element: <TransactionsPage /> },
      { path: "reports", element: <ReportsPage /> },
      {
        path: "users",
        element: protectedElement(<UsersPage />, ["superadmin"]),
      },
      {
        path: "settings",
        element: protectedElement(<SettingsPage />, ["superadmin"]),
      },
    ],
  },
]);
