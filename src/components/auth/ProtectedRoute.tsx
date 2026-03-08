import { useAuth } from "@/hooks/useAuth";
import { Navigate, useLocation } from "react-router-dom";
import { ReactNode } from "react";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, profile, loading, isGuest } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user && !isGuest) {
    return <Navigate to="/landing" replace />;
  }

  // Guest mode skips all checks
  if (isGuest) {
    return <>{children}</>;
  }

  // Beta status check: if user has a beta_status and it's not approved, redirect
  if (profile && (profile as any).beta_status && (profile as any).beta_status !== "aprovado") {
    if (location.pathname !== "/beta-status") {
      return <Navigate to="/beta-status" replace />;
    }
  }

  // Tenant setup check
  if (profile && !profile.tenant_id && location.pathname !== "/setup") {
    return <Navigate to="/setup" replace />;
  }

  return <>{children}</>;
}
