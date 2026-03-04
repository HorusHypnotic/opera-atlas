import { KPICard } from "@/components/dashboard/KPICard";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { GaugeChart } from "@/components/dashboard/GaugeChart";
import { GlobalFilters } from "@/components/dashboard/GlobalFilters";
import { insumosKPIs, consumoMateriais, alertasCompras } from "@/data/mockData";
import { Package, AlertTriangle, TrendingDown } from "lucide-react";
import { toast } from "sonner";

export default function PadronizacaoPage() {
  const top5 = [...consumoMateriais].sort((a, b) => b.desperdicio - a.desperdicio).slice(0, 5);
  const desperdicioStatus = insumosKPIs.desperdicioPercent > 8 ? "critical" : insumosKPIs.desperdicioPercent > 5 ? "warning" : "ok";

  return (
    <div>
      <GlobalFilters />
      <SectionHeader
        title="Padronização — Insumos"
        subtitle="Controle de consumo e desperdício de materiais"
        icon={<Package className="h-5 w-5" />}
        onAddRecord={() => toast.info("Formulário de registro será implementado")}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="glass-card p-5 flex items-center justify-center">
          <GaugeChart value={insumosKPIs.desperdicioPercent} target={insumosKPIs.metaDesperdicio} label="Desperdício Financeiro" />
        </div>
        <KPICard
          title="Compras Emergenciais"
          value={insumosKPIs.comprasEmergenciais}
          icon={<AlertTriangle className="h-5 w-5" />}
          tooltip="Compras realizadas fora do planejamento no período"
          status="critical"
          subtitle="fora do planejamento"
        />
        <KPICard
          title="% Desperdício"
          value={`${insumosKPIs.desperdicioPercent}%`}
          icon={<TrendingDown className="h-5 w-5" />}
          tooltip={`Meta de desperdício: < ${insumosKPIs.metaDesperdicio}%`}
          status={desperdicioStatus}
          subtitle={`Meta: < ${insumosKPIs.metaDesperdicio}%`}
        />
      </div>

      {/* Tabela Consumo */}
      <div className="glass-card p-4 mb-6 overflow-x-auto">
        <h3 className="text-sm font-semibold mb-3">Consumo Previsto vs. Real</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left py-2 px-3">Material</th>
              <th className="text-right py-2 px-3">Previsto</th>
              <th className="text-right py-2 px-3">Real</th>
              <th className="text-left py-2 px-3">Unidade</th>
              <th className="text-right py-2 px-3">Desperdício</th>
            </tr>
          </thead>
          <tbody>
            {consumoMateriais.map(m => (
              <tr key={m.material} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                <td className="py-2.5 px-3 font-medium">{m.material}</td>
                <td className="py-2.5 px-3 text-right font-mono">{m.previsto}</td>
                <td className="py-2.5 px-3 text-right font-mono">{m.real}</td>
                <td className="py-2.5 px-3 text-muted-foreground">{m.unidade}</td>
                <td className={`py-2.5 px-3 text-right font-mono font-semibold ${m.desperdicio > 8 ? "text-status-critical" : m.desperdicio > 5 ? "text-status-warning" : "text-status-ok"}`}>
                  {m.desperdicio}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Ranking Desperdício */}
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold mb-3">Top 5 — Maior Desperdício</h3>
          <div className="space-y-3">
            {top5.map((m, i) => (
              <div key={m.material} className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-status-critical/20 text-status-critical" : "bg-secondary text-muted-foreground"}`}>
                  {i + 1}
                </span>
                <div className="flex-1">
                  <div className="flex justify-between text-sm">
                    <span>{m.material}</span>
                    <span className="font-mono font-semibold">{m.desperdicio}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary mt-1">
                    <div
                      className={`h-full rounded-full transition-all ${m.desperdicio > 8 ? "bg-status-critical" : m.desperdicio > 5 ? "bg-status-warning" : "bg-status-ok"}`}
                      style={{ width: `${Math.min(m.desperdicio * 10, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alertas de Compras */}
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-status-critical" />
            Compras Emergenciais
          </h3>
          <div className="space-y-3">
            {alertasCompras.map(a => (
              <div key={a.material} className="p-3 rounded-lg bg-status-critical/5 border border-status-critical/20">
                <div className="flex justify-between mb-1">
                  <span className="font-medium text-sm">{a.material}</span>
                  <span className="text-xs text-muted-foreground">{a.data}</span>
                </div>
                <p className="text-xs text-muted-foreground">{a.motivo}</p>
                <p className="text-xs font-mono mt-1">Qtd: {a.qtd}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
