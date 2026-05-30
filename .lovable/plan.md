# Handover Técnico Atlas/OPERA — PDF para Migração de Backend

## Objetivo
Produzir um **PDF único, navegável e auto-suficiente** que permita a uma equipe de desenvolvimento externa assumir a operação do sistema — inclusive em cenário de migração de backend (sair de Lovable Cloud / Supabase para outra stack) sem perder as invariantes do OPERA_CORE.

Entrega: `/mnt/documents/Atlas_OPERA_Handover_v1.pdf` (mais artefato Mermaid de arquitetura como anexo visual).

## Conteúdo do PDF (estrutura)

**1. Sumário Executivo**
- O que é o Atlas (1 parágrafo técnico, sem marketing).
- Stack atual: React 18 + Vite + Tailwind + Supabase (Postgres + Auth + Edge Functions Deno + Storage).
- Estado de maturidade: OPERA_CORE v1.3, Frentes 1 e 3 concluídas, Frente 2 pendente.

**2. Constituição OPERA_CORE (resumo das 11 Invariantes)**
- Lista das invariantes I1–I11 com 1 linha cada + arquivo de origem (`.lovable/OPERA_CORE.md`).
- Destaque para as não-negociáveis em qualquer migração: Isolamento de Tenant, Irreversibilidade Temporal, Hashes Imortais, Autoridade Server-Side.

**3. Arquitetura Macro**
- Diagrama Mermaid (Frontend → Edge Functions → RPCs → Postgres + RLS).
- Camadas: UI, Observabilidade Causal, Domínio Financeiro, Domínio Temporal (Gantt), Auditoria.
- Mapa de pastas relevante (`src/`, `supabase/migrations`, `supabase/functions`, `.lovable/`).

**4. Modelo de Dados (núcleo)**
- Tabelas críticas com PK/FK/colunas-chave: `tenants`, `profiles`, `user_roles`, `obras`, `colaboradores`, `registro_presencas`, `apontamento_diarias`, `periodos_fechados`, `periodos_reaberturas`, `atividades`, `atividade_dependencias`, `cronograma_baseline`, `system_events`, `audit_logs`.
- Estratégias: soft delete (`deleted_at`), `snapshot_valor`, `status_contabil`, versionamento de períodos.

**5. RLS e Autorização**
- Modelo de roles (`app_role` enum) + função `has_role` SECURITY DEFINER.
- Padrão de política por tenant (`tenant_id = current_tenant()`).
- Bloqueio por `periodos_fechados` em INSERT/UPDATE/DELETE de presença e apontamento.

**6. RPCs Críticas (contrato funcional)**
Para cada uma: assinatura, propósito, side-effects, hash gerado.
- `folha_pagamento`, `validar_fechamento`, `fechar_periodo`
- `reabrir_periodo`, `refechar_periodo`, `listar_historico_periodo`
- `log_system_event`, `set_correlation_context`
- `has_role`, `has_any_role`

**7. Observabilidade Causal (v1.2)**
- Tabela `system_events` (append-only, `correlation_id` + `causation_id`).
- Propagação via header `x-correlation-id` em Edge Functions.
- Helpers: `src/lib/observability.ts`, `createEdgeObservability` (Deno).
- Como reproduzir um incidente a partir de um correlation_id.

**8. Domínios Funcionais**
- **Folha de Pagamento**: estados `prevista | confirmada | ajustada | fechada`, breakdown obrigatório (base, ajuste, legado), detector de ajuste oculto.
- **Cronograma (Gantt como Evidência)**: baseline, congelamento por mês fechado, edges `gantt-list` / `gantt-update-task`.
- **Multi-tenant**: setup RPC, convites, trial 30d, retenção.

**9. Edge Functions (inventário)**
Lista por função: rota, autenticação, secrets necessários, dependências externas. Inclui `accept-invite`, `beta-signup`, `data-retention`, `session-transfer`, `gantt-*`.

**10. Guia de Migração de Backend**
- **Requisitos mínimos** do novo backend para manter OPERA_CORE: Postgres-compatible (ou DB com triggers + SHA-256 determinístico), RLS-equivalente, JWT auth, append-only logs, storage com policies por tenant.
- **Ordem de migração sugerida**: (1) schema + grants, (2) RLS, (3) RPCs financeiras com hash, (4) triggers de snapshot e status_contabil, (5) Edge Functions, (6) frontend `client.ts`.
- **Pontos de risco** ao migrar: determinismo do hash (ordering, locale, encoding), `SECURITY DEFINER` equivalente, `current_setting('app.correlation_id', true)` para contexto causal.
- **Testes de aceitação**: simulação forense de adulteração de R$ 0,01; tentativa de UPDATE em período fechado; tentativa de cross-tenant read.

**11. Operação Diária**
- Fluxo de fechamento mensal.
- Fluxo de reabertura formal (justificativa ≥ 20 chars + keyword).
- Como ler `system_events` e `audit_logs`.

**12. Riscos Conhecidos e Débitos Técnicos**
- Frente 2 (baseline temporal) ainda não concluída.
- Retrofit cliente de mutações críticas pendente.
- Recomendações de hardening adicional.

**13. Apêndices**
- A. Índice de arquivos-chave (`.lovable/OPERA_CORE.md`, `mem://index.md`, migrations relevantes).
- B. Glossário (snapshot, hash imortal, status contábil, correlation/causation).
- C. Checklist de handover (DevOps, Segurança, Dados, Frontend).

## Como será produzido (técnico)

1. **Exploração** (read-only nesta fase do plano; execução só em build mode):
   - `code--view .lovable/OPERA_CORE.md`, `.lovable/memory/index.md`, `.lovable/plan.md`.
   - Listagem de `supabase/migrations/` e `supabase/functions/`.
   - Leitura de `src/integrations/supabase/types.ts` para inventário de tabelas/RPCs.
   - Inspeção de componentes-chave (`PeriodosFechadosTab`, `GanttBoard`, `observability.ts`).

2. **Geração**:
   - Script Python com **ReportLab** (Platypus) para layout profissional com sumário, headings, tabelas e numeração de página.
   - Fonte: Helvetica/Arial. Capa minimalista preto/laranja (alinhado à identidade do Atlas).
   - Diagrama Mermaid exportado como `.mmd` em `/mnt/documents/` e referenciado também como artefato separado para visualização interativa.

3. **QA obrigatório**:
   - `pdftoppm -jpeg -r 150` em todas as páginas + inspeção visual (sem overflow, sem caixas pretas, tabelas alinhadas).
   - Iterar até zero defeitos.

4. **Entrega**:
   - `<presentation-artifact path="Atlas_OPERA_Handover_v1.pdf" mime_type="application/pdf">`
   - `<lov-artifact url="/__l5e/documents/Atlas_Architecture.mmd" mime_type="text/vnd.mermaid">`

## Escopo explícito
- **Não** altera código da aplicação.
- **Não** publica nem expõe segredos.
- **Não** inclui a folha de marketing — tom é técnico, operacional e jurídico-defensável.
