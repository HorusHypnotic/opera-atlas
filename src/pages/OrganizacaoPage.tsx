import { KPICard } from "@/components/dashboard/KPICard";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { GlobalFilters } from "@/components/dashboard/GlobalFilters";
import { AddRecordDialog } from "@/components/dashboard/AddRecordDialog";
import { useTableData } from "@/hooks/useTableData";
import { Users, DollarSign, BarChart3 } from "lucide-react";

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
  const { data: registros = [], isLoading, insert } = useTableData<RegistroDiario>("registros_diarios");

  const totalRegistros = registros.length;
  const okCount = registros.filter((r) => r.status === "ok").length;
  const alertCount = registros.filter((r) => r.status !== "ok").length;

  return (
    <div>
      <GlobalFilters />
      <SectionHeader
        title="Organização — Mão de Obra"
        subtitle="Controle de produtividade e custos de equipe"
        icon={<Users className="h-5 w-5" />}
      />

      <div className="flex justify-end mb-4">
        <AddRecordDialog title="Novo Registro Diário" fields={fields} onSubmit={insert} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KPICard title="Total Registros" value={totalRegistros} icon={<Users className="h-5 w-5" />} tooltip="Registros diários cadastrados" />
        <KPICard title="Status OK" value={okCount} icon={<BarChart3 className="h-5 w-5" />} tooltip="Colaboradores com status OK" status="ok" />
        <KPICard title="Alertas" value={alertCount} icon={<DollarSign className="h-5 w-5" />} tooltip="Colaboradores com atenção ou crítico" status={alertCount > 0 ? "warning" : "ok"} />
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
