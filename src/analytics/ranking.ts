// Analytics: Ranking de produtividade por atividade/equipe
export interface RankingItem {
  equipe: string;
  producao: number;
}

export function calculateRanking(registros: any[], top = 5): RankingItem[] {
  const byAtividade: Record<string, number> = {};
  registros.forEach((r) => {
    const equipe = r.atividade || "Sem atividade";
    const prod = Number(r.producao) || 0;
    byAtividade[equipe] = (byAtividade[equipe] || 0) + prod;
  });
  return Object.entries(byAtividade)
    .map(([equipe, producao]) => ({ equipe, producao: Math.round(producao) }))
    .sort((a, b) => b.producao - a.producao)
    .slice(0, top);
}
