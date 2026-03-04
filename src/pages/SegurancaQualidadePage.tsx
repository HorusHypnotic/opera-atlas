import { KPICard } from "@/components/dashboard/KPICard";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { GlobalFilters } from "@/components/dashboard/GlobalFilters";
import { segurancaKPIs } from "@/data/mockData";
import { ShieldCheck, Heart, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

export default function SegurancaQualidadePage() {
  return (
    <div>
      <GlobalFilters />
      <SectionHeader
        title="Segurança & Qualidade"
        subtitle="Indicadores de segurança do trabalho e conformidade"
        icon={<ShieldCheck className="h-5 w-5" />}
        onAddRecord={() => toast.info("Formulário de registro será implementado")}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="glass-card p-6 glow-orange col-span-1 sm:col-span-2 lg:col-span-1 flex flex-col items-center justify-center">
          <Heart className="h-8 w-8 text-primary mb-2 animate-pulse-glow" />
          <p className="text-5xl font-bold text-primary animate-count-up">{segurancaKPIs.diasSemAcidente}</p>
          <p className="text-sm text-muted-foreground mt-1">Dias Sem Acidente</p>
        </div>
        <KPICard
          title="Inspeções Aprovadas"
          value={`${segurancaKPIs.inspecoesAprovadasPercent}%`}
          icon={<CheckCircle className="h-5 w-5" />}
          tooltip="Percentual de inspeções aprovadas na primeira tentativa"
          status={segurancaKPIs.inspecoesAprovadasPercent >= 90 ? "ok" : "warning"}
          subtitle="na primeira tentativa"
        />
        <KPICard
          title="NC Abertas"
          value={segurancaKPIs.naoConformidadesAbertas}
          icon={<XCircle className="h-5 w-5" />}
          tooltip="Não conformidades ainda não resolvidas"
          status={segurancaKPIs.naoConformidadesAbertas > 5 ? "critical" : "warning"}
        />
        <KPICard
          title="NC Resolvidas"
          value={segurancaKPIs.naoConformidadesResolvidas}
          icon={<CheckCircle className="h-5 w-5" />}
          tooltip="Não conformidades resolvidas no período"
          status="ok"
        />
      </div>

      {/* Progress bar NC */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold mb-4">Progresso de Resolução — Não Conformidades</h3>
        <div className="flex items-center gap-4 mb-2">
          <span className="text-sm text-muted-foreground">Resolvidas</span>
          <div className="flex-1 h-4 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-status-ok transition-all duration-1000"
              style={{ width: `${(segurancaKPIs.naoConformidadesResolvidas / (segurancaKPIs.naoConformidadesResolvidas + segurancaKPIs.naoConformidadesAbertas)) * 100}%` }}
            />
          </div>
          <span className="text-sm font-mono">
            {segurancaKPIs.naoConformidadesResolvidas}/{segurancaKPIs.naoConformidadesResolvidas + segurancaKPIs.naoConformidadesAbertas}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {((segurancaKPIs.naoConformidadesResolvidas / (segurancaKPIs.naoConformidadesResolvidas + segurancaKPIs.naoConformidadesAbertas)) * 100).toFixed(0)}% das não conformidades foram resolvidas
        </p>
      </div>
    </div>
  );
}
