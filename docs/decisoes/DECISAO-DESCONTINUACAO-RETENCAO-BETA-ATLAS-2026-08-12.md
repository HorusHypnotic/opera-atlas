# Descontinuação da retenção Beta destrutiva do OPERA Atlas

**Data:** 2026-08-12
**Status:** DECISÃO DE CONTENÇÃO
**Execução remota:** pendente de ação e confirmação pelo owner no Lovable

## Contexto

A política de retenção nasceu na fase Beta como resposta de capacidade/storage. O mecanismo e o banner foram introduzidos no commit `3336cc2`, em 08/03/2026, com hard delete de registros com mais de três meses.

A [auditoria remota](./AUDITORIA-REMOTA-RETENCAO-ATLAS-2026-08-12.md) confirmou no ambiente Lovable:

- `cron.job` jobid `1`, nome `data-retention-daily`, schedule `0 3 * * *`, banco e usuário `postgres`, atualmente `active = true`;
- 157 disparos registrados desde 09/03/2026;
- o cron chama `/functions/v1/data-retention` com JWT de papel `anon` e sem `x-cron-secret`;
- a Edge Function rejeita a chamada com HTTP 401;
- 74 eventos `retention.run.denied` e zero eventos `retention.run.started`, `.completed`, `.failed` ou `retention.table.failed`;
- nenhuma evidência de DELETE causado pela retenção;
- 226 registros elegíveis no corte remoto de 12/05/2026;
- 7 de 8 lançamentos financeiros elegíveis, somando R$ 101.425,00, em 6 obras e 2 organizações;
- `periodos_fechados` e `cronograma_baseline` atualmente vazios.

O cron está ativo, mas a retenção está funcionalmente inerte por falha de autorização. O HTTP 401 é uma proteção acidental e não constitui mecanismo de segurança aceitável. Corrigir a autenticação exporia imediatamente os 226 registros ao hard delete.

## Confronto arquitetural e genealogia

```text
REGRA BETA (08/03/2026)
capacidade/storage
        ↓
data-retention
        ↓
hard delete após três meses

ARQUITETURA POSTERIOR (abril/maio de 2026)
soft delete
+ append-only
+ fechamento
+ snapshot
+ hash
+ reconstruibilidade
+ histórico versionado
```

A infraestrutura de soft delete para entidades críticas, incluindo `lancamentos_financeiros`, surgiu em 07/04/2026. Enforcement, auditoria forense, fechamentos, snapshots e hashes foram consolidados em maio; o baseline de cronograma append-only surgiu em 27/05 e a reabertura formal versionada em 30/05. A constituição OPERA_CORE v1.3 tornou vinculantes, entre outras, as invariantes I3 (histórico append-only), I7 (reprodutibilidade), I9 (determinismo financeiro) e I11 (imortalidade dos hashes e lineage de versões).

A retenção Beta é, portanto, anterior e legada diante da arquitetura vigente. Ela apaga dados-fonte com `service_role`, ignora o `deleted_at` existente em `lancamentos_financeiros` e deixa 13 das 14 tabelas sem recuperação equivalente. Manter snapshots ou hashes enquanto os eventos primários desaparecem rompe a reconstruibilidade histórica.

Esse conflito também é incompatível com a identidade canônica e a Home publicada do Atlas como sistema de consolidação, fechamento, memória e rastreabilidade: “A obra acontece. O Atlas preserva o que aconteceu.”

## Decisão

O hard delete automático por idade deixa de ser política válida do OPERA Atlas.

- O agendamento automático `data-retention-daily` deve ser desativado com `active = false`.
- O job não será apagado nesta etapa, preservando genealogia e reversibilidade.
- A Edge Function `data-retention` permanece temporariamente no repositório e no ambiente, sem alteração funcional, marcada como legada e proibida para habilitação.
- Nenhuma correção, troca ou flexibilização da autenticação é autorizada.
- A função não pode ser executada manualmente contra produção sem nova decisão arquitetural e autorização explícita.
- Os 226 registros elegíveis não devem ser modificados por esta contenção.
- A política futura será projetada e implementada separadamente.

## Contenção remota a cargo do owner

O Codex não executará esta operação. O owner deve fornecer ao agente Lovable os três blocos abaixo, em ordem, e interromper se a pré-condição não retornar exatamente uma linha com os valores esperados.

### 1. Pré-condição — somente leitura

```sql
select jobid, jobname, schedule, active, database, username, command
from cron.job
where jobid = 1
  and jobname = 'data-retention-daily';
```

Resultado esperado antes da contenção: uma linha, `jobid = 1`, `jobname = 'data-retention-daily'`, `schedule = '0 3 * * *'`, `active = true`, comando direcionado a `/functions/v1/data-retention`.

### 2. Alteração mínima

Executar somente se a pré-condição corresponder integralmente:

```sql
do $$
begin
  if (
    select count(*)
    from cron.job
    where jobid = 1
      and jobname = 'data-retention-daily'
      and schedule = '0 3 * * *'
      and active = true
      and command ilike '%/functions/v1/data-retention%'
  ) <> 1 then
    raise exception 'Precondicao falhou: data-retention-daily nao corresponde ao alvo canonico';
  end if;

  perform cron.alter_job(1, active := false);
end
$$;
```

Essa operação altera somente o estado ativo do jobid `1`. Não usar `cron.unschedule`, não apagar `cron.job`, não editar o comando e não alterar credenciais.

### 3. Pós-condição — somente leitura

```sql
select jobid, jobname, schedule, active, database, username, command
from cron.job
where jobid = 1
  and jobname = 'data-retention-daily';
```

Resultado obrigatório: exatamente uma linha, com os mesmos identificador, nome, schedule, database, username e command, alterando apenas `active` para `false`.

O owner deve preservar o resultado da pré-condição, da operação e da pós-condição sem reproduzir JWT, token ou secret. O campo `command` deve ser redigido antes de ser registrado fora do ambiente privilegiado.

## Edge Function

`supabase/functions/data-retention/index.ts` permanece funcionalmente intacta. Foi adicionado apenas aviso técnico `DEPRECATED — DO NOT ENABLE`, informando:

- origem na política Beta legada;
- incompatibilidade com reconstruibilidade;
- cron deliberadamente desativado como estado desejado;
- proibição de corrigir ou afrouxar autenticação sem nova decisão;
- proibição de execução manual contra produção sem autorização explícita.

O comentário local não publica nem modifica a Edge Function remota.

## Frontend pendente

A mensagem está em `src/components/dashboard/DataRetentionBanner.tsx`, linhas 72–75 no estado desta decisão:

> Política de Retenção — Beta — Durante o período beta, os dados operacionais são mantidos por até 3 meses. Registros mais antigos são removidos automaticamente para manter o desempenho do sistema.

Ela não será alterada nesta primeira fase. Assim que o owner confirmar `active = false`, uma etapa imediatamente posterior deverá substituir a promessa de exclusão automática por comunicação coerente com persistência e com a política em revisão. Até essa confirmação, não se deve publicar alteração do banner.

## Backup obrigatório antes de transformação futura

A desativação do cron não depende de backup porque altera apenas `active` para `false` e não modifica dados. Antes de qualquer futura migration de retenção, soft delete, arquivamento ou transformação dos dados existentes, serão obrigatórios:

- backup reconstruível;
- manifesto e checksum;
- teste de restore em ambiente isolado.

## Candidatos para a política futura — não implementar nesta missão

- persistência por padrão;
- soft delete para entidades mutáveis;
- append-only para eventos críticos;
- imutabilidade após fechamento;
- arquivamento em vez de destruição;
- política configurável quando juridicamente ou operacionalmente necessária;
- exportação;
- backup;
- restore;
- eventual política de retenção por classe de dado.

## Limites desta decisão

Esta missão não:

- executa SQL remoto;
- corrige autenticação;
- chama `data-retention`;
- altera os 226 registros elegíveis;
- altera os R$ 101.425,00 elegíveis no financeiro;
- altera schema, migration, RLS, secrets ou dados;
- apaga cron ou Edge Function;
- altera ou publica o frontend;
- implementa a política futura.
