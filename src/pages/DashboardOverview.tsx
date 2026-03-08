import { KPICard } from "@/components/dashboard/KPICard";
import { GlobalFilters } from "@/components/dashboard/GlobalFilters";
import { useTableData } from "@/hooks/useTableData";
import { useObra } from "@/hooks/useObra";
import { useAuth } from "@/hooks/useAuth";
import { Users, Package, Wrench, ShieldAlert, TrendingUp, ShieldCheck, DollarSign, Heart, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { exportOperaReport } from "@/utils/exportOperaReport";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { AnalyticsAlerts } from "@/components/dashboard/AnalyticsAlerts";
import { OperaScoreCard } from "@/components/dashboard/OperaScoreCard";

export default function DashboardOverview() {
  const navigate = useNavigate();
  const { obras, selectedObra } = useObra();
  const { profile } = useAuth();

  const { data: registros = [] } = useTableData("registros_diarios");
  const { data: consumo = [] } = useTableData("consumo_materiais");
  const { data: ativos = [] } = useTableData("ativos");
  const { data: riscos = [] } = useTableData("riscos");
  const { data: retrabalhos = [] } = useTableData("retrabalhos");
  const { data: lancamentos = [] } = useTableData("lancamentos_financeiros");
  const { data: incidentes = [] } = useTableData("incidentes_seguranca");
  const { data: sequenciamento = [] } = useTableData("sequenciamento_equipes");
  const { data: logistica = [] } = useTableData("logistica_interna");
  const { data: ciclos = [] } = useTableData("ciclos_tarefa");
  const { data: aditivos = [] } = useTableData("aditivos_contratuais");

  const totalReceitas = lancamentos.filter((l: any) => l.tipo === "receita").reduce((s: number, l: any) => s + Number(l.valor), 0);
  const totalCustos = lancamentos.filter((l: any) => l.tipo === "custo").reduce((s: number, l: any) => s + Number(l.valor), 0);
  const saldo = totalReceitas - totalCustos;
  const margem = totalReceitas > 0 ? ((saldo / totalReceitas) * 100) : 0;

  const desperdicioTotal = consumo.length > 0
    ? consumo.reduce((acc: number, m: any) => acc + (m.previsto > 0 ? ((m.real_consumo - m.previsto) / m.previsto) * 100 : 0), 0) / consumo.length
    : 0;

  const ociosTotal = ativos.filter((f: any) => f.status === "ocioso").reduce((s: number, f: any) => s + Number(f.valor), 0);
  const ativosPercent = ativos.length > 0 ? (ativos.filter((f: any) => f.status === "ativo").length / ativos.length * 100) : 0;

  const ncs = incidentes.filter((i: any) => i.tipo === "nc");
  const ncAbertas = ncs.filter((i: any) => i.status === "aberto").length;
  const inspecoes = incidentes.filter((i: any) => i.tipo === "inspecao");
  const inspecoesAprovadas = inspecoes.filter((i: any) => i.status === "aprovado").length;
  const inspecoesPercent = inspecoes.length > 0 ? (inspecoesAprovadas / inspecoes.length * 100) : 100;

  const acidentes = incidentes.filter((i: any) => i.tipo === "acidente");
  const lastAcidente = acidentes.sort((a: any, b: any) => b.data.localeCompare(a.data))[0];
  const diasSemAcidente = lastAcidente
    ? Math.floor((Date.now() - new Date(lastAcidente.data).getTime()) / (1000 * 60 * 60 * 24))
    : incidentes.length > 0 ? 999 : 0;

  const handleExportPDF = () => {
    exportOperaReport({
      obraNome: selectedObra?.nome || "Todas as obras",
      responsavel: profile?.full_name || profile?.email || "—",
      data: new Date().toLocaleDateString("pt-BR"),
      registros, consumo, ativos, riscos, retrabalhos, lancamentos, incidentes,
      logistica, ciclos, aditivos,
    });
  };

  const sections = [
    {
      letter: "O", title: "Organização", subtitle: "Mão de Obra", icon: <Users className="h-5 w-5" />, url: "/organizacao",
      kpi: `${registros.length} registros`, status: registros.length === 0 ? "warning" as const : "ok" as const,
    },
    {
      letter: "P", title: "Padronização", subtitle: "Insumos", icon: <Package className="h-5 w-5" />, url: "/padronizacao",
      kpi: `Desp: ${desperdicioTotal.toFixed(1)}%`, status: desperdicioTotal > 5 ? "warning" as const : "ok" as const,
    },
    {
      letter: "E", title: "Eficiência", subtitle: "Ativos", icon: <Wrench className="h-5 w-5" />, url: "/eficiencia",
      kpi: `${ativos.length} ativos`, status: ativosPercent >= 80 ? "ok" as const : "warning" as const,
    },
    {
      letter: "R", title: "Redução de Perdas", subtitle: "Improdutividade", icon: <ShieldAlert className="h-5 w-5" />, url: "/reducao-perdas",
      kpi: `${riscos.length} riscos`, status: riscos.length > 3 ? "critical" as const : "ok" as const,
    },
    {
      letter: "A", title: "Análise Contínua", subtitle: "Financeiro", icon: <TrendingUp className="h-5 w-5" />, url: "/analise-continua",
      kpi: `Margem: ${margem.toFixed(1)}%`, status: margem > 15 ? "ok" as const : margem > 10 ? "warning" as const : "critical" as const,
    },
  ];

  return (
    <div>
      <GlobalFilters />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard O.P.E.R.A.</h1>
          <p className="text-sm text-muted-foreground">Visão consolidada de todos os indicadores da obra</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportPDF}>
          <FileText className="h-4 w-4" /> Exportar PDF
        </Button>
      </div>

      <OperaScoreCard registros={registros} consumo={consumo} ativos={ativos} riscos={riscos} retrabalhos={retrabalhos} lancamentos={lancamentos} incidentes={incidentes} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPICard title="Saldo Financeiro" value={`R$ ${(saldo / 1000).toFixed(0)}k`} icon={<DollarSign className="h-5 w-5" />} tooltip="Receitas - Custos" status={saldo >= 0 ? "ok" : "critical"} />
        <KPICard title="Obras Cadastradas" value={obras.length} icon={<TrendingUp className="h-5 w-5" />} tooltip="Total de obras no sistema" status="ok" />
        <KPICard title="Dias Sem Acidente" value={diasSemAcidente} icon={<Heart className="h-5 w-5" />} tooltip="Dias consecutivos sem acidentes" status="ok" />
        <KPICard title="Inspeções Aprovadas" value={`${inspecoesPercent.toFixed(0)}%`} icon={<ShieldCheck className="h-5 w-5" />} tooltip="Aprovadas na primeira tentativa" status={inspecoesPercent >= 90 ? "ok" : "warning"} />
      </div>

      <DashboardCharts registros={registros} consumo={consumo} lancamentos={lancamentos} incidentes={incidentes} />

      <AnalyticsAlerts registros={registros} consumo={consumo} retrabalhos={retrabalhos} sequenciamento={sequenciamento} />

      <h2 className="text-lg font-semibold mb-4">Módulos O.P.E.R.A.</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {sections.map((s) => (
          <button key={s.letter} onClick={() => navigate(s.url)} className="glass-card p-5 text-left hover:border-primary/50 transition-all group cursor-pointer">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-8 h-8 rounded-lg bg-primary/20 text-primary font-bold text-lg flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">{s.letter}</span>
              <div className="text-primary">{s.icon}</div>
            </div>
            <h3 className="font-semibold text-sm mb-0.5">{s.title}</h3>
            <p className="text-xs text-muted-foreground mb-3">{s.subtitle}</p>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-semibold ${
              s.status === "ok" ? "bg-status-ok/15 text-status-ok" :
              s.status === "warning" ? "bg-status-warning/15 text-status-warning" :
              "bg-status-critical/15 text-status-critical"
            }`}>{s.kpi}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
