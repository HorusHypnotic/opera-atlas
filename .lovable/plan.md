
# Gantt como Evidência — Plano de implementação

Objetivo: um Gantt que não é desenho, é **janela para a verdade operacional**. Toda barra é estado autoritativo no servidor; todo arrasto é evento causal auditado; períodos fechados são imutáveis; baseline é contrato.

Será entregue em **3 fases incrementais**. Fase 1 é o MVP funcional (suficiente para piloto). Fases 2 e 3 são camadas de rigor.

---

## Fase 1 — Núcleo (fonte única + mutação auditada + readonly)

### 1.1 Modelo de dados (migração)

Novas tabelas no schema `public`, com GRANTs + RLS no padrão dos demais módulos (tenant_select, operational_insert, gestor_update, admin_delete, super_admin_all):

- `atividades` — fonte única do cronograma
  - `id`, `tenant_id`, `obra_id`, `nome`, `descricao`
  - `data_inicio date`, `data_fim date`
  - `progresso numeric(5,2) default 0` (0–100, **read-only** no Gantt)
  - `ordem int`, `parent_id uuid null` (hierarquia opcional)
  - `responsavel text null`, `cor text null`
  - `created_at`, `updated_at`, `updated_by`, `deleted_at` (soft delete)
  - Validação por **trigger** (não CHECK): `data_fim >= data_inicio`

- `atividade_dependencias` — dependências FS (finish-to-start) por padrão
  - `id`, `tenant_id`, `obra_id`, `predecessora_id`, `sucessora_id`, `tipo text default 'FS'`, `lag_dias int default 0`
  - UNIQUE (predecessora_id, sucessora_id)

- `cronograma_baseline` — snapshot imutável do plano original
  - `id`, `tenant_id`, `obra_id`, `versao int`, `congelado_em`, `congelado_por`, `snapshot_json jsonb`, `hash text`
  - Apenas admin pode criar; nunca update/delete.

Reaproveita as funções `get_user_tenant_id`, `has_role`, `user_has_obra_access`, `is_super_admin`, e o bloqueio por `periodos_fechados` (mesmo padrão de `apontamento_diarias`): trigger/policy que impede INSERT/UPDATE/DELETE em `atividades` cujo mês de `data_fim` esteja fechado (a menos que super admin).

### 1.2 Edge functions (Deno)

Toda mutação passa por edge function. Nada de UPDATE direto do cliente.

- `gantt-list` — `GET ?obra_id=...`
  - Retorna tarefas + dependências + flag `readonly` por tarefa (true se mês fechado, sem permissão de edição, ou sem role gestor+).
  - Usa `userClient` (RLS) para ler; obs propaga `correlation_id`.

- `gantt-update-task` — `POST { task_id, data_inicio?, data_fim?, nome?, reason? }`
  - Valida readonly server-side.
  - Valida dependências (nova `data_inicio` >= max(`data_fim` das predecessoras) + lag). Se conflito → 409 com lista de conflitos.
  - Atualiza `atividades` com `updated_by = auth.uid()`.
  - Loga `system_events` com `event_type = 'gantt.task.update'`, payload `{ task_id, old, new, reason }`, herdando `correlation_id` via header.

- `gantt-update-progress` (Fase 1.5, opcional) — exige `reason` obrigatório, loga `gantt.task.progress.adjusted`.

Config: `verify_jwt = true` (padrão), CORS conforme funções existentes.

### 1.3 Frontend

- Página `src/pages/CronogramaPage.tsx` + rota em `App.tsx` + entrada no `AppSidebar`.
- Biblioteca: **`frappe-gantt-react`** (leve, MIT). Alternativa: `gantt-task-react`. Decidir pela mais estável (frappe é mais simples e combina com a estética dark/glass).
- Componente `src/components/cronograma/GanttBoard.tsx`:
  - Carrega via `gantt-list` (TanStack Query).
  - `onDateChange` → chama `gantt-update-task` com `causalHeaders(ctx)`; UI **não** atualiza otimisticamente — espera resposta e refaz fetch (ou aplica patch só após sucesso). Em erro, mostra toast com motivo (ex: "tarefa bloqueada por período fechado", "conflito de dependência com X").
  - Barras `readonly` renderizadas com cinza + ícone de cadeado, drag desabilitado.
  - Progresso exibido na barra, mas sem handler de drag em progresso (Fase 1).
- Helpers já existentes em `src/lib/observability.ts` são usados para `startCausalContext`, `traced`, `causalHeaders`.

### 1.4 Aceitação Fase 1

- [ ] Gantt carrega tarefas de `atividades` via edge function.
- [ ] Arrastar barra dispara request, e UI só persiste após resposta OK.
- [ ] Tarefa em mês fechado vem com `readonly: true` e não pode ser arrastada.
- [ ] Cada update gera linha em `system_events` com `event_type='gantt.task.update'` e `correlation_id`.
- [ ] RLS testada: usuário do tenant A não vê atividades do tenant B.

---

## Fase 2 — Rigor (dependências + baseline)

- `gantt-list` passa a retornar `dependencies: ["id1", "id2"]`.
- `gantt-update-task` aplica modo configurável por obra: `dependency_mode = 'block' | 'cascade'`.
  - `block`: erro 409 com lista de sucessoras impactadas.
  - `cascade`: recalcula sucessoras numa transação; emite **um** `gantt.task.update` por tarefa afetada, todos com mesmo `correlation_id` e `causation_id` apontando para o evento raiz (forma a árvore causal).
- Borda vermelha em barras com conflito detectado pelo cliente (validação cosmética; backend é a verdade).
- **Baseline**:
  - Edge function `gantt-baseline-create` (admin only) — grava `snapshot_json` + `hash` de `atividades` ordenado.
  - Toggle "Atual / Baseline" no Gantt; baseline desenhado como barra fantasma atrás da atual.
  - Cálculo de desvio (dias) por tarefa via `data_inicio - baseline.data_inicio`, exibido como rótulo.

---

## Fase 3 — Prova (exportação verificável)

- Edge function `gantt-export-proof` — retorna JSON canônico + SHA-256 + `proof_id` armazenado em nova tabela `cronograma_provas` (append-only).
- Botão "Exportar como prova" gera PDF (jsPDF) com: snapshot do gráfico (imagem), tabela de tarefas, hash, data, link/QR para `/verificar-prova/:proof_id` (rota pública que recomputa o hash e exibe match/mismatch).
- Loga `gantt.proof.issued`.

---

## Conformidade com OPERA_CORE

| Invariante | Como é cumprida |
|---|---|
| I1 (tenant boundary) | `tenant_id` derivado server-side via `get_user_tenant_id(auth.uid())`. RLS em todas as tabelas novas. |
| I2 (server-side authority) | Cliente nunca faz UPDATE direto — só via edge function. `readonly` é decidido no backend. |
| I3 (append-only history) | Todos os eventos vão para `system_events` (append-only). Baseline e provas são imutáveis. |
| I4 (temporal irreversibility) | Períodos fechados bloqueiam edição de tarefas cujo `data_fim` cai no mês fechado. |
| I5 (evidence lineage) | `correlation_id` herdado da sessão; cascata de dependências usa `causation_id` em árvore. |
| I6 (contextual permissions) | `readonly` calculado por role + obra_membros + período fechado. |
| I7 (state reproducibility) | Fonte única é a tabela; baseline reproduz o passado. |
| I9 (deterministic finance) | N/A direta, mas progresso readonly impede inflação fantasma de avanço financeiro. |
| I10 (certainty states) | Tarefa carrega estado: planejada / em andamento (progresso > 0) / concluída / atrasada (computado). |

---

## Decisões pendentes (precisam de resposta antes do build)

1. **Escopo desta iteração**: implementamos só a **Fase 1** agora, ou Fase 1+2 de uma vez? (Recomendo Fase 1 isolada — entrega valor em ~1 dia, e baseline/cascata pedem decisões finas que ficam melhores depois do primeiro uso real.)
2. **Biblioteca de Gantt**: `frappe-gantt-react` (mais simples, visual mais limpo) ou `gantt-task-react` (mais features, mais peso)? Default: frappe.
3. **Modo de dependência** (quando entrarmos na Fase 2): `block` ou `cascade` como default? Recomendo `block` (mais seguro, força decisão consciente).
4. **Hierarquia/sub-tarefas** já na Fase 1 (parent_id) ou só lista plana? Recomendo já criar a coluna mas não expor na UI ainda.

Se confirmar Fase 1 com defaults recomendados, sigo direto: 1 migração + 2 edge functions + 1 página + 1 componente Gantt.
