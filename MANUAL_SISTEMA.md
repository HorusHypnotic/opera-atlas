# Documentação Técnica Completa — Método O.P.E.R.A.

## Plataforma SaaS Multi-Tenant de Gestão de Obras

**Versão:** 1.0 Beta  
**Data:** Março 2026  
**URL Produção:** https://opera-atlas.lovable.app  
**Stack:** React 18 + TypeScript + Vite + Supabase (Lovable Cloud)

---

## Sumário

1. [Objetivo do Sistema](#1-objetivo-do-sistema)
2. [Arquitetura Geral](#2-arquitetura-geral)
3. [Modelo de Dados](#3-modelo-de-dados)
4. [Autenticação e Controle de Acesso (RBAC)](#4-autenticação-e-controle-de-acesso-rbac)
5. [Multi-Tenancy e Isolamento de Dados](#5-multi-tenancy-e-isolamento-de-dados)
6. [Módulos Operacionais](#6-módulos-operacionais)
7. [Dashboard e OPERA Score](#7-dashboard-e-opera-score)
8. [Edge Functions (Backend Serverless)](#8-edge-functions-backend-serverless)
9. [Sistema Beta e Onboarding](#9-sistema-beta-e-onboarding)
10. [Política de Retenção de Dados](#10-política-de-retenção-de-dados)
11. [Super Admin — Modelo de Acesso](#11-super-admin--modelo-de-acesso)
12. [Segurança e Boas Práticas](#12-segurança-e-boas-práticas)
13. [Padrões de Código e Arquitetura Frontend](#13-padrões-de-código-e-arquitetura-frontend)
14. [Fluxos Completos](#14-fluxos-completos)
15. [Capacidade e Limites](#15-capacidade-e-limites)
16. [Roadmap e Itens Pendentes](#16-roadmap-e-itens-pendentes)
17. [Proposta Comercial vs. Estado Atual](#17-proposta-comercial-vs-estado-atual)
18. [Glossário Técnico](#18-glossário-técnico)

---

## 1. Objetivo do Sistema

O **Método O.P.E.R.A.** é uma plataforma SaaS de gestão de obras civis que dá visibilidade operacional e financeira em tempo real a construtoras, incorporadoras e empreiteiras.

### Acrônimo O.P.E.R.A.

| Pilar | Nome | Foco | Tabelas Relacionadas |
|-------|------|------|---------------------|
| **O** | Organização | Mão de obra, folha de ponto, produtividade, custo/m² | `registros_diarios` |
| **P** | Padronização | Consumo de insumos, desperdício real vs. previsto, ranking por material | `consumo_materiais`, `compras_emergenciais` |
| **E** | Eficiência | Gestão de ativos/equipamentos, ciclos de tarefa, logística interna | `ativos`, `ciclos_tarefa`, `logistica_interna` |
| **R** | Redução de Perdas | Linha de Balanço, mapa de riscos, retrabalhos | `sequenciamento_equipes`, `riscos`, `retrabalhos` |
| **A** | Análise Contínua | Fluxo de caixa, aditivos contratuais, margem de lucro | `lancamentos_financeiros`, `aditivos_contratuais` |

### Módulos Transversais

| Módulo | Tabela | Descrição |
|--------|--------|-----------|
| Segurança & Qualidade | `incidentes_seguranca` | Acidentes, NCs, inspeções, dias sem acidente |
| Ações Corretivas | `acoes_corretivas` | Registro com foto, responsável, prazo, prioridade |
| Checklist Semanal | `checklist_semanal` | 20 itens do método O.P.E.R.A. por semana |

---

## 2. Arquitetura Geral

### Stack Tecnológica

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| **Frontend** | React 18 + TypeScript + Vite | SPA rápido, type-safe, HMR |
| **UI** | Tailwind CSS + shadcn/ui + Recharts | Design system consistente, componentes acessíveis |
| **Estado** | TanStack React Query v5 | Cache, refetch, invalidação automática |
| **Roteamento** | React Router v6 | Rotas aninhadas, guards |
| **Backend** | Supabase (Lovable Cloud) | PostgreSQL + Auth + Storage + Edge Functions |
| **Banco** | PostgreSQL 15 com RLS | Isolamento por tenant via Row Level Security |
| **Auth** | Supabase Auth | Email/senha + Google OAuth |
| **Functions** | Supabase Edge Functions (Deno) | Serverless, deploy automático |
| **Storage** | Supabase Storage | Bucket `obra-fotos` (público) |
| **PDF** | jsPDF + jspdf-autotable | Relatórios exportáveis |
| **PWA** | vite-plugin-pwa | Instalável como app, ícones 192/512 |

### Diagrama de Componentes

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND (Vite)                    │
│                                                       │
│  BrowserRouter                                        │
│  ├── AuthProvider (useAuth.tsx)                       │
│  │   ├── /landing, /login, /beta → Públicas           │
│  │   └── ProtectedRoute                              │
│  │       ├── ObraProvider (useObra.tsx)               │
│  │       │   └── AppLayout (Sidebar + Content)       │
│  │       │       ├── DashboardOverview               │
│  │       │       ├── OrganizacaoPage                 │
│  │       │       ├── PadronizacaoPage                │
│  │       │       ├── EficienciaPage                  │
│  │       │       ├── ReducaoPerdasPage               │
│  │       │       ├── AnaliseContinuaPage             │
│  │       │       ├── SegurancaQualidadePage          │
│  │       │       ├── AcoesCorretivasPage             │
│  │       │       ├── ChecklistSemanalPage            │
│  │       │       └── AdminPage                       │
│  │       └── /setup → SetupPage                      │
│  │                                                    │
│  └── Hooks Compartilhados                            │
│      ├── useTableData (CRUD genérico)                │
│      ├── usePermissions (visibilidade por role)      │
│      └── useObra (contexto de obra selecionada)      │
│                                                       │
├───────────────────────────────────────────────────────┤
│                   SUPABASE (Backend)                  │
│                                                       │
│  ┌── Auth ──────────────────────────────────────┐    │
│  │  Email/Senha + Google OAuth                   │    │
│  │  Trigger: handle_new_user → cria profile      │    │
│  └───────────────────────────────────────────────┘    │
│                                                       │
│  ┌── Database (PostgreSQL + RLS) ────────────────┐   │
│  │  21 tabelas com RLS por tenant_id             │   │
│  │  Funções: has_role, get_user_tenant_id,       │   │
│  │           is_super_admin, setup_tenant,        │   │
│  │           check_obra_limit                     │   │
│  └───────────────────────────────────────────────┘   │
│                                                       │
│  ┌── Edge Functions ─────────────────────────────┐   │
│  │  accept-invite    → onboarding por convite     │   │
│  │  beta-signup      → inscrição beta + CAPTCHA   │   │
│  │  generate-reset-link → reset de senha          │   │
│  │  data-retention   → limpeza automática (cron)  │   │
│  └───────────────────────────────────────────────┘   │
│                                                       │
│  ┌── Storage ────────────────────────────────────┐   │
│  │  Bucket: obra-fotos (público)                 │   │
│  │  Uso: fotos de ações corretivas               │   │
│  └───────────────────────────────────────────────┘   │
│                                                       │
│  ┌── Cron (pg_cron + pg_net) ────────────────────┐   │
│  │  data-retention-daily → 3h AM diário          │   │
│  └───────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## 3. Modelo de Dados

### 3.1 Tabelas de Infraestrutura (Protegidas)

Estas tabelas **nunca** são afetadas pela política de retenção:

| Tabela | Propósito | Colunas Chave |
|--------|-----------|---------------|
| `tenants` | Empresas/clientes | `id`, `nome`, `cnpj`, `limite_obras` |
| `profiles` | Perfis de usuário | `id` (= auth.uid), `email`, `full_name`, `tenant_id`, `is_super_admin`, `beta_status`, `beta_approved_at` |
| `user_roles` | Papéis RBAC | `user_id`, `role` (enum), `tenant_id` |
| `obras` | Obras/projetos | `id`, `nome`, `tenant_id`, `status`, `custo_orcado_m2` |
| `obra_membros` | Vínculo usuário↔obra | `user_id`, `obra_id`, `tenant_id` |
| `invites` | Convites de equipe | `token`, `email`, `role`, `tenant_id`, `used`, `expires_at` |
| `beta_waitlist` | Lista de espera beta | `email`, `nome`, `status`, `influencer_code` |
| `beta_config` | Config global do beta | `beta_ativo`, `limite_vagas`, `tempo_teste_dias` |
| `influencer_codes` | Códigos de referência | `codigo`, `nome`, `total_cadastros`, `total_convertidos` |

### 3.2 Tabelas Operacionais (Sujeitas a Retenção)

Todas possuem `tenant_id`, `obra_id` e `created_at`:

| Tabela | Pilar | Campos Específicos |
|--------|-------|-------------------|
| `registros_diarios` | O | `nome`, `entrada`, `saida`, `atividade`, `producao`, `status` |
| `consumo_materiais` | P | `material`, `previsto`, `real_consumo`, `unidade` |
| `compras_emergenciais` | P | `material`, `qtd`, `motivo` |
| `ativos` | E | `nome`, `status` (ativo/ocioso/manutencao), `valor`, `local_atual` |
| `ciclos_tarefa` | E | `tarefa`, `tempo_medio_min`, `tempo_alvo_min`, `qtd_medicoes` |
| `logistica_interna` | E | `equipe`, `origem`, `destino`, `tempo_deslocamento_min` |
| `sequenciamento_equipes` | R | `equipe`, `semana_inicio`, `semana_fim`, `status` |
| `riscos` | R | `risco`, `severidade`, `impacto`, `prazo` |
| `retrabalhos` | R | `etapa`, `quantidade`, `descricao` |
| `lancamentos_financeiros` | A | `tipo` (receita/custo), `valor`, `fornecedor`, `status_pagamento` |
| `aditivos_contratuais` | A | `descricao`, `valor`, `tipo`, `aprovado` |
| `incidentes_seguranca` | Seg | `tipo` (acidente/inspecao/nc), `severidade`, `status` |
| `acoes_corretivas` | Trans | `descricao`, `pilar`, `prioridade`, `status`, `responsavel`, `foto_url` |
| `checklist_semanal` | Trans | `item_key`, `semana`, `verificado`, `verificado_por` |

### 3.3 Enum de Roles

```sql
CREATE TYPE public.app_role AS ENUM ('admin', 'gestor', 'operacional', 'visualizador');
```

---

## 4. Autenticação e Controle de Acesso (RBAC)

### 4.1 Métodos de Login

| Método | Implementação | Status |
|--------|--------------|--------|
| Email/Senha | Supabase Auth nativo | ✅ Ativo |
| Google OAuth | Supabase Social Auth | ✅ Ativo |
| Modo Convidado | sessionStorage + dados demo | ✅ Ativo |
| Recuperação de Senha | Edge Function `generate-reset-link` | ✅ Ativo |

### 4.2 Hierarquia de Papéis

```
Super Admin (is_super_admin = true no profiles)
  │
  └── Acesso TOTAL a todos os tenants (debugging, suporte, gestão)
      ├── Aprovar/rejeitar betas
      ├── Gerenciar todos os tenants
      ├── Ajustar limites de obras
      └── Ver métricas globais

Admin (role = 'admin' na user_roles)
  │
  └── Acesso COMPLETO dentro do próprio tenant
      ├── CRUD completo + DELETE
      ├── Gerenciar equipe (convites, roles)
      ├── Criar/editar/excluir obras
      └── Ver todos os dados do tenant

Gestor (role = 'gestor')
  │
  └── INSERT + UPDATE + SELECT
      ├── Criar e editar registros
      ├── Criar/editar obras
      └── NÃO pode excluir nem gerenciar equipe

Operacional (role = 'operacional')
  │
  └── INSERT + SELECT
      ├── Apenas inserir registros
      └── NÃO pode editar nem excluir

Visualizador (role = 'visualizador')
  │
  └── SELECT only
      └── Somente leitura
```

### 4.3 Implementação no Frontend

**Hook `useAuth`** (`src/hooks/useAuth.tsx`):
- Gerencia `AuthContext` com user, session, profile, roles
- Busca profile + roles do banco no login
- Suporta modo convidado (sessionStorage)
- Calcula `isTrialExpired` (30 dias após `beta_approved_at`)

**Hook `usePermissions`** (`src/hooks/usePermissions.ts`):
- Retorna flags: `canInsert`, `canUpdate`, `canDelete`, `canManageRoles`, `canManageObras`, `isViewOnly`
- Quando `isTrialExpired = true`, tudo vira read-only
- Usado pelos componentes para ocultar/exibir botões de CRUD

**Componente `ProtectedRoute`** (`src/components/auth/ProtectedRoute.tsx`):
- Redireciona para `/landing` se não autenticado
- Redireciona para `/beta-status` se beta não aprovado
- Redireciona para `/setup` se sem tenant_id
- Exibe banner de trial expirado
- Exibe aviso de transparência sobre acesso administrativo

### 4.4 Implementação no Backend (RLS)

Funções `SECURITY DEFINER` (evitam recursão nas policies):

```sql
-- Verifica se usuário tem um role específico
has_role(_user_id uuid, _role app_role) → boolean

-- Verifica se usuário tem QUALQUER dos roles listados
has_any_role(_user_id uuid, _roles app_role[]) → boolean

-- Retorna o tenant_id do usuário
get_user_tenant_id(_user_id uuid) → uuid

-- Verifica se é super admin
is_super_admin(_user_id uuid) → boolean
```

Padrão de RLS por tabela operacional:

```sql
-- SELECT: qualquer membro do tenant
USING (tenant_id = get_user_tenant_id(auth.uid()))

-- INSERT: admin, gestor ou operacional do tenant
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid())
  AND has_any_role(auth.uid(), ARRAY['admin', 'gestor', 'operacional']))

-- UPDATE: admin ou gestor do tenant
USING (tenant_id = get_user_tenant_id(auth.uid())
  AND has_any_role(auth.uid(), ARRAY['admin', 'gestor']))

-- DELETE: somente admin do tenant
USING (tenant_id = get_user_tenant_id(auth.uid())
  AND has_role(auth.uid(), 'admin'))

-- SUPER ADMIN: acesso total (policy separada)
USING (is_super_admin(auth.uid()))
```

---

## 5. Multi-Tenancy e Isolamento de Dados

### 5.1 Modelo de Isolamento

```
Tenant A (Construtora ABC)          Tenant B (Engenharia XYZ)
├── obras: [Obra 1, Obra 2]        ├── obras: [Obra 3]
├── users: [admin, gestor1]         ├── users: [admin, op1, op2]
├── registros_diarios: [...]        ├── registros_diarios: [...]
└── lancamentos: [...]              └── lancamentos: [...]

⚠️ Tenant A NUNCA vê dados do Tenant B (RLS garante)
⚠️ Super Admin vê TUDO (policy separada com is_super_admin)
```

### 5.2 Criação de Tenant (`setup_tenant`)

```sql
-- Função chamada no /setup (primeiro acesso)
setup_tenant(_nome text, _cnpj text)
  1. Verifica se está autenticado
  2. Verifica se já não tem tenant
  3. Cria registro em tenants
  4. Atualiza profiles.tenant_id
  5. Atribui role 'admin' ao criador
  6. Retorna tenant_id
```

### 5.3 Limite de Obras por Tenant

```sql
-- Trigger check_obra_limit (BEFORE INSERT em obras)
-- Compara COUNT(obras) com tenants.limite_obras
-- Default: 3 obras (ajustável pelo Super Admin)
```

### 5.4 Hook `useObra`

- Busca obras do tenant (via `profiles.tenant_id`)
- Mantém `selectedObraId` em state
- Todos os hooks de dados filtram por `obra_id` selecionada
- Em modo convidado, usa `DEMO_OBRAS`

### 5.5 Hook `useTableData` (CRUD Genérico)

```typescript
// src/hooks/useTableData.ts
const { data, isLoading, insert, update, remove } = useTableData<T>("nome_tabela");

// Automaticamente:
// - Filtra por tenant_id e obra_id
// - Em modo convidado, usa DEMO_DATA
// - Invalida cache após mutations
// - Ordena por created_at DESC
```

---

## 6. Módulos Operacionais

### 6.1 Organização (O) — `OrganizacaoPage`

**Tabela:** `registros_diarios`  
**KPIs:** Total de registros, custo real/m², atraso médio  
**Analytics:** `src/analytics/atraso.ts` — calcula atraso médio com base em entrada/saída  
**Campos:** nome, data_registro, entrada, saída, atividade, produção, status

### 6.2 Padronização (P) — `PadronizacaoPage`

**Tabela:** `consumo_materiais`, `compras_emergenciais`  
**KPIs:** Desperdício % ((real - previsto) / previsto × 100), ranking por material  
**Analytics:** `src/analytics/desperdicio.ts` — ranking de materiais por desperdício  
**Campos:** material, previsto, real_consumo, unidade, data_registro

### 6.3 Eficiência (E) — `EficienciaPage`

**Tabelas:** `ativos`, `ciclos_tarefa`, `logistica_interna`  
**KPIs:** % ativos em uso, tempo médio vs. alvo, tempo médio deslocamento  
**Campos ativos:** nome, status (ativo/ocioso/manutencao), valor, local_atual  
**Campos ciclos:** tarefa, tempo_medio_min, tempo_alvo_min, qtd_medicoes

### 6.4 Redução de Perdas (R) — `ReducaoPerdasPage`

**Tabelas:** `riscos`, `retrabalhos`, `sequenciamento_equipes`  
**KPIs:** Total riscos por severidade, retrabalhos por etapa, Linha de Balanço  
**Analytics:** `src/analytics/retrabalho.ts` — identifica etapas recorrentes  
**Linha de Balanço:** Visualização Gantt do sequenciamento de equipes

### 6.5 Análise Contínua (A) — `AnaliseContinuaPage`

**Tabelas:** `lancamentos_financeiros`, `aditivos_contratuais`, `compras_emergenciais`  
**KPIs:** Saldo (receitas - custos), margem %, aditivos aprovados vs. pendentes  
**Campos financeiros:** tipo (receita/custo), valor, fornecedor, status_pagamento

### 6.6 Segurança & Qualidade — `SegurancaQualidadePage`

**Tabela:** `incidentes_seguranca`  
**KPIs:** Dias sem acidente, inspeções aprovadas %, NCs abertas/resolvidas  
**Tipos:** acidente, inspecao, nc  
**Status:** aberto, resolvido, aprovado, reprovado

### 6.7 Ações Corretivas — `AcoesCorretivasPage`

**Tabela:** `acoes_corretivas`  
**Campos:** descrição, pilar, prioridade, status (pendente/em_andamento/concluida), responsável, prazo, foto_url  
**Storage:** Upload de fotos para bucket `obra-fotos`

### 6.8 Checklist Semanal — `ChecklistSemanalPage`

**Tabela:** `checklist_semanal`  
**20 itens** fixos baseados no método O.P.E.R.A.  
**Campos:** item_key, semana, verificado, verificado_por, observação  
**Histórico:** Gráfico de evolução semanal

---

## 7. Dashboard e OPERA Score

### 7.1 OPERA Score (`src/analytics/operaScore.ts`)

Nota de 0 a 100, calculada em 5 sub-scores de 20 pontos cada:

```
OPERA Score = O (20) + P (20) + E (20) + R (20) + A (20)
```

| Pilar | Cálculo | Max |
|-------|---------|-----|
| O — Organização | % de registros com status "ok" × 20 | 20 |
| P — Padronização | 20 - (desperdício_médio / 15 × 20), mín 0 | 20 |
| E — Eficiência | % de ativos com status "ativo" × 20 | 20 |
| R — Redução de Perdas | 20 - (riscos × 2, max 10) - (retrabalhos, max 10) | 20 |
| A — Análise Contínua | margem_score (max 10) + segurança_score (max 10) | 20 |

### 7.2 Dashboard Overview

- **DataRetentionBanner** — Aviso de retenção beta + alertas de dados próximos da exclusão
- **OperaScoreCard** — Gauge visual com breakdown por pilar
- **KPIs globais** — Saldo financeiro, obras cadastradas, dias sem acidente, inspeções aprovadas
- **DashboardCharts** — Frequência diária, consumo por material, fluxo financeiro, incidentes por tipo
- **AnalyticsAlerts** — Alertas inteligentes automáticos:
  - `src/analytics/atraso.ts` — Atraso médio > 30 min
  - `src/analytics/desperdicio.ts` — Materiais com >5% desperdício
  - `src/analytics/retrabalho.ts` — Etapas com retrabalho recorrente
  - `src/analytics/ranking.ts` — Ranking geral de eficiência
- **Módulos O.P.E.R.A.** — Cards navegáveis com status (ok/warning/critical)
- **Exportação PDF** — Relatório completo via `src/utils/exportOperaReport.ts`

### 7.3 Filtros Globais (`GlobalFilters`)

- Seletor de obra (dropdown com todas do tenant)
- Afeta todos os hooks via `useObra().selectedObraId`

---

## 8. Edge Functions (Backend Serverless)

### 8.1 `accept-invite` — Aceitar Convite

**Endpoint:** `POST /functions/v1/accept-invite`  
**Auth:** Público (sem JWT)  
**Input:** `{ token, email, password, full_name }`

**Fluxo:**
1. Valida convite (token, usado, expirado, email)
2. Verifica se usuário já existe
3. Se novo: cria via `admin.createUser()` com email confirmado
4. Aguarda trigger `handle_new_user` criar profile (retry com backoff)
5. Se trigger falha: cria profile via upsert (fallback)
6. Atualiza `profiles.tenant_id`
7. Atribui role via `user_roles` (upsert)
8. Se convite tem `obra_id`: vincula em `obra_membros`
9. Marca convite como usado
10. Retorna `{ success: true, auto_login: true }`

### 8.2 `beta-signup` — Inscrição Beta

**Endpoint:** `POST /functions/v1/beta-signup`  
**Auth:** Público (sem JWT)  
**Proteções:** Rate limit por IP (15s) + Cloudflare Turnstile CAPTCHA

**Fluxo:**
1. Valida CAPTCHA Turnstile
2. Sanitiza inputs (nome, email, telefone, empresa, código)
3. Verifica duplicata
4. Verifica se beta está ativo (`beta_config`)
5. Conta vagas disponíveis
6. Se tem código de influenciador + vaga + senha → **auto-aprova** + cria conta
7. Se tem vaga → `aguardando_aprovacao`
8. Se sem vaga → `lista_de_espera`
9. Rastreia conversão do influenciador

### 8.3 `generate-reset-link` — Reset de Senha

**Endpoint:** `POST /functions/v1/generate-reset-link`  
**Auth:** Requer Bearer token (admin ou super_admin)  
**Input:** `{ email, redirect_to? }`

**Fluxo:**
1. Valida token do chamador
2. Verifica se é admin ou super_admin
3. Gera link de recuperação via `admin.generateLink({ type: 'recovery' })`
4. Retorna `{ link }`

### 8.4 `data-retention` — Limpeza Automática

**Endpoint:** `POST /functions/v1/data-retention`  
**Auth:** Via cron (anon key)  
**Frequência:** Diário às 3h AM (pg_cron)

**Fluxo:**
1. Calcula data de corte: `now() - 3 meses`
2. Itera 14 tabelas operacionais
3. Valida que tabela não é protegida (double-check)
4. Deleta registros com `created_at < cutoff`
5. Loga quantidade deletada por tabela
6. Retorna relatório completo

---

## 9. Sistema Beta e Onboarding

### 9.1 Fluxo Completo de Novo Cliente

```
1. Landing Page (/landing)
   └── Conhece o sistema, planos, CTA para beta

2. Inscrição Beta (/beta)
   └── Formulário: nome, email, telefone, empresa, código influenciador
   └── CAPTCHA Turnstile obrigatório
   └── Edge Function: beta-signup
   └── Status: aguardando_aprovacao | lista_de_espera | aprovado (auto)

3. Acompanhamento (/beta-status)
   └── Usuário acompanha status pela interface

4. Aprovação (Admin Panel → Super Admin)
   └── Super Admin aprova/rejeita na aba Beta
   └── Trigger sync_beta_approval:
       - Atualiza profiles.beta_status = 'aprovado'
       - Define profiles.beta_approved_at = now()

5. Primeiro Login (/login)
   └── Email/senha ou Google
   └── ProtectedRoute verifica beta_status

6. Setup Tenant (/setup)
   └── Nome da empresa + CNPJ
   └── Função setup_tenant:
       - Cria tenant
       - Vincula profile
       - Atribui role admin
   └── Trigger track_influencer_conversion (se veio de código)

7. Dashboard (/)
   └── Sistema pronto para uso
   └── Trial de 30 dias inicia em beta_approved_at
```

### 9.2 Fluxo de Convite (Equipe)

```
1. Admin → Painel Admin → Aba Convites
2. Cria convite: email + role + obra (opcional)
3. Copia link: /invite?token=xxx
4. Envia manualmente para colaborador
5. Colaborador acessa link → preenche nome + senha
6. Edge Function accept-invite:
   - Cria conta com email confirmado
   - Vincula ao tenant + obra
   - Atribui role
7. Auto-login → Dashboard
```

### 9.3 Expiração de Trial

```
beta_approved_at + 30 dias = data de expiração

Se expirado:
- isTrialExpired = true (useAuth)
- usePermissions: canInsert/canUpdate/canDelete = false
- Banner: "Período de teste expirou"
- Sistema: modo somente leitura

Exceções:
- Super Admin: isento
- Modo convidado: isento (demo)
```

### 9.4 Códigos de Influenciador

| Campo | Descrição |
|-------|-----------|
| `codigo` | Código único (ex: ENGENHEIRO10) |
| `nome` | Nome do influenciador |
| `ativo` | Se o código está ativo |
| `total_cadastros` | Incrementa no beta-signup |
| `total_convertidos` | Incrementa quando profile ganha tenant_id (trigger) |

---

## 10. Política de Retenção de Dados

### 10.1 Regra (Beta)

- **Retenção:** 3 meses de dados operacionais
- **Limpeza:** Diária às 3h AM (pg_cron → Edge Function)
- **Critério:** `created_at < NOW() - INTERVAL '3 months'`
- **Escopo:** 14 tabelas operacionais apenas

### 10.2 Tabelas Afetadas

`registros_diarios`, `consumo_materiais`, `incidentes_seguranca`, `lancamentos_financeiros`, `retrabalhos`, `ativos`, `riscos`, `ciclos_tarefa`, `logistica_interna`, `sequenciamento_equipes`, `compras_emergenciais`, `aditivos_contratuais`, `checklist_semanal`, `acoes_corretivas`

### 10.3 Tabelas Protegidas (NUNCA limpas)

`profiles`, `tenants`, `user_roles`, `invites`, `beta_waitlist`, `beta_config`, `influencer_codes`, `obras`, `obra_membros`

### 10.4 Avisos no Dashboard

| Tempo Restante | Tipo de Aviso | Cor |
|----------------|---------------|-----|
| Sempre | Informativo (política beta) | Azul (primary) |
| ≤ 30 dias | Dados próximos da retenção | Azul claro |
| ≤ 7 dias | Exclusão próxima | Âmbar |
| ≤ 1 dia | Exclusão iminente | Vermelho (destructive) |

### 10.5 Futuro (Pós-Beta)

A Edge Function aceita `retentionMonths` como parâmetro:
- Essencial: 3 meses
- Profissional: 6 meses
- Enterprise: 12 meses ou ilimitado

---

## 11. Super Admin — Modelo de Acesso

### 11.1 Modelo Atual: Acesso Total + Transparência

**Justificativa:** Em fase beta, o Super Admin precisa de acesso completo para debugging, suporte e melhoria do sistema.

**Implementação RLS:**
```sql
-- Policy em TODAS as tabelas operacionais e de gestão
CREATE POLICY "super_admin_all" ON tabela FOR ALL TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));
```

**Aviso de Transparência (LGPD):**
- Banner fixo no `ProtectedRoute` para todos os usuários logados:
- > "Durante o período beta, administradores do sistema podem acessar dados operacionais de forma limitada para diagnóstico e melhoria da plataforma."

### 11.2 Painel Super Admin

| Aba | Funcionalidade |
|-----|---------------|
| **Beta** | Aprovar/rejeitar inscrições, ver lista de espera |
| **Influenciadores** | Criar/gerenciar códigos, ver conversões |
| **Config Beta** | Ativar/desativar beta, ajustar vagas e prazo |
| **Métricas** | KPIs consolidados do beta (total inscritos, aprovados, etc.) |
| **Super Admin** | Listar TODOS os tenants, ajustar `limite_obras` por tenant |
| **Usuários** | Gerenciar membros do próprio tenant |
| **Convites** | Criar/copiar/deletar convites |
| **Equipe por Obra** | Vincular membros a obras |

### 11.3 Dados que NUNCA são Expostos

Mesmo com acesso total, o sistema não exibe:
- Senhas ou hashes
- Tokens de convite em texto
- Service role keys
- Dados bancários completos

### 11.4 Evolução Planejada

| Fase | Modelo |
|------|--------|
| **Beta (atual)** | Acesso total + aviso transparência |
| **Produção** | Acesso a métricas agregadas + acesso temporário para suporte |
| **Enterprise** | Tabela `support_access` com `granted_by`, `expires_at`, `reason` |

---

## 12. Segurança e Boas Práticas

### 12.1 Row Level Security (RLS)

- ✅ **Habilitado** em todas as 21 tabelas
- ✅ Policies separadas por **comando** (SELECT, INSERT, UPDATE, DELETE)
- ✅ Policies separadas por **role** (admin, gestor, operacional, visualizador)
- ✅ Super Admin com policy `FOR ALL` separada
- ✅ Funções `SECURITY DEFINER` para evitar recursão
- ✅ Isolamento por `tenant_id` em todas as queries

### 12.2 Proteções Ativas

| Proteção | Implementação |
|----------|--------------|
| CAPTCHA | Cloudflare Turnstile no beta-signup |
| Rate Limiting | 15s por IP no beta-signup |
| Email Confirmação | `email_confirm: true` no createUser |
| Convites com Expiração | `expires_at = now() + 7 days` |
| Limite de Obras | Trigger `check_obra_limit` |
| Trial Expiration | 30 dias → read-only |
| Sanitização de Input | Edge Functions validam/sanitizam todos os campos |

### 12.3 Boas Práticas de Desenvolvimento

#### Frontend
- **Nunca** confie apenas no frontend para segurança — RLS é a garantia real
- Use `usePermissions()` apenas para UX (ocultar botões), não para segurança
- Nunca armazene secrets no código — use variáveis de ambiente
- Use `as any` com moderação — preferir tipos do Supabase

#### Backend
- **Nunca** modifique schemas reservados (auth, storage, realtime)
- **Nunca** execute SQL raw de input do usuário
- Use `SECURITY DEFINER` com `SET search_path = public`
- Validate inputs no Edge Function ANTES de qualquer operação

#### Banco de Dados
- Roles em tabela separada (`user_roles`), nunca no `profiles`
- `is_super_admin` é a ÚNICA exceção (flag booleana em profiles)
- Foreign keys para `auth.users` somente via `profiles.id`
- Defaults sensíveis em todas as colunas (evita erros de insert)

### 12.4 Pontos de Atenção

| Item | Status | Ação Necessária |
|------|--------|----------------|
| Turnstile CAPTCHA | 🟡 Modo teste | Ativar chave de produção |
| Leaked Password Protection | 🟡 Desabilitado | Ativar no Supabase |
| Audit Trail | ❌ Não implementado | Criar tabela de logs |
| LGPD / Termos de Uso | ❌ Não implementado | Criar página |

---

## 13. Padrões de Código e Arquitetura Frontend

### 13.1 Estrutura de Diretórios

```
src/
├── analytics/          # Cálculos de KPIs e alertas
│   ├── atraso.ts
│   ├── desperdicio.ts
│   ├── operaScore.ts
│   ├── ranking.ts
│   └── retrabalho.ts
├── components/
│   ├── auth/           # ProtectedRoute
│   ├── admin/          # Abas do painel admin
│   ├── dashboard/      # KPICard, Charts, Filters, Score, Alerts
│   ├── layout/         # AppLayout, AppSidebar
│   └── ui/             # shadcn/ui components
├── data/
│   ├── demoData.ts     # Dados fictícios para modo convidado
│   └── mockData.ts     # (legacy)
├── hooks/
│   ├── useAuth.tsx     # Contexto de autenticação
│   ├── useObra.tsx     # Contexto de obra selecionada
│   ├── usePermissions.ts # Flags de permissão por role
│   └── useTableData.ts   # CRUD genérico para tabelas
├── integrations/
│   └── supabase/
│       ├── client.ts   # Auto-gerado (NÃO editar)
│       └── types.ts    # Auto-gerado (NÃO editar)
├── pages/              # Uma página por módulo
├── utils/
│   └── exportOperaReport.ts  # Geração de PDF
└── main.tsx
```

### 13.2 Padrão de Página

Toda página operacional segue o mesmo padrão:

```tsx
export default function ModuloPage() {
  // 1. Hooks de dados
  const { data, isLoading, insert, update, remove } = useTableData<T>("tabela");
  
  // 2. Cálculos de KPIs (useMemo quando complexo)
  const kpi = useMemo(() => calcular(data), [data]);
  
  // 3. Definição de campos do formulário
  const fields = [
    { name: "campo", label: "Label", type: "text", required: true },
  ];
  
  return (
    <div>
      {/* Filtros globais */}
      <GlobalFilters />
      
      {/* Header do módulo */}
      <SectionHeader title="..." subtitle="..." icon={<Icon />} />
      
      {/* Botão de adicionar (condicionado por usePermissions) */}
      <AddRecordDialog fields={fields} onSubmit={insert} />
      
      {/* KPIs em grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard ... />
      </div>
      
      {/* Tabela de dados */}
      <table>
        {data.map(row => (
          <tr>
            {/* Dados */}
            <EditRecordDialog ... onSubmit={update} />
            <DeleteRecordButton onConfirm={() => remove(id)} />
          </tr>
        ))}
      </table>
    </div>
  );
}
```

### 13.3 Design System

- **Cores:** Sempre via tokens CSS (`--primary`, `--background`, `--muted`, etc.)
- **Status:** `status-ok` (verde), `status-warning` (âmbar), `status-critical` (vermelho)
- **Cards:** Classe `glass-card` para cards com glassmorphism
- **Responsividade:** `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
- **Dark Mode:** Suportado via CSS variables (sem toggle manual ainda)

### 13.4 Arquivos Auto-Gerados (NÃO EDITAR)

| Arquivo | Motivo |
|---------|--------|
| `src/integrations/supabase/client.ts` | Gerado pelo Lovable Cloud |
| `src/integrations/supabase/types.ts` | Gerado pelo Lovable Cloud |
| `supabase/config.toml` | Configuração do projeto |
| `.env` | Variáveis de ambiente |

---

## 14. Fluxos Completos

### 14.1 Fluxo de Dados — Da UI ao Banco

```
Usuário clica "Adicionar" no módulo
  → AddRecordDialog abre form com campos definidos
  → Usuário preenche e submete
  → onSubmit chama insert() do useTableData
  → insert() adiciona tenant_id e obra_id automaticamente
  → Supabase client faz INSERT via API
  → RLS verifica: tenant_id + role do usuário
  → Se OK → dado persistido
  → Se FALHA → erro retornado
  → useTableData invalida cache (queryClient)
  → React Query refetcha dados automaticamente
  → UI atualiza com novo registro
```

### 14.2 Fluxo de Autenticação

```
Usuário acessa qualquer rota protegida
  → ProtectedRoute verifica useAuth()
  → Se loading → spinner
  → Se !user && !isGuest → redirect /landing
  → Se isGuest → libera (dados demo)
  → Se beta_status !== "aprovado" → redirect /beta-status
  → Se !tenant_id → redirect /setup
  → Se isTrialExpired → banner + read-only
  → Renderiza children
```

### 14.3 Fluxo de Limpeza de Dados (Cron)

```
3h AM (diário)
  → pg_cron dispara HTTP POST via pg_net
  → Edge Function data-retention recebe request
  → Calcula cutoff = now() - 3 meses
  → Loop em 14 tabelas operacionais
  → DELETE WHERE created_at < cutoff (usa service_role_key)
  → Loga resultados
  → Retorna relatório JSON
```

---

## 15. Capacidade e Limites

### 15.1 Limites do Banco

| Recurso | Limite | Uso Atual |
|---------|--------|-----------|
| Banco de dados | ~500 MB | ~12 MB (2.4%) |
| Storage (fotos) | 1 GB | Mínimo |
| Edge Functions | Sem limite prático | 4 funções |
| Rows por query | 1.000 (padrão Supabase) | OK |

### 15.2 Estimativa de Capacidade

| Cenário | Clientes | Dados/mês | Duração | Espaço |
|---------|----------|-----------|---------|--------|
| **Seguro** | 10-15 | ~5 MB/mês | 12 meses | 50-80 MB |
| **Confortável** | 20-30 | ~8 MB/mês | 12 meses | 100-200 MB |
| **Limite** | 50+ | ~12 MB/mês | 12 meses | 300+ MB |

**Com política de retenção (3 meses):** capacidade efetiva ~3x maior.

### 15.3 Premissas por Obra Ativa

| Tabela | Registros/mês | Bytes/registro |
|--------|--------------|----------------|
| registros_diarios | 500-800 | ~200 |
| consumo_materiais | 50-100 | ~150 |
| lancamentos_financeiros | 30-50 | ~180 |
| incidentes_seguranca | 5-15 | ~150 |
| Outras | 20-50 cada | ~150 |

---

## 16. Roadmap e Itens Pendentes

### 16.1 Alta Prioridade

| Item | Descrição | Complexidade |
|------|-----------|-------------|
| **Envio de email nos convites** | Automático ao criar convite (hoje é manual) | Média |
| **Integração Stripe** | Converter trial → plano pago | Alta |
| **Extensão manual de trial** | Super Admin estender prazo por tenant | Baixa |
| **Turnstile produção** | Ativar chave real do CAPTCHA | Baixa |
| **Leaked Password Protection** | Ativar verificação de senhas comprometidas | Baixa |

### 16.2 Média Prioridade

| Item | Descrição | Complexidade |
|------|-----------|-------------|
| **Relatórios agendados por email** | PDF quinzenal/mensal automático | Alta |
| **Edição de perfil** | Nome, foto, senha | Baixa |
| **Auditoria / Log de ações** | Registrar quem alterou o quê | Média |
| **Filtros por data** | Semana, mês, trimestre em todos os módulos | Média |
| **Import CSV/Excel** | Upload em massa | Média |
| **Export CSV** | Backup de dados do tenant | Baixa |

### 16.3 Baixa Prioridade / Futuro

| Item | Descrição |
|------|-----------|
| App nativo (React Native) | Uso offline em canteiro |
| Integração ERP | Sienge, UAU, etc. |
| IA para previsões | ML para atrasos e desperdícios |
| Fotos com GPS | Geolocalização em ações corretivas |
| Comparativo entre obras | Dashboard comparativo |
| Notificações push (PWA) | Service Worker |
| Multi-idioma | EN/ES |
| Toggle Dark/Light mode | Preferência do usuário |
| LGPD / Termos de uso | Página de política |

---

## 17. Proposta Comercial vs. Estado Atual

### 17.1 Pacote Essencial (R$ 497/mês)

| Promessa | Status | Observação |
|----------|--------|------------|
| Controle de frequência | ✅ | `registros_diarios` |
| KPI real vs. orçado | ✅ | Cálculos no dashboard |
| Controle de materiais | ✅ | `consumo_materiais` |
| Gestão de ativos | ✅ | `ativos` |
| Checklist semanal | ✅ | `checklist_semanal` |
| Dashboard consolidado | ✅ | OPERA Score + KPIs |
| Exportação PDF | ✅ | `exportOperaReport` |
| Até 3 obras | ✅ | `limite_obras = 3` |
| Até 10 usuários | 🟡 | Sem limite técnico (implementar) |

### 17.2 Pacote Profissional (R$ 997/mês)

| Promessa | Status |
|----------|--------|
| Tudo do Essencial | ✅ |
| Fluxo de caixa | ✅ |
| Linha de Balanço | ✅ |
| Alertas inteligentes | ✅ |
| Ações corretivas com foto | ✅ |
| Relatório quinzenal por email | ❌ Pendente |
| Até 10 obras | ✅ (ajustar `limite_obras`) |
| Até 30 usuários | 🟡 |

### 17.3 Pacote Estratégico (R$ 1.997/mês)

| Promessa | Status |
|----------|--------|
| Tudo do Profissional | ✅/🟡 |
| Previsão de prazo com IA | ❌ Pendente |
| Comparativo entre obras | ❌ Pendente |
| Importação de dados | ❌ Pendente |
| Dashboard de economia real | 🟡 Parcial |
| Relatório mensal premium | ❌ Pendente |
| Obras ilimitadas | ✅ (ajustar `limite_obras`) |
| Usuários ilimitados | 🟡 |

### 17.4 Resumo de Cobertura

- **Essencial:** ~90% pronto
- **Profissional:** ~75% pronto
- **Estratégico:** ~55% pronto

---

## 18. Glossário Técnico

| Termo | Definição |
|-------|-----------|
| **Tenant** | Empresa/cliente isolado no sistema |
| **RLS** | Row Level Security — isolamento de dados no PostgreSQL |
| **RBAC** | Role-Based Access Control — controle por papel |
| **OPERA Score** | Nota de 0-100 dos 5 pilares do método |
| **Edge Function** | Função serverless executada no Deno (Supabase) |
| **Linha de Balanço** | Técnica de planejamento visual (Gantt de equipes) |
| **NC** | Não Conformidade — desvio de qualidade |
| **KPI** | Key Performance Indicator — indicador chave |
| **Trial** | Período de teste de 30 dias pós-aprovação beta |
| **Retenção** | Política de manter dados por tempo limitado |
| **PWA** | Progressive Web App — app instalável via navegador |
| **CAPTCHA** | Verificação anti-bot (Cloudflare Turnstile) |
| **LGPD** | Lei Geral de Proteção de Dados |

---

*Documento gerado em Março de 2026 — Método O.P.E.R.A. v1.0 Beta*  
*Atualização automática recomendada a cada sprint.*
