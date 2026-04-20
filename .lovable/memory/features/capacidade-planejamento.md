---
name: Camada de Planejamento — Capacidade & Produtividade
description: tamanho_equipe_esperada na obra, eficiência de presença, produtividade por equipe, RPCs de agregação server-side
type: feature
---

## Camada de Planejamento

Pacote estrutural que adiciona dimensão de capacidade planejada vs execução real.

### Schema
- `obras.tamanho_equipe_esperada` (int, default 0) — pessoas planejadas para a obra
- `registros_diarios.equipe` (text, opcional) — agrupador leve para vincular produção a grupos de trabalho

### RPCs (server-side, todas SECURITY DEFINER + multi-tenant)
- `eficiencia_presenca(_obra_id, _data)` → { esperado, presente (soma fracao_diaria), eficiencia % }
- `produtividade_por_equipe(_obra_id, _start, _end)` → ranking por equipe/atividade
- `dashboard_aggregates(_obra_id, _start, _end)` → JSON com financeiro+presença+consumo+incidentes+capacidade em 1 query (cache 60s no client)

### Analytics (src/analytics/capacidade.ts)
- `calculateCapacidade(presencas, tamanhoEsperado, hoje?)` → CapacidadeMetrics com status (ok/warning/critical/indisponivel) e consistência (confiavel/parcial/indisponivel)
- `calculateProdutividadePorEquipe(registros)` → agrupa por `equipe || atividade || "Sem equipe"`

### Regras
- Eficiência de presença ≥90% = ok, ≥70% = warning, <70% = critical
- Se `tamanho_equipe_esperada = 0` → status "indisponivel" (NÃO pune score, conforme regra do dual model)
- Equipe é opcional no registro diário; se vazio, fallback para `atividade`
- Hook `useDashboardAggregates()` com staleTime 60s — preparado para migração futura de cálculos pesados client→server
