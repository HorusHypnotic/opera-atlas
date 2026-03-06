import { KPICard } from "@/components/dashboard/KPICard";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { GlobalFilters } from "@/components/dashboard/GlobalFilters";
import { AddRecordDialog } from "@/components/dashboard/AddRecordDialog";
import { useTableData } from "@/hooks/useTableData";
import { Wrench, DollarSign, Activity } from "lucide-react";

interface Ativo {
  id: string;
  nome: string;
  status: string;
  local_atual: string | null;
  valor: number;
}

const fields = [
  { name: "nome", label: "Nome do Equipamento", placeholder: "Ex: Betoneira 400L", required: true },
  { name: "status", label: "Status", type: "select" as const, defaultValue: "ativo", options: [
    { value: "ativo", label: "Ativo" },
    { value: "ocioso", label: "Ocioso" },
    { value: "realocavel", label: "Realocável" },
  ]},
  { name: "local_atual", label: "Local", placeholder: "Ex: Bloco A" },
  { name: "valor", label: "Valor (R$)", type: "number" as const, placeholder: "8500" },
];

export default function EficienciaPage() {
  const { data: ativos = [], isLoading, insert } = useTableData<Ativo>("ativos");

  const ociosTotal = ativos.filter((f) => f.status === "ocioso").reduce((s, f) => s + Number(f.valor), 0);
  const ativosCount = ativos.filter((f) => f.status === "ativo").length;
  const totalValue = ativos.reduce((s, f) => s + Number(f.valor), 0);

  return (
    <div>
      <GlobalFilters />
      <SectionHeader
        title="Eficiência — Ativos"
        subtitle="Gestão de ferramentas, equipamentos e tempo produtivo"
        icon={<Wrench className="h-5 w-5" />}
      />

      <div className="flex justify-end mb-4">
        <AddRecordDialog title="Novo Ativo/Equipamento" fields={fields} onSubmit={insert} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KPICard title="Ativos Parados" value={`R$ ${ociosTotal.toLocaleString("pt-BR")}`} icon={<DollarSign className="h-5 w-5" />} tooltip="Valor total em equipamentos ociosos" status={ociosTotal > 0 ? "critical" : "ok"} />
        <KPICard title="Ativos em Uso" value={ativosCount} icon={<Activity className="h-5 w-5" />} tooltip="Equipamentos ativos em uso" status="ok" />
        <KPICard title="Patrimônio Total" value={`R$ ${totalValue.toLocaleString("pt-BR")}`} icon={<Wrench className="h-5 w-5" />} tooltip="Valor total dos ativos cadastrados" />
      </div>

      <div className="glass-card p-4 overflow-x-auto">
        <h3 className="text-sm font-semibold mb-3">Mapa de Ferramentas & Equipamentos</h3>
        {isLoading ? <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p> :
        ativos.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">Nenhum ativo cadastrado.</p> : (
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
              {ativos.map((f) => (
                <tr key={f.id} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                  <td className="py-2.5 px-3 font-medium">{f.nome}</td>
                  <td className="py-2.5 px-3 text-muted-foreground">{f.local_atual || "—"}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{Number(f.valor).toLocaleString("pt-BR")}</td>
                  <td className="py-2.5 px-3"><StatusBadge status={f.status as any} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
