# Plano: PDF "Governança de Maturidade Empresarial — OPERA Atlas v1.1"

Gerar um novo PDF (`/mnt/documents/OPERA_Atlas_Governanca_Maturidade_v1.1.pdf`) que evolui o Roadmap de documento estático para **instrumento de governança executiva**. Mantém os marcos M0–M4 do v1.0 e adiciona as 8 camadas pedidas. **Sem alteração de código da aplicação.**

## Escopo

Evolução direta do `OPERA_Atlas_Roadmap_Maturidade.pdf` (v1.0). Não substitui o Diagnóstico Objetivo nem o Roadmap v1.0 — soma-se a eles como camada de governança.

## Fonte da verdade (verificável no repo)

- `.lovable/OPERA_CORE.md` v1.3 — invariantes
- Migrations existentes: `periodos_fechados`, `periodos_reaberturas`, `cronograma_baseline`, `system_events`, `audit_logs_db`, `registro_presencas` (com `status_contabil`)
- Funções: `folha_pagamento` (retorna `hash` SHA-256), `verificar_hash_periodo`, `reabrir_periodo`, `refechar_periodo`, `validar_fechamento`
- Edge: `supabase/functions/export-csv/index.ts`, `data-retention/index.ts`
- Memórias em `.lovable/memory/*`
- Roadmap v1.0 já entregue em `/mnt/documents/`

## Estrutura do PDF (~10–12 páginas)

### 1. Capa + Metadados
Título "OPERA Atlas — Governança de Maturidade Empresarial", subtítulo "Evolução do Roadmap v1.0 → v1.1", data 06/07/2026, tag "Instrumento de governança contínua, evidence-based".

### 2. Painel Executivo (§8 — vem primeiro, é a leitura de 30 segundos)
Card único no topo com:
- Posição atual: **M0 concluído · M1 em curso**
- Percentual global de maturidade: **~32%** (M0 100% + M1 ~60%, ponderado)
- Próximo marco: **M1 — Pré-piloto Pago**
- Bloqueador principal: **Hash de fechamento nunca reproduzido em obra real**
- Previsão de conclusão de M1: **4–6 semanas**
- Risco geral: **MÉDIO-ALTO**
- Tendência: **↑** (invariantes I11 e função `verificar_hash_periodo` já entregues após v1.0)

### 3. Índice de Maturidade por Marco (§1)
Uma tabela por marco (M0–M4) com: % conclusão, critérios ✔/△/✖, bloqueadores, nível de risco, evidência-chave. Barra de progresso visual (Table cell com fill proporcional).

Valores derivados dos critérios de v1.0:
- **M0**: 100% (5/5 critérios). Baixo risco.
- **M1**: ~60% (3/6 concluídos, 1 parcial, 2 abertos). Risco médio-alto.
- **M2**: 5% (só CSV parcial). Risco alto.
- **M3**: 10% (só §8 OPERA_CORE). Risco alto.
- **M4**: 0%. Risco alto.

### 4. Critérios Mensuráveis (§2)
Tabela mestra com **um ID por critério** (M0-01 … M4-XX), coluna: ID · Critério · Prioridade · Responsável · Validação objetiva · Dependências · Status. ~25–30 linhas.

Exemplos:
- **M1-01** Fechamento real executado — Alta — Backend + Cliente piloto — Registro em `periodos_fechados.hash_snapshot` para 1 obra real — Depende de M0-04 — Aberto
- **M1-02** Hash reproduzido por terceiro — Alta — Backend + Auditor externo — `verificar_hash_periodo(id)` retorna `integro=true` executado por 2 sessões distintas — Depende de M1-01 — Aberto
- **M1-03** CSV conferido pelo cliente — Média — Produto — Assinatura do cliente piloto no CSV exportado por `export-csv` — Independente — Pronto para execução
- **M1-04** Domínio próprio — Média — DevOps — DNS apontando + certificado ativo — Independente — Aberto
- **M2-01** Testes RLS cross-tenant em CI — Alta — Backend — `bun vitest run` verde com fixture de 2 tenants — Depende de M1 concluído — Aberto
- (…demais critérios completos no documento)

### 5. Mapa de Dependências (§3)
Dois diagramas ASCII/table:
- **Linear entre marcos**: M0 → M1 → M2 → M3 → M4
- **Crítico de destravamento** (o que realmente bloqueia):
```text
Hash reproduzido (M1-02) ─► Piloto Pago (M1) ─► Cliente Enterprise (M2) ─► Due Diligence (M3)
Retenção auditada ────────────────────────────────────────────────────► Certificações (M4)
Testes RLS cross-tenant ────────────────► Cliente Enterprise (M2)
```

### 6. Evidências Normalizadas (§4)
Tabela padronizada. Colunas: ID evidência · Tipo (Migration/Função/Edge/Memória/Documento) · Origem · Localização · Comprova critério(s) · Data · Validade (perene / expira em / a auditar).

Ex.:
- **E-01** Migration · Supabase · `periodos_fechados` (schema com `hash_snapshot`, `versao`, `reaberto_em`) · Comprova M0-04, M1-01 · 2026-05 · Perene
- **E-02** Função DB · Supabase · `folha_pagamento` retorna `hash` SHA-256 determinístico · Comprova M0-04 estrutural · 2026-05 · Perene
- **E-03** Função DB · Supabase · `verificar_hash_periodo` reexecuta e compara · Comprova M1-02 (mecanismo, não execução real) · 2026-05 · A auditar
- **E-04** Edge Function · Supabase · `supabase/functions/export-csv/index.ts` · Comprova M0-03, M1-03 · Ativa · Perene
- **E-05** Constitucional · Repo · `.lovable/OPERA_CORE.md` v1.3 (I1–I11) · Comprova M0-01 · 2026-05-30 · Perene enquanto versão vigente
- (…demais evidências)

### 7. Indicadores Executivos (§5)
Painel de KPIs em cards:
- Marcos concluídos: **1/5**
- Critérios concluídos / total: **~9 / ~28** (~32%)
- Critérios bloqueados: **3** (dependências abertas)
- Riscos críticos: **3** (Alto)
- Débitos técnicos críticos: **2** (hash não reproduzido, sem testes RLS)
- Evidências auditadas: **6** (estruturais no repo)
- Evidências pendentes: **~12** (execução real, contratos, LGPD)

### 8. Critério Formal de Mudança de Marco (§7)
Regra explícita (destaque em caixa laranja):
> Um marco só muda para "atingido" quando **(a)** todos os critérios de prioridade **Alta** estão concluídos com evidência auditada, **(b)** nenhuma dependência crítica está aberta, **(c)** todas as evidências obrigatórias existem e são rastreáveis, **(d)** nenhum bloqueador classificado como **Alto** permanece. Critérios de prioridade Média/Baixa podem transitar para "débito técnico documentado" sem impedir a promoção do marco.

### 9. Histórico de Evolução (§6)
Log incremental (só mudanças). Formato compacto:
- **v1.0 — 2026-07-06** — Roadmap inicial, M0 concluído, marcos M1–M4 definidos.
- **v1.1 — 2026-07-06** — Governança contínua ativada: IDs de critério, evidências normalizadas, painel executivo, critério formal de mudança de marco.
- (linhas futuras vazias reservadas: "+ Hash reproduzido", "+ Domínio próprio", "+ Piloto 30 dias", "+ Contrato piloto", "→ M1 atingido")

### 10. Como Atualizar Este Documento
Meia página final com regras operacionais:
- Cada avanço = uma linha no histórico + atualização do critério + atualização do painel executivo.
- Nenhuma mudança de marco sem passar pelo Critério Formal §7.
- Novas evidências recebem próximo ID sequencial (E-XX).
- O documento é regerado, não editado à mão — este PDF é a saída de um script Python versionado (`gen_gov.py`).

### 11. Anexo — Diferença v1.0 → v1.1
Tabela curta: v1.0 = documento (marcos + gaps textuais); v1.1 = instrumento (critérios com ID, evidências rastreadas, painel executivo, histórico versionado, regra formal de promoção).

## Detalhes técnicos de geração

- Python + `reportlab` Platypus, `SimpleDocTemplate` A4, margens 2 cm.
- Paleta reaproveitada: laranja `#F97316` (header), verde `#16A34A`, âmbar `#F59E0B`, vermelho `#DC2626`, cinza-escuro `#374151` (header de tabela), cinza claro `#F3F4F6` (linhas alternadas).
- Barras de progresso: `Table` de 2 colunas (largura proporcional ao %), fill verde no preenchido / cinza no restante.
- Setas: caractere `>` em Helvetica bold (arrows Unicode não renderizam em Helvetica embedded).
- Sem Unicode sub/superscript. Nada de `▶`.
- Cada tabela grande recebe `repeatRows=1` para quebrar entre páginas mantendo cabeçalho.
- QA obrigatório: `pdftoppm -jpeg -r 110` → `code--view` de todas as páginas, corrigir overflow/alinhamento antes de finalizar. Reportar issues encontrados e como foram corrigidos.

## Fora de escopo

- **Não** implementar o painel dentro da aplicação (nada de nova rota `/governanca`). Se essa evolução for desejada em UI, virá em pedido separado.
- **Não** alterar schema, RLS, edge functions ou memórias.
- **Não** regerar o Diagnóstico Objetivo nem o Roadmap v1.0.
- **Não** gerar versão pitch/comercial.

## Entregável

Um arquivo: `/mnt/documents/OPERA_Atlas_Governanca_Maturidade_v1.1.pdf` (~10–12 páginas). Script Python de geração salvo em `/tmp/gen_gov.py` para re-execução determinística nas próximas atualizações (v1.2, v1.3…).
