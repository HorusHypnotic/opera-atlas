import { KPICard } from "@/components/dashboard/KPICard";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { GlobalFilters } from "@/components/dashboard/GlobalFilters";
import { laborKPIs, colaboradores, producaoPorFrente } from "@/data/mockData";
import { Users, DollarSign, BarChart3, Ruler } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { toast } from "sonner";

const chartData = producaoPorFrente.map(f => ({
  name: f.frente,
  Seg: f.seg, Ter: f.ter, Qua: f.qua, Qui: f.qui, Sex: f.sex,
}));

export default function OrganizacaoPage() {
  const desvioStatus = laborKPIs.desvioPercent > 10 ? "critical" : laborKPIs.desvioPercent > 5 ? "warning" : "ok";

  return (
    <div>
      <GlobalFilters />
      <SectionHeader
        title="Organização — Mão de Obra"
        subtitle="Controle de produtividade e custos de equipe"
        icon={<Users className="h-5 w-5" />}
        onAddRecord={() => toast.info("Formulário de registro será implementado")}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard
          title="Custo Real"
          value={`R$ ${laborKPIs.custoReal.toLocaleString("pt-BR")}`}
          icon={<DollarSign className="h-5 w-5" />}
          tooltip="Custo total realizado com mão de obra no período"
          status={desvioStatus}
        />
        <KPICard
          title="Custo Orçado"
          value={`R$ ${laborKPIs.custoOrcado.toLocaleString("pt-BR")}`}
          icon={<DollarSign className="h-5 w-5" />}
          tooltip="Custo previsto em orçamento para mão de obra"
        />
        <KPICard
          title="Desvio"
          value={`${laborKPIs.desvioPercent}%`}
          icon={<BarChart3 className="h-5 w-5" />}
          tooltip="Percentual de desvio entre custo real e orçado"
          status={desvioStatus}
          subtitle="acima do orçado"
        />
        <KPICard
          title="Custo/m² Executado"
          value={`R$ ${laborKPIs.custoM2Executado}`}
          icon={<Ruler className="h-5 w-5" />}
          tooltip={`Meta: R$ ${laborKPIs.custoM2Orcado}/m²`}
          status={laborKPIs.custoM2Executado > laborKPIs.custoM2Orcado * 1.1 ? "critical" : "warning"}
          subtitle={`Orçado: R$ ${laborKPIs.custoM2Orcado}/m²`}
        />
      </div>

      {/* Tabela de Colaboradores */}
      <div className="glass-card p-4 mb-6 overflow-x-auto">
        <h3 className="text-sm font-semibold mb-3">Colaboradores — Controle Diário</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left py-2 px-3">Nome</th>
              <th className="text-left py-2 px-3">Entrada</th>
              <th className="text-left py-2 px-3">Saída</th>
              <th className="text-left py-2 px-3">Atividade</th>
              <th className="text-left py-2 px-3">Produção</th>
              <th className="text-left py-2 px-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {colaboradores.map(c => (
              <tr key={c.id} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                <td className="py-2.5 px-3 font-medium">{c.nome}</td>
                <td className="py-2.5 px-3 font-mono text-xs">{c.entrada}</td>
                <td className="py-2.5 px-3 font-mono text-xs">{c.saida}</td>
                <td className="py-2.5 px-3">{c.atividade}</td>
                <td className="py-2.5 px-3 font-mono">{c.producao}</td>
                <td className="py-2.5 px-3"><StatusBadge status={c.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Gráfico de Produção */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-semibold mb-4">Produção por Frente de Serviço — Últimos 5 dias</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
            <Legend />
            <Bar dataKey="Seg" fill="hsl(var(--chart-1))" radius={[2, 2, 0, 0]} />
            <Bar dataKey="Ter" fill="hsl(var(--chart-2))" radius={[2, 2, 0, 0]} />
            <Bar dataKey="Qua" fill="hsl(var(--chart-3))" radius={[2, 2, 0, 0]} />
            <Bar dataKey="Qui" fill="hsl(var(--chart-4))" radius={[2, 2, 0, 0]} />
            <Bar dataKey="Sex" fill="hsl(var(--chart-5))" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
