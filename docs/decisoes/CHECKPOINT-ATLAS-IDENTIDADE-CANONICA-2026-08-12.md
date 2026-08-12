# Checkpoint da identidade canônica do OPERA Atlas

**Data:** 2026-08-12  
**Status:** baseline publicado e validado  
**Commit funcional de referência:** `a47046917576db458e8919eb082a4a3a01b78e83`

## Publicação

A nova identidade/Home do OPERA Atlas foi:

- implementada;
- enviada para `origin/main`;
- testada no Lovable;
- aprovada pelo usuário;
- publicada manualmente pelo usuário;
- validada na URL pública em 12/08/2026.

A inspeção pública e somente leitura de `https://opera-atlas.lovable.app` confirmou resposta HTTP 200 para a Home, `/login` e `/beta`. O HTML publicado identifica o produto como **OPERA Atlas** no título, metadata e autoria. O bundle live observado foi `assets/index-BCT3b53o.js`, com SHA-256 `2110AC10DF45CCB7C4CE01C56E8E53143C646885682C91D6FF5E5F8F0AB39BE9`.

O bundle contém os marcadores da nova Home — hero, identidade OPERA Atlas, CTAs e Programa Beta — e não contém `O.P.E.R.A. Control` como identidade da landing. O nome e o hash do bundle são registrados somente como evidência do artefato servido; a infraestrutura pública não expõe vínculo formal entre esse artefato e um SHA Git exato. O aceite humano e os marcadores funcionais publicados constituem a comprovação deste baseline.

## Identidade canônica

**OPERA Atlas**

→ identidade deste aplicativo  
→ consolidação operacional  
→ fechamento  
→ histórico  
→ rastreabilidade

**OPERA Control**

→ produto distinto  
→ não é a identidade deste aplicativo

**Construction Hub**

→ nome histórico/administrativo do projeto Lovable  
→ não possui função canônica identificada no produto  
→ eventual renomeação administrativa é tarefa futura separada

## Proposta aprovada

**Hero:**

> A obra acontece. O Atlas preserva o que aconteceu.

**Subheadline:**

> Para construtoras e equipes que precisam consolidar execução, custo, prazo e responsabilidade — da rotina de campo ao fechamento auditável de cada obra.

**CTA principal:** `Solicitar demonstração`  
**CTA secundário:** `Entrar ou explorar a demo`

Também permanece publicado o acesso ao `Programa Beta` pelo fluxo oficial do produto.

## Decisões comerciais

- As métricas 20–49%, 8–11, 150+ e 5+ foram removidas por ausência de comprovação versionada.
- Os pacotes comerciais genéricos foram removidos.
- O Programa Beta foi preservado por possuir implementação real.
- O Control foi preservado como produto distinto.
- A Home foi construída a partir das capacidades reais do Atlas.

## Taxonomia atual

**Vision**  
→ representação espacial operacional

**Control**  
→ desvios, perdas e controle operacional

**Atlas**  
→ consolidação, fechamento, memória e rastreabilidade

Esta é a taxonomia atual de produto e não implica refatoração técnica global.

## Risco crítico aberto

Referência: [Auditoria de retenção e preservação financeira](./AUDITORIA-RETENCAO-PRESERVACAO-FINANCEIRA-2026-08-12.md)

**RISCO CRÍTICO ABERTO**

A Edge Function `data-retention` deployada possui capacidade de hard delete após três meses em 14 tabelas, incluindo `lancamentos_financeiros`.

Ainda **NÃO** foi possível confirmar:

- cron ativo;
- execuções anteriores;
- quantidade de registros elegíveis.

O risco permanece bloqueado por ausência de acesso remoto read-only privilegiado. Este checkpoint não reinvestigou o risco e não alterou retenção.

## Limites do checkpoint

A canonização da identidade não alterou:

- banco;
- migrations;
- RLS;
- autenticação;
- Storage;
- financeiro;
- fechamento;
- snapshots;
- hashes;
- retenção;
- cron;
- lógica operacional da aplicação autenticada.

