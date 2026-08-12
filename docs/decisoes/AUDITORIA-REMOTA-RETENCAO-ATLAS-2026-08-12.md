# Auditoria remota de retenção — OPERA Atlas

**Data da coleta:** 2026-08-12 (~15:10 UTC)
**Natureza:** somente leitura. Nenhuma alteração de código, banco, migration, DDL, Edge Function, secret, cron, RLS, policy, frontend ou publicação foi executada.
**Escopo:** estado efetivamente implantado no ambiente Lovable Cloud, não o repositório nem a documentação histórica.

Todas as consultas usadas foram `SELECT`/agregação. Nenhum valor de secret, token, JWT, senha ou credencial é reproduzido neste documento.

---

## Resumo executivo

O mecanismo de retenção **existe, está deployado e está agendado e ativo**, disparando diariamente às 03:00 UTC desde 2026-03-09. **Nunca conseguiu apagar nada**: o job envia um JWT de papel `anon` e não envia o header de segredo exigido, então a Edge Function responde **HTTP 401** e registra `retention.run.denied`. Não há nenhuma evidência de hard delete executado.

Hoje existem **226 registros elegíveis** para exclusão nas 14 tabelas, incluindo **7 lançamentos financeiros somando R$ 101.425,00**, distribuídos em 6 obras e 2 organizações. Se a autorização do job for "consertada" sem revisão prévia, essa exclusão ocorre na próxima janela das 03:00 UTC.

Classificação final: **C combinado com A** (agendado e ativo, com registros elegíveis, porém funcionalmente inerte por falha de autorização). **Sem evidência de D.**

---

## 1. Inventário do mecanismo de retenção

| Item | Estado | Evidência |
|---|---|---|
| Edge Function `data-retention` | **ESTÁ DEPLOYADO** | o cron a invoca e o endpoint responde 401 (`net._http_response`) |
| Código-fonte da função | **EXISTE NO CÓDIGO** | `supabase/functions/data-retention/index.ts` |
| Versão exata deployada | **NÃO FOI POSSÍVEL CONFIRMAR** | plano de controle não consultável por SQL; a resposta 401 é compatível com o código versionado |
| Tabelas alcançadas | 14 (lista abaixo) | array `OPERATIONAL_TABLES` no código |
| Campo temporal | `created_at` em todas as 14 | idem |
| Cálculo da data limite | `now()` menos 3 meses de calendário (`setMonth(-3)`), hardcoded | idem; **não** lê parâmetro do request body |
| Método de exclusão | `DELETE` físico via `.delete().lt(created_at, cutoff).select("id")`, cliente `service_role` (ignora RLS) | idem |
| Autorização exigida | header `x-cron-secret` igual a `CRON_SECRET`, **ou** Bearer JWT cujo `profiles.is_super_admin = true` | idem |
| Secrets relacionados | `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` (nomes apenas) | `Deno.env.get` no código; **valores não inspecionados** |
| `CRON_SECRET` configurado no ambiente | **NÃO FOI POSSÍVEL CONFIRMAR** | nomes/valores de secrets de Edge Functions não são legíveis por SQL. O 401 recorrente é consistente com "o job não envia o header", independentemente do secret existir |
| Eventos gerados | `retention.run.denied` (74 ocorrências) em `system_events` | ver §3 |
| Dependências | `pg_cron` 1.6.4, `pg_net` 0.19.5, `pgcrypto` 1.3 — **EXISTEM NO BANCO** | `pg_extension` |
| Funções SQL relacionadas | `log_system_event` (chamada pela função para observabilidade). Nenhuma função SQL executa a retenção | `pg_proc` |
| Triggers relacionados | Nenhum trigger de retenção. Nas 14 tabelas existem apenas `trg_audit_lf` + `trg_updated_meta_lf` (`lancamentos_financeiros`) e `trg_extract_producao_valor` (`registros_diarios`) | `pg_trigger` |
| Policies/RLS relevantes | Irrelevantes na prática: a função usa `service_role`, que **bypassa RLS** | `pg_policies` |

Tabelas alcançadas: `registros_diarios`, `consumo_materiais`, `incidentes_seguranca`, `lancamentos_financeiros`, `retrabalhos`, `ativos`, `riscos`, `ciclos_tarefa`, `logistica_interna`, `sequenciamento_equipes`, `compras_emergenciais`, `aditivos_contratuais`, `checklist_semanal`, `acoes_corretivas`.

---

## 2. Cron / agendamento real

### CRON DE RETENÇÃO ATIVO.

```sql
select jobid, jobname, schedule, active, database, username, left(command,300) from cron.job;
```

| Campo | Valor |
|---|---|
| jobid | `1` |
| jobname | `data-retention-daily` |
| schedule | `0 3 * * *` (diário, 03:00 UTC = 00:00 America/Sao_Paulo) |
| active | `true` |
| database | `postgres` |
| username | `postgres` |
| comando | `SELECT net.http_post(url := '<project>/functions/v1/data-retention', headers := '{"Content-Type":"application/json","Authorization":"Bearer <JWT>"}' ...)` |

**Achado crítico sobre o comando** (verificado sem expor o token):

- o comando **não contém** o header `x-cron-secret` (`command ilike '%x-cron-secret%'` → `false`);
- o JWT embutido tem `role = "anon"` (decodificação apenas do claim `role`; o valor do token não foi lido nem registrado).

Ou seja: o job existe, está ativo e dispara, mas **não satisfaz nenhuma das duas condições de autorização da função**.

Última execução: **2026-08-12 03:00:00 UTC**. Próxima condição: 03:00 UTC diariamente, enquanto `active = true`.

Nenhuma alteração foi feita no job.

---

## 3. Execuções anteriores

### `cron.job_run_details`

```sql
select jobid, status, count(*), min(start_time), max(start_time) from cron.job_run_details group by 1,2;
```

| jobid | status | execuções | primeira | última |
|---|---|---:|---|---|
| 1 | `succeeded` | **157** | 2026-03-09 03:00 UTC | 2026-08-12 03:00 UTC |

Zero falhas. **Atenção interpretativa:** `succeeded` aqui significa apenas que o `net.http_post` foi enfileirado com sucesso pelo Postgres — não diz nada sobre o resultado HTTP.

### `net._http_response`

```sql
select status_code, count(*), min(created), max(created) from net._http_response group by 1;
```

| status_code | ocorrências | janela |
|---|---:|---|
| **401** | 1 | 2026-08-12 03:00 UTC |

A tabela de respostas do `pg_net` tem retenção curta (limpeza automática), então guarda apenas a execução mais recente. O único código observado é **401 Unauthorized**.

### `system_events`

```sql
select event_type, status, count(*), min(created_at), max(created_at)
from system_events where event_type like 'retention%' group by 1,2;
```

| event_type | status | ocorrências | primeira | última |
|---|---|---:|---|---|
| `retention.run.denied` | `denied` | **74** | 2026-05-31 03:00 UTC | 2026-08-12 03:00 UTC |

- `retention.run.started` — **0 ocorrências**
- `retention.run.completed` — **0 ocorrências**
- `retention.run.failed` — **0 ocorrências**
- `retention.table.failed` — **0 ocorrências**

`system_events` contém **74 linhas no total** — todas de retenção negada. O evento mais antigo da tabela é de 2026-05-31, ou seja, a trilha causal só cobre a partir dessa data. As execuções de 2026-03-09 a 2026-05-30 (≈83 disparos) **não têm registro em `system_events`** e permanecem sem evidência direta de resultado; o padrão do comando do job (inalterado, sem `x-cron-secret`) torna improvável que tenham sido autorizadas, mas isso é inferência, não prova.

### `audit_logs_db`

```sql
select table_name, operation, count(*), min(created_at), max(created_at)
from audit_logs_db where operation='DELETE' group by 1,2;
```

| table_name | operação | linhas | primeira | última |
|---|---|---:|---|---|
| `registro_presencas` | DELETE | 1341 | 2026-05-04 | 2026-08-10 |

`registro_presencas` **não pertence** ao conjunto da retenção — esses deletes correspondem a ação de usuário (exclusão em lote na tela de Presenças & Faltas). **Nenhum DELETE registrado em qualquer das 14 tabelas do mecanismo.**

### Conclusões da seção

- `data-retention` **já executou como requisição** (157 disparos), mas **nunca passou da checagem de autorização** em nenhuma execução observável.
- Nenhuma tabela foi afetada. Nenhum registro removido pelo mecanismo. Nenhuma falha de tabela.
- **Ressalva formal:** ausência de evidência entre 2026-03-09 e 2026-05-30 não é prova de ausência de execução. Para esse intervalo, o estado é **NÃO FOI POSSÍVEL CONFIRMAR** — a confirmação exigiria logs da Edge Function no plano de controle, que não são acessíveis por SQL.

---

## 4. Quantificação dos dados

Corte real da função em 2026-08-12: **2026-05-12** (3 meses de calendário). Consulta por tabela com `count(*) filter (where created_at < now() - interval '3 months')`.

| Tabela | Total | Mais antigo | Mais recente | Elegível hoje |
|---|---:|---|---|---:|
| `checklist_semanal` | 94 | 2026-03-09 | 2026-04-15 | **94** |
| `ativos` | 41 | 2026-03-09 | 2026-04-25 | **41** |
| `sequenciamento_equipes` | 36 | 2026-03-11 | 2026-05-04 | **36** |
| `registros_diarios` | 25 | 2026-03-09 | 2026-06-22 | **23** |
| `lancamentos_financeiros` | 8 | 2026-03-30 | 2026-05-14 | **7** |
| `consumo_materiais` | 7 | 2026-03-09 | 2026-06-22 | **2** |
| `logistica_interna` | 7 | 2026-03-10 | 2026-03-10 | **7** |
| `compras_emergenciais` | 4 | 2026-03-09 | 2026-04-15 | **4** |
| `ciclos_tarefa` | 4 | 2026-04-25 | 2026-04-25 | **4** |
| `incidentes_seguranca` | 3 | 2026-03-09 | 2026-04-15 | **3** |
| `acoes_corretivas` | 2 | 2026-03-19 | 2026-03-19 | **2** |
| `riscos` | 2 | 2026-04-25 | 2026-04-25 | **2** |
| `retrabalhos` | 1 | 2026-03-11 | 2026-03-11 | **1** |
| `aditivos_contratuais` | 0 | — | — | 0 |
| **TOTAL** | **234** | 2026-03-09 | 2026-06-22 | **226** |

**226 de 234 registros (96,6%) estão atualmente elegíveis** segundo a lógica real da função. Nada foi excluído.

---

## 5. Financeiro — prioridade crítica

```sql
select count(*), sum(valor), count(distinct obra_id), count(distinct tenant_id), min(data), max(data)
from lancamentos_financeiros where created_at < now() - interval '3 months';
```

| Métrica | Valor |
|---|---|
| Total na tabela | 8 |
| Data mais antiga (`created_at`) | 2026-03-30 |
| Data mais recente (`created_at`) | 2026-05-14 |
| **Elegíveis pela regra atual** | **7** |
| **Soma monetária dos elegíveis** | **R$ 101.425,00** |
| Obras afetadas | **6** |
| Organizações (tenants) afetadas | **2** |
| Elegíveis já em soft delete (`deleted_at`) | 0 |

### Comportamento de um DELETE em `lancamentos_financeiros`

| Pergunta | Resposta | Evidência |
|---|---|---|
| É bloqueado por alguma regra? | **Não.** As policies são `super_admin_all` (ALL), `admin_delete` (DELETE), `tenant_select`, `operational_insert`, `gestor_update` — e a função usa `service_role`, que **bypassa RLS integralmente**. Não há trigger `BEFORE DELETE` de bloqueio nem checagem de período fechado nesta tabela | `pg_policies`, `pg_trigger` |
| Dispara trigger de auditoria? | **Sim** — `trg_audit_lf` → `fn_audit_log_changes` | `pg_trigger` |
| Preserva `old_data`? | **Sim**, em `audit_logs_db.old_data` (jsonb da linha completa). Não verificável empiricamente aqui porque nunca houve DELETE nesta tabela | definição do trigger |
| Pode ser reconstruído integralmente? | **Parcialmente.** A linha é recuperável a partir de `audit_logs_db`, mas isso é reconstrução forense manual, não restore. Não há mecanismo de aplicação automática | — |
| Deixa referências órfãs? | Não foram encontradas FKs apontando **para** `lancamentos_financeiros`. A linha referencia `obras` e `tenants`, que sobrevivem. Órfãos relacionais: **não**. Órfãos analíticos (relatórios/agregados que passam a divergir): **sim** | `pg_constraint` |
| Afeta fechamentos/snapshots/hashes? | Hoje **não**, porque `periodos_fechados` está vazia. Ver §7 | consulta em `periodos_fechados` |

**A única barreira de fato hoje é o 401.** Não existe defesa estrutural no banco contra o hard delete financeiro.

---

## 6. Constituição × estado real

Verificação de colunas de soft delete nas 14 tabelas (`information_schema.columns`):

| Coluna | Presença |
|---|---|
| `deleted_at` | **Somente em `lancamentos_financeiros`** (1 de 14) |
| `is_deleted` / equivalente | **Nenhuma tabela** |

Outros achados:

- **DELETE físico é permitido** em todas as 14 tabelas (via `service_role`, e em várias delas também via policy `admin_delete` para `authenticated`).
- **Nenhum trigger intercepta DELETE** para convertê-lo em soft delete. Os únicos triggers presentes nas 14 tabelas são `trg_audit_lf`, `trg_updated_meta_lf` e `trg_extract_producao_valor` — nenhum bloqueia ou reescreve a operação.
- **Auditoria preserva conteúdo removido apenas em `lancamentos_financeiros`** (`trg_audit_lf`). As outras **13 tabelas não têm trilha forense de conteúdo**: uma exclusão nelas é irreversível a partir dos dados aplicativos.

### Atenção especial: `lancamentos_financeiros`

A tabela possui `deleted_at` — a infraestrutura de soft delete existe — mas a função `data-retention` **não a utiliza**: executa `DELETE` físico direto. Existe portanto uma discrepância objetiva entre a capacidade instalada e o comportamento implementado.

### Classificação

**CONFLITO ARQUITETURAL OBJETIVO — INTENÇÃO NÃO DETERMINÁVEL.**

O ambiente comprova o conflito (soft delete disponível e não usado; hard delete em domínio financeiro), mas não contém nenhum artefato que registre se isso foi uma exceção deliberada de custo/desempenho no beta ou uma violação não percebida do princípio histórico. Não há RFC, comentário de migration ou evento que declare a intenção.

---

## 7. Fechamentos, snapshots e hashes

```sql
select count(*), count(*) filter (where snapshot_json is not null) from periodos_fechados;  -- 0, 0
select count(*) from cronograma_baseline;                                                   -- 0
```

| Estrutura | Estado |
|---|---|
| `periodos_fechados` | **0 linhas**, 0 snapshots, 0 hashes emitidos |
| `periodos_reaberturas` | sem fechamentos, logo sem reaberturas |
| `cronograma_baseline` | **0 linhas** |
| `system_events` | apenas eventos de retenção negada |

### Resposta à pergunta

**Não existe hoje nenhum fechamento antigo em risco** — porque não existe nenhum fechamento. A pergunta se torna prospectiva.

Se registros-fonte forem fisicamente apagados após três meses, um fechamento antigo permanece:

- **PARCIALMENTE RECONSTRUÍVEL** para `lancamentos_financeiros`, via `audit_logs_db.old_data`, com esforço forense manual e sem garantia de completude operacional;
- **NÃO RECONSTRUÍVEL** para as outras 13 tabelas, que não possuem trilha de conteúdo removido — a Edge Function registra em `system_events` apenas contagens agregadas por tabela, nunca os IDs nem o conteúdo.

**Classificação global: PARCIALMENTE RECONSTRUÍVEL**, e apenas no recorte financeiro. Para o conjunto operacional, **NÃO RECONSTRUÍVEL**.

Observação relevante: a folha e a presença (`registro_presencas`, `apontamento_diarias`, `colaboradores`) **não estão** no conjunto da retenção. O hash da folha, quando emitido, não depende diretamente das 14 tabelas. O que se perde é o contexto operacional que explica o número, não o número em si.

---

## 8. Política Beta exibida ao usuário

Texto atualmente renderizado (`src/components/dashboard/DataRetentionBanner.tsx`, exibido no dashboard):

> **Política de Retenção — Beta** — Durante o período beta, os dados operacionais são mantidos por até **3 meses**. Registros mais antigos são removidos automaticamente para manter o desempenho do sistema.

| Pergunta | Resposta |
|---|---|
| A mensagem corresponde ao backend atual? | **Parcialmente.** O prazo (3 meses) e o mecanismo automático correspondem ao código deployado e ao cron ativo. Mas "são removidos automaticamente" descreve algo que **de fato nunca aconteceu**: o job é rejeitado com 401 há meses. A mensagem é mais assertiva que a realidade observada |
| "Dados operacionais" inclui tecnicamente lançamentos financeiros? | **Sim.** `lancamentos_financeiros` está explicitamente no array da função, e 7 registros somando R$ 101.425,00 estão elegíveis agora |
| Existem categorias que um usuário razoavelmente não interpretaria como "dados operacionais"? | **Sim, ao menos quatro:** `lancamentos_financeiros` (financeiro), `aditivos_contratuais` (contratual), `incidentes_seguranca` (segurança do trabalho, com potencial relevância legal e prazos de guarda próprios) e `acoes_corretivas` (evidência de conformidade). Nenhuma delas é nomeada na mensagem |
| Existe divergência entre mensagem e implementação? | **Sim, em três eixos:** (a) escopo — o termo "dados operacionais" subdimensiona o alcance real, que inclui financeiro e contratual; (b) fato — a exclusão anunciada como automática não ocorreu; (c) precisão temporal — o banner calcula prazos com 90 dias fixos, enquanto o backend usa meses de calendário (28–31 dias), e o banner só observa 5 das 14 tabelas, deixando 9 sem qualquer aviso ao usuário |

A mensagem **não foi alterada**.

---

## 9. Backup e recuperação

| Recurso | Estado | Observação |
|---|---|---|
| Backups automáticos gerenciados | **NÃO CONFIRMADO** | política de backup é do plano de controle da plataforma, não consultável por SQL nem exposta ao projeto |
| Point-in-Time Recovery (PITR) | **NÃO CONFIRMADO** | idem. Não há evidência no banco de PITR habilitado |
| Retenção dos backups | **NÃO CONFIRMADO** | idem |
| Exportação CSV (bucket `exports` + Edge Function `export-csv`) | **CONFIGURADO** | recurso do próprio produto, acionável em Admin → Dados; gera ZIP por tabela respeitando RLS |
| Exportação de dados da plataforma | **DISPONÍVEL MAS NÃO CONFIGURADO** | existe em Cloud → Advanced settings → Export data; nenhuma execução registrada |
| Capacidade de restore | **NÃO CONFIRMADO** | depende de backup/PITR não confirmados |
| Logs/auditoria utilizáveis para reconstrução | **CONFIGURADO, com cobertura parcial** | `audit_logs_db` cobre apenas `lancamentos_financeiros` entre as 14 tabelas; `system_events` cobre somente a partir de 2026-05-31 |

Nenhum recurso foi habilitado, configurado ou executado.

---

## 10. Classificação final

**C, combinado com A.**

- **C — mecanismo ativo com registros elegíveis:** o cron `data-retention-daily` está `active = true`, dispara diariamente às 03:00 UTC, e existem **226 registros atualmente elegíveis**, incluindo R$ 101.425,00 em lançamentos financeiros.
- **A — mecanismo não efetivo:** apesar de agendado e ativo, o job **não está funcionalmente operante**. Envia JWT `anon` sem `x-cron-secret`, recebe 401 e é registrado como `retention.run.denied`. Nenhuma exclusão ocorreu.
- **D é rejeitado:** zero eventos `retention.run.completed`, zero DELETEs das 14 tabelas em `audit_logs_db`, e os 234 registros — os mais antigos de 2026-03-09, portanto com 5 meses — continuam presentes. Se houvesse hard delete executado, esses registros não existiriam.
- **E não se aplica** ao mecanismo em si; aplica-se pontualmente à janela 2026-03-09 → 2026-05-30, anterior ao início de `system_events`.

**Leitura combinada:** o sistema está protegido hoje por um acidente de configuração, não por desenho. A retenção é uma arma carregada e engatilhada, cujo gatilho está emperrado. Qualquer correção do header de autorização do job — inclusive uma "correção de bug" bem-intencionada — dispara a exclusão dos 226 registros na próxima janela das 03:00 UTC.

---

## 11. Matriz de evidências

| Questão | Evidência | Fonte | Estado | Confiança |
|---|---|---|---|---|
| Existe cron de retenção? | jobid 1, `data-retention-daily`, `0 3 * * *` | `cron.job` (banco remoto) | **ATIVO** | Alta |
| O cron está ativo? | `active = true` | `cron.job` | **ATIVO** | Alta |
| O cron invoca `data-retention`? | `net.http_post` para `/functions/v1/data-retention` | `cron.job.command` | **CONFIRMADO** | Alta |
| O cron autoriza corretamente? | sem `x-cron-secret`; JWT com `role = anon` | `cron.job.command` | **NÃO AUTORIZA** | Alta |
| Quantos disparos ocorreram? | 157, todos `succeeded` (enfileiramento) | `cron.job_run_details` | **CONFIRMADO** | Alta |
| Qual o resultado HTTP? | 401 | `net._http_response` | **CONFIRMADO** (janela curta) | Média-Alta |
| A função já apagou dados? | 74 `retention.run.denied`; 0 `.started`/`.completed` | `system_events` | **NÃO APAGOU** | Alta |
| Houve DELETE nas 14 tabelas? | nenhum registro de DELETE nelas | `audit_logs_db` | **NÃO** | Média-Alta (cobertura só de `lancamentos_financeiros`) |
| Janela mar–mai/2026 | `system_events` inicia em 2026-05-31 | `system_events` | **NÃO CONFIRMADO** | Baixa |
| Versão deployada da função | endpoint responde e rejeita conforme o código versionado | Edge Function deployada | **NÃO CONFIRMADO** (compatível) | Média |
| `CRON_SECRET` existe? | não inspecionável por SQL | — | **NÃO CONFIRMADO** | — |
| Registros elegíveis hoje | 226 de 234 | banco remoto (14 tabelas) | **CONFIRMADO** | Alta |
| Exposição financeira | 7 lançamentos, R$ 101.425,00, 6 obras, 2 tenants | `lancamentos_financeiros` | **CONFIRMADO** | Alta |
| DELETE financeiro é bloqueado? | nenhuma policy/trigger bloqueia; `service_role` bypassa RLS | `pg_policies`, `pg_trigger` | **NÃO BLOQUEADO** | Alta |
| Auditoria financeira preserva `old_data`? | `trg_audit_lf` → `fn_audit_log_changes` | `pg_trigger` | **CONFIGURADO** (não exercitado) | Média-Alta |
| Soft delete nas 14 tabelas | `deleted_at` só em `lancamentos_financeiros` | `information_schema.columns` | **CONFIRMADO** | Alta |
| Trigger converte DELETE em soft delete? | nenhum | `pg_trigger` | **NÃO EXISTE** | Alta |
| Existem fechamentos? | `periodos_fechados` = 0 linhas | banco remoto | **CONFIRMADO** | Alta |
| Existem baselines de cronograma? | `cronograma_baseline` = 0 linhas | banco remoto | **CONFIRMADO** | Alta |
| Banner Beta cobre todas as tabelas? | monitora 5 de 14; usa 90 dias fixos | `DataRetentionBanner.tsx` (frontend publicado) | **DIVERGENTE** | Alta |
| Backups / PITR | plano de controle não consultável | — | **NÃO CONFIRMADO** | — |

Documentação histórica (`MANUAL_SISTEMA.md`, `OPERA_CORE.md`, auditorias anteriores) **não foi usada como prova** de estado remoto — apenas para comparação em §6 e §8.

---

## 12. Lacunas e riscos

### CONFIRMADO

1. Cron `data-retention-daily` existe, está ativo e dispara diariamente às 03:00 UTC desde 2026-03-09.
2. O comando do cron não envia `x-cron-secret` e usa JWT de papel `anon`.
3. A Edge Function rejeita com 401; 74 eventos `retention.run.denied` entre 2026-05-31 e 2026-08-12.
4. Nenhuma exclusão pelo mecanismo: zero `retention.run.completed`, zero DELETEs das 14 tabelas.
5. 226 de 234 registros estão elegíveis hoje.
6. Exposição financeira elegível: R$ 101.425,00 em 7 lançamentos, 6 obras, 2 organizações.
7. 13 das 14 tabelas não têm soft delete nem trilha forense de conteúdo.
8. Nenhum trigger, policy ou constraint bloqueia o hard delete nas 14 tabelas contra `service_role`.
9. `periodos_fechados` e `cronograma_baseline` estão vazias.

### NÃO CONFIRMADO

1. Resultado das execuções entre 2026-03-09 e 2026-05-30 (anteriores a `system_events`).
2. Existência e valor de `CRON_SECRET` no ambiente de Edge Functions.
3. Versão exata do código deployado da função.
4. Backups automáticos, PITR e retenção de backups.
5. Códigos HTTP históricos além da última execução (`net._http_response` tem retenção curta).

### CONTRADIÇÃO

1. **Princípio "soft-delete padrão" × hard delete implementado** em 14 tabelas, inclusive financeiro — com `deleted_at` disponível em `lancamentos_financeiros` e não utilizado.
2. **Documentação afirma retenção operando × ambiente prova rejeição contínua** há pelo menos 74 dias registrados.
3. **Banner ao usuário afirma remoção automática × nenhuma remoção ocorreu**, e o banner monitora 5 de 14 tabelas com aritmética de 90 dias fixos contra meses de calendário no backend.
4. **`cron.job_run_details` reporta 157 `succeeded` × todas as invocações falharam** no destino — o "sucesso" mede apenas o enfileiramento HTTP.

### RISCO

1. **Crítico — gatilho latente:** corrigir a autorização do job sem decisão prévia apaga 226 registros e R$ 101.425,00 em lançamentos na próxima janela das 03:00 UTC, sem confirmação humana.
2. **Crítico — irreversibilidade:** 13 tabelas não têm como ser reconstruídas após exclusão.
3. **Alto — superfície de acionamento manual:** qualquer superadmin autenticado pode disparar a função hoje mesmo e obter o mesmo efeito, sem cron.
4. **Alto — comunicação ao usuário:** o banner Beta cria expectativa divergente do comportamento real, em ambos os sentidos (promete exclusão que não ocorre; omite que financeiro e contratual estão no escopo).
5. **Médio — observabilidade cega:** `succeeded` no `cron.job_run_details` mascara falha total; sem `system_events` isso seria invisível.
6. **Médio — retenção de dados de segurança do trabalho:** `incidentes_seguranca` e `acoes_corretivas` podem ter prazos de guarda legais superiores a 3 meses.
7. **Médio — recuperação não confirmada:** sem PITR/backup confirmados, não há rede de segurança comprovada.

### DECISÃO NECESSÁRIA

1. A retenção automática deve continuar existindo como conceito no beta?
2. Se sim, o domínio **financeiro** e o **contratual** devem permanecer no escopo, ou ser excluídos dele?
3. Hard delete ou soft delete? A decisão define se a arquitetura mantém ou abandona formalmente o princípio histórico.
4. O que fazer com o job hoje: mantê-lo inerte, desativá-lo formalmente ou corrigi-lo — e, se corrigir, com qual salvaguarda (dry-run, aprovação explícita, snapshot prévio)?
5. Os 226 registros atualmente elegíveis devem ser preservados por decisão explícita antes de qualquer alteração no mecanismo?
6. O texto do banner Beta deve ser alinhado ao comportamento real, e em que direção?
7. É necessário confirmar backup/PITR junto à plataforma antes de qualquer intervenção?

Nenhuma implementação é proposta neste documento.

---

## Anexo — consultas executadas

```sql
-- extensões
select extname, extversion from pg_extension where extname in ('pg_cron','pg_net','pgcrypto');

-- cron
select jobid, jobname, schedule, active, database, username, left(command,300) from cron.job order by jobid;
select length(command), (command ilike '%x-cron-secret%') from cron.job where jobid=1;
select jobid, status, count(*), min(start_time), max(start_time) from cron.job_run_details group by 1,2;

-- respostas HTTP
select status_code, count(*), min(created), max(created) from net._http_response group by 1;

-- observabilidade
select event_type, status, count(*), min(created_at), max(created_at) from system_events group by 1,2;

-- auditoria
select table_name, operation, count(*), min(created_at), max(created_at)
from audit_logs_db where operation='DELETE' group by 1,2;

-- quantificação (por tabela)
select count(*), min(created_at), max(created_at),
       count(*) filter (where created_at < now() - interval '3 months')
from public.<tabela>;

-- financeiro
select count(*), sum(valor), count(distinct obra_id), count(distinct tenant_id), min(data), max(data),
       count(*) filter (where deleted_at is not null)
from lancamentos_financeiros where created_at < now() - interval '3 months';

-- schema / soft delete
select table_name, column_name from information_schema.columns
where table_schema='public' and column_name in ('deleted_at','is_deleted');

-- triggers e policies
select c.relname, t.tgname, p.proname from pg_trigger t
  join pg_class c on c.oid=t.tgrelid join pg_proc p on p.oid=t.tgfoid
  join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and not t.tgisinternal;
select tablename, policyname, cmd, roles::text from pg_policies where schemaname='public';

-- fechamentos
select count(*), count(*) filter (where snapshot_json is not null), min(mes), max(mes) from periodos_fechados;
select count(*) from cronograma_baseline;
```

**FIM DA AUDITORIA.** Nenhuma correção executada. Nenhum cron alterado. Nenhuma migration. Nenhuma publicação.
