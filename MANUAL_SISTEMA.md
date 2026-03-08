# Manual do Sistema — Método O.P.E.R.A.
## Gestão Inteligente de Obras

**Versão:** Beta  
**Data:** Março 2026  
**URL:** https://opera-atlas.lovable.app

---

## 1. Objetivo do Sistema

O **Método O.P.E.R.A.** é uma plataforma SaaS multi-tenant de gestão de obras civis, projetada para dar visibilidade operacional e financeira em tempo real a construtoras e empreiteiras.

O acrônimo O.P.E.R.A. representa os cinco pilares do sistema:

| Pilar | Nome | Objetivo |
|-------|------|----------|
| **O** | Organização | Controle de mão de obra, diárias, produtividade e custo por m² |
| **P** | Padronização | Gestão de insumos, consumo real vs. previsto, ranking de desperdício |
| **E** | Eficiência | Gestão de ativos/equipamentos, ciclos de tarefa, logística interna |
| **R** | Redução de Perdas | Linha de Balanço (sequenciamento de equipes), mapa de riscos, retrabalhos |
| **A** | Análise Contínua | Fluxo de caixa, aditivos contratuais, compras emergenciais, status de fornecedores |

Além dos 5 pilares, há módulos transversais:
- **Segurança & Qualidade** — Incidentes, não-conformidades, inspeções, dias sem acidente
- **Ações Corretivas** — Registro com foto, prioridade, responsável e prazo
- **Checklist Semanal** — 20 itens baseados no método O.P.E.R.A., com histórico de evolução

---

## 2. Arquitetura de Acesso (RBAC Multi-Tenant)

O sistema é isolado por **tenant** (empresa). Cada empresa tem seus próprios dados, obras e usuários.

### Hierarquia de Papéis

| Papel | Quem é | O que pode fazer |
|-------|--------|------------------|
| **Super Admin** | Dono da plataforma (você) | Acesso global a todos os tenants. Aprova betas, define limites de obras, gerencia tudo |
| **Admin (Cliente)** | Dono da construtora | CRUD completo + excluir registros. Gerencia equipe, obras e convites dentro do seu tenant |
| **Gestor** | Engenheiro / Mestre de obra | Inserir + editar registros. Criar/editar obras. Não pode excluir nem gerenciar equipe |
| **Operacional** | Encarregado / Apontador | Apenas inserir registros (diárias, consumo, incidentes). Não pode editar nem excluir |
| **Visualizador** | Diretoria / Fiscalização | Somente leitura. Vê todos os dados do tenant mas não altera nada |

### Isolamento de Dados
- Todas as tabelas operacionais usam **Row Level Security (RLS)** com `tenant_id = get_user_tenant_id(auth.uid())`
- Um usuário de um tenant **jamais** vê dados de outro tenant
- O Super Admin tem políticas RLS separadas que permitem acesso global

---

## 3. O que está funcionando ✅

### 3.1 Autenticação e Onboarding
- ✅ Login com **email/senha**
- ✅ Login com **Google OAuth**
- ✅ **Modo convidado** (demo com dados fictícios, sem acesso ao banco)
- ✅ **Recuperação de senha** por email
- ✅ **Configuração inicial** (setup de tenant): ao fazer primeiro login, o usuário cria sua empresa e se torna admin
- ✅ **Landing page** com apresentação do sistema, planos e formulário de contato via WhatsApp
- ✅ **PWA** — instalável como app no celular

### 3.2 Sistema de Convites Multi-Tenant
- ✅ Admin cria convite com email + role (gestor, operacional ou visualizador)
- ✅ Convite salva `tenant_id`, `role`, `token`, `expires_at`, `created_by`
- ✅ Edge Function `accept-invite`: valida token → cria usuário → vincula ao tenant → atribui role → marca como usado
- ✅ Retry com backoff para aguardar trigger de criação de profile (evita race condition)
- ✅ Fallback: se trigger não criar profile, a Edge Function cria diretamente via upsert
- ✅ Suporte a `obra_id` opcional no convite (vincula usuário a obra específica)
- ✅ Auto-login após aceitar convite
- ✅ Convites com expiração de 7 dias
- ✅ UI para copiar link, ver status (ativo/usado/expirado), deletar convite

### 3.3 Sistema Beta
- ✅ Página pública `/beta` para inscrição na lista de espera
- ✅ Controle de vagas com contador em tempo real
- ✅ Edge Function `beta-signup` com rate limiting por IP (15s) e proteção Turnstile
- ✅ Status: `aguardando_aprovacao` → `aprovado` / `lista_de_espera` / `rejeitado`
- ✅ Trigger `sync_beta_approval`: quando aprovado na waitlist, atualiza profile automaticamente
- ✅ `ProtectedRoute` bloqueia acesso se `beta_status !== "aprovado"`
- ✅ Página `/beta-status` para usuário acompanhar status

### 3.4 Códigos de Influenciador
- ✅ Criação de códigos de desconto/rastreamento
- ✅ Contagem de cadastros e conversões por código
- ✅ Ativar/desativar códigos
- ✅ Trigger `track_influencer_conversion`: incrementa conversão quando beta cria tenant

### 3.5 Dashboard e Módulos Operacionais
Todos os módulos abaixo possuem **CRUD completo** (respeitando permissões por role), tabelas com dados reais do banco, KPIs calculados e filtros por obra:

| Módulo | Tabela | KPIs |
|--------|--------|------|
| Organização | `registros_diarios` | Total de registros, custo/m², atraso médio |
| Padronização | `consumo_materiais` | Desperdício %, ranking por material |
| Eficiência - Ativos | `ativos` | Utilização %, valor ocioso |
| Eficiência - Ciclos | `ciclos_tarefa` | Tempo médio vs. alvo |
| Eficiência - Logística | `logistica_interna` | Tempo médio deslocamento |
| Redução de Perdas - Riscos | `riscos` | Total de riscos por severidade |
| Redução de Perdas - Retrabalhos | `retrabalhos` | Quantidade por etapa |
| Redução de Perdas - Sequenciamento | `sequenciamento_equipes` | Linha de Balanço visual |
| Análise Contínua - Financeiro | `lancamentos_financeiros` | Saldo, margem, fluxo de caixa |
| Análise Contínua - Aditivos | `aditivos_contratuais` | Valor total, aprovados vs. pendentes |
| Análise Contínua - Compras | `compras_emergenciais` | Total de compras emergenciais |
| Segurança & Qualidade | `incidentes_seguranca` | Dias sem acidente, NCs abertas, inspeções |
| Ações Corretivas | `acoes_corretivas` | Pendentes, em andamento, concluídas + upload de foto |
| Checklist Semanal | `checklist_semanal` | 20 itens por semana, % conclusão, gráfico de evolução |

### 3.6 Dashboard Consolidado
- ✅ **OPERA Score** — nota de 0 a 100 calculada a partir dos 5 pilares
- ✅ **KPIs globais** — saldo financeiro, obras cadastradas, dias sem acidente, inspeções aprovadas
- ✅ **Gráficos** — frequência diária, consumo por material, fluxo financeiro, incidentes por tipo
- ✅ **Alertas inteligentes** — atraso médio, desperdício, retrabalho recorrente, conflitos de sequenciamento
- ✅ **Exportação PDF** — relatório completo com todos os indicadores

### 3.7 Painel Administrativo
- ✅ Aba **Usuários & Permissões** — listar membros do tenant, atribuir/remover roles
- ✅ Aba **Convites** — criar, copiar link, ver status, deletar
- ✅ Aba **Obras** — criar obra (com limite por tenant), listar, excluir
- ✅ Aba **Equipe por Obra** (`obra_membros`) — vincular membros a obras específicas
- ✅ Aba **Beta** (Super Admin) — aprovar/rejeitar inscrições
- ✅ Aba **Influenciadores** (Super Admin) — gerenciar códigos
- ✅ Aba **Config Beta** (Super Admin) — ativar/desativar beta, ajustar vagas e prazo
- ✅ Aba **Métricas** (Super Admin) — visão consolidada do beta
- ✅ Aba **Super Admin** — gerenciar todos os tenants, ajustar limites de obras

### 3.8 Expiração de Trial (30 dias)
- ✅ Campo `beta_approved_at` registrado automaticamente na aprovação
- ✅ Cálculo de expiração: `beta_approved_at + 30 dias`
- ✅ Após expirar: **modo somente leitura** (vê tudo, não insere/edita/exclui)
- ✅ Banner visual informando que o trial expirou
- ✅ Super Admin é isento da expiração

### 3.9 Segurança
- ✅ RLS em **todas** as tabelas operacionais
- ✅ Policies separadas por comando (SELECT, INSERT, UPDATE, DELETE) e por role
- ✅ Funções `SECURITY DEFINER` para evitar recursão nas policies
- ✅ `check_obra_limit` — trigger que impede criação de obras acima do limite
- ✅ Sidebar Admin **oculto** para convidados e não-admins
- ✅ Redirecionamento no `AdminPage` para usuários sem permissão
- ✅ `usePermissions` — hook centralizado para controle de UI por role

---

## 4. O que falta implementar ❌

### 4.1 Alta Prioridade

| Item | Descrição | Complexidade |
|------|-----------|-------------|
| **Notificações por email** | Avisar quando convite é enviado, trial está acabando (5 dias antes), obra criada | Média |
| **Planos e pagamento** | Integrar Stripe/similar para converter trial em plano pago (Essencial, Profissional, Enterprise) | Alta |
| **Extensão manual de trial** | Super Admin poder estender prazo de teste de um tenant específico | Baixa |
| **Envio real de email no convite** | Hoje o admin copia o link manualmente; deveria enviar email automático | Média |
| **Turnstile em produção** | CAPTCHA do beta está em modo teste; ativar chave de produção | Baixa |
| **Proteção de senha vazada** | Ativar verificação de senhas comprometidas (Supabase Leaked Password Protection) | Baixa |

### 4.2 Média Prioridade

| Item | Descrição | Complexidade |
|------|-----------|-------------|
| **Relatórios agendados** | Envio automático de relatório PDF por email (semanal/mensal) | Alta |
| **Edição de perfil** | Usuário poder alterar nome, foto, senha dentro do sistema | Baixa |
| **Auditoria / Log de ações** | Registrar quem alterou o quê e quando (audit trail) | Média |
| **Filtros avançados por data** | Filtrar dados por período (semana, mês, trimestre) em todos os módulos | Média |
| **Importação de dados** | Upload de planilha CSV/Excel para popular tabelas em massa | Média |
| **Backup/export de dados** | Admin poder exportar todos os dados do tenant em CSV | Baixa |
| **Operacional editar próprios registros** | Permitir que o operacional corrija registros que ele mesmo criou | Média |

### 4.3 Baixa Prioridade / Futuro

| Item | Descrição | Complexidade |
|------|-----------|-------------|
| **App nativo** | Versão nativa iOS/Android (React Native) para uso offline em canteiro | Muito Alta |
| **Integração com ERP** | Conectar com sistemas de gestão existentes (Sienge, UAU, etc.) | Muito Alta |
| **IA para previsões** | Usar ML para prever atrasos, desperdício e riscos com base no histórico | Alta |
| **Fotos com geolocalização** | Registrar local GPS ao tirar fotos de ações corretivas | Média |
| **Comparativo entre obras** | Dashboard comparando indicadores entre obras do mesmo tenant | Média |
| **Notificações push (PWA)** | Alertas em tempo real no celular via Service Worker | Média |
| **Multi-idioma** | Suporte a inglês/espanhol para internacionalização | Baixa |
| **Dark/Light mode toggle** | Já existe dark mode, falta toggle manual para o usuário | Baixa |
| **Termos de uso e LGPD** | Página com política de privacidade e consentimento | Baixa |

---

## 5. Fluxos Principais

### 5.1 Fluxo de Onboarding (Novo Cliente)
```
Landing Page → Inscrição Beta → Aprovação (Super Admin)
→ Login → Setup Tenant (nome + CNPJ) → Dashboard
```

### 5.2 Fluxo de Convite (Equipe)
```
Admin → Painel Admin → Aba Convites → Cria convite (email + role)
→ Copia link → Envia para colaborador
→ Colaborador acessa /invite?token=xxx → Cria senha
→ Edge Function: cria conta + vincula tenant + atribui role
→ Auto-login → Dashboard (com acesso limitado por role)
```

### 5.3 Fluxo de Expiração de Trial
```
Aprovação Beta → beta_approved_at = now()
→ 30 dias depois → isTrialExpired = true
→ usePermissions bloqueia insert/update/delete
→ Banner: "Período de teste expirou"
→ Usuário vê tudo em modo somente leitura
```

---

## 6. Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| UI | Tailwind CSS + shadcn/ui + Recharts |
| Estado | TanStack React Query |
| Roteamento | React Router v6 |
| Backend | Supabase (Lovable Cloud) |
| Banco | PostgreSQL com RLS |
| Auth | Supabase Auth (email + Google OAuth) |
| Functions | Supabase Edge Functions (Deno) |
| Storage | Supabase Storage (fotos de ações corretivas) |
| PDF | jsPDF + jspdf-autotable |
| PWA | vite-plugin-pwa |

---

*Documento gerado em Março de 2026 — Método O.P.E.R.A. v1.0 Beta*
