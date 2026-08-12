# Contenção controlada do cron `data-retention-daily`

Pré-condição já verificada agora, somente leitura, no ambiente remoto:

| Campo | Valor |
|---|---|
| jobid | 1 |
| jobname | data-retention-daily |
| schedule | `0 3 * * *` |
| active | **true** |
| database / username | postgres / postgres |
| command | contém `/functions/v1/data-retention` (valor redigido — pode conter credencial) |

Exatamente uma linha retornada. `lancamentos_financeiros`: 8 registros, 7 elegíveis pelo corte de 3 meses — estado idêntico ao da auditoria.

Pré-condição corresponde integralmente ao alvo canônico. Autorizado prosseguir.

## O que será executado

1. **Contenção** — bloco `do $$ ... $$` exatamente como especificado: revalida internamente jobid, jobname, schedule, active e o `ilike` do command; aborta com exception se não retornar 1; caso contrário executa `cron.alter_job(1, active := false)`.
2. **Pós-condição** — releitura de `cron.job` para jobid 1, confirmando `active = false` e schedule, database, username e command inalterados (command reportado apenas como "inalterado", nunca em valor).
3. **Verificação de integridade** — leituras mínimas: contagem das 14 tabelas operacionais comparada à auditoria, `lancamentos_financeiros` ainda com 8 registros e 7 elegíveis presentes, e ausência de eventos `retention.run.started/completed/failed` em `system_events` durante a janela desta ação.
4. **Registro** — relatório em chat com timestamp UTC, estado anterior (`true`), estado posterior (`false`), job preservado, Edge Function preservada, dados preservados, nenhuma autenticação corrigida, nenhum hard delete. Sem JWT, token ou segredo.

## Fora do escopo — não será feito

Sem alteração de código, Edge Function, autenticação, secrets, RLS ou dados. Sem `cron.unschedule`, sem DELETE em `cron.job`, sem mudança de schedule ou command, sem execução de `data-retention`, sem alteração do banner de retenção no frontend, sem publicação e sem nova política de retenção.

## Detalhe técnico

A alteração roda via a ferramenta de execução SQL do backend (não como migration versionada), já que toca apenas estado de agendamento no schema `cron` e não deve ser replicada em remix. O bloco `do` é idempotente na prática: se reexecutado após a contenção, a pré-condição interna (`active = true`) falha e ele levanta exception sem alterar nada.

Condição de parada: confirmado `active = false`, o trabalho encerra.
