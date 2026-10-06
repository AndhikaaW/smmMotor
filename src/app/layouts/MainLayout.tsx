import { signOut } from "firebase/auth";
import { useState } from "react";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Tags,
  Layers,
  Wrench,
  Receipt,
  BarChart2,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { auth } from "@/lib/firebase/client";
import { cn } from "@/lib/utils";

const SECTIONS: {
  label: string;
  items: { to: string; label: string; icon: React.ElementType; end?: boolean }[];
}[] = [
  {
    label: "Overview",
    items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard, end: true }],
  },
  {
    label: "Manajemen",
    items: [
      { to: "/pos", label: "Kasir", icon: ShoppingCart },
      { to: "/products", label: "Produk", icon: Package },
      { to: "/categories", label: "Kategori", icon: Tags },
      { to: "/stock", label: "Stok", icon: Layers },
      { to: "/services", label: "Jasa", icon: Wrench },
    ],
  },
  {
    label: "Transaksi",
    items: [{ to: "/transactions", label: "Riwayat Transaksi", icon: Receipt }],
  },
  {
    label: "Laporan",
    items: [{ to: "/reports", label: "Laporan", icon: BarChart2 }],
  },
  {
    label: "Sistem",
    items: [
      { to: "/users", label: "Pengguna", icon: Users },
      { to: "/settings", label: "Pengaturan", icon: Settings },
    ],
  },
];

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const { appUser } = useAuth();
  return (
    <div className="flex h-full flex-col bg-sidebar text-white">
      {/* Brand */}
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
        <div className="flex items-center gap-3">
          <span className="text-2xl leading-none">🏍️</span>
          <div>
            <p className="text-sm font-bold leading-tight">Sedyo Makmur Motor</p>
            <p className="text-[10px] tracking-widest text-white/50 uppercase">POS System</p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-white/60 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="mb-1 px-2 text-[10px] font-semibold tracking-widest text-white/40 uppercase">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-primary text-gray-900"
                          : "text-white/70 hover:bg-white/8 hover:text-white",
                      )
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User Footer */}
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-gray-900">
            {appUser?.name?.charAt(0).toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-tight">{appUser?.name ?? "…"}</p>
            <p className="text-xs text-white/50 capitalize">{appUser?.role}</p>
          </div>
          <button
            type="button"
            onClick={() => void signOut(auth)}
            className="rounded-md p-1.5 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function MainLayout() {
  const { appUser } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-200 ease-in-out lg:hidden",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <SidebarContent onClose={() => setSidebarOpen(false)} />
      </aside>

      {/* Desktop sidebar — fixed penuh, tak ikut scroll konten */}
      <aside className="hidden h-screen w-64 shrink-0 flex-col shadow-xl lg:flex lg:sticky lg:top-0">
        <SidebarContent />
      </aside>

      {/* Main */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface px-4 shadow-sm sm:px-6">
          {/* Mobile hamburger */}
          <button
            type="button"
            className="rounded-md p-2 text-muted hover:bg-background hover:text-text lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden lg:block" />

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted sm:block">
              {new Date().toLocaleDateString("id-ID", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
            <div className="hidden h-4 w-px bg-border sm:block" />
            <span className="text-sm font-medium">{appUser?.name}</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
