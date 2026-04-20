import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ProdutividadeEquipe } from "@/analytics/capacidade";

interface Props {
  equipes: ProdutividadeEquipe[];
}

export function ProdutividadeEquipeCard({ equipes }: Props) {
  const top = equipes.slice(0, 5);
  const max = top.reduce((m, e) => Math.max(m, e.producaoTotal), 0) || 1;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Produtividade por Equipe
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
                  Soma de produção registrada por equipe (ou atividade quando equipe não estiver definida).
                  Para detalhar por equipe, preencha o campo <strong>Equipe</strong> no Registro Diário.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent>
        {top.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            Sem registros de produção no período.
          </p>
        ) : (
          <div className="space-y-2">
            {top.map((e) => (
              <div key={e.equipe} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium truncate flex-1 mr-2">{e.equipe}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {e.producaoTotal.toLocaleString("pt-BR")}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${(e.producaoTotal / max) * 100}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{e.diasTrabalhados} dia(s) • {e.registros} registro(s)</span>
                  <span>~ {e.producaoMediaDia.toLocaleString("pt-BR")}/dia</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
