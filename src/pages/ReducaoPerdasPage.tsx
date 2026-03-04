import { KPICard } from "@/components/dashboard/KPICard";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { GaugeChart } from "@/components/dashboard/GaugeChart";
import { GlobalFilters } from "@/components/dashboard/GlobalFilters";
import { perdasKPIs, sequenciamentoEquipes, riscos, retrabalhos } from "@/data/mockData";
import { ShieldAlert, AlertTriangle, RotateCcw, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";

const severityColors = { alta: "critical" as const, media: "warning" as const, baixa: "ok" as const };

export default function ReducaoPerdasPage() {
  const improdStatus = perdasKPIs.improdutividadePercent > 20 ? "critical" : perdasKPIs.improdutividadePercent > 15 ? "warning" : "ok";

  return (
    <div>
      <GlobalFilters />
      <SectionHeader
        title="Redução de Perdas"
        subtitle="Combate à improdutividade, retrabalhos e riscos"
        icon={<ShieldAlert className="h-5 w-5" />}
        onAddRecord={() => toast.info("Formulário de registro será implementado")}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="glass-card p-5 flex items-center justify-center">
          <GaugeChart value={perdasKPIs.improdutividadePercent} target={perdasKPIs.metaImprodutividade} label="Índice de Improdutividade" />
        </div>
        <KPICard
          title="Improdutividade"
          value={`${perdasKPIs.improdutividadePercent}%`}
          icon={<Clock className="h-5 w-5" />}
          tooltip={`Meta: < ${perdasKPIs.metaImprodutividade}%. Mede tempo não produtivo`}
          status={improdStatus}
          subtitle={`Meta: < ${perdasKPIs.metaImprodutividade}%`}
        />
        <KPICard
          title="Retrabalhos Registrados"
          value={perdasKPIs.retrabalhosTotal}
          icon={<RotateCcw className="h-5 w-5" />}
          tooltip="Total de retrabalhos registrados no período atual"
          status="warning"
        />
      </div>

      {/* Linha de Balanço */}
      <div className="glass-card p-4 mb-6">
        <h3 className="text-sm font-semibold mb-4">Sequenciamento de Equipes — Linha de Balanço</h3>
        <div className="space-y-2">
          {sequenciamentoEquipes.map(eq => (
            <div key={eq.equipe} className="flex items-center gap-3">
              <span className="w-32 text-xs text-right text-muted-foreground shrink-0">{eq.equipe}</span>
              <div className="flex-1 h-7 bg-secondary rounded relative">
                <div
                  className={`absolute h-full rounded flex items-center justify-center text-[10px] font-semibold ${
                    eq.status === "concluido" ? "bg-status-ok/30 text-status-ok" :
                    eq.status === "em_andamento" ? "bg-primary/30 text-primary" :
                    "bg-muted-foreground/20 text-muted-foreground"
                  }`}
                  style={{ left: `${(eq.inicio / 22) * 100}%`, width: `${((eq.fim - eq.inicio) / 22) * 100}%` }}
                >
                  S{eq.inicio}-S{eq.fim}
                </div>
              </div>
              <StatusBadge status={eq.status} />
            </div>
          ))}
          <div className="flex items-center gap-3 mt-2">
            <span className="w-32" />
            <div className="flex-1 flex justify-between text-[10px] text-muted-foreground px-1">
              {Array.from({ length: 5 }, (_, i) => <span key={i}>S{(i + 1) * 4}</span>)}
            </div>
            <span className="w-24" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Mapa de Risco */}
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-status-warning" />
            Mapa de Risco — Próximos 15 dias
          </h3>
          <div className="space-y-3">
            {riscos.map(r => (
              <div key={r.risco} className={`p-3 rounded-lg border ${
                r.severidade === "alta" ? "bg-status-critical/5 border-status-critical/20" : "bg-status-warning/5 border-status-warning/20"
              }`}>
                <div className="flex justify-between items-start mb-1">
                  <span className="font-medium text-sm">{r.risco}</span>
                  <StatusBadge status={severityColors[r.severidade]} label={r.severidade.toUpperCase()} />
                </div>
                <p className="text-xs text-muted-foreground">{r.impacto}</p>
                <p className="text-xs font-mono mt-1 text-muted-foreground">Em {r.prazo}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Retrabalhos por Etapa */}
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold mb-4">Retrabalhos por Etapa</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={retrabalhos} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <YAxis dataKey="etapa" type="category" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} width={80} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Bar dataKey="quantidade" fill="hsl(var(--status-warning))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
