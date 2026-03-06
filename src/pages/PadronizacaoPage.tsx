import { KPICard } from "@/components/dashboard/KPICard";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { GaugeChart } from "@/components/dashboard/GaugeChart";
import { GlobalFilters } from "@/components/dashboard/GlobalFilters";
import { AddRecordDialog } from "@/components/dashboard/AddRecordDialog";
import { useTableData } from "@/hooks/useTableData";
import { Package, AlertTriangle, TrendingDown } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ConsumoMaterial {
  id: string;
  material: string;
  previsto: number;
  real_consumo: number;
  unidade: string;
  data_registro: string;
}

interface CompraEmergencial {
  id: string;
  material: string;
  qtd: number;
  motivo: string | null;
  data: string;
}

const consumoFields = [
  { name: "material", label: "Material", placeholder: "Ex: Cimento CP-II", required: true },
  { name: "previsto", label: "Qtd Prevista", type: "number" as const, placeholder: "500" },
  { name: "real_consumo", label: "Qtd Real", type: "number" as const, placeholder: "545" },
  { name: "unidade", label: "Unidade", placeholder: "sacos", defaultValue: "un" },
  { name: "data_registro", label: "Data", type: "date" as const, defaultValue: new Date().toISOString().split("T")[0] },
];

const compraFields = [
  { name: "material", label: "Material", placeholder: "Ex: Cimento CP-V ARI", required: true },
  { name: "qtd", label: "Quantidade", type: "number" as const },
  { name: "motivo", label: "Motivo", placeholder: "Falta no estoque", required: false },
  { name: "data", label: "Data", type: "date" as const, defaultValue: new Date().toISOString().split("T")[0] },
];

export default function PadronizacaoPage() {
  const { data: consumo = [], isLoading: loadingC, insert: insertConsumo } = useTableData<ConsumoMaterial>("consumo_materiais");
  const { data: compras = [], isLoading: loadingP, insert: insertCompra } = useTableData<CompraEmergencial>("compras_emergenciais");

  const desperdicioTotal = consumo.length > 0
    ? consumo.reduce((acc, m) => acc + (m.previsto > 0 ? ((m.real_consumo - m.previsto) / m.previsto) * 100 : 0), 0) / consumo.length
    : 0;

  const top5 = [...consumo]
    .map((m) => ({ ...m, desperdicio: m.previsto > 0 ? ((m.real_consumo - m.previsto) / m.previsto) * 100 : 0 }))
    .sort((a, b) => b.desperdicio - a.desperdicio)
    .slice(0, 5);

  const desperdicioStatus = desperdicioTotal > 8 ? "critical" : desperdicioTotal > 5 ? "warning" : "ok";

  return (
    <div>
      <GlobalFilters />
      <SectionHeader
        title="Padronização — Insumos"
        subtitle="Controle de consumo e desperdício de materiais"
        icon={<Package className="h-5 w-5" />}
      />

      <div className="flex justify-end gap-2 mb-4">
        <AddRecordDialog title="Novo Consumo de Material" fields={consumoFields} onSubmit={insertConsumo} />
        <AddRecordDialog title="Nova Compra Emergencial" fields={compraFields} onSubmit={insertCompra}
          trigger={<button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"><AlertTriangle className="h-4 w-4" /> Compra Emergencial</button>}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="glass-card p-5 flex items-center justify-center">
          <GaugeChart value={Math.max(0, desperdicioTotal)} target={5} label="Desperdício Financeiro" />
        </div>
        <KPICard title="Compras Emergenciais" value={compras.length} icon={<AlertTriangle className="h-5 w-5" />} tooltip="Compras fora do planejamento" status={compras.length > 0 ? "critical" : "ok"} subtitle="fora do planejamento" />
        <KPICard title="% Desperdício" value={`${desperdicioTotal.toFixed(1)}%`} icon={<TrendingDown className="h-5 w-5" />} tooltip="Meta: < 5%" status={desperdicioStatus as any} subtitle="Meta: < 5%" />
      </div>

      <Tabs defaultValue="consumo" className="space-y-4">
        <TabsList>
          <TabsTrigger value="consumo">Consumo Previsto vs Real</TabsTrigger>
          <TabsTrigger value="compras">Compras Emergenciais ({compras.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="consumo">
          <div className="glass-card p-4 overflow-x-auto">
            {loadingC ? <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p> :
            consumo.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">Nenhum material cadastrado.</p> : (
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
                  {consumo.map((m) => {
                    const desp = m.previsto > 0 ? ((m.real_consumo - m.previsto) / m.previsto) * 100 : 0;
                    return (
                      <tr key={m.id} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                        <td className="py-2.5 px-3 font-medium">{m.material}</td>
                        <td className="py-2.5 px-3 text-right font-mono">{m.previsto}</td>
                        <td className="py-2.5 px-3 text-right font-mono">{m.real_consumo}</td>
                        <td className="py-2.5 px-3 text-muted-foreground">{m.unidade}</td>
                        <td className={`py-2.5 px-3 text-right font-mono font-semibold ${desp > 8 ? "text-status-critical" : desp > 5 ? "text-status-warning" : "text-status-ok"}`}>{desp.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="compras">
          <div className="glass-card p-4">
            {loadingP ? <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p> :
            compras.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma compra emergencial.</p> : (
              <div className="space-y-3">
                {compras.map((a) => (
                  <div key={a.id} className="p-3 rounded-lg bg-status-critical/5 border border-status-critical/20">
                    <div className="flex justify-between mb-1">
                      <span className="font-medium text-sm">{a.material}</span>
                      <span className="text-xs text-muted-foreground">{a.data}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{a.motivo || "—"}</p>
                    <p className="text-xs font-mono mt-1">Qtd: {a.qtd}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
