import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import type { UserRole } from "@/types";

export function ProtectedRoute({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: UserRole[];
}) {
  const { firebaseUser, appUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-muted">
        Memuat...
      </div>
    );
  }
  if (!firebaseUser || !appUser?.isActive) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(appUser.role))
    return <Navigate to="/" replace />;

  return <>{children}</>;
}
