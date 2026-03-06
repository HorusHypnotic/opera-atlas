import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile } = useAuth();

  // If user has no tenant, redirect to setup
  if (profile && !profile.tenant_id) {
    return <Navigate to="/setup" replace />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b border-border px-4 shrink-0">
            <SidebarTrigger className="mr-3" />
            <span className="text-xs text-muted-foreground font-mono">
              Método O.P.E.R.A. • {new Date().toLocaleDateString("pt-BR")}
            </span>
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
