import { KPICard } from "@/components/dashboard/KPICard";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { GlobalFilters } from "@/components/dashboard/GlobalFilters";
import { AddRecordDialog, EditRecordDialog, DeleteRecordButton } from "@/components/dashboard/AddRecordDialog";
import { useTableData } from "@/hooks/useTableData";
import { Users, DollarSign, BarChart3, Ruler } from "lucide-react";

interface RegistroDiario {
  id: string;
  nome: string;
  entrada: string | null;
  saida: string | null;
  atividade: string | null;
  producao: string | null;
  status: string;
  data_registro: string;
}

const fields = [
  { name: "nome", label: "Nome do Colaborador", placeholder: "Ex: Carlos Silva", required: true },
  { name: "entrada", label: "Entrada", type: "time" as const },
  { name: "saida", label: "Saída", type: "time" as const },
  { name: "atividade", label: "Atividade", placeholder: "Ex: Alvenaria" },
  { name: "producao", label: "Produção", placeholder: "Ex: 12 m²" },
  { name: "status", label: "Status", type: "select" as const, defaultValue: "ok", options: [
    { value: "ok", label: "OK" },
    { value: "warning", label: "Atenção" },
    { value: "critical", label: "Crítico" },
  ]},
  { name: "data_registro", label: "Data", type: "date" as const, defaultValue: new Date().toISOString().split("T")[0] },
];

export default function OrganizacaoPage() {
  const { data: registros = [], isLoading, insert, update, remove } = useTableData<RegistroDiario>("registros_diarios");
  const { data: lancamentos = [] } = useTableData("lancamentos_financeiros");

  const totalRegistros = registros.length;
  const okCount = registros.filter((r) => r.status === "ok").length;
  const alertCount = registros.filter((r) => r.status !== "ok").length;

  // Custo por m² — cruza produção total (m²) com custos de folha
  const totalM2 = registros.reduce((s, r) => {
    const match = r.producao?.match(/(\d+(?:[.,]\d+)?)\s*m/i);
    return s + (match ? parseFloat(match[1].replace(",", ".")) : 0);
  }, 0);
  const custoFolha = (lancamentos as any[])
    .filter((l: any) => l.tipo === "custo" && l.descricao?.toLowerCase().includes("folha"))
    .reduce((s: number, l: any) => s + Number(l.valor), 0);
  const custoPorM2 = totalM2 > 0 ? custoFolha / totalM2 : 0;

  return (
    <div>
      <GlobalFilters />
      <SectionHeader title="Organização — Mão de Obra" subtitle="Controle de produtividade e custos de equipe" icon={<Users className="h-5 w-5" />} />

      <div className="flex justify-end mb-4">
        <AddRecordDialog title="Novo Registro Diário" fields={fields} onSubmit={insert} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard title="Total Registros" value={totalRegistros} icon={<Users className="h-5 w-5" />} tooltip="Registros diários cadastrados" />
        <KPICard title="Status OK" value={okCount} icon={<BarChart3 className="h-5 w-5" />} tooltip="Colaboradores com status OK" status="ok" />
        <KPICard title="Alertas" value={alertCount} icon={<DollarSign className="h-5 w-5" />} tooltip="Colaboradores com atenção ou crítico" status={alertCount > 0 ? "warning" : "ok"} />
        <KPICard title="Custo por m²" value={custoPorM2 > 0 ? `R$ ${custoPorM2.toFixed(0)}` : "—"} icon={<Ruler className="h-5 w-5" />} tooltip="Custo de folha / m² produzido" subtitle={totalM2 > 0 ? `${totalM2.toFixed(0)} m² total` : "Sem dados de m²"} />
      </div>

      <div className="glass-card p-4 overflow-x-auto">
        <h3 className="text-sm font-semibold mb-3">Colaboradores — Controle Diário</h3>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
        ) : registros.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nenhum registro encontrado. Adicione o primeiro!</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-2 px-3">Nome</th>
                <th className="text-left py-2 px-3">Entrada</th>
                <th className="text-left py-2 px-3">Saída</th>
                <th className="text-left py-2 px-3">Atividade</th>
                <th className="text-left py-2 px-3">Produção</th>
                <th className="text-left py-2 px-3">Data</th>
                <th className="text-left py-2 px-3">Status</th>
                <th className="text-right py-2 px-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((c) => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                  <td className="py-2.5 px-3 font-medium">{c.nome}</td>
                  <td className="py-2.5 px-3 font-mono text-xs">{c.entrada || "—"}</td>
                  <td className="py-2.5 px-3 font-mono text-xs">{c.saida || "—"}</td>
                  <td className="py-2.5 px-3">{c.atividade || "—"}</td>
                  <td className="py-2.5 px-3 font-mono">{c.producao || "—"}</td>
                  <td className="py-2.5 px-3 text-xs">{c.data_registro}</td>
                  <td className="py-2.5 px-3"><StatusBadge status={c.status as any} /></td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex justify-end gap-1">
                      <EditRecordDialog title="Editar Registro" fields={fields} record={c} onSubmit={update} />
                      <DeleteRecordButton onConfirm={() => remove(c.id)} itemName={c.nome} />
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
