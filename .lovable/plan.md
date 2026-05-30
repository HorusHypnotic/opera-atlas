
# Frente 3 — Reabertura Formal + Fechamento F1.5

Avançar direto para a Frente 3 incorporando a cobertura residual de observabilidade (F1.5) dentro das próprias RPCs de reabertura/refechamento. Resultado: ciclo completo **Registrar → Fechar → Rastrear → Corrigir → Refechar**, com cadeia causal end-to-end.

## Princípios invioláveis

1. **Hash anterior nunca é apagado.** Reabertura cria uma nova versão; o hash original permanece como evidência histórica.
2. **Toda reabertura exige justificativa + autorização explícita** (role `admin`, motivo textual obrigatório, confirmação por keyword).
3. **Reabertura é um evento auditável**, não uma edição silenciosa. Vai para `system_events` + `audit_logs` com `correlation_id` próprio.
4. **Refechamento é obrigatório** após reabertura: período reaberto não pode permanecer "em aberto" indefinidamente sem novo hash.

---

## Bloco 1 — Schema: versionamento de fechamento

Migration em `periodos_fechados`:

- `versao INT NOT NULL DEFAULT 1` — incrementa a cada refechamento.
- `reaberto_em TIMESTAMPTZ NULL` — já existe nas policies, formalizar.
- `reaberto_por UUID NULL`
- `motivo_reabertura TEXT NULL`
- Índice único: `(tenant_id, obra_id, mes, versao)` em vez do atual `(tenant_id, obra_id, mes)`.
- Constraint: apenas **uma** versão ativa por (tenant, obra, mes) — versão ativa = `reaberto_em IS NULL`.

Nova tabela `periodos_reaberturas` (append-only, imutável):

```
id, tenant_id, obra_id, mes,
versao_anterior, hash_anterior, snapshot_anterior_json,
reaberto_por, reaberto_em, motivo,
correlation_id, causation_id,
refechado_em NULL, refechado_por NULL,
versao_nova NULL, hash_novo NULL
```

RLS: SELECT por admin do tenant + super_admin; INSERT/UPDATE apenas via RPC (`SECURITY DEFINER`); DELETE bloqueado para todos.

## Bloco 2 — RPCs

Três RPCs novas, todas `SECURITY DEFINER` com `set_correlation_context` no topo:

1. **`reabrir_periodo(p_obra_id, p_mes, p_motivo, p_correlation_id)`**
   - Valida: admin + tenant match + período existe e está ativo + motivo ≥ 20 chars.
   - Copia versão atual para `periodos_reaberturas` (snapshot + hash preservados).
   - Marca versão atual com `reaberto_em = now()`, `reaberto_por`, `motivo_reabertura`.
   - Libera RLS de `apontamento_diarias` / `registro_presencas` / `atividades` (policies já checam `reaberto_em IS NULL`).
   - Loga `system_events` (`periodo.reaberto`) + `audit_logs`.
   - Retorna `reabertura_id` para encadear `causation_id`.

2. **`refechar_periodo(p_obra_id, p_mes, p_reabertura_id, p_correlation_id)`**
   - Valida: existe reabertura ativa + admin + `validar_fechamento` passa.
   - Recalcula folha + hash via lógica determinística existente.
   - Cria nova linha em `periodos_fechados` com `versao = anterior + 1`.
   - Atualiza `periodos_reaberturas`: `refechado_em`, `refechado_por`, `versao_nova`, `hash_novo`.
   - Loga `periodo.refechado` com `causation_id = reabertura_id`.

3. **`listar_historico_periodo(p_obra_id, p_mes)`**
   - Retorna timeline de versões: fechamento original → reaberturas → refechamentos, com hashes e motivos.

## Bloco 3 — Frontend

Dois componentes novos em `src/components/folha/`:

- **`ReaberturaPeriodoDialog.tsx`** — gatilho no card de período fechado. Exige:
  - Motivo textual (mín. 20 chars, validação client + server).
  - Confirmação por keyword (`REABRIR <MES>`).
  - Aviso explícito: "Esta ação invalida o hash atual e fica registrada permanentemente."
  - Propaga `correlation_id` via `observability.ts`.

- **`HistoricoPeriodoTimeline.tsx`** — exibido em modo expandido do período:
  - Linha do tempo com fechamento → reaberturas → refechamentos.
  - Cada nó mostra: versão, hash (truncado + copy), autor, motivo, timestamp.
  - Badge visual para versão ativa.

Banner permanente em `FolhaPagamento.tsx` quando o período está reaberto: laranja com texto "Período em reabertura — refechamento pendente".

## Bloco 4 — F1.5 absorvida

Durante a implementação acima, adicionar (sem PR separado):

- Wrapper `traced()` em `src/lib/observability.ts` para envolver mutações cliente (fechamento, reabertura, refechamento, ajuste financeiro).
- Parâmetro `_correlation_id` opcional nas RPCs financeiras restantes (`folha_pagamento`, `validar_fechamento`, `gerar_fechamento`) — quando ausente, gera UUID no servidor e devolve no retorno.
- Atualização do hook `useFolhaPagamento` para propagar correlation ID.

## Bloco 5 — OPERA_CORE v1.3

Atualizar `.lovable/OPERA_CORE.md`:

- Bump v1.2 → v1.3.
- Nova invariante: **"Reabertura é evento, não edição. Hashes anteriores são imortais."**
- Documentar ciclo das 5 etapas e o contrato append-only de `periodos_reaberturas`.
- Atualizar `mem://architecture/causal-observability.md` com padrão de `causation_id` em cadeias de reabertura.

---

## Ordem de execução

```text
1. Migration (schema + RLS + índice único por versão)
2. RPCs reabrir / refechar / listar_historico
3. Wrapper traced() + retrofit correlation_id nas RPCs financeiras (F1.5)
4. UI: ReaberturaDialog + HistoricoTimeline + banner
5. OPERA_CORE v1.3 + memória de arquitetura
6. Validação forense: simular fechamento → reabertura → ajuste → refechamento → conferir 2 hashes distintos e timeline completa
```

## Riscos cobertos

- **Reabertura silenciosa** → bloqueada (RPC exige motivo + keyword).
- **Perda de evidência histórica** → `periodos_reaberturas` append-only + snapshot original preservado.
- **Loop de reaberturas** → constraint permite só uma versão ativa; refechamento obrigatório antes de nova reabertura.
- **Quebra de cadeia causal** → `causation_id` encadeia reabertura → refechamento; `system_events` registra ambos.

## Fora de escopo (próximas frentes)

- Frente 2 (Baseline de cronograma como evidência de prazo).
- Notificação automática a stakeholders quando período é reaberto (pode entrar depois via Edge Function).
- Política de retenção / arquivamento de versões muito antigas.
