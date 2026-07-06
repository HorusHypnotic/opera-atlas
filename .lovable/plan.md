# Plano: PDF "OPERA Atlas — Constituição Arquitetural v1.0"

Gerar `/mnt/documents/OPERA_Atlas_Constituicao_Arquitetural_v1.0.pdf`. Quarto documento da trilogia + 1, no nível acima da maturidade: define **leis permanentes** da arquitetura do Atlas, separando o que pode evoluir do que não pode ser quebrado.

**Sem alteração de código, schema, RLS, memórias ou edge functions.** Apenas geração de PDF.

## Posicionamento na hierarquia documental

```text
Constituição Arquitetural (v1.0)  ← este documento (nível meta, permanente)
        │
        ├── OPERA_CORE.md v1.3         (invariantes de domínio)
        ├── Modelo Empresarial          (o que o Atlas é)
        ├── Diagnóstico Objetivo        (onde está)
        └── Governança de Maturidade    (como medir evolução)
```

A Constituição rege como esses quatro documentos podem mudar.

## Fonte da verdade (verificável)

- `.lovable/OPERA_CORE.md` v1.3 (invariantes I1–I11)
- `.lovable/memory/architecture/*` (multi-tenancy, workforce-financial-logic)
- `.lovable/memory/security/rls-access-validation.md`
- Schema atual (tabelas, funções `folha_pagamento`, `verificar_hash_periodo`, `reabrir_periodo`, `refechar_periodo`, `dashboard_aggregates`, RPCs `has_role`, `user_has_obra_access`, `get_user_tenant_id`, `is_super_admin`)
- Edge functions (`export-csv`, `data-retention`)
- Padrão de tabelas: `tenant_id`, `deleted_at`, `created_at`, `updated_at`, `correlation_id`
- Padrão de audit: `audit_logs`, `audit_logs_db`, `system_events`
- Regras do stack: React 18 + Vite 5 + Tailwind + Supabase; sem PWA/Service Worker; auth Supabase nativa

## Estrutura do PDF (~14–16 páginas)

### 1. Preâmbulo
Meia página. Declara: escopo permanente, autoridade sobre demais documentos, quem pode emendar (apenas via RFC §16), quem interpreta em caso de conflito (ordem: Constituição → OPERA_CORE → Governança → Roadmap → Diagnóstico → Modelo Empresarial).

### 2. Arquitetura em Camadas
Diagrama ASCII em Table + explicação de cada camada.

```text
┌─────────────────────────────────────────────────┐
│ Interface   (React + Tailwind + shadcn)         │  ← apresentação
├─────────────────────────────────────────────────┤
│ Aplicação   (hooks, services, react-query)      │  ← orquestração
├─────────────────────────────────────────────────┤
│ Domínio     (invariantes, regras, tipos)        │  ← núcleo estável
├─────────────────────────────────────────────────┤
│ Infraestrutura (Supabase: DB, RLS, RPC, Edge)   │  ← execução
└─────────────────────────────────────────────────┘
```

Regra: dependência aponta **para baixo**. Domínio não conhece Aplicação; Aplicação não conhece Interface; nenhuma camada superior pula direto para Infraestrutura sem passar pelo cliente Supabase encapsulado.

### 3. Princípios Arquiteturais Obrigatórios
Lista numerada P1–P10. Ex.:
- **P1** Tenant-isolation por RLS. Nenhuma consulta client-side confia em filtros locais para separação de tenants.
- **P2** Soft-delete padrão (`deleted_at`) para entidades de domínio.
- **P3** Server-derived truth. `tenant_id`, `user_id`, `role` derivam de `auth.uid()` no server, nunca do payload cliente.
- **P4** Hash determinístico para fatos financeiros (SHA-256 sobre payload canonicalizado).
- **P5** Causalidade rastreável (`correlation_id`, `causation_id` em `system_events`).
- **P6** Presenças/diárias como eventos imutáveis com `status_contabil` (prevista/confirmada/ajustada).
- **P7** Nenhum estado de sessão em IndexedDB/localforage. Apenas Supabase Auth nativo.
- **P8** Zero Service Worker/PWA (histórico de stale cache).
- **P9** Roles em tabela `user_roles` separada, verificadas por SECURITY DEFINER.
- **P10** Design tokens semânticos em `index.css`; sem cores hardcoded em componentes.

### 4. Regras de Evolução do Banco de Dados
- Toda mudança de schema via migration versionada.
- `CREATE TABLE public.*` sempre acompanhado de `GRANT` + `ENABLE RLS` + policies (na mesma migration).
- Colunas de auditoria (`created_at`, `updated_at`, `tenant_id`, opcional `deleted_at`) obrigatórias em tabelas de domínio.
- Migrations **não removem colunas** sem passar por depreciação §12.
- Renames de coluna passam por `add + backfill + dual-write + read-switch + drop`.
- Nenhum `ALTER DATABASE postgres`.
- Validações time-dependent via trigger, nunca CHECK constraint.

### 5. Regras de Versionamento
Adota **SemVer** para o produto Atlas e para contratos públicos:
- **Major** — quebra de contrato público (RPC, edge, schema exposto ao cliente).
- **Minor** — adição retrocompatível.
- **Patch** — correção sem mudar contrato.

Documentos governados pela Constituição versionam separadamente (`OPERA_CORE v1.x`, `Governança v1.x`) mas seguem a mesma classificação.

### 6. Política de Breaking Changes
Uma mudança é **breaking** quando:
- Remove/renomeia campo em resposta de RPC ou edge function pública.
- Muda tipo de campo de forma não coerciva.
- Altera semântica de invariante existente (I1–I11).
- Remove policy RLS que outros clientes assumem ativa.
- Quebra hash de fechamento (`folha_pagamento` retorna hash diferente para o mesmo input).

Breaking change exige:
1. RFC aprovada (§16).
2. Versão Major.
3. Janela de depreciação mínima de **90 dias** com contrato antigo ativo.
4. Migration path documentado.
5. Notificação a clientes ativos em produção.

### 7. Contratos Públicos Entre Módulos
Enumera os contratos considerados **públicos** (mudança exige §6):
- Funções DB `folha_pagamento`, `verificar_hash_periodo`, `reabrir_periodo`, `refechar_periodo`, `dashboard_aggregates`, `validar_fechamento`, `promover_previsoes`, `has_role`, `user_has_obra_access`, `get_user_tenant_id`, `is_super_admin`.
- Edge functions: `export-csv`, `data-retention`, e qualquer edge com URL pública.
- Tabelas expostas via PostgREST: schema + policies observáveis.
- Formato de eventos `system_events` (event_type, payload).
- Formato de hash de fechamento (payload canonicalizado + algoritmo SHA-256).

Contratos **privados** (podem mudar em Minor): componentes React, hooks, tabelas internas sem PostgREST, colunas com prefixo `_internal`, memórias e documentação.

### 8. Modelo Oficial de Eventos
Padrão único em `system_events`:
```text
event_type   verbo.entidade.qualificador  (ex. periodo.reaberto)
source       origem técnica (rpc.<nome> | edge.<nome> | trigger.<nome>)
correlation_id  transação lógica
causation_id    evento que causou este
payload      jsonb canonicalizado
severity     info | warn | error
```
Toda mutação de estado com efeito jurídico/financeiro emite evento.

### 9. Modelo Oficial de Snapshots
Snapshot = fotografia imutável de fato consolidado.
- `folha_pagamento(obra, ini, fim)` produz snapshot canônico.
- Ao fechar período: `periodos_fechados` armazena `snapshot_json` + `hash_snapshot`.
- Reabertura preserva versão anterior em `periodos_reaberturas` (append-only).
- Hash reproduzível: mesmo input ⇒ mesmo SHA-256, indefinidamente.

### 10. Modelo Oficial de Identidade das Entidades
- Toda entidade primária tem `id uuid default gen_random_uuid()`.
- Toda entidade multi-tenant tem `tenant_id uuid not null`.
- Nenhum identificador de negócio (CNPJ, matrícula) serve como PK.
- Referências entre entidades sempre via UUID + FK explícita.
- IDs de critério, evidência e evento seguem prefixo estável (`M0-01`, `E-01`, `event.tipo`).

### 11. Política de Compatibilidade Retroativa
- Aditividade preferida: novos campos opcionais nunca quebram contrato.
- Respostas de RPC aceitam campos extras ignorados pelo cliente.
- Clientes toleram versões +1 minor sem falhar.
- Cliente rejeita apenas em mudança Major com contrato explícito novo.

### 12. Política de Depreciação
- Marcar como `@deprecated` na documentação + retornar header `X-Deprecated: <motivo>` (edge functions) ou log estruturado (RPC).
- Janela mínima **90 dias** para contratos públicos, **30 dias** para privados.
- Remoção só após: prazo cumprido + zero uso em `system_events` no período + RFC aprovada.

### 13. Política de Observabilidade
- Todo RPC público loga em `audit_logs` OU `system_events` (regra: efeito de negócio → ambos).
- `correlation_id` propagado do cliente ao DB via `set_correlation_context`.
- Erros server-side com stack + payload sanitizado.
- Métricas mínimas: latência p95 de RPCs críticas, taxa de erro, volume de eventos por tipo.

### 14. Política de Auditoria
- Toda tabela de domínio com efeito financeiro/jurídico tem trigger `fn_audit_log_changes` gravando em `audit_logs_db`.
- Reabertura de período: registra motivo (≥20 caracteres), autor, correlation.
- Alteração de `valor_diaria_usado` bloqueada após 7 dias exceto admin (`fn_protect_snapshot`).
- Fechado + reaberto = registros lado a lado, nunca sobrescrita.

### 15. Política de Performance
Limites duros (violação = bug, não trade-off):
- Consultas de dashboard não excedem **15 queries** por render (regra observada como débito atual).
- RPCs de fechamento executam em **≤ 3s** para 1 obra × 1 mês.
- Nenhuma query no cliente que produza N+1 sobre `colaboradores` ou `obras`.
- Bulk operations preferidas via RPC dedicada (ex. bulk delete de presenças).

### 16. Política de Segurança
- RLS obrigatório em toda tabela `public.*`.
- Roles administrativas verificadas por SECURITY DEFINER (`has_role`, `is_super_admin`).
- Nunca checar admin em client-side/localStorage.
- Secrets apenas via env de edge functions; nunca no bundle cliente.
- Publishable/anon key ok em código; service_role nunca no cliente.

### 17. Critérios de Aceitação de Nova Funcionalidade
Uma funcionalidade só entra em `main` quando:
1. Cabe em uma camada (§2) sem violar dependência.
2. Não viola nenhum princípio P1–P10.
3. Traz teste ou justificativa registrada de por que não trouxe.
4. Se toca DB: migration + GRANT + RLS + policies na mesma migration.
5. Se toca contrato público: RFC aprovada.

### 18. Critérios de Rejeição
Rejeitar automaticamente quando:
- Usa localStorage/IndexedDB para sessão.
- Instala Service Worker/PWA.
- Adiciona coluna sem `tenant_id` em tabela multi-tenant.
- Confia em filtro cliente para separação de dados.
- Introduz gradiente/roxo genérico ou tipografia default (viola design memory).
- Adiciona role em `profiles` em vez de `user_roles`.
- Bypassa `has_role` com check ad-hoc.

### 19. Processo Formal de RFC (Request for Change)
Estrutura mínima:
```text
RFC-XXXX  Título
Autor · Data · Status (draft | review | approved | rejected | superseded)
1. Motivação
2. Proposta (contrato antes/depois)
3. Alternativas consideradas
4. Impacto (§21)
5. Migration path
6. Compatibilidade retroativa (§11)
7. Depreciação prevista (§12)
8. Aprovação (mín. 1 admin + 1 revisor arquitetural)
```
RFCs vivem em `.lovable/rfcs/RFC-XXXX.md` (a criar futuramente — fora do escopo deste PDF).

### 20. Fluxo Oficial de Evolução Arquitetural
```text
Ideia → Discussão → RFC draft → Review → Aprovação → Implementação
                                              ↓
                              Migration + Teste + Docs
                                              ↓
                              Release (Patch/Minor/Major)
                                              ↓
                              Registro em Governança §7 (histórico)
```

### 21. Matriz de Impacto Arquitetural
Tabela: dimensão × classificação.

| Dimensão | Patch | Minor | Major |
|---|---|---|---|
| Schema | Índice, comentário | Nova coluna nullable, nova tabela | Remove/rename coluna, muda tipo |
| RPC pública | Bugfix sem mudar shape | Novo parâmetro opcional | Muda retorno, remove função |
| Edge pública | Bugfix | Novo endpoint | Muda contrato existente |
| RLS | Ajuste equivalente | Nova policy permissiva | Restringir acesso já concedido |
| UI | Estilo, texto | Nova tela, novo card | Remove rota, muda URL |
| Invariante | — | — | Sempre Major, exige emenda constitucional |

### 22. Classificação de Mudanças
Regra prática: em caso de dúvida, escalar (Patch→Minor, Minor→Major). Nunca escalar para baixo.

### 23. Checklist Obrigatório Pré-Release
- [ ] Migrations aplicadas em staging.
- [ ] `bun run build` sem erros.
- [ ] Testes que existem verdes.
- [ ] Se toca DB: `supabase--linter` sem novos avisos.
- [ ] Se toca contrato público: RFC linkada.
- [ ] Histórico da Governança §7 atualizado com a mudança.
- [ ] Sem `console.error` novo no fluxo principal.
- [ ] Design tokens respeitados (sem hex hardcoded).

### 24. Critérios para Congelamento Arquitetural
Áreas podem ser declaradas **congeladas** — nenhuma mudança sem emenda constitucional:
- Formato do hash de fechamento (após primeira execução em cliente pago).
- Estrutura de `periodos_fechados` e `periodos_reaberturas`.
- Contrato de `folha_pagamento`.
- Modelo de eventos em `system_events`.

Congelamento acontece por RFC que altera esta seção.

### 25. Relação Entre Documentos
Tabela final:

| Documento | Governa | Sujeito a |
|---|---|---|
| Constituição Arquitetural v1.0 | Como o Atlas pode mudar | Emenda via RFC |
| OPERA_CORE v1.3 | Invariantes de domínio | Constituição §3 |
| Modelo Empresarial | O que o Atlas é | Constituição §17 |
| Diagnóstico Objetivo | Onde está | Reflete estado real |
| Roadmap de Maturidade | Marcos M0–M4 | Constituição §21 |
| Governança de Maturidade v1.1 | Como medir evolução | Constituição §20 |
| RFCs | Propostas de mudança | Constituição §19 |

### 26. Assinatura Constitucional
Uma frase de encerramento em caixa laranja:
> "Esta Constituição é a única fonte de autoridade sobre a arquitetura do OPERA Atlas. Qualquer código, migration, decisão de produto ou release que a viole é considerado defeituoso, independentemente de funcionar."

## Detalhes técnicos de geração

- Python + `reportlab` A4, margens 1.8 cm.
- Reaproveitar paleta e estilos (`H1`, `H2`, `H3`, `BODY`, `CELL`, `CELLW`, `QUOTE`) do gerador anterior — copiar de `/tmp/gen_gov.py`.
- Setas apenas ASCII (`>`, `<`, `->`, `↓` só em blocos monospaced sem tab).
- Diagramas em `Table` com fundo `GRAY_L` + fonte Courier para lookalike ASCII.
- Tabela de princípios (P1–P10), matriz de impacto (§21) e relação de documentos (§25) com `repeatRows=1`.
- QA obrigatório: `pdftoppm -jpeg -r 110` → `code--view` de todas as páginas, corrigir overflow/alinhamento. Reportar issues.

## Fora de escopo

- **Não** criar `.lovable/rfcs/` nem primeira RFC (fica para pedido separado).
- **Não** codificar checklist §23 em CI (fica para pedido separado).
- **Não** modificar OPERA_CORE, memórias, schema, código ou edge functions.
- **Não** regerar Diagnóstico, Roadmap ou Governança v1.1.

## Entregável

Um arquivo: `/mnt/documents/OPERA_Atlas_Constituicao_Arquitetural_v1.0.pdf` (~14–16 páginas). Script versionado em `/tmp/gen_const.py`.
