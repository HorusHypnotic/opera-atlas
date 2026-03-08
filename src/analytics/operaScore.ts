// Analytics: Score O.P.E.R.A. (0-100)
// Composto por 5 pilares com peso igual (20 pontos cada)

export interface OperaScoreBreakdown {
  total: number;
  organizacao: number;
  padronizacao: number;
  eficiencia: number;
  reducaoPerdas: number;
  analiseContinua: number;
}

interface ScoreInput {
  registros: any[];
  consumo: any[];
  ativos: any[];
  riscos: any[];
  retrabalhos: any[];
  lancamentos: any[];
  incidentes: any[];
}

export function calculateOperaScore(data: ScoreInput): OperaScoreBreakdown {
  // O — Organização (20 pts): baseado em % de status OK
  const okCount = data.registros.filter((r) => r.status === "ok").length;
  const orgRate = data.registros.length > 0 ? okCount / data.registros.length : 0;
  const organizacao = Math.round(orgRate * 20);

  // P — Padronização (20 pts): baseado em desperdício médio (0% = 20, >15% = 0)
  let despMedio = 0;
  const validConsumo = data.consumo.filter((m) => Number(m.previsto) > 0);
  if (validConsumo.length > 0) {
    despMedio = validConsumo.reduce((acc, m) => {
      return acc + Math.abs((Number(m.real_consumo) - Number(m.previsto)) / Number(m.previsto)) * 100;
    }, 0) / validConsumo.length;
  }
  const padronizacao = Math.round(Math.max(0, 20 - (despMedio / 15) * 20));

  // E — Eficiência (20 pts): baseado em % de ativos em uso
  const ativosAtivos = data.ativos.filter((a) => a.status === "ativo").length;
  const efRate = data.ativos.length > 0 ? ativosAtivos / data.ativos.length : 1;
  const eficiencia = Math.round(efRate * 20);

  // R — Redução de Perdas (20 pts): baseado em riscos e retrabalhos
  const totalRetrabalho = data.retrabalhos.reduce((s, r) => s + Number(r.quantidade || 0), 0);
  const riskPenalty = Math.min(data.riscos.length * 2, 10);
  const retPenalty = Math.min(totalRetrabalho, 10);
  const reducaoPerdas = Math.max(0, 20 - riskPenalty - retPenalty);

  // A — Análise Contínua (20 pts): baseado em margem financeira e segurança
  const receitas = data.lancamentos.filter((l) => l.tipo === "receita").reduce((s, l) => s + Number(l.valor), 0);
  const custos = data.lancamentos.filter((l) => l.tipo === "custo").reduce((s, l) => s + Number(l.valor), 0);
  const margem = receitas > 0 ? ((receitas - custos) / receitas) * 100 : 0;
  const margemScore = Math.min(Math.round((margem / 25) * 10), 10); // up to 10pts

  const ncAbertas = data.incidentes.filter((i) => i.tipo === "nc" && i.status === "aberto").length;
  const segScore = Math.max(0, 10 - ncAbertas * 2); // up to 10pts
  const analiseContinua = margemScore + segScore;

  const total = organizacao + padronizacao + eficiencia + reducaoPerdas + analiseContinua;

  return { total, organizacao, padronizacao, eficiencia, reducaoPerdas, analiseContinua };
}
