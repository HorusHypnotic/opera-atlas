---
name: Causal observability
description: Correlation/causation IDs + structured logging spanning client, edge functions, RPC, audit. Use src/lib/observability.ts and supabase/functions/_shared/observability.ts. Logs go to system_events via log_system_event RPC.
type: feature
---

# Observabilidade causal — passo #2 pós OPERA_CORE

## O contrato

Toda transição de estado, decisão crítica, autorização, falha ou mutação relevante deve gerar um evento na tabela `system_events`, carregando:

- `correlation_id` — a história inteira de uma cadeia causal (mesmo valor em todos os eventos da operação).
- `causation_id` — o evento pai direto que originou este (forma a árvore causal).
- `actor_id`, `tenant_id`, `obra_id` — derivados server-side via `log_system_event` RPC (cumpre I1/I2).
- `event_type` — nome semântico (ex: `auth.reset_link.issued`, `presenca.confirmar`, `periodo.fechar`).
- `source` — origem técnica (ex: `client.RegistroPage`, `edge.generate-reset-link`).
- `status` — `success`/`failure`/`warning`/`info`/`denied`.
- `severity` — `debug`/`info`/`warning`/`error`/`critical`.

## Como usar

### Cliente (`src/lib/observability.ts`)

```ts
import { startCausalContext, logEvent, traced, causalHeaders } from "@/lib/observability";

// Início de uma ação do usuário
const ctx = startCausalContext("client.PresencaPage", { obraId });

// Loga evento simples
const eventId = await logEvent({ ctx, eventType: "presenca.iniciar" });

// Mede + loga sucesso/falha
await traced({ ctx, eventType: "presenca.confirmar" }, async () => {
  await supabase.from("registro_presencas").update(...);
});

// Propaga a edge functions
await supabase.functions.invoke("nome", {
  body: {...},
  headers: causalHeaders(ctx),
});
```

### Edge function (`supabase/functions/_shared/observability.ts`)

```ts
import { createEdgeObservability, correlationResponseHeaders } from "../_shared/observability.ts";

const obs = createEdgeObservability(req, "edge.minha-funcao");
const headers = { ...corsHeaders, ...correlationResponseHeaders(obs), "Content-Type": "application/json" };

await obs.log({ event_type: "minha.acao", status: "success", payload: {...} });
// ou
await obs.traced({ event_type: "minha.acao" }, async () => { ... });
```

A função recolhe `x-correlation-id` / `x-causation-id` do request automaticamente. Se não vier, gera novo.

## Regras de logging (não negociáveis)

**Logar:**
- Transições de estado (`prevista→confirmada`, `aberto→fechado`)
- Decisões de autorização (deny, escalação)
- Mutações financeiras / de fechamento
- Falhas e exceções
- Ações administrativas (criar convite, alterar role, gerar reset)
- Edge function entry/exit

**NÃO logar:**
- Renders, polling, hover, scroll
- Operações triviais de leitura
- Mudança de filtro / paginação

Logging excessivo destrói sinal. Falha de logging NUNCA derruba fluxo de negócio (todas as funções fazem `try/catch` e retornam null em erro).

## Schema

`system_events` é append-only. RLS:
- SELECT: admin do tenant ou super admin.
- INSERT: apenas via `log_system_event` RPC (SECURITY DEFINER que valida tenant).

Colunas adicionadas em `audit_logs` e `audit_logs_db`: `correlation_id`, `causation_id` (amarra trilha existente à nova narrativa).

## Referência rápida — convenções de event_type

Padrão: `<dominio>.<acao>[.<resultado>]`

- `auth.reset_link.issued` / `.denied` / `.failed`
- `auth.invite.created` / `.accepted`
- `presenca.confirmar` / `presenca.ajustar`
- `periodo.fechar` / `periodo.reabrir`
- `obra.criar` / `obra.excluir` / `obra.restaurar`
- `tenant.setup` / `tenant.invite_member`
