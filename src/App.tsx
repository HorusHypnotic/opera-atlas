import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import DashboardOverview from "./pages/DashboardOverview";
import OrganizacaoPage from "./pages/OrganizacaoPage";
import PadronizacaoPage from "./pages/PadronizacaoPage";
import EficienciaPage from "./pages/EficienciaPage";
import ReducaoPerdasPage from "./pages/ReducaoPerdasPage";
import AnaliseContinuaPage from "./pages/AnaliseContinuaPage";
import SegurancaQualidadePage from "./pages/SegurancaQualidadePage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<DashboardOverview />} />
            <Route path="/organizacao" element={<OrganizacaoPage />} />
            <Route path="/padronizacao" element={<PadronizacaoPage />} />
            <Route path="/eficiencia" element={<EficienciaPage />} />
            <Route path="/reducao-perdas" element={<ReducaoPerdasPage />} />
            <Route path="/analise-continua" element={<AnaliseContinuaPage />} />
            <Route path="/seguranca-qualidade" element={<SegurancaQualidadePage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
