# Auditoria de retenção e preservação financeira

**Data:** 2026-08-12
**Projeto:** OPERA Atlas (`aiyluolhojdszqitusum`)
**Natureza:** comprovação e plano; nenhuma exclusão, desativação, migration ou publicação

## Resumo executivo

Existe um mecanismo efetivamente capaz de excluir automaticamente dados operacionais e financeiros. O código existe, a Edge Function `data-retention` está deployada e executa hard delete com `service_role` em 14 tabelas quando chamada por segredo de cron ou por superadmin. `lancamentos_financeiros` está explicitamente no conjunto.

O agendamento ativo não pôde ser confirmado. O manual afirma `data-retention-daily` diariamente às 03h via `pg_cron`/`pg_net`, mas o código versionado apenas cria as extensões; não contém `cron.schedule`, workflow ou chamada periódica. Não havia token Supabase de gerenciamento, senha de banco, service role ou sessão autenticada disponível. Portanto, cron, logs globais, contagens e execuções anteriores permanecem **NÃO CONFIRMADOS**.

O risco atual é **CRÍTICO**: a função destrutiva está implantada e pode ser acionada; se o cron documentado existir remotamente, dados elegíveis são apagados diariamente. Mesmo sem cron, um superadmin ou detentor de `CRON_SECRET` pode acioná-la.

## 1. Evidências e limites

### Preservação da auditoria anterior

O relatório anterior foi revisado, normalizado quanto a whitespace, commitado e enviado fast-forward para `origin/main`:

- commit: `b4db65f32f0bec27143dc2e956f18d387e9062fd`
- mensagem: `docs(atlas): record identity and architecture audit`
- `HEAD == origin/main` após o push

### Acesso remoto disponível

O projeto local contém apenas `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID` e chave publicável. Não há `SUPABASE_ACCESS_TOKEN`, service role ou senha de banco disponível. O CLI recusou listagem de funções/projetos por ausência de access token.

Uma requisição segura `OPTIONS` ao endpoint remoto retornou HTTP 200 com os cabeçalhos exatos da versão atual (`x-cron-secret`, `x-correlation-id`, `x-causation-id`). Como o handler responde a `OPTIONS` antes de criar observabilidade ou executar deletes, isso confirmou o deploy sem acionar a retenção.

Consultas REST anônimas com `count=exact` retornaram `Content-Range: */0` em todas as tabelas, inclusive `system_events`. Sob RLS, esse resultado significa “zero linhas visíveis ao papel anon”, não “zero linhas existentes”. Ele não foi usado como contagem.

## 2. Estado comprovado

| Condição | Estado | Evidência |
|---|---|---|
| Código existe | SIM | `supabase/functions/data-retention/index.ts` desde `3336cc2` |
| Banner existe | SIM | `DataRetentionBanner.tsx`, renderizado no dashboard |
| Função deployada | SIM | endpoint remoto responde 200 ao preflight com assinatura da versão atual |
| Hard delete real | SIM | `.delete().lt("created_at", cutoff).select("id")` com cliente service role |
| Prazo backend | 3 meses de calendário | `Date.setMonth(currentMonth - 3)` |
| Autorização | segredo cron ou JWT de superadmin | validação explícita na função |
| `CRON_SECRET` configurado | NÃO CONFIRMADO | nomes de secrets remotos não acessíveis |
| Cron ativo | NÃO CONFIRMADO | manual afirma ativo; repositório não contém schedule |
| Última execução | NÃO CONFIRMADO | logs remotos inacessíveis com credenciais disponíveis |
| Dados em risco agora | NÃO QUANTIFICADO | RLS anon impede contagens reais |

## 3. Fluxo real

```text
registro inserido (created_at)
        │
        ├── frontend carrega apenas 5 das 14 tabelas
        │     └── calcula idade como 3 × 30 = 90 dias
        │           ├── <= 30 dias restantes: aviso azul
        │           ├── <= 7 dias: aviso âmbar
        │           └── <= 1 dia: aviso vermelho
        │
        └── chamada externa à Edge Function (momento NÃO CONFIRMADO)
              ├── x-cron-secret igual a CRON_SECRET, ou
              └── Bearer JWT cujo profile é superadmin
                    ↓
              cutoff = instante atual menos 3 meses de calendário
                    ↓
              cliente service_role ignora RLS
                    ↓
              DELETE físico por tabela WHERE created_at < cutoff
                    ↓
              system_events recebe started/completed/failed
```

Não há “gatilho aos 30/7/1 dias”. Esses marcos existem somente no navegador e não acionam backend. O backend apaga quando alguém chama a função.

### Divergência frontend/backend

O banner usa 90 dias fixos. O backend usa meses de calendário, que variam entre 28 e 31 dias. Em 2026-08-12, o cutoff backend é aproximadamente 2026-05-12 no mesmo horário, enquanto 90 dias aponta aproximadamente 2026-05-14. Um registro pode deixar de aparecer no aviso frontend antes de se tornar elegível no backend, ou o prazo exibido pode diferir do real. A variável `daysUntilDeletion` é calculada e nunca utilizada.

O manual ainda afirma que a função aceita `retentionMonths` por parâmetro, mas a implementação não lê request body: o valor é hardcoded em `3`.

## 4. Inventário das 14 tabelas atingidas

Todas sofrem hard delete direto. Não foram encontradas FKs de outras tabelas apontando para essas 14; logo, o delete não aparenta disparar cascata relacional descendente. Cada registro referencia `obras` e `tenants`; nas tabelas iniciais essas referências usam `ON DELETE CASCADE`, mas isso atua ao excluir obra/tenant, não ao excluir o registro operacional.

| Tabela | Informação | Cascade ao apagar a linha | Importância/risco |
|---|---|---|---|
| `lancamentos_financeiros` | receitas, custos, fornecedor, pagamento | nenhum FK dependente encontrado; trigger preserva `OLD` em `audit_logs_db` | CRÍTICA |
| `aditivos_contratuais` | valor e aprovação de aditivos | nenhum dependente encontrado | CRÍTICA |
| `compras_emergenciais` | compras, custo, justificativa | nenhum dependente encontrado | ALTA |
| `consumo_materiais` | previsto/real, custo e estoque consumido | nenhum dependente encontrado | ALTA |
| `registros_diarios` | mão de obra, produção e custo diário | nenhum dependente encontrado | CRÍTICA |
| `sequenciamento_equipes` | planejamento temporal de equipes | nenhum dependente encontrado | ALTA |
| `ciclos_tarefa` | tempos e medições de produtividade | nenhum dependente encontrado | ALTA |
| `logistica_interna` | deslocamentos e logística por equipe | nenhum dependente encontrado | MÉDIA |
| `ativos` | equipamentos, localização, status e valor | nenhum dependente encontrado | ALTA |
| `riscos` | risco, severidade, impacto e prazo | nenhum dependente encontrado | ALTA |
| `retrabalhos` | etapa, quantidade e descrição | nenhum dependente encontrado | ALTA |
| `incidentes_seguranca` | incidentes, severidade e status | nenhum dependente encontrado | CRÍTICA |
| `checklist_semanal` | verificações e observações semanais | nenhum dependente encontrado | MÉDIA |
| `acoes_corretivas` | problema, ação, responsável, prazo e evidência | nenhum dependente encontrado | ALTA |

### Tabelas importantes não atingidas diretamente

- `registro_presencas`, `apontamento_diarias`, `colaboradores` e `colaborador_obras`;
- `lotes_consumo` e `lote_materiais`;
- `atividades`, `atividade_dependencias` e `cronograma_baseline`;
- `periodos_fechados`, `periodos_reaberturas` e seus snapshots/hashes;
- `audit_logs`, `audit_logs_db` e `system_events`;
- `obras`, `tenants`, `profiles`, `user_roles` e `obra_membros`.

“Presença”, “folha”, “fechamentos”, “snapshots” e “auditoria” não estão no array destrutivo. Contudo, `registros_diarios` e `lancamentos_financeiros` alimentam análises e reconstrução operacional/financeira; mantê-los apagados enquanto fechamentos e hashes sobrevivem cria divergência entre estado primário e materializado.

## 5. Auditoria e cascatas

`lancamentos_financeiros` possui trigger DB-level `trg_audit_lf` para INSERT/UPDATE/DELETE. Em um hard delete, `audit_logs_db.old_data` deve receber a linha completa, mesmo quando a exclusão vem do service role. Isso oferece possível evidência/recuperação parcial do financeiro, mas não substitui backup e precisa ser confirmado no banco remoto.

As outras 13 tabelas do mecanismo não possuem trigger forense equivalente identificado. A Edge Function registra somente contagens agregadas por tabela em `system_events`, não o conteúdo apagado nem os IDs. Assim, para essas tabelas, uma execução pode ser irreversível a partir dos dados aplicativos restantes.

## 6. Agendamento e estado remoto

### Evidência favorável a cron ativo

- `MANUAL_SISTEMA.md` afirma repetidamente `data-retention-daily`, diariamente às 03h, via `pg_cron` + `pg_net`.
- A migration `20260308215547...sql` habilita ambas as extensões.
- O endpoint está deployado.

### Evidência ausente/contrária à comprovação

- nenhuma migration contém `cron.schedule`;
- nenhum workflow GitHub chama a função;
- nenhuma chamada frontend ou server-side periódica foi encontrada;
- URL, headers e secret do job não estão versionados;
- não foi possível consultar `cron.job` ou plano de controle remoto.

**Classificação:** `NÃO CONFIRMADO`. A documentação é intenção/alegação, não prova do estado remoto.

Para confirmar com acesso autorizado, executar somente leitura:

```sql
select jobid, schedule, command, active, jobname
from cron.job
where command ilike '%data-retention%' or jobname ilike '%retention%';

select jobid, status, start_time, end_time, return_message
from cron.job_run_details
where jobid in (select jobid from cron.job where command ilike '%data-retention%')
order by start_time desc
limit 50;
```

Também listar deploys/logs da função pelo plano de controle Supabase. Nenhuma dessas consultas deve chamar o endpoint.

## 7. Dados potencialmente em risco

As contagens reais não puderam ser obtidas com segurança. Todos os valores abaixo permanecem `NÃO CONFIRMADOS`; `*/0` sob anon/RLS não é zero real.

| Tabela | Total | >60d | >75d | >83d | >89d | elegível no cutoff | mais antigo |
|---|---:|---:|---:|---:|---:|---:|---|
| todas as 14 | NÃO CONFIRMADO | NÃO CONFIRMADO | NÃO CONFIRMADO | NÃO CONFIRMADO | NÃO CONFIRMADO | NÃO CONFIRMADO | NÃO CONFIRMADO |
| `lancamentos_financeiros` | NÃO CONFIRMADO | NÃO CONFIRMADO | NÃO CONFIRMADO | NÃO CONFIRMADO | NÃO CONFIRMADO | NÃO CONFIRMADO | NÃO CONFIRMADO |

Com conexão read-only adequada, usar limites calculados no servidor para evitar diferenças de relógio. A consulta deve agregar, sem exportar dados pessoais:

```sql
select
  count(*) as total,
  count(*) filter (where created_at < now() - interval '60 days') as gt_60d,
  count(*) filter (where created_at < now() - interval '75 days') as gt_75d,
  count(*) filter (where created_at < now() - interval '83 days') as gt_83d,
  count(*) filter (where created_at < now() - interval '89 days') as gt_89d,
  count(*) filter (where created_at < now() - interval '3 months') as elegiveis,
  min(created_at) as mais_antigo
from public.<tabela>;
```

Para `lancamentos_financeiros`, agrupar elegíveis somente por `tenant_id` e `obra_id`, reportando contagens e intervalo de datas; resolver nomes apenas em ambiente autorizado e não incluí-los no relatório público.

## 8. Evidência de exclusões anteriores

**NÃO É POSSÍVEL DETERMINAR com o acesso atual.** Não foi encontrada evidência versionada de execução. Os locais remotos adequados são:

1. `system_events` com `event_type` em `retention.run.started`, `.completed`, `.failed` e `retention.table.failed`;
2. `audit_logs_db` com `table_name = 'lancamentos_financeiros'` e `operation = 'DELETE'`;
3. `cron.job_run_details`;
4. logs da Edge Function;
5. backups/PITR e métricas históricas de contagem.

Um DELETE financeiro no `audit_logs_db` prova exclusão, mas não sozinho que foi causado pela retenção; correlacionar horário, `system_events`, cutoff e volume. Para as outras 13 tabelas, a ausência de auditoria por linha reduz severamente a capacidade de prova.

## 9. Estratégia mínima de backup reconstruível

Antes de desativar ou alterar qualquer coisa, criar um snapshot lógico consistente de produção em local criptografado e restrito:

1. Registrar UTC, projeto, versão do schema/migrations e cutoff proposto.
2. Exportar schema `public`, funções, triggers, policies, enums e extensões.
3. Exportar dados das 14 tabelas **e** dependências necessárias: `tenants`, `obras`, tabelas de equipe/presença, fechamentos/reaberturas, auditorias e eventos.
4. Preferir dump PostgreSQL custom (`pg_dump -Fc`) para restauração fiel; gerar CSV/JSON somente como cópia auditável complementar.
5. Produzir manifesto sem dados pessoais: tabela, quantidade, `min/max(created_at)`, tamanho, SHA-256 do arquivo e timestamp.
6. Armazenar dump, manifesto e migration HEAD juntos, com controle de acesso e cópia fora do ambiente Lovable.

Exemplo conceitual, com credenciais fornecidas por canal seguro e nunca gravadas no repositório:

```text
pg_dump --format=custom --no-owner --no-acl --schema=public <connection> > opera-atlas-UTC.dump
sha256sum opera-atlas-UTC.dump > opera-atlas-UTC.dump.sha256
```

Não usar somente exportação via UI, screenshot ou CSV sem schema. Não incluir secrets no manifesto.

## 10. Teste de restauração

**NÃO TESTADO:** não existe ambiente isolado e credenciado disponível nesta sessão.

Procedimento obrigatório:

1. criar Postgres/Supabase descartável e isolado, nunca produção;
2. validar checksum do dump;
3. restaurar extensões/schema e depois dados;
4. executar `ANALYZE` e checar constraints/FKs;
5. comparar contagem, `min/max(created_at)` e agregados financeiros por tenant/obra;
6. recomputar hashes/snapshots de uma amostra de períodos fechados sem sobrescrevê-los;
7. comparar `audit_logs_db`, `system_events` e histórico de reabertura;
8. registrar diferenças e destruir o ambiente de teste de forma controlada após aprovação.

Aceitação: checksum válido, zero violação referencial, contagens idênticas, totais financeiros idênticos e hashes explicáveis.

## 11. Motivo histórico

O mecanismo e o banner nasceram juntos no commit `3336cc2` (“Implement data retention policy”), em 2026-03-08. O manual foi atualizado logo depois no commit `6774463`.

A evidência documental indica:

- regra da fase **Beta**;
- objetivo de ampliar capacidade efetiva diante de storage mínimo (manual estima capacidade “~3x maior”);
- planos futuros de 3/6/12 meses ou ilimitado.

Não há ADR com análise de risco financeiro, requisito legal, privacidade, backup ou restore. A afirmação de configuração futura está desatualizada frente ao código hardcoded. Depois, o OPERA_CORE introduziu invariantes de append-only, reprodutibilidade e hashes imortais, tornando a regra antiga incompatível com a arquitetura posterior.

**Classificação:** regra legada perigosa; a justificativa Beta/storage não é suficiente para destruir dados-fonte financeiros e auditáveis.

## 12. Quebra de reconstruibilidade

Sim, o schema permite que `periodos_fechados.snapshot_json` e `hash_snapshot` permaneçam enquanto dados-fonte atingidos — sobretudo `lancamentos_financeiros` e `registros_diarios` — são apagados. O snapshot de folha depende principalmente de presença/apontamentos, que não estão no array, mas relatórios financeiros e operacionais mais amplos deixam de ser reconstruíveis.

Isso viola ou ameaça diretamente:

- I3, histórico append-only;
- I7, reprodutibilidade de estado;
- I9, determinismo financeiro;
- I11, imortalidade e lineage de versões de fechamento.

Princípio recomendado:

> Um mecanismo de retenção não deve destruir silenciosamente informação necessária para reconstrução financeira, operacional ou auditável de uma obra.

## 13. Opções de estado futuro

| Opção | Benefício | Limite | Avaliação Atlas |
|---|---|---|---|
| A. Remover retenção automática | elimina risco imediato | exige política manual e capacidade | necessária para dados críticos |
| B. Soft delete | recuperação simples e trilha | não reduz storage sozinho | adequada para operação corrente |
| C. Arquivamento | reduz conjunto quente sem destruir | exige storage, índices e restore testado | adequada para dados antigos |
| D. Retenção configurável | atende planos/contratos | perigosa se permitir apagar core | somente para classes não críticas e com consentimento |
| E. Imutabilidade crítica | preserva finanças, hashes e auditoria | maior custo de retenção | obrigatória |

Combinação recomendada:

1. imutabilidade permanente para lançamentos financeiros, fechamentos, snapshots, hashes e auditoria;
2. remover essas classes de qualquer hard delete;
3. soft delete com janela de recuperação para entidades operacionais mutáveis;
4. arquivamento portável para dados antigos;
5. política configurável apenas depois de classificação de dados, consentimento e backup/restore comprovado;
6. retenção física eventual somente para dados derivados/regeráveis ou por obrigação documentada.

## 14. Recomendação e condição de ação

A próxima ação, **antes de executar qualquer desativação**, é obter acesso read-only autorizado ao banco/plano de controle e realizar, nesta ordem:

1. consultar `cron.job`, logs e `system_events` para confirmar risco temporal imediato;
2. quantificar as 14 tabelas, com prioridade a `lancamentos_financeiros`;
3. produzir dump completo consistente e manifesto com checksums;
4. testar restore em ambiente isolado;
5. somente após backup validado, aprovar uma missão de contenção que desative o schedule — sem remover função ou dados — e verifique que nenhum novo run ocorreu;
6. substituir o hard delete por política de imutabilidade + soft delete/arquivamento em missão posterior.

Até essas etapas, não chamar `data-retention`, não criar/alterar cron e não confiar no banner como prazo real.
