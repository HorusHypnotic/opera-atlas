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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTableData } from "@/hooks/useTableData";
import { useObra } from "@/hooks/useObra";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { usePermissions } from "@/hooks/usePermissions";
import { logAudit } from "@/lib/auditLog";
import {
  FileText, Download, Printer, DollarSign, Users, Calendar, Filter, FileSpreadsheet,
  Plus, Pencil, Trash2, RotateCcw,
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

interface ApontamentoDiaria {
  id: string;
  obra_id: string;
  colaborador_id: string;
  tenant_id: string;
  periodo_inicio: string;
  periodo_fim: string;
  quantidade_diarias: number;
  valor_diaria: number;
  observacao: string | null;
  created_at: string;
}

interface RegistroPresenca {
  id: string;
  colaborador_id: string;
  obra_id: string;
  data: string;
  tipo: string;
  fracao_diaria?: number;
  horas_extra: number;
  valor_diaria_usado: number | null;
  valor_diaria_especial: number | null;
  servico_especial: string | null;
  observacao: string | null;
}

interface ColaboradorObra {
  id: string;
  colaborador_id: string;
  obra_id: string;
  valor_diaria_especial: number | null;
  ativo: boolean;
}

interface ReportRow {
  colaboradorId: string;
  nome: string;
  funcao: string;
  valorDiaria: number;
  qtdDiarias: number;
  valorTotal: number;
  pixChave: string;
  pixTipo: string;
  observacao: string;
  fonte: "manual" | "presenca";
  // operational (from presence)
  presencas: number;
  faltas: number;
  faltasJustificadas: number;
  horasExtra: number;
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
  const { canInsert, canUpdate, canDelete } = usePermissions();
  const { data: colaboradores = [] } = useTableData<Colaborador>("colaboradores");
  const { data: apontamentos = [], insert: insertApontamento, update: updateApontamento, remove: removeApontamento } = useTableData<ApontamentoDiaria>("apontamento_diarias");
  const { data: presencas = [], insert: insertPresenca } = useTableData<RegistroPresenca>("registro_presencas");
  const { data: vinculos = [] } = useTableData<ColaboradorObra>("colaborador_obras");
  const { data: sequenciamento = [] } = useTableData<{ id: string; equipe: string; semana_inicio: number; semana_fim: number; status: string }>("sequenciamento_equipes");

  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [dataFim, setDataFim] = useState(() => new Date().toISOString().split("T")[0]);
  const [filtroFuncao, setFiltroFuncao] = useState("all");
  const [filtroTrabalhador, setFiltroTrabalhador] = useState("all");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formColaboradorId, setFormColaboradorId] = useState("");
  const [formQtdDiarias, setFormQtdDiarias] = useState("");
  const [formValorDiaria, setFormValorDiaria] = useState("");
  const [formObs, setFormObs] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; nome: string }>({ open: false, id: "", nome: "" });
  const [zerarConfirm, setZerarConfirm] = useState(false);

  const obraAtual = obras.find((o) => o.id === selectedObraId) || obras[0];

  const colabAtivos = useMemo(() => colaboradores.filter((c) => c.ativo), [colaboradores]);

  // ─── Build report rows ───
  // Priority: 1) manual apontamento_diarias  2) fallback to presence calc
  const reportRows = useMemo(() => {
    const rows: Record<string, ReportRow> = {};

    // 1) Manual entries (apontamento_diarias)
    const filteredApontamentos = apontamentos.filter((a) => {
      if (selectedObraId && a.obra_id !== selectedObraId) return false;
      // overlap check with filter period
      if (a.periodo_fim < dataInicio || a.periodo_inicio > dataFim) return false;
      return true;
    });

    for (const a of filteredApontamentos) {
      const colab = colaboradores.find((c) => c.id === a.colaborador_id);
      if (!colab) continue;
      if (filtroFuncao !== "all" && colab.categoria !== filtroFuncao) continue;
      if (filtroTrabalhador !== "all" && colab.id !== filtroTrabalhador) continue;

      if (!rows[colab.id]) {
        rows[colab.id] = makeEmptyRow(colab);
      }
      const row = rows[colab.id];
      row.fonte = "manual";
      row.qtdDiarias += Number(a.quantidade_diarias);
      row.valorDiaria = Number(a.valor_diaria);
      row.valorTotal += Number(a.quantidade_diarias) * Number(a.valor_diaria);
      if (a.observacao) row.observacao = a.observacao;
    }

    // 2) Fallback: presence-based for workers WITHOUT manual entries
    const filteredPresencas = presencas.filter((p) => {
      if (selectedObraId && p.obra_id !== selectedObraId) return false;
      if (p.data < dataInicio || p.data > dataFim) return false;
      return true;
    });

    for (const p of filteredPresencas) {
      const colab = colaboradores.find((c) => c.id === p.colaborador_id);
      if (!colab) continue;
      if (filtroFuncao !== "all" && colab.categoria !== filtroFuncao) continue;
      if (filtroTrabalhador !== "all" && colab.id !== filtroTrabalhador) continue;

      // Always track operational data
      if (!rows[colab.id]) {
        rows[colab.id] = makeEmptyRow(colab);
      }
      const row = rows[colab.id];

      // Operational tracking — usa fracao_diaria como verdade
      const fracao = p.fracao_diaria != null
        ? Number(p.fracao_diaria)
        : (p.tipo === "falta" || p.tipo === "falta_injustificada" || p.tipo === "falta_justificada" ? 0
          : p.tipo === "meio_periodo" ? 0.5 : 1);

      if (p.tipo === "hora_extra") {
        row.horasExtra += Number(p.horas_extra || 0);
      } else if (p.tipo === "falta_justificada") {
        row.faltasJustificadas += 1;
      } else if (fracao === 0) {
        row.faltas += 1;
      } else {
        row.presencas += fracao; // 0.5 conta como meia presença
      }

      // Financial fallback only if no manual entry
      if (row.fonte === "manual") continue;

      const vinculo = vinculos.find(
        (v) => v.colaborador_id === colab.id && v.obra_id === (selectedObraId || p.obra_id) && v.ativo
      );
      const valorDiaria = vinculo?.valor_diaria_especial ?? colab.valor_diaria;
      row.valorDiaria = Number(valorDiaria);

      if (fracao > 0 && p.tipo !== "hora_extra") {
        const valorBase = p.valor_diaria_especial != null ? Number(p.valor_diaria_especial) : Number(valorDiaria);
        row.qtdDiarias += fracao;
        row.valorTotal += valorBase * fracao;
      } else if (p.tipo === "hora_extra") {
        const extraValue = (Number(p.horas_extra || 0) / 8) * Number(valorDiaria);
        row.valorTotal += extraValue;
        row.qtdDiarias += Number(p.horas_extra || 0) / 8;
      }
    }

    return Object.values(rows).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [apontamentos, presencas, colaboradores, vinculos, selectedObraId, dataInicio, dataFim, filtroFuncao, filtroTrabalhador]);

  function makeEmptyRow(colab: Colaborador): ReportRow {
    return {
      colaboradorId: colab.id,
      nome: colab.nome,
      funcao: CATEGORIAS[colab.categoria || ""] || colab.categoria || "—",
      valorDiaria: Number(colab.valor_diaria),
      qtdDiarias: 0,
      valorTotal: 0,
      pixChave: colab.pix_chave || "",
      pixTipo: colab.pix_tipo || "",
      observacao: "",
      fonte: "presenca",
      presencas: 0,
      faltas: 0,
      faltasJustificadas: 0,
      horasExtra: 0,
    };
  }

  const subtotalGeral = reportRows.reduce((s, r) => s + r.valorTotal, 0);
  const totalDiarias = reportRows.reduce((s, r) => s + r.qtdDiarias, 0);
  const totalTrabalhadores = reportRows.length;

  // ─── Apontamentos for current period ───
  const apontamentosPeriodo = useMemo(() => {
    return apontamentos.filter((a) => {
      if (selectedObraId && a.obra_id !== selectedObraId) return false;
      if (a.periodo_fim < dataInicio || a.periodo_inicio > dataFim) return false;
      return true;
    });
  }, [apontamentos, selectedObraId, dataInicio, dataFim]);

  // ─── CRUD handlers ───
  const openNewDialog = () => {
    setEditingId(null);
    setFormColaboradorId("");
    setFormQtdDiarias("");
    setFormValorDiaria("");
    setFormObs("");
    setDialogOpen(true);
  };

  const openEditDialog = (a: ApontamentoDiaria) => {
    setEditingId(a.id);
    setFormColaboradorId(a.colaborador_id);
    setFormQtdDiarias(String(a.quantidade_diarias));
    setFormValorDiaria(String(a.valor_diaria));
    setFormObs(a.observacao || "");
    setDialogOpen(true);
  };

  const handleColabChange = (colabId: string) => {
    setFormColaboradorId(colabId);
    if (!formValorDiaria) {
      const colab = colaboradores.find((c) => c.id === colabId);
      if (colab) {
        const vinculo = vinculos.find((v) => v.colaborador_id === colabId && v.obra_id === selectedObraId && v.ativo);
        setFormValorDiaria(String(vinculo?.valor_diaria_especial ?? colab.valor_diaria));
      }
    }
  };

  const handleSave = async () => {
    if (!formColaboradorId || !formQtdDiarias || !formValorDiaria) {
      toast.error("Preencha trabalhador, quantidade e valor da diária");
      return;
    }
    const payload = {
      obra_id: selectedObraId || obraAtual?.id,
      colaborador_id: formColaboradorId,
      periodo_inicio: dataInicio,
      periodo_fim: dataFim,
      quantidade_diarias: parseFloat(formQtdDiarias),
      valor_diaria: parseFloat(formValorDiaria),
      observacao: formObs || null,
    };

    if (editingId) {
      const { error } = await updateApontamento(editingId, payload);
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Apontamento atualizado");
    } else {
      const { error } = await insertApontamento(payload);
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Apontamento registrado");
    }
    setDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    await removeApontamento(id);
    await logAudit({ action: "DELETE_DIARIA", target_type: "apontamento_diarias", target_id: id });
  };

  const handleZerarQuinzena = async () => {
    if (apontamentosPeriodo.length === 0) {
      toast.info("Não há apontamentos para zerar neste período");
      return;
    }
    let errors = 0;
    for (const a of apontamentosPeriodo) {
      await removeApontamento(a.id);
    }
    await logAudit({
      action: "ZERAR_DIARIAS",
      target_type: "apontamento_diarias",
      metadata: { periodo_inicio: dataInicio, periodo_fim: dataFim, qtd_removidos: apontamentosPeriodo.length },
    });
    toast.success(`${apontamentosPeriodo.length} apontamentos zerados para nova quinzena`);
  };

  // ─── Quick presence (1-click for today) ───
  const hojeStr = new Date().toISOString().split("T")[0];
  const presencasHoje = useMemo(() => {
    const map: Record<string, RegistroPresenca | undefined> = {};
    for (const p of presencas) {
      if (p.data === hojeStr && (!selectedObraId || p.obra_id === selectedObraId)) {
        map[p.colaborador_id] = p;
      }
    }
    return map;
  }, [presencas, selectedObraId, hojeStr]);

  const registrarPresencaRapida = async (colaboradorId: string, fracao: 0 | 0.5 | 1) => {
    if (!selectedObraId) {
      toast.error("Selecione uma obra primeiro");
      return;
    }
    if (presencasHoje[colaboradorId]) {
      toast.info("Presença de hoje já registrada — edite na aba Operacional se precisar mudar");
      return;
    }
    const tipo = fracao === 0 ? "falta" : fracao === 0.5 ? "meio_periodo" : "presente";
    const colab = colaboradores.find((c) => c.id === colaboradorId);
    const vinculo = vinculos.find((v) => v.colaborador_id === colaboradorId && v.obra_id === selectedObraId && v.ativo);
    const valorDiaria = vinculo?.valor_diaria_especial ?? colab?.valor_diaria ?? 0;

    const { error } = await insertPresenca({
      colaborador_id: colaboradorId,
      obra_id: selectedObraId,
      data: hojeStr,
      tipo,
      fracao_diaria: fracao,
      valor_diaria_usado: Number(valorDiaria),
    } as any);
    if (error) {
      toast.error("Erro ao registrar: " + error.message);
      return;
    }
    const label = fracao === 0 ? "Falta" : fracao === 0.5 ? "½ diária" : "1 diária";
    toast.success(`${label} registrada para ${colab?.nome || "colaborador"}`);
  };

  // ─── Build per-obra report rows (used when no obra selected) ───
  const buildRowsForObra = (obraId: string): ReportRow[] => {
    const rows: Record<string, ReportRow> = {};

    const filteredApontamentos = apontamentos.filter((a) => {
      if (a.obra_id !== obraId) return false;
      if (a.periodo_fim < dataInicio || a.periodo_inicio > dataFim) return false;
      return true;
    });
    for (const a of filteredApontamentos) {
      const colab = colaboradores.find((c) => c.id === a.colaborador_id);
      if (!colab) continue;
      if (filtroFuncao !== "all" && colab.categoria !== filtroFuncao) continue;
      if (filtroTrabalhador !== "all" && colab.id !== filtroTrabalhador) continue;
      if (!rows[colab.id]) rows[colab.id] = makeEmptyRow(colab);
      const row = rows[colab.id];
      row.fonte = "manual";
      row.qtdDiarias += Number(a.quantidade_diarias);
      row.valorDiaria = Number(a.valor_diaria);
      row.valorTotal += Number(a.quantidade_diarias) * Number(a.valor_diaria);
      if (a.observacao) row.observacao = a.observacao;
    }

    const filteredPresencas = presencas.filter((p) => {
      if (p.obra_id !== obraId) return false;
      if (p.data < dataInicio || p.data > dataFim) return false;
      return true;
    });
    for (const p of filteredPresencas) {
      const colab = colaboradores.find((c) => c.id === p.colaborador_id);
      if (!colab) continue;
      if (filtroFuncao !== "all" && colab.categoria !== filtroFuncao) continue;
      if (filtroTrabalhador !== "all" && colab.id !== filtroTrabalhador) continue;
      if (!rows[colab.id]) rows[colab.id] = makeEmptyRow(colab);
      const row = rows[colab.id];

      const fracao = p.fracao_diaria != null
        ? Number(p.fracao_diaria)
        : (p.tipo === "falta" || p.tipo === "falta_injustificada" || p.tipo === "falta_justificada" ? 0
          : p.tipo === "meio_periodo" ? 0.5 : 1);

      if (p.tipo === "hora_extra") row.horasExtra += Number(p.horas_extra || 0);
      else if (p.tipo === "falta_justificada") row.faltasJustificadas += 1;
      else if (fracao === 0) row.faltas += 1;
      else row.presencas += fracao;

      if (row.fonte === "manual") continue;

      const vinculo = vinculos.find((v) => v.colaborador_id === colab.id && v.obra_id === obraId && v.ativo);
      const valorDiaria = vinculo?.valor_diaria_especial ?? colab.valor_diaria;
      row.valorDiaria = Number(valorDiaria);

      if (fracao > 0 && p.tipo !== "hora_extra") {
        const valorBase = p.valor_diaria_especial != null ? Number(p.valor_diaria_especial) : Number(valorDiaria);
        row.qtdDiarias += fracao;
        row.valorTotal += valorBase * fracao;
      } else if (p.tipo === "hora_extra") {
        const extraValue = (Number(p.horas_extra || 0) / 8) * Number(valorDiaria);
        row.valorTotal += extraValue;
        row.qtdDiarias += Number(p.horas_extra || 0) / 8;
      }
    }

    return Object.values(rows).sort((a, b) => a.nome.localeCompare(b.nome));
  };

  const buildReportBlocks = () => {
    if (selectedObraId) {
      return [{
        obraNome: obraAtual?.nome || "Obra",
        rows: reportRows,
        subtotal: subtotalGeral,
        totalDiarias,
      }];
    }
    const obraIds = new Set<string>();
    apontamentos.forEach((a) => { if (a.periodo_fim >= dataInicio && a.periodo_inicio <= dataFim) obraIds.add(a.obra_id); });
    presencas.forEach((p) => { if (p.data >= dataInicio && p.data <= dataFim) obraIds.add(p.obra_id); });
    return Array.from(obraIds)
      .map((obraId) => {
        const obra = obras.find((o) => o.id === obraId);
        const rows = buildRowsForObra(obraId);
        const sub = rows.reduce((s, r) => s + r.valorTotal, 0);
        const td = rows.reduce((s, r) => s + r.qtdDiarias, 0);
        return { obraNome: obra?.nome || "Obra desconhecida", rows, subtotal: sub, totalDiarias: td };
      })
      .filter((b) => b.rows.length > 0)
      .sort((a, b) => a.obraNome.localeCompare(b.obraNome));
  };

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
    doc.text(`Obra: ${selectedObraId ? (obraAtual?.nome || "—") : "Todas as obras"}`, 14, y); y += 5;
    doc.text(`Período: ${formatDate(dataInicio)} - ${formatDate(dataFim)}`, 14, y); y += 5;
    doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, y); y += 8;

    doc.setDrawColor(200);
    doc.line(14, y, pageWidth - 14, y);
    y += 6;

    const blocks = buildReportBlocks();

    if (blocks.length === 0) {
      doc.text("Nenhum dado encontrado para o período selecionado.", 14, y);
      doc.save(`relatorio-equipe-${dataInicio}-${dataFim}.pdf`);
      return;
    }

    let totalGeralValor = 0;
    let totalGeralDiarias = 0;

    blocks.forEach((block, idx) => {
      const lastY = (doc as any).lastAutoTable?.finalY;
      let titleY = idx === 0 ? y : (lastY ? lastY + 10 : y);
      if (titleY > doc.internal.pageSize.getHeight() - 40) {
        doc.addPage();
        titleY = 20;
      }

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`Obra: ${block.obraNome}`, 14, titleY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      autoTable(doc, {
        startY: titleY + 3,
        head: [["Nome", "Função", "Diária (R$)", "Qtd Diárias", "Total (R$)", "PIX"]],
        body: block.rows.map((r) => [
          r.nome, r.funcao,
          `R$ ${r.valorDiaria.toFixed(2)}`,
          r.qtdDiarias % 1 === 0 ? r.qtdDiarias.toString() : r.qtdDiarias.toFixed(1),
          `R$ ${r.valorTotal.toFixed(2)}`,
          r.pixChave ? `${r.pixTipo}: ${r.pixChave}` : "—",
        ]),
        foot: [["", "", "", `Subtotal: ${block.totalDiarias.toFixed(1)}`, `R$ ${block.subtotal.toFixed(2)}`, ""]],
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [41, 37, 36], textColor: 255 },
        footStyles: { fillColor: [245, 245, 244], textColor: [0, 0, 0], fontStyle: "bold" },
        margin: { left: 14 },
      });

      totalGeralValor += block.subtotal;
      totalGeralDiarias += block.totalDiarias;
    });

    if (blocks.length > 1) {
      const finalY = (doc as any).lastAutoTable?.finalY || y;
      let tgY = finalY + 10;
      if (tgY > doc.internal.pageSize.getHeight() - 20) { doc.addPage(); tgY = 20; }
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`TOTAL GERAL — ${totalGeralDiarias.toFixed(1)} diárias — R$ ${totalGeralValor.toFixed(2)}`, 14, tgY);
    }

    doc.save(`relatorio-equipe-${dataInicio}-${dataFim}.pdf`);
  };

  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const blocks = buildReportBlocks();
    const wsData: any[][] = [
      ["RELATÓRIO FINANCEIRO DE EQUIPE"],
      [`Obra: ${selectedObraId ? (obraAtual?.nome || "—") : "Todas as obras"}`],
      [`Período: ${formatDate(dataInicio)} - ${formatDate(dataFim)}`],
      [],
    ];

    let totalGeralValor = 0;
    let totalGeralDiarias = 0;

    blocks.forEach((block) => {
      wsData.push([`Obra: ${block.obraNome}`]);
      wsData.push(["Nome", "Função", "Diária (R$)", "Qtd Diárias", "Total (R$)", "PIX"]);
      block.rows.forEach((r) => {
        wsData.push([
          r.nome, r.funcao, r.valorDiaria, r.qtdDiarias, r.valorTotal,
          r.pixChave ? `${r.pixTipo}: ${r.pixChave}` : "",
        ]);
      });
      wsData.push(["", "", "", `Subtotal: ${block.totalDiarias.toFixed(1)}`, block.subtotal, ""]);
      wsData.push([]);
      totalGeralValor += block.subtotal;
      totalGeralDiarias += block.totalDiarias;
    });

    if (blocks.length > 1) {
      wsData.push(["", "", "", `TOTAL GERAL (${totalGeralDiarias.toFixed(1)} diárias)`, totalGeralValor, ""]);
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mão de Obra");
    XLSX.writeFile(wb, `relatorio-equipe-${dataInicio}-${dataFim}.xlsx`);
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
              <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
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
              <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {colabAtivos.map((c) => (
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

      {/* ─── Tabs ─── */}
      <Tabs defaultValue="financeiro" className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="financeiro">💰 Financeiro</TabsTrigger>
            {canInsert && <TabsTrigger value="apontamentos">📝 Apontamentos</TabsTrigger>}
            <TabsTrigger value="operacional">📋 Operacional</TabsTrigger>
            <TabsTrigger value="sequenciamento">🔄 Sequenciamento</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportPDF}>
              <Download className="h-4 w-4 mr-1" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={exportExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-1" /> Imprimir
            </Button>
          </div>
        </div>

        {/* ─── Financeiro Tab ─── */}
        <TabsContent value="financeiro">
          <div className="glass-card p-4 print:shadow-none">
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
                Nenhum registro encontrado. Use a aba "Apontamentos" para lançar diárias manualmente.
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
                      <th className="text-center py-2 px-3">Fonte</th>
                      {canInsert && <th className="text-center py-2 px-3 print:hidden">Hoje</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {reportRows.map((r) => {
                      const presHoje = presencasHoje[r.colaboradorId];
                      const fracaoHoje = presHoje
                        ? (presHoje.fracao_diaria != null
                            ? Number(presHoje.fracao_diaria)
                            : (presHoje.tipo === "falta" ? 0 : presHoje.tipo === "meio_periodo" ? 0.5 : 1))
                        : null;
                      return (
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
                        <td className="py-2.5 px-3 text-center">
                          <Badge variant={r.fonte === "manual" ? "default" : "secondary"} className="text-[10px]">
                            {r.fonte === "manual" ? "Manual" : "Presença"}
                          </Badge>
                        </td>
                        {canInsert && (
                          <td className="py-2 px-3 text-center print:hidden">
                            {presHoje ? (
                              <Badge
                                variant={fracaoHoje === 0 ? "destructive" : fracaoHoje === 0.5 ? "secondary" : "default"}
                                className="text-[10px]"
                              >
                                {fracaoHoje === 0 ? "Falta" : fracaoHoje === 0.5 ? "½ hoje" : "✓ hoje"}
                              </Badge>
                            ) : (
                              <div className="inline-flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => registrarPresencaRapida(r.colaboradorId, 1)}
                                  title="Registrar 1 diária para hoje"
                                >
                                  +1
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => registrarPresencaRapida(r.colaboradorId, 0.5)}
                                  title="Registrar meia diária para hoje"
                                >
                                  ½
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                                  onClick={() => registrarPresencaRapida(r.colaboradorId, 0)}
                                  title="Registrar falta para hoje"
                                >
                                  ✕
                                </Button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                      );
                    })}
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
                      <td colSpan={canInsert ? 3 : 2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ─── Apontamentos Tab (CRUD) ─── */}
        <TabsContent value="apontamentos">
          <div className="glass-card p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-border">
              <div>
                <h2 className="text-base font-bold">Apontamento de Diárias</h2>
                <p className="text-sm text-muted-foreground">
                  Lançamento manual de diárias por trabalhador — usado como fonte principal do relatório financeiro.
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                {canDelete && apontamentosPeriodo.length > 0 && (
                  <Button size="sm" variant="outline" className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setZerarConfirm(true)}>
                    <RotateCcw className="h-3.5 w-3.5" /> Zerar Quinzena
                  </Button>
                )}
                {canInsert && (
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" onClick={openNewDialog}>
                      <Plus className="h-4 w-4 mr-1" /> Novo Apontamento
                    </Button>
                  </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingId ? "Editar Apontamento" : "Novo Apontamento de Diárias"}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Trabalhador</Label>
                      <Select value={formColaboradorId} onValueChange={handleColabChange}>
                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          {colabAtivos.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.nome} — {CATEGORIAS[c.categoria || ""] || c.categoria || "—"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Qtd Diárias</Label>
                        <Input
                          type="number"
                          step="0.5"
                          min="0"
                          placeholder="Ex: 4.5"
                          value={formQtdDiarias}
                          onChange={(e) => setFormQtdDiarias(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Valor da Diária (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Ex: 170.00"
                          value={formValorDiaria}
                          onChange={(e) => setFormValorDiaria(e.target.value)}
                        />
                      </div>
                    </div>
                    {formQtdDiarias && formValorDiaria && (
                      <div className="p-3 rounded-md bg-muted/50 text-sm">
                        <span className="text-muted-foreground">Total calculado: </span>
                        <span className="font-bold text-primary">
                          R$ {(parseFloat(formQtdDiarias || "0") * parseFloat(formValorDiaria || "0")).toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div>
                      <Label>Observação</Label>
                      <Textarea
                        placeholder="Observação opcional..."
                        value={formObs}
                        onChange={(e) => setFormObs(e.target.value)}
                      />
                    </div>
                    <Button className="w-full" onClick={handleSave}>
                      {editingId ? "Salvar Alterações" : "Registrar Apontamento"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
                )}
              </div>
            </div>

            {apontamentosPeriodo.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhum apontamento de diária para o período selecionado. Clique em "Novo Apontamento" para começar.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-2 px-3">Trabalhador</th>
                      <th className="text-right py-2 px-3">Diária</th>
                      <th className="text-right py-2 px-3">Qtd</th>
                      <th className="text-right py-2 px-3">Total</th>
                      <th className="text-left py-2 px-3">Obs</th>
                      <th className="text-center py-2 px-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apontamentosPeriodo.map((a) => {
                      const colab = colaboradores.find((c) => c.id === a.colaborador_id);
                      const total = Number(a.quantidade_diarias) * Number(a.valor_diaria);
                      return (
                        <tr key={a.id} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                          <td className="py-2.5 px-3 font-medium">{colab?.nome || "—"}</td>
                          <td className="py-2.5 px-3 text-right font-mono">R$ {Number(a.valor_diaria).toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-right font-mono">{Number(a.quantidade_diarias) % 1 === 0 ? Number(a.quantidade_diarias) : Number(a.quantidade_diarias).toFixed(1)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold">R$ {total.toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-xs text-muted-foreground max-w-[150px] truncate">{a.observacao || "—"}</td>
                          <td className="py-2.5 px-3 text-center">
                            {(canUpdate || canDelete) && (
                            <div className="flex items-center justify-center gap-1">
                              {canUpdate && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(a)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              )}
                              {canDelete && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => {
                                const colab = colaboradores.find((c) => c.id === a.colaborador_id);
                                setDeleteConfirm({ open: true, id: a.id, nome: colab?.nome || "—" });
                              }}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                              )}
                            </div>
                            )}
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

        {/* ─── Operacional Tab ─── */}
        <TabsContent value="operacional">
          <div className="glass-card p-4">
            <div className="mb-4 pb-3 border-b border-border">
              <h2 className="text-base font-bold">Relatório Operacional</h2>
              <p className="text-sm text-muted-foreground">
                Controle de presença, produtividade e ocorrências (baseado em registros de presença)
              </p>
            </div>

            {reportRows.filter(r => r.presencas + r.faltas + r.faltasJustificadas > 0).length === 0 ? (
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
                    {reportRows.filter(r => r.presencas + r.faltas + r.faltasJustificadas > 0).map((r) => {
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

        {/* ─── Sequenciamento Tab ─── */}
        <TabsContent value="sequenciamento">
          <div className="glass-card p-4">
            <div className="mb-4 pb-3 border-b border-border">
              <h2 className="text-base font-bold">Sequenciamento de Equipes</h2>
              <p className="text-sm text-muted-foreground">
                Planejamento e status das equipes na obra atual
              </p>
            </div>

            {sequenciamento.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhum sequenciamento cadastrado para esta obra. Cadastre em Redução de Perdas.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-2 px-3">Equipe</th>
                      <th className="text-center py-2 px-3">Semana Início</th>
                      <th className="text-center py-2 px-3">Semana Fim</th>
                      <th className="text-center py-2 px-3">Duração</th>
                      <th className="text-center py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sequenciamento.map((eq) => {
                      const duracao = eq.semana_fim - eq.semana_inicio + 1;
                      const statusColor = eq.status === "concluido" ? "bg-status-ok/20 text-status-ok" : eq.status === "em_andamento" ? "bg-chart-4/20 text-chart-4" : "bg-muted text-muted-foreground";
                      const statusLabel = eq.status === "concluido" ? "Concluído" : eq.status === "em_andamento" ? "Em Andamento" : "Planejado";
                      return (
                        <tr key={eq.id} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                          <td className="py-2.5 px-3 font-medium">{eq.equipe}</td>
                          <td className="py-2.5 px-3 text-center font-mono">{eq.semana_inicio}</td>
                          <td className="py-2.5 px-3 text-center font-mono">{eq.semana_fim}</td>
                          <td className="py-2.5 px-3 text-center font-mono">{duracao} sem.</td>
                          <td className="py-2.5 px-3 text-center">
                            <Badge className={`${statusColor} text-[10px]`}>{statusLabel}</Badge>
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

      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(v) => setDeleteConfirm(prev => ({ ...prev, open: v }))}
        title="Excluir Apontamento"
        description={`Deseja excluir o apontamento de diária de "${deleteConfirm.nome}"?`}
        onConfirm={() => handleDelete(deleteConfirm.id)}
      />

      <ConfirmDialog
        open={zerarConfirm}
        onOpenChange={setZerarConfirm}
        title="Zerar Diárias da Quinzena"
        description={`Esta ação irá remover TODOS os ${apontamentosPeriodo.length} apontamentos do período ${formatDate(dataInicio)} - ${formatDate(dataFim)}. Essa ação é irreversível.`}
        confirmText="ZERAR"
        onConfirm={handleZerarQuinzena}
      />
    </div>
  );
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}
