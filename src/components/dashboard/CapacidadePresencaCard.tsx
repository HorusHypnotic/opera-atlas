import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users2, TrendingUp, AlertTriangle, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { CapacidadeMetrics } from "@/analytics/capacidade";

interface Props {
  metrics: CapacidadeMetrics;
  obraNome?: string;
}

const STATUS_STYLES = {
  ok: { color: "text-status-ok", bg: "bg-status-ok/10", label: "Ótima" },
  warning: { color: "text-status-warning", bg: "bg-status-warning/10", label: "Atenção" },
  critical: { color: "text-status-critical", bg: "bg-status-critical/10", label: "Crítica" },
  indisponivel: { color: "text-muted-foreground", bg: "bg-muted/30", label: "Sem dados" },
} as const;

export function CapacidadePresencaCard({ metrics, obraNome }: Props) {
  const s = STATUS_STYLES[metrics.status];
  const showHoje = metrics.eficienciaHoje !== null;
  const main = showHoje ? metrics.eficienciaHoje : metrics.eficienciaMedia;

  return (
    <Card data-tour="capacidade-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users2 className="h-4 w-4 text-primary" />
            Capacidade de Presença
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="text-muted-foreground hover:text-foreground transition-colors">
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                <p className="text-xs">
                  Mostra quantas pessoas planejadas estão efetivamente presentes hoje.
                  Calculado como <strong>presença real / equipe esperada</strong>.
                  Configure o tamanho da equipe esperada no cadastro da obra.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {metrics.status === "indisponivel" ? (
          <div className="flex items-start gap-2 p-3 rounded-md bg-muted/30 border border-muted">
            <AlertTriangle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="text-xs text-muted-foreground">
              <p className="font-medium mb-1">Capacidade não configurada</p>
              <p>Defina <strong>tamanho da equipe esperada</strong> no cadastro da obra para visualizar a eficiência de presença.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-end justify-between">
              <div>
                <div className={`text-3xl font-bold ${s.color}`}>
                  {main !== null ? `${main.toFixed(0)}%` : "—"}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {showHoje ? "Eficiência de hoje" : "Média do período"}
                </p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.color}`}>
                {s.label}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded bg-muted/30">
                <p className="text-muted-foreground">Esperado</p>
                <p className="font-semibold text-foreground">{metrics.esperado} pessoas</p>
              </div>
              <div className="p-2 rounded bg-muted/30">
                <p className="text-muted-foreground">{showHoje ? "Hoje" : "Média/dia"}</p>
                <p className="font-semibold text-foreground">
                  {(showHoje ? metrics.presenteHoje : metrics.presenteMedio).toFixed(1)} diárias
                </p>
              </div>
            </div>

            {metrics.consistencia === "parcial" && (
              <p className="text-[10px] text-status-warning flex items-center gap-1">
                <Info className="h-3 w-3" /> Apenas {metrics.diasMedidos} dia(s) com dados — confiabilidade parcial.
              </p>
            )}
            {metrics.eficienciaMedia !== null && showHoje && (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1 border-t border-border">
                <TrendingUp className="h-3 w-3" />
                Média {metrics.diasMedidos}d: <span className="font-semibold text-foreground">{metrics.eficienciaMedia.toFixed(0)}%</span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
