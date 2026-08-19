# OPERA Atlas — Gestão de obras para pequenos e médios construtores

OPERA Atlas é um sistema de gestão de obras web (PWA) para registrar e acompanhar **cronograma, mão de obra e produção**, com geração de relatórios em PDF e exportação de dados. Foi construído a partir de um problema real de canteiro: o que está planejado deixa de corresponder ao que está registrado, e essa divergência costuma ser percebida tarde demais.

## Para quem foi construído

Pequenos e médios construtores, mestres de obras e responsáveis por mais de uma obra simultânea, que precisam de um controle centralizado de cronograma e mão de obra sem planilhas descentralizadas.

## O que já funciona

| Área | Capacidade | Evidência no repositório |
|---|---|---|
| Cronograma | Criação e acompanhamento de cronograma com linha de base versionada | `docs/decisoes/` (baseline de cronograma, 12/08/2026) |
| Mão de obra | Registro e relatórios de mão de obra em PDF (IPMO) | Relatórios PDF implementados |
| Exportação | Exportação de dados em CSV a partir do painel administrativo | Exportação CSV implementada |
| Colaboração | Compartilhamento de relatórios via WhatsApp | Funcionalidade implementada |
| Dashboard | Painel de acompanhamento de obras | Dashboard implementado |
| Multi-tenant | Isolamento de dados entre organizações (tenants) | RLS no Supabase; teste de contrato de permissões em `supabase/tests/database/permission_contract.test.sql` |
| Retenção de dados | Política de retenção auditada | `docs/decisoes/AUDITORIA-REMOTA-RETENCAO-ATLAS-2026-08-12.md` |

## Arquitetura

React 18 + TypeScript + Vite, Tailwind CSS e shadcn/ui, com backend em Supabase (PostgreSQL) operando multi-tenant com Row Level Security. Edge functions em Deno (Deno Deploy) executam operações privilegiadas (convites, retenção de dados, exportação CSV, gantt, transferências de sessão). O projeto tem origem na plataforma Lovable, que gerou a base do código; funcionalidades, testes e documentação evoluem sobre essa base. Licenciado sob MIT.

## Demonstração

A demonstração pública está em [opera-atlas.lovable.app](https://opera-atlas.lovable.app).

## Status e maturidade

**Beta ativo.** O sistema está em demonstração pública e em evolução constante; não há garantia de estabilidade de banco de dados nem SLA. A política de retenção de dados do período de beta está documentada em `docs/decisoes/`.

## Limitações atuais

O banco de dados é de demonstração e pode ser resetado; a exportação CSV e os relatórios PDF cobrem os fluxos principais de cronograma e mão de obra — não incluem cotação, pedidos, notas fiscais ou financeiro (esses fluxos existem em outros sistemas do ecossistema OPERA, cujos repositórios permanecem privados durante a maturação); a interface pode variar antes de uma versão estável.

## Relação com o OPERA e a TPC

OPERA Atlas é a implementação inicial do ecossistema OPERA, que nasceu de observações de campo formalizadas em um programa de pesquisa aplicado (Informodinâmica / TPC — Teoria dos Processos Coordenativos). A TPC orienta conceitualmente o desenho do sistema (representações que precisam permanecer coerentes com a realidade), mas **não é uma teoria validada cientificamente**: as métricas e construtos documentados no programa de pesquisa são candidatos, não resultados estabelecidos.

## Execução local

O frontend pode ser construído e testado localmente:

```bash
pnpm install
pnpm build     # build de produção
pnpm test      # suíte vitest
pnpm dev       # servidor de desenvolvimento (porta 8080)
```

A execução completa exige um projeto Supabase equivalente, configurado pelas migrações em `supabase/migrations/` e pelas variáveis listadas em `.env.example`. As edge functions rodam em Deno Deploy e dependem de secrets configuradas no painel do deploy (`SUPABASE_SERVICE_ROLE_KEY`), que não residem neste repositório.

## Segurança

Este repositório não contém credenciais de produção. Variáveis sensíveis são injetadas por ambiente (`.env.example` documenta as necessárias; secrets de edge functions ficam no painel do deploy). Chaves do tipo `anon`/publishable do Supabase são concebidas para uso no cliente e, portanto, públicas por design.
