# Auditoria remota de retenção — resultados e entrega do relatório

Investigação somente leitura concluída. Nada foi alterado: sem migration, sem DDL, sem escrita, sem deploy, sem mudança de cron, RLS, secrets ou frontend.

Falta apenas uma ação: gravar o relatório em `docs/decisoes/AUDITORIA-REMOTA-RETENCAO-ATLAS-2026-08-12.md`. Aprovar este plano autoriza somente a criação desse arquivo Markdown.

## Achados principais (evidência do ambiente remoto)

**1. CRON DE RETENÇÃO ATIVO.** `cron.job` jobid 1, nome `data-retention-daily`, schedule `0 3 * * *`, `active = true`, database `postgres`, usuário `postgres`. O comando faz `net.http_post` para o endpoint `/functions/v1/data-retention`.

**2. O cron nunca conseguiu apagar nada.** O `Authorization: Bearer` embutido no comando é um JWT de papel `anon`, e o comando **não** envia o header `x-cron-secret`. A Edge Function exige segredo de cron ou JWT de superadmin. Resultado observado:

- `cron.job_run_details`: 157 execuções, todas `succeeded` (isso significa apenas "o POST foi enfileirado"), de 2026-03-09 a 2026-08-12 03:00 UTC.
- `net._http_response`: resposta HTTP **401**.
- `system_events`: **74 eventos `retention.run.denied`**, de 2026-05-31 a 2026-08-12, e **zero** `retention.run.started`, `.completed`, `.failed` ou `.table.failed`.
- `audit_logs_db`: nenhum DELETE em qualquer das 14 tabelas (o único DELETE registrado é `registro_presencas`, 1341 linhas, ação de usuário, tabela fora do escopo da retenção).

Conclusão: o mecanismo dispara diariamente e é rejeitado diariamente. Não há evidência de hard delete executado.

**3. Dados atualmente elegíveis (corte de 3 meses = 2026-05-12).**

| Tabela | Total | Mais antigo | Mais recente | Elegível |
|---|---:|---|---|---:|
| registros_diarios | 25 | 2026-03-09 | 2026-06-22 | 23 |
| checklist_semanal | 94 | 2026-03-09 | 2026-04-15 | 94 |
| ativos | 41 | 2026-03-09 | 2026-04-25 | 41 |
| sequenciamento_equipes | 36 | 2026-03-11 | 2026-05-04 | 36 |
| lancamentos_financeiros | 8 | 2026-03-30 | 2026-05-14 | 7 |
| consumo_materiais | 7 | 2026-03-09 | 2026-06-22 | 2 |
| logistica_interna | 7 | 2026-03-10 | 2026-03-10 | 7 |
| compras_emergenciais | 4 | 2026-03-09 | 2026-04-15 | 4 |
| ciclos_tarefa | 4 | 2026-04-25 | 2026-04-25 | 4 |
| incidentes_seguranca | 3 | 2026-03-09 | 2026-04-15 | 3 |
| acoes_corretivas | 2 | 2026-03-19 | 2026-03-19 | 2 |
| riscos | 2 | 2026-04-25 | 2026-04-25 | 2 |
| retrabalhos | 1 | 2026-03-11 | 2026-03-11 | 1 |
| aditivos_contratuais | 0 | — | — | 0 |

**Total elegível hoje: 226 registros.**

**4. Financeiro (crítico).** 7 de 8 lançamentos elegíveis, soma **R$ 101.425,00**, datas 2026-04-10 a 2026-04-27, **6 obras** e **2 organizações** afetadas. Nenhuma regra bloqueia o DELETE físico: as policies de `lancamentos_financeiros` são SELECT/INSERT/UPDATE/DELETE por papel — e o service_role da função ignora RLS por completo. Existe o trigger `trg_audit_lf` (`fn_audit_log_changes`), que preserva `old_data` em `audit_logs_db`; é a única via de reconstrução.

**5. Constituição × estado real.** Das 14 tabelas, apenas `lancamentos_financeiros` possui coluna `deleted_at` — e a função de retenção não a usa, faz `DELETE` físico. Nenhuma das 14 tem trigger interceptando DELETE para convertê-lo em soft delete. Classificação: **CONFLITO ARQUITETURAL OBJETIVO — INTENÇÃO NÃO DETERMINÁVEL**.

**6. Fechamentos e hashes.** `periodos_fechados` está **vazia** (0 linhas, 0 snapshots) e `cronograma_baseline` também (0 linhas). Não há fechamento antigo em risco hoje, mas também não há nenhuma camada de snapshot protegendo os dados. Se a retenção passasse a funcionar antes do primeiro fechamento, o período seria **NÃO RECONSTRUÍVEL** para as 13 tabelas sem trilha forense e **PARCIALMENTE RECONSTRUÍVEL** para o financeiro via `audit_logs_db.old_data`.

**7. Classificação final: C + A parcial.** O mecanismo está agendado e ativo (C: há 226 registros elegíveis agora), porém funcionalmente inerte por falha de autorização (A). **Não há evidência de D.** Risco: qualquer correção do header de autenticação do job — sem revisão prévia — apaga imediatamente os 226 registros, incluindo R$ 101.425,00 em lançamentos financeiros.

## O relatório a ser gravado

`docs/decisoes/AUDITORIA-REMOTA-RETENCAO-ATLAS-2026-08-12.md`, com as 13 seções pedidas: inventário do mecanismo, cron real, execuções anteriores, quantificação das 14 tabelas, análise financeira, constituição × estado real, fechamentos e hashes, política Beta × comportamento real, backup e recuperação (classificado como NÃO CONFIRMADO — o plano de controle não é consultável por SQL), classificação final, matriz de evidências com fonte e nível de confiança, e lista separada de CONFIRMADO / NÃO CONFIRMADO / CONTRADIÇÃO / RISCO / DECISÃO NECESSÁRIA.

Cada afirmação virá acompanhada da consulta SQL que a produziu. Nenhum segredo, token, JWT ou credencial será incluído — o JWT do cron será referenciado apenas pelo papel (`anon`), nunca pelo valor.

Nenhuma correção será proposta ou executada neste documento.
