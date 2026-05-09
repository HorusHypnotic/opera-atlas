## Contexto

Hoje o sistema trata `previsto`, `confirmado`, `ajustado` e `fechado` como a mesma entidade. O operador olha o total e age como se fosse líquido — mas pode haver dias futuros assumidos como presentes. Isso causou prejuízo real (pagamento sobre previsão).

A correção não é visual. É **estado contábil explícito** em cada registro de presença, propagado até o PDF e o hash de fechamento.

---

## Modelo de estados (núcleo)

Adicionar coluna `status_contabil` em `registro_presencas`:

```text
prevista    🟡  Dia futuro assumido (ex: lançado na quinta para sexta)
confirmada  🔵  Dia já ocorreu, presença registrada
ajustada    🟠  Houve alteração manual após a data
fechada     🟢  Pertence a período em periodos_fechados (derivado, não armazenado)
```

Regra de transição automática (via trigger):
- INSERT com `data > CURRENT_DATE` → `prevista`
- INSERT com `data <= CURRENT_DATE` → `confirmada`
- UPDATE em registro com `data < CURRENT_DATE` (exceto auto-promoção prevista→confirmada) → `ajustada`
- Job/trigger diário: `prevista` cuja `data <= CURRENT_DATE` → `confirmada` (mantendo valor)
- Bloqueio: registros em `periodos_fechados` não admitem mudança (já existe via RLS)

---

## Bloco 1 — Schema + lógica (DB)

1. **Migration**:
   - `ALTER TABLE registro_presencas ADD COLUMN status_contabil text NOT NULL DEFAULT 'confirmada'`
   - CHECK constraint via trigger (não CHECK, conforme mem://): valores válidos `prevista|confirmada|ajustada`
   - Backfill: registros com `data > CURRENT_DATE` → `prevista`; resto → `confirmada`
   - Índice em `(obra_id, data, status_contabil)`

2. **Trigger `fn_set_status_contabil`** (BEFORE INSERT/UPDATE):
   - INSERT: define com base em `data vs CURRENT_DATE`
   - UPDATE em campo material (`fracao_diaria`, `valor_diaria_usado`, `tipo`) após `data` → `ajustada`
   - Promoção `prevista` → `confirmada` quando `data` chega: feita via RPC `promover_previsoes()` agendável (ou no próprio `folha_pagamento` ao consultar)

3. **Atualizar `folha_pagamento` RPC**:
   - Agregados separados: `qtd_confirmada`, `valor_confirmado`, `qtd_prevista`, `valor_previsto`, `qtd_ajustada`, `valor_ajustado`
   - `valor_consolidado` = confirmada + ajustada + legado
   - `valor_projetado` = consolidado + prevista
   - Hash inclui breakdown por estado (mantém determinismo, `rule_version: 'v2'`)
   - Flag `contem_previsoes: boolean` no payload raiz

4. **`validar_fechamento`**: adicionar erro bloqueante se houver `prevista` no período → não pode fechar mês com previsão pendente.

---

## Bloco 2 — UI Relatório de Mão-de-Obra

Em `src/pages/RelatorioMaoObraPage.tsx`:

1. **Banner crítico vermelho** no topo quando `contem_previsoes === true`:
   > ⚠️ PRÉVIA OPERACIONAL — Este relatório contém R$ X em diárias **previstas** (ainda não ocorreram). Não use como base de pagamento final.

2. **Novas colunas** na tabela financeira:
   - `Confirmadas (qtd / R$)` 🔵
   - `Previstas (qtd / R$)` 🟡 — destaque amarelo
   - `Ajustes` 🟠 (já existe)
   - `Legado` (já existe)
   - `Consolidado` (sem prevista)
   - `Projetado` (com prevista)

3. **Badge por linha** quando colaborador tiver prevista: `🟡 inclui dias futuros`

4. **Footer**: dois totais lado a lado, "Consolidado" em verde, "Projetado" em amarelo.

5. **Toggle**: "Ocultar previsões" — recalcula visual sem dias futuros.

---

## Bloco 3 — PDF

1. Marca d'água diagonal "PRÉVIA OPERACIONAL — NÃO CONSOLIDADA" quando houver previsão.
2. Cabeçalho com dois totais: Consolidado vs Projetado.
3. Coluna "Estado" por linha quando houver mistura.
4. Rodapé: data/hora geração + aviso explícito.

---

## Bloco 4 — Lançamento de presença (preventivo)

Onde o operador lança presença em massa para data futura, mostrar warning inline:
> Você está registrando presença para uma data futura. Estes lançamentos serão marcados como **PREVISÃO** e devem ser confirmados após o dia ocorrer.

(Localizar no fluxo de presenças — ainda não toco até confirmar arquivos.)

---

## Ordem de execução

1. Migration (schema + trigger + backfill)
2. Atualizar `folha_pagamento` (rule_version v2) e `validar_fechamento`
3. UI `RelatorioMaoObraPage` (colunas + banner + badges)
4. PDF (marca d'água + duplo total)
5. Aviso no formulário de presença futura

Cada bloco testável isoladamente. Após Bloco 1+2 a engine já é correta — UI só revela.

---

## Riscos e mitigações

- **Hash retroativo**: ao mudar para `rule_version v2`, fechamentos antigos (`v1`) continuam verificáveis com lógica antiga? → Sim, manter ramo no `verificar_hash_periodo` baseado em `rule_version` armazenado.
- **Backfill incorreto**: registros antigos com `data > today` por erro de digitação viram "previstos" indevidamente. Mitigação: backfill só marca prevista se `data > CURRENT_DATE AND created_at >= CURRENT_DATE - 7 days`.
- **Promoção automática**: sem job agendado, depende de `folha_pagamento` ser chamada. Aceitável: a RPC promove em runtime ao consultar.

Confirma que sigo com o **Bloco 1** (migration + RPC) primeiro?
