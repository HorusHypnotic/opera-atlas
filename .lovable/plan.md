# Plano — Consolidação Causal do OPERA

Reinterpretação aceita: **Frente 1 não é observabilidade — é a conclusão da camada causal.** O objetivo da iteração é fechar o "DNA transacional" do sistema antes de qualquer expansão. Ordem: **F1 → F3 → F2**, terminando com **Congelamento Arquitetural de Piloto**.

---

## Frente 1 — Conclusão da Camada Causal (1–2 dias)

Objetivo: qualquer alteração relevante carrega linhagem completa (`correlation_id` + `causation_id`) end-to-end, do clique do usuário ao trigger no banco. Sem investigação manual depois.

**Edge functions a instrumentar** (herdar correlation via header `x-opera-correlation-id` usando `_shared/observability.ts`):
- `accept-invite`
- `beta-signup`
- `data-retention`
- `session-transfer`
- `generate-reset-link`
- `gantt-update-task` (já parcialmente; auditar)
- `gantt-list`

Padrão por função: extrair/gerar correlation no boundary HTTP → propagar em todo `log_system_event` e `audit_logs` da requisição → retornar no header da resposta.

**Cliente — mutações financeiras e operacionais críticas** (envolver com `withCorrelation()` de `src/lib/observability.ts` e propagar para `logAudit({ correlation_id, causation_id })`):
- Confirmar/registrar presença (`registro_presencas`)
- Apontar diária (`apontamento_diarias`)
- Fechar/validar período (RPC `folha_pagamento`, `validar_fechamento`)
- Criar/editar/excluir atividade Gantt
- Criar/editar dependência Gantt
- Soft delete de obras e colaboradores

**Banco — herança em triggers:**
- Estabelecer convenção: cliente/edge faz `select set_config('opera.correlation_id', $1, true)` no início da transação.
- Atualizar função genérica de audit trigger para ler `current_setting('opera.correlation_id', true)` e gravar em `audit_logs_db.correlation_id` quando presente.
- Sem fallback silencioso: se não houver correlation, registrar `NULL` (não inventar).

**Critério de aceitação:** dado qualquer `audit_logs.id` recente, é possível reconstruir a cadeia (quem → tenant → função → DB writes) com **uma única query** por `correlation_id`.

**Entrega documental:** bumpar OPERA_CORE para v1.2, atualizar §8 (sistema nervoso observável passa de "parcial" para "completo no núcleo financeiro/cronograma").

---

## Frente 3 — Reabertura Formal de Período (1 dia)

Fecha a contradição: hoje existe fechamento formal, mas não correção formal. Sem caminho oficial, o usuário cria caminhos não oficiais — e invariantes apodrecem em silêncio.

Princípio: **erro vira evento.** Reabertura é registrada, não escondida. O hash anterior fica preservado no histórico; ao re-fechar, novo hash + nova versão.

**Backend:**
- RPC `reabrir_periodo(tenant_id, obra_id, mes, motivo)`:
  - SECURITY DEFINER, exige `has_role('admin')` no tenant.
  - Valida motivo não vazio (≥ 20 chars).
  - Preserva linha anterior em `periodos_fechados` (não DELETE): grava `reaberto_em`, `reaberto_por`, `motivo_reabertura`.
  - Emite `system_events` (`periodo.reaberto`) com `correlation_id` da requisição.
  - Append em `audit_logs` com snapshot do hash anterior em `metadata`.
- RLS de bloqueio já cobre (`pf.reaberto_em IS NULL`) — escrita volta a ser permitida automaticamente.
- Ao re-fechar via fluxo existente: nova linha em `periodos_fechados` com `versao = anterior + 1`, novo hash, novo snapshot.

**UI:**
- Botão "Reabrir período" visível só para admin, em período fechado.
- Modal de confirmação por palavra-chave (`REABRIR <mês/ano>`) + textarea de motivo obrigatória.
- Banner persistente no relatório do mês: "Período reaberto em DD/MM por X. Motivo: …" enquanto não houver re-fechamento.
- Histórico de versões (hash v1 → v2) visível no rodapé do relatório.

**Critério de aceitação:** ciclo completo fechar → reabrir → editar → re-fechar gera 2 linhas em `periodos_fechados`, 2 hashes distintos, e cadeia causal recuperável por `correlation_id`.

---

## Frente 2 — Fechamento Temporal (Baseline como evidência) (3–4 dias)

Reenquadrada: **não é feature de Gantt, é o equivalente temporal do fechamento financeiro.** Mesma mecânica de hash + snapshot, aplicada a prazo. A tabela `cronograma_baseline` já existe — só falta o fluxo.

**Simetria:**

```text
Folha original     →  hash (periodos_fechados)
Cronograma original →  hash (cronograma_baseline)
```

**Backend:**
- RPC `congelar_baseline(obra_id, motivo)`:
  - SECURITY DEFINER, exige `has_role('admin')`.
  - Lê todas atividades + dependências ativas da obra, serializa em ordem determinística.
  - Calcula SHA-256 (mesma função usada em `folha_pagamento`).
  - Insere em `cronograma_baseline` com `versao = max(anterior) + 1`.
  - Emite `system_events` (`baseline.congelada`) com correlation.
- RPC `comparar_baseline(obra_id, versao?)`: retorna desvio por atividade (start/end/duração/progresso) entre baseline e estado atual.
- Sem mutação destrutiva: nova baseline = nova versão; baselines anteriores permanecem.

**UI (Gantt — refinamento, não nova página):**
- Botão "Congelar baseline" no header do cronograma (admin only, confirmação por palavra-chave).
- Toggle "Baseline vs Atual": renderiza barras fantasma da baseline sob barras atuais; deltas coloridos (verde/amarelo/vermelho).
- Ícone de cadeado em atividades cujo `data_fim` cai em `periodos_fechados` (já bloqueado por RLS — só exibir).
- Footer com hash + versão da baseline ativa.

**Dependências em cascata** (já há tabela `atividade_dependencias`):
- Validação server-side em `gantt-update-task`: ao mover predecessora, sugerir/aplicar shift em sucessoras respeitando `lag_dias` e `tipo` (FS/SS/FF).
- Decisão UX: sugerir + confirmar (não aplicar silenciosamente — preserva I8 falha segura).

**Critério de aceitação:** baseline congelada → atividade movida → relatório mostra desvio explícito + hash original imutável + correlation_id da edição na trilha.

---

## Congelamento Arquitetural de Piloto (após F2)

Concordo em ser mais agressivo. Ao final das três frentes, declarar congelamento formal e registrá-lo no OPERA_CORE (§7 ou novo §11).

**Congelado até primeiro piloto real produzir dados:**
- Novas páginas
- Novos dashboards
- Novos indicadores / KPIs
- Novos módulos
- IA / automações "legais de ter"
- Billing / Paddle (já era)

**Permitido durante o piloto:**
- Correções de bug
- Observabilidade adicional (sempre dentro da camada causal)
- Hardening de segurança reativo
- Ajustes de UX que removem fricção real reportada

**Critério de saída do congelamento:** evidência empírica (eventos + feedback de pelo menos uma construtora real) que contradiga premissa atual ou revele gargalo não antecipado. Sem isso, qualquer expansão é infraestrutura para problema imaginário.

---

## Notas técnicas

- Toda RPC nova: `SECURITY DEFINER`, `SET search_path = public, extensions`, validação server-side de `tenant_id` e role.
- Toda nova escrita: passa por RLS existente + grava em `audit_logs` e `system_events` com `correlation_id`.
- Zero alteração em schema de negócio existente (apenas RPCs, triggers e UI).
- Migrations: uma por frente (causal-propagation triggers; reabrir_periodo; congelar_baseline + comparar_baseline).
- Atualizar memórias: `mem://architecture/causal-observability` (F1), nova `mem://features/reabertura-formal` (F3), nova `mem://features/baseline-cronograma` (F2).

---

## Sequência de execução

1. **F1** — Causal end-to-end. Sem isso, F3 e F2 nascem cegas.
2. **F3** — Reabertura formal. Remove pressão sobre I4 antes que o usuário invente workaround.
3. **F2** — Baseline como fechamento temporal. Fecha simetria dinheiro ↔ tempo.
4. **Congelamento** — Documentado em OPERA_CORE v1.3. Piloto inicia.

Pronto para executar na ordem aprovada quando você liberar build mode.