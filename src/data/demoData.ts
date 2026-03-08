// Demo data for guest mode — simulates a real construction project
const DEMO_OBRA_ID = "demo-obra-001";
const DEMO_TENANT_ID = "guest-tenant";
const today = new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

export const DEMO_OBRAS = [
  { id: DEMO_OBRA_ID, nome: "Residencial Aurora", endereco: "Av. Brasil, 1200 — São Paulo", status: "em_andamento", custo_orcado_m2: 680 },
  { id: "demo-obra-002", nome: "Edifício Horizonte", endereco: "Rua das Palmeiras, 45 — Campinas", status: "em_andamento", custo_orcado_m2: 720 },
];

const base = { tenant_id: DEMO_TENANT_ID, obra_id: DEMO_OBRA_ID };

export const DEMO_DATA: Record<string, any[]> = {
  registros_diarios: [
    { id: "rd1", ...base, nome: "Carlos Silva", data_registro: today, entrada: "07:00", saida: "17:00", atividade: "Alvenaria 3º pavimento", producao: "42 m²", status: "ok", created_at: today },
    { id: "rd2", ...base, nome: "João Santos", data_registro: today, entrada: "07:00", saida: "17:00", atividade: "Instalação elétrica", producao: "8 pontos", status: "ok", created_at: today },
    { id: "rd3", ...base, nome: "Maria Oliveira", data_registro: today, entrada: "07:30", saida: "16:30", atividade: "Pintura interna", producao: "65 m²", status: "ok", created_at: today },
    { id: "rd4", ...base, nome: "Pedro Lima", data_registro: daysAgo(1), entrada: "07:00", saida: "12:00", atividade: "Concretagem laje", producao: "—", status: "atestado", created_at: daysAgo(1) },
    { id: "rd5", ...base, nome: "Ana Costa", data_registro: daysAgo(1), entrada: "07:00", saida: "17:00", atividade: "Reboco externo", producao: "38 m²", status: "ok", created_at: daysAgo(1) },
    { id: "rd6", ...base, nome: "Lucas Mendes", data_registro: daysAgo(2), entrada: "07:00", saida: "17:00", atividade: "Armação de ferragem", producao: "120 kg", status: "ok", created_at: daysAgo(2) },
    { id: "rd7", ...base, nome: "Roberto Alves", data_registro: daysAgo(2), entrada: null, saida: null, atividade: null, producao: null, status: "falta", created_at: daysAgo(2) },
    { id: "rd8", ...base, nome: "Fernanda Rocha", data_registro: daysAgo(3), entrada: "07:00", saida: "17:00", atividade: "Assentamento piso", producao: "28 m²", status: "ok", created_at: daysAgo(3) },
  ],

  consumo_materiais: [
    { id: "cm1", ...base, material: "Cimento CP-II", unidade: "saco", previsto: 200, real_consumo: 218, data_registro: daysAgo(1), created_at: daysAgo(1) },
    { id: "cm2", ...base, material: "Areia média", unidade: "m³", previsto: 30, real_consumo: 28, data_registro: daysAgo(1), created_at: daysAgo(1) },
    { id: "cm3", ...base, material: "Aço CA-50", unidade: "kg", previsto: 1500, real_consumo: 1620, data_registro: daysAgo(2), created_at: daysAgo(2) },
    { id: "cm4", ...base, material: "Tijolo cerâmico", unidade: "un", previsto: 5000, real_consumo: 4850, data_registro: daysAgo(3), created_at: daysAgo(3) },
    { id: "cm5", ...base, material: "Tinta acrílica", unidade: "lata", previsto: 40, real_consumo: 44, data_registro: daysAgo(4), created_at: daysAgo(4) },
    { id: "cm6", ...base, material: "Brita nº1", unidade: "m³", previsto: 20, real_consumo: 19, data_registro: daysAgo(5), created_at: daysAgo(5) },
  ],

  compras_emergenciais: [
    { id: "ce1", ...base, material: "Mangueira hidráulica", qtd: 50, data: daysAgo(3), motivo: "Ruptura na rede provisória", created_at: daysAgo(3) },
    { id: "ce2", ...base, material: "Disjuntor 32A", qtd: 10, data: daysAgo(7), motivo: "Falta de estoque", created_at: daysAgo(7) },
  ],

  ativos: [
    { id: "at1", ...base, nome: "Betoneira 400L", status: "ativo", valor: 8500, local_atual: "Pátio central", created_at: daysAgo(10) },
    { id: "at2", ...base, nome: "Andaime fachadeiro (kit)", status: "ativo", valor: 15000, local_atual: "Fachada norte", created_at: daysAgo(10) },
    { id: "at3", ...base, nome: "Guincho coluna", status: "ativo", valor: 12000, local_atual: "Torre A", created_at: daysAgo(10) },
    { id: "at4", ...base, nome: "Vibrador de concreto", status: "manutencao", valor: 3200, local_atual: "Almoxarifado", created_at: daysAgo(5) },
    { id: "at5", ...base, nome: "Escora metálica (lote 200)", status: "ativo", valor: 22000, local_atual: "3º pavimento", created_at: daysAgo(10) },
    { id: "at6", ...base, nome: "Compactador de solo", status: "ocioso", valor: 6800, local_atual: "Almoxarifado", created_at: daysAgo(15) },
  ],

  sequenciamento_equipes: [
    { id: "se1", ...base, equipe: "Alvenaria", semana_inicio: 1, semana_fim: 12, status: "em_andamento", created_at: daysAgo(30) },
    { id: "se2", ...base, equipe: "Elétrica", semana_inicio: 4, semana_fim: 14, status: "em_andamento", created_at: daysAgo(30) },
    { id: "se3", ...base, equipe: "Hidráulica", semana_inicio: 4, semana_fim: 13, status: "planejado", created_at: daysAgo(30) },
    { id: "se4", ...base, equipe: "Pintura", semana_inicio: 10, semana_fim: 16, status: "planejado", created_at: daysAgo(30) },
    { id: "se5", ...base, equipe: "Acabamento", semana_inicio: 14, semana_fim: 20, status: "planejado", created_at: daysAgo(30) },
  ],

  riscos: [
    { id: "ri1", ...base, risco: "Atraso na entrega de aço", severidade: "alta", impacto: "Paralisação da armação por 3 dias", prazo: daysAgo(-5), created_at: daysAgo(4) },
    { id: "ri2", ...base, risco: "Chuvas intensas previstas", severidade: "media", impacto: "Atraso na concretagem", prazo: daysAgo(-2), created_at: daysAgo(2) },
    { id: "ri3", ...base, risco: "Falta de mão de obra qualificada", severidade: "alta", impacto: "Redução de produtividade em 30%", prazo: null, created_at: daysAgo(7) },
    { id: "ri4", ...base, risco: "Variação cambial nos insumos importados", severidade: "baixa", impacto: "Aumento de 5% no custo de materiais", prazo: null, created_at: daysAgo(14) },
  ],

  retrabalhos: [
    { id: "rt1", ...base, etapa: "Alvenaria", quantidade: 3, descricao: "Paredes fora de prumo — 3º pavimento", data_registro: daysAgo(5), created_at: daysAgo(5) },
    { id: "rt2", ...base, etapa: "Elétrica", quantidade: 2, descricao: "Pontos elétricos em posição errada", data_registro: daysAgo(8), created_at: daysAgo(8) },
    { id: "rt3", ...base, etapa: "Hidráulica", quantidade: 1, descricao: "Vazamento na prumada do 2º andar", data_registro: daysAgo(12), created_at: daysAgo(12) },
  ],

  lancamentos_financeiros: [
    { id: "lf1", ...base, tipo: "receita", valor: 450000, descricao: "Medição #4 — Contrato principal", fornecedor: null, data: daysAgo(2), status_pagamento: "pago", created_at: daysAgo(2) },
    { id: "lf2", ...base, tipo: "receita", valor: 380000, descricao: "Medição #3 — Contrato principal", fornecedor: null, data: daysAgo(30), status_pagamento: "pago", created_at: daysAgo(30) },
    { id: "lf3", ...base, tipo: "custo", valor: 85000, descricao: "Folha de pagamento — Mar/26", fornecedor: "RH Interno", data: daysAgo(5), status_pagamento: "pago", created_at: daysAgo(5) },
    { id: "lf4", ...base, tipo: "custo", valor: 62000, descricao: "Compra de aço CA-50", fornecedor: "Gerdau S.A.", data: daysAgo(8), status_pagamento: "pago", created_at: daysAgo(8) },
    { id: "lf5", ...base, tipo: "custo", valor: 38000, descricao: "Aluguel de equipamentos", fornecedor: "LocaMaq", data: daysAgo(10), status_pagamento: "pago", created_at: daysAgo(10) },
    { id: "lf6", ...base, tipo: "custo", valor: 27500, descricao: "Cimento e agregados", fornecedor: "Votorantim", data: daysAgo(12), status_pagamento: "pago", created_at: daysAgo(12) },
    { id: "lf7", ...base, tipo: "custo", valor: 15000, descricao: "Material elétrico", fornecedor: "Eletropaulo Mat.", data: daysAgo(14), status_pagamento: "pendente", created_at: daysAgo(14) },
    { id: "lf8", ...base, tipo: "custo", valor: 42000, descricao: "Folha de pagamento — Fev/26", fornecedor: "RH Interno", data: daysAgo(35), status_pagamento: "pago", created_at: daysAgo(35) },
    { id: "lf9", ...base, tipo: "receita", valor: 120000, descricao: "Adiantamento contratual", fornecedor: null, data: daysAgo(60), status_pagamento: "pago", created_at: daysAgo(60) },
  ],

  incidentes_seguranca: [
    { id: "is1", ...base, tipo: "inspecao", status: "aprovado", severidade: "baixa", descricao: "Inspeção semanal — EPIs", data: daysAgo(2), created_at: daysAgo(2) },
    { id: "is2", ...base, tipo: "inspecao", status: "aprovado", severidade: "baixa", descricao: "Inspeção mensal — andaimes", data: daysAgo(7), created_at: daysAgo(7) },
    { id: "is3", ...base, tipo: "inspecao", status: "reprovado", severidade: "media", descricao: "Inspeção — proteção de periferia", data: daysAgo(10), created_at: daysAgo(10) },
    { id: "is4", ...base, tipo: "nc", status: "aberto", severidade: "alta", descricao: "Falta de guarda-corpo no 4º pavimento", data: daysAgo(3), created_at: daysAgo(3) },
    { id: "is5", ...base, tipo: "nc", status: "resolvido", severidade: "media", descricao: "Fio exposto na área de vivência", data: daysAgo(15), created_at: daysAgo(15) },
    { id: "is6", ...base, tipo: "acidente", status: "resolvido", severidade: "media", descricao: "Queda de material do 2º andar (sem vítimas)", data: daysAgo(22), created_at: daysAgo(22) },
    { id: "is7", ...base, tipo: "inspecao", status: "aprovado", severidade: "baixa", descricao: "Inspeção — sinalização de canteiro", data: daysAgo(14), created_at: daysAgo(14) },
  ],

  acoes_corretivas: [
    { id: "ac1", ...base, descricao: "Corrigir prumo da parede do 3º pavimento — alvenaria fora de esquadro", responsavel: "Carlos Silva", pilar: "organizacao", prioridade: "alta", status: "em_andamento", prazo: daysAgo(-3), created_at: daysAgo(5), updated_at: daysAgo(2) },
    { id: "ac2", ...base, descricao: "Instalar guarda-corpo no 4º pavimento — NC de segurança aberta", responsavel: "Roberto Alves", pilar: "seguranca", prioridade: "alta", status: "pendente", prazo: daysAgo(-1), created_at: daysAgo(3), updated_at: daysAgo(3) },
    { id: "ac3", ...base, descricao: "Recalcular quantitativo de aço para laje do 5º pav. — consumo acima de 8%", responsavel: "Ana Costa", pilar: "padronizacao", prioridade: "media", status: "concluida", prazo: daysAgo(2), created_at: daysAgo(10), updated_at: daysAgo(2) },
    { id: "ac4", ...base, descricao: "Devolver compactador de solo ocioso ao fornecedor — custo de locação", responsavel: "Pedro Lima", pilar: "eficiencia", prioridade: "media", status: "pendente", prazo: daysAgo(-5), created_at: daysAgo(7), updated_at: daysAgo(7) },
    { id: "ac5", ...base, descricao: "Renegociar prazo de entrega de material elétrico com Eletropaulo", responsavel: "Eduardo Martins", pilar: "analise", prioridade: "baixa", status: "concluida", prazo: daysAgo(1), created_at: daysAgo(14), updated_at: daysAgo(1) },
  ],
};
