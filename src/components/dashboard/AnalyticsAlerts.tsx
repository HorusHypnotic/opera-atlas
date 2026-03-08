import { AlertTriangle, TrendingDown, Trophy, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface AnalyticsAlertsProps {
  registros: any[];
  consumo: any[];
  retrabalhos: any[];
  sequenciamento: any[];
}

export function AnalyticsAlerts({ registros, consumo, retrabalhos, sequenciamento }: AnalyticsAlertsProps) {
  // 1. Ranking de equipes por produção
  const byAtividade: Record<string, number> = {};
  registros.forEach((r: any) => {
    const equipe = r.atividade || "Sem atividade";
    const prod = parseFloat(r.producao) || 1;
    byAtividade[equipe] = (byAtividade[equipe] || 0) + prod;
  });
  const rankingData = Object.entries(byAtividade)
    .map(([equipe, producao]) => ({ equipe, producao: Math.round(producao) }))
    .sort((a, b) => b.producao - a.producao)
    .slice(0, 5);

  // 2. Detector de desperdício (>15% = alerta, >30% = crítico)
  const desperdicios = consumo
    .filter((m: any) => m.previsto > 0)
    .map((m: any) => {
      const desvio = ((Number(m.real_consumo) - Number(m.previsto)) / Number(m.previsto)) * 100;
      return { material: m.material, desvio: Math.round(desvio * 10) / 10, previsto: m.previsto, real: m.real_consumo };
    })
    .filter((m) => m.desvio > 5)
    .sort((a, b) => b.desvio - a.desvio);

  // 3. Previsão de atraso (baseado em sequenciamento)
  const currentWeek = Math.ceil((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / (7 * 86400000));
  const atrasadas = sequenciamento.filter((s: any) => {
    return s.semana_fim < currentWeek && s.status !== "concluido";
  });
  const emRisco = sequenciamento.filter((s: any) => {
    return s.semana_fim >= currentWeek && s.semana_fim <= currentWeek + 2 && s.status !== "concluido";
  });

  // 4. Índice de retrabalho
  const totalRetrabalho = retrabalhos.reduce((s: number, r: any) => s + Number(r.quantidade || 0), 0);

  const tooltipStyle = {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    fontSize: 12,
  };

  const hasAlerts = desperdicios.length > 0 || atrasadas.length > 0 || emRisco.length > 0 || totalRetrabalho > 0;

  return (
    <div className="space-y-4 mb-8">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-status-warning" />
        Inteligência Operacional
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Ranking de Produtividade */}
        {rankingData.length > 0 && (
          <div className="glass-card p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-status-ok" />
              Ranking de Produtividade
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={rankingData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis type="category" dataKey="equipe" width={110} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="producao" name="Produção" radius={[0, 4, 4, 0]}>
                  {rankingData.map((_, i) => {
                    const colors = ["hsl(var(--primary))", "hsl(var(--status-ok))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--muted-foreground))"];
                    return <rect key={i} fill={colors[i % colors.length]} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Alertas de Desperdício */}
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-status-critical" />
            Detector de Desperdício
          </h3>
          {desperdicios.length === 0 ? (
            <div className="flex items-center justify-center h-[180px] text-muted-foreground">
              <div className="text-center">
                <div className="text-3xl mb-2">✅</div>
                <p className="text-sm">Todos os materiais dentro da meta</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {desperdicios.map((d, i) => (
                <div key={i} className={`p-3 rounded-lg border ${
                  d.desvio > 30 ? "bg-status-critical/10 border-status-critical/30" :
                  d.desvio > 15 ? "bg-status-warning/10 border-status-warning/30" :
                  "bg-status-warning/5 border-status-warning/20"
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{d.material}</span>
                    <span className={`text-sm font-mono font-bold ${
                      d.desvio > 30 ? "text-status-critical" : "text-status-warning"
                    }`}>+{d.desvio}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Previsto: {d.previsto} → Real: {d.real}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Previsão de Atraso */}
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-status-warning" />
            Previsão de Atraso
          </h3>
          {atrasadas.length === 0 && emRisco.length === 0 ? (
            <div className="flex items-center justify-center h-[120px] text-muted-foreground">
              <div className="text-center">
                <div className="text-3xl mb-2">🟢</div>
                <p className="text-sm">Nenhuma equipe com risco de atraso</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {atrasadas.map((s: any) => (
                <div key={s.id} className="p-3 rounded-lg bg-status-critical/10 border border-status-critical/30">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{s.equipe}</span>
                    <span className="text-xs font-mono text-status-critical font-bold">ATRASADA</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Previsto até semana {s.semana_fim} — Semana atual: {currentWeek}
                  </p>
                </div>
              ))}
              {emRisco.map((s: any) => (
                <div key={s.id} className="p-3 rounded-lg bg-status-warning/10 border border-status-warning/30">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{s.equipe}</span>
                    <span className="text-xs font-mono text-status-warning font-bold">EM RISCO</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Prazo: semana {s.semana_fim} — Faltam {s.semana_fim - currentWeek} semanas
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Índice de Retrabalho */}
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-status-warning" />
            Índice de Retrabalho
          </h3>
          <div className="flex items-center justify-center h-[120px]">
            <div className="text-center">
              <p className={`text-5xl font-bold ${
                totalRetrabalho > 10 ? "text-status-critical" :
                totalRetrabalho > 5 ? "text-status-warning" :
                "text-status-ok"
              }`}>{totalRetrabalho}</p>
              <p className="text-sm text-muted-foreground mt-1">ocorrências de retrabalho</p>
              {totalRetrabalho > 5 && (
                <p className="text-xs text-status-warning mt-2">⚠ Acima do limite recomendado (5)</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
