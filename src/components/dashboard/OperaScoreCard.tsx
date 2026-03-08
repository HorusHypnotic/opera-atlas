import { useMemo } from "react";
import { calculateOperaScore, OperaScoreBreakdown } from "@/analytics/operaScore";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface OperaScoreCardProps {
  registros: any[];
  consumo: any[];
  ativos: any[];
  riscos: any[];
  retrabalhos: any[];
  lancamentos: any[];
  incidentes: any[];
}

const pillars = [
  { key: "organizacao" as const, label: "O", name: "Organização", max: 20 },
  { key: "padronizacao" as const, label: "P", name: "Padronização", max: 20 },
  { key: "eficiencia" as const, label: "E", name: "Eficiência", max: 20 },
  { key: "reducaoPerdas" as const, label: "R", name: "Redução de Perdas", max: 20 },
  { key: "analiseContinua" as const, label: "A", name: "Análise Contínua", max: 20 },
];

function getScoreColor(score: number): string {
  if (score >= 80) return "text-status-ok";
  if (score >= 60) return "text-status-warning";
  return "text-status-critical";
}

function getScoreBg(score: number): string {
  if (score >= 80) return "bg-status-ok";
  if (score >= 60) return "bg-status-warning";
  return "bg-status-critical";
}

export function OperaScoreCard(props: OperaScoreCardProps) {
  const score = useMemo(
    () => calculateOperaScore(props),
    [props.registros, props.consumo, props.ativos, props.riscos, props.retrabalhos, props.lancamentos, props.incidentes]
  );

  return (
    <div className="glass-card p-6 mb-8">
      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Score circular */}
        <div className="relative w-28 h-28 shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--secondary))" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="42" fill="none"
              stroke={score.total >= 80 ? "hsl(var(--status-ok))" : score.total >= 60 ? "hsl(var(--status-warning))" : "hsl(var(--status-critical))"}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${(score.total / 100) * 264} 264`}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-3xl font-bold ${getScoreColor(score.total)}`}>{score.total}</span>
            <span className="text-[10px] text-muted-foreground font-mono">/100</span>
          </div>
        </div>

        {/* Breakdown */}
        <div className="flex-1 w-full">
          <h3 className="text-sm font-semibold mb-3">Score O.P.E.R.A.</h3>
          <div className="space-y-2">
            {pillars.map((p) => {
              const val = score[p.key];
              const pct = (val / p.max) * 100;
              return (
                <Tooltip key={p.key}>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-3 cursor-default">
                      <span className="w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center bg-primary/20 text-primary shrink-0">
                        {p.label}
                      </span>
                      <div className="flex-1 h-2.5 rounded-full bg-secondary overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${getScoreBg(pct)}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono w-10 text-right text-muted-foreground">{val}/{p.max}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">{p.name}: {val} de {p.max} pontos</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
