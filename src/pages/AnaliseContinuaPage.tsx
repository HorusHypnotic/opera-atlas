import { KPICard } from "@/components/dashboard/KPICard";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { GlobalFilters } from "@/components/dashboard/GlobalFilters";
import { AddRecordDialog, EditRecordDialog, DeleteRecordButton } from "@/components/dashboard/AddRecordDialog";
import { useTableData } from "@/hooks/useTableData";
import { TrendingUp, DollarSign, PiggyBank, AlertTriangle } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Lancamento { id: string; tipo: string; valor: number; descricao: string | null; data: string; fornecedor: string | null; status_pagamento: string; }

const fields = [
  { name: "tipo", label: "Tipo", type: "select" as const, defaultValue: "custo", options: [
    { value: "receita", label: "Receita" }, { value: "custo", label: "Custo" },
  ]},
  { name: "valor", label: "Valor (R$)", type: "number" as const, required: true },
  { name: "descricao", label: "Descrição", placeholder: "Ex: Pagamento fornecedor X", required: false },
  { name: "fornecedor", label: "Fornecedor", placeholder: "Ex: Votorantim", required: false },
  { name: "status_pagamento", label: "Status", type: "select" as const, defaultValue: "pendente", options: [
    { value: "pago", label: "Pago" }, { value: "pendente", label: "Pendente" }, { value: "atrasado", label: "Atrasado" },
  ]},
  { name: "data", label: "Data", type: "date" as const, defaultValue: new Date().toISOString().split("T")[0] },
];

export default function AnaliseContinuaPage() {
  const { data: lancamentos = [], isLoading, insert, update, remove } = useTableData<Lancamento>("lancamentos_financeiros");

  const receitas = lancamentos.filter((l) => l.tipo === "receita");
  const custos = lancamentos.filter((l) => l.tipo === "custo");
  const totalReceitas = receitas.reduce((s, l) => s + Number(l.valor), 0);
  const totalCustos = custos.reduce((s, l) => s + Number(l.valor), 0);
  const saldo = totalReceitas - totalCustos;
  const margem = totalReceitas > 0 ? ((saldo / totalReceitas) * 100) : 0;
  const margemStatus = margem > 15 ? "ok" : margem > 10 ? "warning" : "critical";

  const byMonth: Record<string, { receita: number; custo: number }> = {};
  lancamentos.forEach((l) => {
    const mes = l.data?.substring(0, 7) || "N/A";
    if (!byMonth[mes]) byMonth[mes] = { receita: 0, custo: 0 };
    if (l.tipo === "receita") byMonth[mes].receita += Number(l.valor);
    else byMonth[mes].custo += Number(l.valor);
  });
  const chartData = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, v]) => ({ mes, ...v, lucro: v.receita - v.custo }));

  return (
    <div>
      <GlobalFilters />
      <SectionHeader title="Análise Contínua — Financeiro" subtitle="Fluxo de caixa, projeções e controle de fornecedores" icon={<TrendingUp className="h-5 w-5" />} />

      <div className="flex justify-end mb-4">
        <AddRecordDialog title="Novo Lançamento Financeiro" fields={fields} onSubmit={insert} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard title="Total Receitas" value={`R$ ${(totalReceitas / 1000).toFixed(0)}k`} icon={<TrendingUp className="h-5 w-5" />} tooltip="Total de receitas registradas" status="ok" />
        <KPICard title="Total Custos" value={`R$ ${(totalCustos / 1000).toFixed(0)}k`} icon={<DollarSign className="h-5 w-5" />} tooltip="Total de custos registrados" />
        <KPICard title="Saldo" value={`R$ ${saldo.toLocaleString("pt-BR")}`} icon={<PiggyBank className="h-5 w-5" />} tooltip="Receitas - Custos" status={saldo >= 0 ? "ok" : "critical"} />
        <KPICard title="Margem" value={`${margem.toFixed(1)}%`} icon={<AlertTriangle className="h-5 w-5" />} tooltip="Margem sobre receitas" status={margemStatus as any} subtitle="Mín. recomendado: 10%" />
      </div>

      {margemStatus === "critical" && totalReceitas > 0 && (
        <div className="mb-6 p-4 rounded-lg bg-status-critical/10 border border-status-critical/30 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-status-critical shrink-0" />
          <div>
            <p className="text-sm font-semibold text-status-critical">⚠ Ponto de Ruptura Financeira</p>
            <p className="text-xs text-muted-foreground">A margem está sendo consumida. Ação imediata necessária.</p>
          </div>
        </div>
      )}

      {chartData.length > 0 && (
        <div className="glass-card p-4 mb-6">
          <h3 className="text-sm font-semibold mb-4">Evolução Financeira</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: number) => `R$ ${v.toLocaleString("pt-BR")}`} />
              <Legend />
              <Area type="monotone" dataKey="receita" stroke="hsl(var(--status-ok))" fill="hsl(var(--status-ok) / 0.2)" name="Receita" />
              <Area type="monotone" dataKey="custo" stroke="hsl(var(--status-critical))" fill="hsl(var(--status-critical) / 0.2)" name="Custo" />
              <Area type="monotone" dataKey="lucro" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" name="Lucro" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="glass-card p-4">
        <h3 className="text-sm font-semibold mb-3">Lançamentos Recentes</h3>
        {isLoading ? <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p> :
        lancamentos.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">Nenhum lançamento registrado.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-muted-foreground">
              <th className="text-left py-2 px-3">Tipo</th>
              <th className="text-left py-2 px-3">Descrição</th>
              <th className="text-left py-2 px-3">Fornecedor</th>
              <th className="text-right py-2 px-3">Valor</th>
              <th className="text-left py-2 px-3">Status</th>
              <th className="text-left py-2 px-3">Data</th>
              <th className="text-right py-2 px-3">Ações</th>
            </tr></thead>
            <tbody>
              {lancamentos.slice(0, 20).map((l) => (
                <tr key={l.id} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                  <td className="py-2.5 px-3"><StatusBadge status={l.tipo === "receita" ? "ok" : "warning"} label={l.tipo === "receita" ? "Receita" : "Custo"} /></td>
                  <td className="py-2.5 px-3">{l.descricao || "—"}</td>
                  <td className="py-2.5 px-3 text-muted-foreground">{l.fornecedor || "—"}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{Number(l.valor).toLocaleString("pt-BR")}</td>
                  <td className="py-2.5 px-3"><StatusBadge status={l.status_pagamento as any} /></td>
                  <td className="py-2.5 px-3 text-xs">{l.data}</td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex justify-end gap-1">
                      <EditRecordDialog title="Editar Lançamento" fields={fields} record={l} onSubmit={update} />
                      <DeleteRecordButton onConfirm={() => remove(l.id)} itemName={l.descricao || "lançamento"} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
