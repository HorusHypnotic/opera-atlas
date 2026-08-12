# Implementação — Baseline de Prazo V1 — 2026-08-12

Status: **IMPLEMENTADO — FASE 1A**. O diff estrutural da Fase 1B permanece pendente.

## Persistência e autoridade

A migration `20260812170000_schedule_baseline_v1.sql` evolui a tabela existente `cronograma_baseline`. Os campos
`congelado_em` e `congelado_por` representam criação e aprovação, pois a V1 não possui rascunho; `hash` representa
o hash do snapshot de prazo. Foram acrescentados formato, versão do formato, algoritmo e lineage por
`baseline_anterior_id`.

A RPC `aprovar_baseline_cronograma` deriva usuário e tenant no servidor, rejeita superadmin e papéis diferentes de
admin contextual, valida acesso à obra, serializa aprovações concorrentes pela linha da obra e cria a próxima versão
em uma única transação. A maior versão é a única vigente; nenhuma versão anterior é atualizada para expressar essa
vigência. A RPC registra `cronograma.baseline_aprovado` em `audit_logs` e `system_events`, com correlation ID.

## Contrato do snapshot e hash

O envelope JSONB contém `tenant_id`, `obra_id`, `atividades` e `dependencias`. Cada atividade contém somente `id`,
`nome`, `data_inicio`, `data_fim`, `duracao_dias`, `responsavel` e `ordem`. Cada dependência contém
`predecessora_id`, `sucessora_id`, `tipo` e `lag_dias`. Progresso, aparência, timestamps mutáveis, exclusões lógicas
e dados financeiros ficam fora.

Atividades são ordenadas por UUID; dependências por predecessor, sucessor, tipo e lag. Datas usam `YYYY-MM-DD` e o
JSONB normaliza a ordem de propriedades. O SHA-256 é calculado no PostgreSQL sobre
`opera.atlas.schedule-baseline:v1:<jsonb-canônico>`, separado de qualquer hash financeiro. O snapshot não contém o
instante da aprovação e não depende do navegador, timezone local ou relógio do cliente.

## Imutabilidade, UI e testes

Escrita direta autenticada foi revogada. Um trigger bloqueia `UPDATE` e `DELETE`, inclusive para operações com
privilégio elevado; mudança de compromisso cria nova versão. A RLS mantém leitura por tenant/obra e leitura de
superadmin, sem lhe conceder aprovação rotineira.

O Cronograma ganhou um painel compacto com estado vigente, hash resumido, confirmação para aprovação exclusiva de
admin contextual e histórico de versão, data, aprovador, hash e vigência. O Gantt e a edição do plano corrente não
foram alterados.

O teste pgTAP `schedule_baseline.test.sql` cobre determinismo, ordenação, versões, preservação, vigência única,
negação a não-admin, isolamento cross-tenant e imutabilidade.

## Limitações deliberadas

Não há diff estrutural, visualização integral do snapshot, realizado verificável, EV/PV/SPI, rebaseline sofisticado,
fechamento temporal de prazo ou integração com hashes financeiros. Dados legados não são promovidos a baseline:
continuam no estado sem baseline histórico até uma aprovação prospectiva real.
