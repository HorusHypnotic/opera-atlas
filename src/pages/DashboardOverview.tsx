import { KPICard } from "@/components/dashboard/KPICard";
import { GlobalFilters } from "@/components/dashboard/GlobalFilters";
import { laborKPIs, insumosKPIs, ativosKPIs, perdasKPIs, financeiroKPIs, segurancaKPIs } from "@/data/mockData";
import { Users, Package, Wrench, ShieldAlert, TrendingUp, ShieldCheck, DollarSign, Heart, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const sections = [
  {
    letter: "O",
    title: "Organização",
    subtitle: "Mão de Obra",
    icon: <Users className="h-5 w-5" />,
    url: "/organizacao",
    kpi: `Desvio: ${laborKPIs.desvioPercent}%`,
    status: laborKPIs.desvioPercent > 10 ? "critical" as const : "warning" as const,
  },
  {
    letter: "P",
    title: "Padronização",
    subtitle: "Insumos",
    icon: <Package className="h-5 w-5" />,
    url: "/padronizacao",
    kpi: `Desperdício: ${insumosKPIs.desperdicioPercent}%`,
    status: insumosKPIs.desperdicioPercent > 5 ? "warning" as const : "ok" as const,
  },
  {
    letter: "E",
    title: "Eficiência",
    subtitle: "Ativos",
    icon: <Wrench className="h-5 w-5" />,
    url: "/eficiencia",
    kpi: `Produtivo: ${ativosKPIs.tempoProdutivoPercent}%`,
    status: ativosKPIs.tempoProdutivoPercent >= 80 ? "ok" as const : "warning" as const,
  },
  {
    letter: "R",
    title: "Redução de Perdas",
    subtitle: "Improdutividade",
    icon: <ShieldAlert className="h-5 w-5" />,
    url: "/reducao-perdas",
    kpi: `Improd.: ${perdasKPIs.improdutividadePercent}%`,
    status: perdasKPIs.improdutividadePercent > 15 ? "critical" as const : "ok" as const,
  },
  {
    letter: "A",
    title: "Análise Contínua",
    subtitle: "Financeiro",
    icon: <TrendingUp className="h-5 w-5" />,
    url: "/analise-continua",
    kpi: `Margem: ${financeiroKPIs.margemAtual}%`,
    status: financeiroKPIs.margemAtual > 15 ? "ok" as const : "warning" as const,
  },
];

export default function DashboardOverview() {
  const navigate = useNavigate();

  return (
    <div>
      <GlobalFilters />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard O.P.E.R.A.</h1>
          <p className="text-sm text-muted-foreground">Visão consolidada de todos os indicadores da obra</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast.info("Exportação PDF será implementada")}>
          <FileText className="h-4 w-4" />
          Exportar Relatório
        </Button>
      </div>

      {/* Hero KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPICard
          title="Saldo Projetado (30d)"
          value={`R$ ${(financeiroKPIs.saldoProjetado / 1000).toFixed(0)}k`}
          icon={<DollarSign className="h-5 w-5" />}
          tooltip="Diferença entre entradas e saídas projetadas em 30 dias"
          status="ok"
        />
        <KPICard
          title="Economia na Semana"
          value={`R$ ${financeiroKPIs.economizadoSemana.toLocaleString("pt-BR")}`}
          icon={<TrendingUp className="h-5 w-5" />}
          tooltip="Economia gerada por gestão eficiente nesta semana"
          status="ok"
          trend={{ value: 8, label: "vs anterior" }}
        />
        <KPICard
          title="Dias Sem Acidente"
          value={segurancaKPIs.diasSemAcidente}
          icon={<Heart className="h-5 w-5" />}
          tooltip="Dias consecutivos sem acidentes na obra"
          status="ok"
        />
        <KPICard
          title="Inspeções Aprovadas"
          value={`${segurancaKPIs.inspecoesAprovadasPercent}%`}
          icon={<ShieldCheck className="h-5 w-5" />}
          tooltip="Aprovadas na primeira tentativa"
          status={segurancaKPIs.inspecoesAprovadasPercent >= 90 ? "ok" : "warning"}
        />
      </div>

      {/* O.P.E.R.A. Cards */}
      <h2 className="text-lg font-semibold mb-4">Módulos O.P.E.R.A.</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {sections.map(s => (
          <button
            key={s.letter}
            onClick={() => navigate(s.url)}
            className="glass-card p-5 text-left hover:border-primary/50 transition-all group cursor-pointer"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="w-8 h-8 rounded-lg bg-primary/20 text-primary font-bold text-lg flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                {s.letter}
              </span>
              <div className="text-primary">{s.icon}</div>
            </div>
            <h3 className="font-semibold text-sm mb-0.5">{s.title}</h3>
            <p className="text-xs text-muted-foreground mb-3">{s.subtitle}</p>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-semibold ${
              s.status === "ok" ? "bg-status-ok/15 text-status-ok" :
              s.status === "warning" ? "bg-status-warning/15 text-status-warning" :
              "bg-status-critical/15 text-status-critical"
            }`}>
              {s.kpi}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
