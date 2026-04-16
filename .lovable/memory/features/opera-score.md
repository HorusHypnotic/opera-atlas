---
name: O.P.E.R.A. Score
description: Dashboard structure, 5 pillars, KPI logic, dual score (performance + consistency), no penalties
type: feature
---

## Opera Score — Dual Model

Score = Performance (0-100) + Consistency Index (confiável/parcial/indisponível)

**Rule**: Missing data never reduces score — it reduces visibility/confidence.

### Pillars (20 pts each)
- **O (Organização)**: 60% registros_diarios status OK + 40% registro_presencas taxa. If no presencas, uses only registros.
- **P (Padronização)**: Mean material deviation (consumo_materiais real vs previsto)
- **E (Eficiência)**: % ativos with status "ativo". Defaults to 0 when no ativos (not 1).
- **R (Redução de Perdas)**: 20 minus risk/rework penalties
- **A (Análise Contínua)**: Margin score + safety score (NCs abertas)

### Consistency
- Three levels: ✅ confiável, ⚠️ parcial, ❌ indisponível
- Each pillar has its own level + items array
- Items sorted by severity (indisponível first)
- Overall = worst of all pillars

### Key rule
"Presença não é inferida. É declarada." — use registro_presencas as source of truth, not registros_diarios.
