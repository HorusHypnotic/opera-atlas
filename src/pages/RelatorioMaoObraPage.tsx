import { useState, useMemo } from "react";
import { GlobalFilters } from "@/components/dashboard/GlobalFilters";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { KPICard } from "@/components/dashboard/KPICard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { useTableData } from "@/hooks/useTableData";
import { useObra } from "@/hooks/useObra";
import {
  FileText, Download, Printer, DollarSign, Users, Calendar, Filter, FileSpreadsheet,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── Types ───
interface Colaborador {
  id: string;
  nome: string;
  categoria: string | null;
  valor_diaria: number;
  pix_tipo: string | null;
  pix_chave: string | null;
  ativo: boolean;
}

interface RegistroPresenca {
  id: string;
  colaborador_id: string;
  obra_id: string;
  data: string;
  tipo: string;
  horas_extra: number;
  valor_diaria_usado: number | null;
  valor_diaria_especial: number | null;
  servico_especial: string | null;
  observacao: string | null;
}

interface RegistroDiario {
  id: string;
  nome: string;
  atividade: string | null;
  producao: string | null;
  status: string;
  data_registro: string;
  entrada: string | null;
  saida: string | null;
}

interface ColaboradorObra {
  id: string;
  colaborador_id: string;
  obra_id: string;
  valor_diaria_especial: number | null;
  ativo: boolean;
}

// ─── Aggregated row type ───
interface ReportRow {
  colaboradorId: string;
  nome: string;
  funcao: string;
  valorDiaria: number;
  qtdDiarias: number;
  horasExtra: number;
  valorTotal: number;
  pixChave: string;
  pixTipo: string;
  presencas: number;
  faltas: number;
  faltasJustificadas: number;
}

const CATEGORIAS: Record<string, string> = {
  ajudante: "Ajudante",
  pedreiro: "Pedreiro",
  armador: "Armador",
  carpinteiro: "Carpinteiro",
  eletricista: "Eletricista",
  encanador: "Encanador",
  pintor: "Pintor",
  gesseiro: "Gesseiro",
  mestre_obras: "Mestre de Obras",
  engenheiro: "Engenheiro",
  operador_maquinas: "Operador de Máquinas",
  servente: "Servente",
  outro: "Outro",
};

export default function RelatorioMaoObraPage() {
  const { selectedObraId, obras } = useObra();
  const { data: colaboradores = [] } = useTableData<Colaborador>("colaboradores");
  const { data: presencas = [] } = useTableData<RegistroPresenca>("registro_presencas");
  const { data: registros = [] } = useTableData<RegistroDiario>("registros_diarios");
  const { data: vinculos = [] } = useTableData<ColaboradorObra>("colaborador_obras");

  // Filters
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [dataFim, setDataFim] = useState(() => new Date().toISOString().split("T")[0]);
  const [filtroFuncao, setFiltroFuncao] = useState("all");
  const [filtroTrabalhador, setFiltroTrabalhador] = useState("all");

  const obraAtual = obras.find((o) => o.id === selectedObraId) || obras[0];

  // Aggregate data
  const reportRows = useMemo(() => {
    const filtered = presencas.filter((p) => {
      if (selectedObraId && p.obra_id !== selectedObraId) return false;
      if (p.data < dataInicio || p.data > dataFim) return false;
      return true;
    });

    const grouped: Record<string, ReportRow> = {};

    for (const p of filtered) {
      const colab = colaboradores.find((c) => c.id === p.colaborador_id);
      if (!colab) continue;

      if (filtroFuncao !== "all" && colab.categoria !== filtroFuncao) continue;
      if (filtroTrabalhador !== "all" && colab.id !== filtroTrabalhador) continue;

      if (!grouped[colab.id]) {
        // Check for obra-specific daily rate
        const vinculo = vinculos.find(
          (v) => v.colaborador_id === colab.id && v.obra_id === (selectedObraId || p.obra_id) && v.ativo
        );
        const valorDiaria = vinculo?.valor_diaria_especial ?? colab.valor_diaria;

        grouped[colab.id] = {
          colaboradorId: colab.id,
          nome: colab.nome,
          funcao: CATEGORIAS[colab.categoria || ""] || colab.categoria || "—",
          valorDiaria: Number(valorDiaria),
          qtdDiarias: 0,
          horasExtra: 0,
          valorTotal: 0,
          pixChave: colab.pix_chave || "",
          pixTipo: colab.pix_tipo || "",
          presencas: 0,
          faltas: 0,
          faltasJustificadas: 0,
        };
      }

      const row = grouped[colab.id];

      if (p.tipo === "presente") {
        // Use valor_diaria_especial if set on the presence record, otherwise use the calculated rate
        const valorDia = p.valor_diaria_especial != null ? Number(p.valor_diaria_especial) : row.valorDiaria;
        row.qtdDiarias += 1;
        row.valorTotal += valorDia;
        row.presencas += 1;
      } else if (p.tipo === "hora_extra") {
        row.horasExtra += Number(p.horas_extra || 0);
        // Half-day logic: each extra hour = 0.125 of a daily rate (1h/8h)
        const extraValue = (Number(p.horas_extra || 0) / 8) * row.valorDiaria;
        row.valorTotal += extraValue;
        row.qtdDiarias += Number(p.horas_extra || 0) / 8;
      } else if (p.tipo === "falta_injustificada") {
        row.faltas += 1;
      } else if (p.tipo === "falta_justificada") {
        row.faltasJustificadas += 1;
      }
    }

    return Object.values(grouped).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [presencas, colaboradores, vinculos, selectedObraId, dataInicio, dataFim, filtroFuncao, filtroTrabalhador]);

  const subtotalGeral = reportRows.reduce((s, r) => s + r.valorTotal, 0);
  const totalDiarias = reportRows.reduce((s, r) => s + r.qtdDiarias, 0);
  const totalTrabalhadores = reportRows.length;

  // Operational data for the operational tab
  const operationalRows = useMemo(() => {
    return registros.filter((r) => {
      if (r.data_registro < dataInicio || r.data_registro > dataFim) return false;
      return true;
    });
  }, [registros, dataInicio, dataFim]);

  // ─── Export PDF ───
  const exportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("RELATÓRIO FINANCEIRO DE EQUIPE", 14, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Obra: ${obraAtual?.nome || "Todas"}`, 14, y);
    y += 5;
    doc.text(`Período: ${formatDate(dataInicio)} - ${formatDate(dataFim)}`, 14, y);
    y += 5;
    doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, y);
    y += 8;

    doc.setDrawColor(200);
    doc.line(14, y, pageWidth - 14, y);
    y += 6;

    if (reportRows.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [["Nome", "Função", "Diária (R$)", "Qtd Diárias", "Total (R$)", "PIX"]],
        body: reportRows.map((r) => [
          r.nome,
          r.funcao,
          `R$ ${r.valorDiaria.toFixed(2)}`,
          r.qtdDiarias % 1 === 0 ? r.qtdDiarias.toString() : r.qtdDiarias.toFixed(1),
          `R$ ${r.valorTotal.toFixed(2)}`,
          r.pixChave ? `${r.pixTipo}: ${r.pixChave}` : "—",
        ]),
        foot: [["", "", "", "SUBTOTAL", `R$ ${subtotalGeral.toFixed(2)}`, ""]],
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [41, 37, 36], textColor: 255 },
        footStyles: { fillColor: [245, 245, 244], textColor: [0, 0, 0], fontStyle: "bold" },
        margin: { left: 14 },
      });
    } else {
      doc.text("Nenhum dado encontrado para o período selecionado.", 14, y);
    }

    doc.save(`relatorio-equipe-${dataInicio}-${dataFim}.pdf`);
  };

  // ─── Export Excel ───
  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const wsData = [
      ["RELATÓRIO FINANCEIRO DE EQUIPE"],
      [`Obra: ${obraAtual?.nome || "Todas"}`],
      [`Período: ${formatDate(dataInicio)} - ${formatDate(dataFim)}`],
      [],
      ["Nome", "Função", "Diária (R$)", "Qtd Diárias", "Total (R$)", "PIX"],
      ...reportRows.map((r) => [
        r.nome,
        r.funcao,
        r.valorDiaria,
        r.qtdDiarias,
        r.valorTotal,
        r.pixChave ? `${r.pixTipo}: ${r.pixChave}` : "",
      ]),
      [],
      ["", "", "", "SUBTOTAL GERAL", subtotalGeral, ""],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mão de Obra");
    XLSX.writeFile(wb, `relatorio-equipe-${dataInicio}-${dataFim}.xlsx`);
  };

  // ─── Print ───
  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      <GlobalFilters />
      <SectionHeader
        title="Relatório de Mão de Obra"
        subtitle="Controle financeiro e operacional da equipe por período"
        icon={<FileText className="h-5 w-5" />}
      />

      {/* ─── Filter Bar ─── */}
      <div className="glass-card p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-muted-foreground">Filtros do Relatório</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Data Início</label>
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="h-9" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Data Fim</label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="h-9" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Função</label>
            <Select value={filtroFuncao} onValueChange={setFiltroFuncao}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as funções</SelectItem>
                {Object.entries(CATEGORIAS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Trabalhador</label>
            <Select value={filtroTrabalhador} onValueChange={setFiltroTrabalhador}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {colaboradores.filter((c) => c.ativo).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ─── KPIs ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard title="Trabalhadores" value={totalTrabalhadores} icon={<Users className="h-5 w-5" />} tooltip="Trabalhadores no período" />
        <KPICard title="Total Diárias" value={totalDiarias % 1 === 0 ? totalDiarias : totalDiarias.toFixed(1)} icon={<Calendar className="h-5 w-5" />} tooltip="Soma de todas as diárias" />
        <KPICard
          title="Subtotal Geral"
          value={`R$ ${subtotalGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          icon={<DollarSign className="h-5 w-5" />}
          tooltip="Valor total de mão de obra"
          status={subtotalGeral > 0 ? "ok" : "warning"}
        />
        <KPICard
          title="Média por Diária"
          value={totalDiarias > 0 ? `R$ ${(subtotalGeral / totalDiarias).toFixed(2)}` : "—"}
          icon={<DollarSign className="h-5 w-5" />}
          tooltip="Valor médio por diária paga"
        />
      </div>

      {/* ─── Tabs: Financeiro / Operacional ─── */}
      <Tabs defaultValue="financeiro" className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="financeiro">💰 Financeiro</TabsTrigger>
            <TabsTrigger value="operacional">📋 Operacional</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportPDF}>
              <Download className="h-4 w-4 mr-1" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={exportExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" /> Imprimir
            </Button>
          </div>
        </div>

        {/* ─── Financeiro Tab ─── */}
        <TabsContent value="financeiro">
          <div className="glass-card p-4 print:shadow-none" id="report-financeiro">
            {/* Report Header */}
            <div className="mb-4 pb-3 border-b border-border">
              <h2 className="text-base font-bold">Relatório Financeiro de Equipe</h2>
              <p className="text-sm text-muted-foreground">
                Obra: <span className="font-medium text-foreground">{obraAtual?.nome || "Todas"}</span>
                {" · "}
                Período: <span className="font-medium text-foreground">{formatDate(dataInicio)} - {formatDate(dataFim)}</span>
              </p>
            </div>

            {reportRows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhum registro de presença encontrado para os filtros selecionados.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-2 px-3">Nome</th>
                      <th className="text-left py-2 px-3">Função</th>
                      <th className="text-right py-2 px-3">Diária</th>
                      <th className="text-right py-2 px-3">Qtd Diárias</th>
                      <th className="text-right py-2 px-3">Total</th>
                      <th className="text-left py-2 px-3">PIX</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportRows.map((r) => (
                      <tr key={r.colaboradorId} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                        <td className="py-2.5 px-3 font-medium">{r.nome}</td>
                        <td className="py-2.5 px-3">
                          <Badge variant="outline" className="text-[10px]">{r.funcao}</Badge>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">R$ {r.valorDiaria.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          {r.qtdDiarias % 1 === 0 ? r.qtdDiarias : r.qtdDiarias.toFixed(1)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold">
                          R$ {r.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-xs text-muted-foreground">
                          {r.pixChave ? `${r.pixTipo}: ${r.pixChave}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/30">
                      <td colSpan={3} className="py-3 px-3 font-bold text-right">SUBTOTAL GERAL</td>
                      <td className="py-3 px-3 text-right font-mono font-bold">
                        {totalDiarias % 1 === 0 ? totalDiarias : totalDiarias.toFixed(1)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-primary">
                        R$ {subtotalGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ─── Operacional Tab ─── */}
        <TabsContent value="operacional">
          <div className="glass-card p-4">
            <div className="mb-4 pb-3 border-b border-border">
              <h2 className="text-base font-bold">Relatório Operacional</h2>
              <p className="text-sm text-muted-foreground">
                Controle de presença, produtividade e ocorrências
              </p>
            </div>

            {/* Operational summary per worker */}
            {reportRows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhum dado operacional encontrado para os filtros selecionados.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-2 px-3">Nome</th>
                      <th className="text-left py-2 px-3">Função</th>
                      <th className="text-right py-2 px-3">Presenças</th>
                      <th className="text-right py-2 px-3">Faltas</th>
                      <th className="text-right py-2 px-3">Faltas Just.</th>
                      <th className="text-right py-2 px-3">H. Extra</th>
                      <th className="text-left py-2 px-3">Assiduidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportRows.map((r) => {
                      const totalDias = r.presencas + r.faltas + r.faltasJustificadas;
                      const assiduidade = totalDias > 0 ? (r.presencas / totalDias) * 100 : 0;
                      return (
                        <tr key={r.colaboradorId} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                          <td className="py-2.5 px-3 font-medium">{r.nome}</td>
                          <td className="py-2.5 px-3">
                            <Badge variant="outline" className="text-[10px]">{r.funcao}</Badge>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">{r.presencas}</td>
                          <td className="py-2.5 px-3 text-right font-mono">{r.faltas}</td>
                          <td className="py-2.5 px-3 text-right font-mono">{r.faltasJustificadas}</td>
                          <td className="py-2.5 px-3 text-right font-mono">{r.horasExtra > 0 ? `+${r.horasExtra}h` : "—"}</td>
                          <td className="py-2.5 px-3">
                            <StatusBadge
                              status={assiduidade >= 90 ? "ok" : assiduidade >= 70 ? "warning" : "critical"}
                              label={`${assiduidade.toFixed(0)}%`}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}
