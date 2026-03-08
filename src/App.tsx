import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ObraProvider } from "@/hooks/useObra";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import DashboardOverview from "./pages/DashboardOverview";
import OrganizacaoPage from "./pages/OrganizacaoPage";
import PadronizacaoPage from "./pages/PadronizacaoPage";
import EficienciaPage from "./pages/EficienciaPage";
import ReducaoPerdasPage from "./pages/ReducaoPerdasPage";
import AnaliseContinuaPage from "./pages/AnaliseContinuaPage";
import SegurancaQualidadePage from "./pages/SegurancaQualidadePage";
import AcoesCorretivasPage from "./pages/AcoesCorretivasPage";
import ChecklistSemanalPage from "./pages/ChecklistSemanalPage";
import LandingPage from "./pages/LandingPage";
import AdminPage from "./pages/AdminPage";
import LoginPage from "./pages/LoginPage";
import SetupPage from "./pages/SetupPage";
import NotFound from "./pages/NotFound";
import InvitePage from "./pages/InvitePage";
import { PWAInstallBanner } from "./components/PWAInstallBanner";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <PWAInstallBanner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/landing" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/invite" element={<InvitePage />} />
            <Route path="/setup" element={
              <ProtectedRoute><SetupPage /></ProtectedRoute>
            } />
            <Route path="/*" element={
              <ProtectedRoute>
                <ObraProvider>
                  <AppLayout>
                    <Routes>
                      <Route path="/" element={<DashboardOverview />} />
                      <Route path="/organizacao" element={<OrganizacaoPage />} />
                      <Route path="/padronizacao" element={<PadronizacaoPage />} />
                      <Route path="/eficiencia" element={<EficienciaPage />} />
                      <Route path="/reducao-perdas" element={<ReducaoPerdasPage />} />
                      <Route path="/analise-continua" element={<AnaliseContinuaPage />} />
                      <Route path="/seguranca-qualidade" element={<SegurancaQualidadePage />} />
                      <Route path="/acoes-corretivas" element={<AcoesCorretivasPage />} />
                      <Route path="/checklist" element={<ChecklistSemanalPage />} />
                      <Route path="/admin" element={<AdminPage />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </AppLayout>
                </ObraProvider>
              </ProtectedRoute>
            } />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
