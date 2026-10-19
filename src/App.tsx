import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ObraProvider } from "@/hooks/useObra";
import { PeriodFilterProvider } from "@/hooks/usePeriodFilter";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { PWAInstallBanner } from "./components/PWAInstallBanner";

const DashboardOverview = lazy(() => import("./pages/DashboardOverview"));
const OrganizacaoPage = lazy(() => import("./pages/OrganizacaoPage"));
const PadronizacaoPage = lazy(() => import("./pages/PadronizacaoPage"));
const EficienciaPage = lazy(() => import("./pages/EficienciaPage"));
const ReducaoPerdasPage = lazy(() => import("./pages/ReducaoPerdasPage"));
const AnaliseContinuaPage = lazy(() => import("./pages/AnaliseContinuaPage"));
const SegurancaQualidadePage = lazy(() => import("./pages/SegurancaQualidadePage"));
const AcoesCorretivasPage = lazy(() => import("./pages/AcoesCorretivasPage"));
const ChecklistSemanalPage = lazy(() => import("./pages/ChecklistSemanalPage"));
const ColaboradoresPage = lazy(() => import("./pages/ColaboradoresPage"));
const ObrasPage = lazy(() => import("./pages/ObrasPage"));
const EconomiaPage = lazy(() => import("./pages/EconomiaPage"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const SetupPage = lazy(() => import("./pages/SetupPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const InvitePage = lazy(() => import("./pages/InvitePage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const BetaSignupPage = lazy(() => import("./pages/BetaSignupPage"));
const BetaStatusPage = lazy(() => import("./pages/BetaStatusPage"));
const RelatorioMaoObraPage = lazy(() => import("./pages/RelatorioMaoObraPage"));
const CronogramaPage = lazy(() => import("./pages/CronogramaPage"));
const PesquisaPage = lazy(() => import("./pages/PesquisaPage"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <PWAInstallBanner />
      <BrowserRouter>
        <Suspense fallback={<main role="status" className="min-h-screen grid place-items-center">Carregando OPERA Atlas...</main>}>
        <AuthProvider>
          <Routes>
            <Route path="/landing" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/invite" element={<InvitePage />} />
            <Route path="/beta" element={<BetaSignupPage />} />
            <Route path="/beta-status" element={<BetaStatusPage />} />
            <Route path="/setup" element={
              <ProtectedRoute><SetupPage /></ProtectedRoute>
            } />
            <Route path="/*" element={
              <ProtectedRoute>
                <ObraProvider>
                  <PeriodFilterProvider>
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
                      <Route path="/colaboradores" element={<ColaboradoresPage />} />
                      <Route path="/obras" element={<ObrasPage />} />
                      <Route path="/economia" element={<EconomiaPage />} />
                      <Route path="/relatorio-mao-obra" element={<RelatorioMaoObraPage />} />
                      <Route path="/cronograma" element={<CronogramaPage />} />
                      <Route path="/pesquisa" element={<PesquisaPage />} />
                      <Route path="/admin" element={<AdminPage />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </AppLayout>
                  </PeriodFilterProvider>
                </ObraProvider>
              </ProtectedRoute>
            } />
          </Routes>
        </AuthProvider>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
