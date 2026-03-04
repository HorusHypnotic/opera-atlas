import { KPICard } from "@/components/dashboard/KPICard";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { GlobalFilters } from "@/components/dashboard/GlobalFilters";
import { financeiroKPIs, evolucaoFinanceira, fornecedores } from "@/data/mockData";
import { TrendingUp, DollarSign, PiggyBank, AlertTriangle } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { toast } from "sonner";

export default function AnaliseContinuaPage() {
  const margemStatus = financeiroKPIs.margemAtual > 15 ? "ok" : financeiroKPIs.margemAtual > 10 ? "warning" : "critical";

  return (
    <div>
      <GlobalFilters />
      <SectionHeader
        title="Análise Contínua — Financeiro"
        subtitle="Fluxo de caixa, projeções e controle de fornecedores"
        icon={<TrendingUp className="h-5 w-5" />}
        onAddRecord={() => toast.info("Formulário de registro será implementado")}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard
          title="Entradas (30d)"
          value={`R$ ${(financeiroKPIs.entradasProjetadas / 1000).toFixed(0)}k`}
          icon={<TrendingUp className="h-5 w-5" />}
          tooltip="Projeção de entradas para os próximos 30 dias"
          status="ok"
        />
        <KPICard
          title="Saídas (30d)"
          value={`R$ ${(financeiroKPIs.saidasProjetadas / 1000).toFixed(0)}k`}
          icon={<DollarSign className="h-5 w-5" />}
          tooltip="Projeção de saídas para os próximos 30 dias"
        />
        <KPICard
          title="Economia na Semana"
          value={`R$ ${financeiroKPIs.economizadoSemana.toLocaleString("pt-BR")}`}
          icon={<PiggyBank className="h-5 w-5" />}
          tooltip="Valor economizado nesta semana através de gestão eficiente"
          status="ok"
        />
        <KPICard
          title="Margem Atual"
          value={`${financeiroKPIs.margemAtual}%`}
          icon={<AlertTriangle className="h-5 w-5" />}
          tooltip={`Margem mínima segura: ${financeiroKPIs.margemMinima}%. Alerta se consumida`}
          status={margemStatus}
          subtitle={`Mínimo: ${financeiroKPIs.margemMinima}%`}
        />
      </div>

      {margemStatus === "critical" && (
        <div className="mb-6 p-4 rounded-lg bg-status-critical/10 border border-status-critical/30 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-status-critical shrink-0" />
          <div>
            <p className="text-sm font-semibold text-status-critical">⚠ Ponto de Ruptura Financeira</p>
            <p className="text-xs text-muted-foreground">A margem está sendo consumida. Ação imediata necessária.</p>
          </div>
        </div>
      )}

      {/* Gráfico Evolução Financeira */}
      <div className="glass-card p-4 mb-6">
        <h3 className="text-sm font-semibold mb-4">Evolução Financeira da Obra</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={evolucaoFinanceira}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="mes" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: number) => `R$ ${v.toLocaleString("pt-BR")}`} />
            <Legend />
            <Area type="monotone" dataKey="receita" stackId="1" stroke="hsl(var(--status-ok))" fill="hsl(var(--status-ok) / 0.2)" name="Receita" />
            <Area type="monotone" dataKey="custo" stackId="2" stroke="hsl(var(--status-critical))" fill="hsl(var(--status-critical) / 0.2)" name="Custo" />
            <Area type="monotone" dataKey="lucro" stackId="3" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" name="Lucro" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Fornecedores */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-semibold mb-3">Status de Fornecedores</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left py-2 px-3">Fornecedor</th>
              <th className="text-right py-2 px-3">Valor (R$)</th>
              <th className="text-left py-2 px-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {fornecedores.map(f => (
              <tr key={f.nome} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                <td className="py-2.5 px-3 font-medium">{f.nome}</td>
                <td className="py-2.5 px-3 text-right font-mono">{f.valor.toLocaleString("pt-BR")}</td>
                <td className="py-2.5 px-3"><StatusBadge status={f.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
