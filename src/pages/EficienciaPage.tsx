import { KPICard } from "@/components/dashboard/KPICard";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { GlobalFilters } from "@/components/dashboard/GlobalFilters";
import { ativosKPIs, ferramentas, cicloTarefa } from "@/data/mockData";
import { Wrench, DollarSign, Clock, Activity } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";

export default function EficienciaPage() {
  const ociosTotal = ferramentas.filter(f => f.status === "ocioso").reduce((s, f) => s + f.valor, 0);

  return (
    <div>
      <GlobalFilters />
      <SectionHeader
        title="Eficiência — Ativos"
        subtitle="Gestão de ferramentas, equipamentos e tempo produtivo"
        icon={<Wrench className="h-5 w-5" />}
        onAddRecord={() => toast.info("Formulário de registro será implementado")}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <KPICard
          title="Ativos Parados"
          value={`R$ ${ociosTotal.toLocaleString("pt-BR")}`}
          icon={<DollarSign className="h-5 w-5" />}
          tooltip="Valor total em equipamentos ociosos que poderiam ser realocados"
          status="critical"
        />
        <KPICard
          title="Tempo Produtivo"
          value={`${ativosKPIs.tempoProdutivoPercent}%`}
          icon={<Activity className="h-5 w-5" />}
          tooltip="Percentual do tempo utilizado em atividades produtivas"
          status={ativosKPIs.tempoProdutivoPercent >= 80 ? "ok" : "warning"}
          subtitle={`Deslocamento: ${ativosKPIs.tempoDeslocamentoPercent}%`}
        />
        <KPICard
          title="Ciclo Médio"
          value={`${cicloTarefa[cicloTarefa.length - 1].tempo}h`}
          icon={<Clock className="h-5 w-5" />}
          tooltip="Tempo médio de ciclo de tarefa na última semana"
          trend={{ value: -12, label: "vs semana anterior" }}
        />
      </div>

      {/* Mapa de Ferramentas */}
      <div className="glass-card p-4 mb-6 overflow-x-auto">
        <h3 className="text-sm font-semibold mb-3">Mapa de Ferramentas & Equipamentos</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left py-2 px-3">Equipamento</th>
              <th className="text-left py-2 px-3">Local</th>
              <th className="text-right py-2 px-3">Valor (R$)</th>
              <th className="text-left py-2 px-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {ferramentas.map(f => (
              <tr key={f.id} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                <td className="py-2.5 px-3 font-medium">{f.nome}</td>
                <td className="py-2.5 px-3 text-muted-foreground">{f.local}</td>
                <td className="py-2.5 px-3 text-right font-mono">{f.valor.toLocaleString("pt-BR")}</td>
                <td className="py-2.5 px-3"><StatusBadge status={f.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Gráfico Ciclo */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-semibold mb-4">Tempo Médio de Ciclo por Semana</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={cicloTarefa}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="semana" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} unit="h" />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
            <Line type="monotone" dataKey="tempo" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4, fill: "hsl(var(--primary))" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
