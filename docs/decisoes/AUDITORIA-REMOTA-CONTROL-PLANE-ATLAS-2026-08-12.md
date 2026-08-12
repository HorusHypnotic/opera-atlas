# AUDITORIA REMOTA — CONTROL PLANE (PERMISSÕES E PROVISIONAMENTO ADMINISTRATIVO)

**Sistema:** OPERA Atlas
**Data:** 2026-08-12 (UTC)
**Modo:** SOMENTE LEITURA
**Escopo:** ambiente Lovable Cloud efetivamente implantado (catálogo de funções, policies RLS, triggers, grants, chaves estrangeiras, defaults) + código do repositório para as decisões que ocorrem fora do banco.

**Declaração de não intervenção:** nenhuma alteração de código, banco, migration, RLS, usuários, tenants, papéis, Beta, produtos ou publicação foi executada. Nenhum usuário foi criado, nenhum signup executado, nenhuma aprovação Beta realizada. Nenhum segredo, token ou dado pessoal consta deste documento.

---

## 1. SIGNUP E AUTOPROVISIONAMENTO

| Pergunta | Resposta | Evidência |
|---|---|---|
| Signup público habilitado? | **SIM** | `src/pages/LoginPage.tsx` chama `supabase.auth.signUp({ email, password })` diretamente, sem convite nem código |
| Novo usuário autenticado pode chamar `setup_tenant`? | **SIM** | `EXECUTE` presente para `authenticated` (e também `anon`) no catálogo de privilégios da função |
| `setup_tenant` cria tenant? | **SIM** | `INSERT INTO public.tenants` no corpo da função |
| `setup_tenant` concede papel admin? | **SIM** | `INSERT INTO public.user_roles (user_id, role, tenant_id) VALUES (_user_id,'admin',_tenant_id)` |
| Existe aprovação server-side anterior? | **NÃO** | a função valida apenas `auth.uid() IS NOT NULL` e ausência de tenant prévio |
| Existe allowlist? | **NÃO** | nenhuma tabela/checagem de allowlist referenciada em `handle_new_user` ou `setup_tenant` |
| Convite obrigatório? | **NÃO** | `invites` existe, mas nenhum caminho o exige para criar tenant |
| Verificação Beta? | **PARCIAL / CLIENT-SIDE** | `ProtectedRoute` redireciona para `/beta-status` apenas quando `profiles.beta_status` é não-nulo; `beta_status` só é preenchido por `handle_new_user` se o e-mail já constar em `beta_waitlist`. Quem se cadastra direto pelo login fica com `beta_status = NULL` e **não é barrado** |
| Verificação comercial? | **NÃO** | nenhuma referência a plano, assinatura ou contrato no caminho de provisionamento |

**Classificação: ABERTO.**
Um e-mail qualquer pode criar conta, chegar a `/setup`, chamar `setup_tenant` e sair como administrador de um tenant novo, sem passar por convite, allowlist, Beta ou verificação comercial.

---

## 2. FUNÇÃO `setup_tenant`

| Item | Estado remoto |
|---|---|
| Assinatura | `public.setup_tenant(_nome text, _cnpj text DEFAULT NULL) RETURNS uuid` |
| SECURITY DEFINER | **SIM** (owner `postgres`) |
| `search_path` | `search_path=public` (fixado — correto) |
| EXECUTE | `postgres`, `anon`, `authenticated`, `service_role` |
| Validações | (a) `auth.uid() IS NOT NULL`; (b) `profiles.tenant_id IS NULL` para o chamador. Nada além disso. `_nome` não é validado (tamanho, unicidade, formato); `_cnpj` não é validado nem verificado quanto a duplicidade |
| Tenant criado | SIM — `tenants(nome, cnpj)` |
| Role atribuída | SIM — `admin` no `user_roles`, escopado ao tenant recém-criado |
| Obra inicial criada | **NÃO** |
| Limites definidos | **NÃO** explicitamente — herda o default da coluna (`limite_obras = 3`) |
| Auditoria/eventos | **NENHUM** — não grava em `audit_logs`, não chama `log_system_event`, e `tenants`/`user_roles` não possuem trigger `fn_audit_log_changes` |

**Observação:** o grant a `anon` é inócuo na prática (a função aborta sem `auth.uid()`), mas é superfície desnecessária e contraria o padrão já aplicado às helpers de permissão, das quais `anon` foi revogado.

---

## 3. `tenants.limite_obras`

| Item | Estado remoto |
|---|---|
| Valor padrão | **3** (`column_default = 3`) |
| Valores em uso | 15 (1 tenant), 10 (1 tenant), 3 (4 tenants) — 6 tenants no total |
| Onde o limite é aplicado | trigger `enforce_obra_limit` → `check_obra_limit()` (BEFORE INSERT em `obras`, SECURITY DEFINER): lê `tenants.limite_obras` e compara com a contagem de obras do tenant |
| Policy UPDATE efetiva | `tenants: "Admins can manage own tenant"` — `FOR ALL TO authenticated USING (id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(),'admin'))`, **sem cláusula `WITH CHECK`** |
| Grant | `authenticated` possui privilégio `UPDATE` na tabela |
| Quem pode alterar | admin do próprio tenant (via policy acima) e super admin (`"Super admin can manage all tenants"`) |
| Cliente comum (gestor/operacional/visualizador) | **NÃO** — nenhuma policy os cobre para UPDATE |
| Validação server-side contra autoaumento | **NENHUMA** — não há trigger, CHECK, coluna protegida ou RPC intermediária |
| Auditoria da alteração | **NENHUMA** — `tenants` não tem trigger de auditoria |

### Pergunta crítica
> Um admin tenant consegue transformar `limite_obras = 2` em `limite_obras = 100` sem autorização global?

**SIM.** Evidência: a policy `ALL` cobre o comando UPDATE, o `USING` só verifica que a linha é o próprio tenant e que o chamador é admin, não existe `WITH CHECK` restringindo colunas, o grant de UPDATE está concedido a `authenticated` e nenhum trigger valida a coluna. O único enforcement do produto (`check_obra_limit`) lê exatamente o valor que o próprio admin pode reescrever — ou seja, a quota é autoconfigurável pelo cliente via API REST, mesmo sem UI para isso.

*(Nenhum valor foi alterado nesta auditoria.)*

---

## 4. BETA GLOBAL

Tabelas efetivas: `beta_waitlist`, `beta_config`, `influencer_codes`. Não há coluna `tenant_id` em nenhuma delas — são objetos **globais** por natureza.

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `beta_waitlist` | `has_any_role(uid,{admin})` **OU** `is_super_admin(uid)` | **negado** por RLS (fluxo exclusivo pela edge function `beta-signup`, service role) | `has_any_role(uid,{admin})` | `has_any_role(uid,{admin})` |
| `beta_config` | qualquer `authenticated` | `has_any_role(uid,{admin})` | `has_any_role(uid,{admin})` | **negado** |
| `influencer_codes` | `has_any_role(uid,{admin})` **OU** `is_super_admin(uid)` | `has_any_role(uid,{admin})` | `has_any_role(uid,{admin})` | `has_any_role(uid,{admin})` |

- **Aprovar / rejeitar / bloquear:** todas as três operações são um `UPDATE` de `beta_waitlist.status`, cobertas pela mesma policy de admin. Aprovar dispara o trigger `on_beta_waitlist_status_change` → `sync_beta_approval()`, que grava `beta_status='aprovado'` e `beta_approved_at` no `profiles` correspondente. Ou seja, **o UPDATE concede acesso real ao produto**, não é apenas metadado.
- `has_any_role(uid,'admin')` é tenant-aware apenas no sentido de exigir que o papel pertença ao tenant do usuário — o que **não** restringe as linhas alcançadas em tabelas sem `tenant_id`.

### Pergunta crítica
> Um admin de Tenant A consegue ler ou alterar inscrições Beta que não pertencem ao seu tenant?

**SIM.** Qualquer usuário com papel `admin` em qualquer tenant — inclusive um tenant que ele mesmo criou via `setup_tenant` (seção 1) — lê a lista completa de inscritos (nome, e-mail, telefone, empresa), aprova, rejeita, altera limite de vagas e apaga registros de qualquer origem. A governança do programa Beta não distingue "admin de cliente" de "operador da plataforma"; o único papel verdadeiramente global (`is_super_admin`) aparece apenas como alternativa nas policies de SELECT, nunca como exigência exclusiva.

**Severidade: ALTA** (escalonamento de privilégio do plano do cliente para o plano de controle da plataforma, encadeável a partir de signup público).

---

## 5. PORTFÓLIO GLOBAL

**Estado remoto: as tabelas não existem.**
A listagem completa do schema `public` (40 tabelas) não contém nenhuma tabela `portfolio_*`. A migration `supabase/migrations/20260803223000_create_portfolio_commercial_domain.sql` e o rollback correspondente existem no repositório, e a edge function `portfolio-interest` (`verify_jwt = false`) está declarada em `config.toml`, mas o domínio comercial **não está aplicado no banco remoto**.

| Capacidade | Estado |
|---|---|
| Admin tenant lê catálogo global | N/A — objeto inexistente |
| Edita catálogo / cria produto / altera maturidade / altera oferta / exclui | N/A — objeto inexistente |

**Leitura pública intencional vs. administração global indevida:** não há hoje nenhuma das duas. O risco é **latente**: se a migration for aplicada reutilizando o padrão `has_any_role(uid,'admin')` observado nas tabelas globais de Beta (seção 4), o domínio de portfólio nascerá com a mesma falha — admin de cliente administrando catálogo comercial global. A decisão de aplicar essa migration deve, portanto, ser tratada como decisão de control plane, não como feature.

---

## 6. CÓDIGO INFLUENCIADOR BETA

Lógica efetivamente implantada em `supabase/functions/beta-signup/index.ts` (executa com service role, ignorando RLS):

```
hasInfluencer = !!cleanCode                      // apenas "string não vazia"
hasSlot       = (inscritos ativos) < limite_vagas
hasPassword   = typeof password === "string" && password.length >= 6
autoApprove   = hasInfluencer && hasSlot && hasPassword
```

| Item | Estado |
|---|---|
| Onde o código é validado | **Em lugar nenhum, para fins de decisão.** A consulta a `influencer_codes` ocorre *depois* do cálculo de `autoApprove` e serve somente para incrementar `total_cadastros` quando o código existe e está ativo |
| Quem decide a aprovação | a edge function, server-side (positivo: a decisão não é do frontend) |
| Código **válido** | `status = 'aprovado'`, usuário criado via `auth.admin.createUser` com `email_confirm: true`, contador incrementado |
| Código **inválido** (string qualquer) | **idêntico ao válido**: `status = 'aprovado'` e usuário confirmado criado; apenas o contador não é incrementado |
| Código **ausente** | `aguardando_aprovacao` (se há vaga) ou `lista_de_espera` — comportamento correto |
| Alguma decisão depende só do frontend? | A **decisão de aprovação** não; mas o CAPTCHA aceita o secret de teste (`1x0000...AA`) como fallback quando `TURNSTILE_SECRET_KEY` não está definido, o que enfraquece a barreira anti-automação desse mesmo caminho |
| Função `validar_codigo_influencer` | existe no banco, é adequada para o propósito, **não é chamada** por este fluxo |

**Conclusão:** a autoaprovação com código inválido é confirmada por leitura do código implantado. Combinada com a seção 1, produz um caminho completo: cadastro → conta confirmada → `setup_tenant` → admin → alcance global de Beta (seção 4). *Nenhuma inscrição foi executada para verificar isto.*

---

## 7. TRIAL

Implementação única: `computeTrialExpired()` em `src/hooks/useAuth.tsx` — `beta_approved_at + 30 dias`, com bypass para `is_super_admin`. Consumido por `usePermissions` (`canInsert/canUpdate/canDelete = false`) e por um banner em `ProtectedRoute`.

| Regra | Classificação | Observação |
|---|---|---|
| Início do trial | **CLIENT-SIDE** | derivado de `profiles.beta_approved_at`, gravado por trigger, mas nunca lido pelo banco para fins de trial |
| Duração (30 dias) | **CLIENT-SIDE** | constante no bundle JavaScript. `beta_config.tempo_teste_dias` existe no banco e **não é usado** por este cálculo |
| Expiração | **CLIENT-SIDE** | comparação com o relógio do navegador |
| Bloqueio de escrita | **CLIENT-SIDE** | nenhuma policy, trigger ou RPC consulta trial; RLS continua concedendo INSERT/UPDATE/DELETE normalmente |
| Renovação | **NÃO CONFIRMADA** | nenhum fluxo de renovação identificado; alterar `beta_approved_at` (admin do tenant pode atualizar profiles do próprio tenant) reinicia o relógio |
| Bypass | **CLIENT-SIDE** | qualquer chamada direta à API REST/RPC ignora o trial por completo; `account_status='blocked'` também é aplicado só no cliente (logout dentro do `useAuth`) |
| Relação com tenant | **INEXISTENTE** | trial é por perfil, não por tenant; não há campo de vigência em `tenants` |
| Relação com Beta | **MISTA** | depende de `beta_approved_at`, que vem do fluxo Beta, mas nada no servidor conecta os dois |
| Relação com limites | **INEXISTENTE** | `limite_obras` não considera trial |

**Veredito: o trial não é imposto pelo backend.** É uma convenção de interface.

---

## 8. EXCLUSÃO DE TENANT

| Camada | Estado |
|---|---|
| UI | **Não existe** botão de excluir/desativar tenant (`TenantProfileTab` não expõe destruição) |
| Policy | `tenants: "Admins can manage own tenant" FOR ALL` — **cobre DELETE** para o admin do próprio tenant; `authenticated` possui grant |
| Function | nenhuma RPC de exclusão/desativação; não há soft delete (`tenants` não possui `deleted_at`) |
| Cascade | **destrutivo**: `ON DELETE CASCADE` em `obras`, `registro_presencas`, `lancamentos_financeiros`, `colaboradores`, `colaborador_obras`, `obra_membros`, `user_roles`, `invites`, `registros_diarios`, `consumo_materiais`, `ativos`, `riscos`, `retrabalhos`, `incidentes_seguranca`, `sequenciamento_equipes`, `compras_emergenciais`. `profiles` e `system_events` usam `SET NULL`. Um subconjunto (`apontamento_diarias`, `audit_logs`, `lotes_consumo`, `checklist_semanal`, `aditivos_contratuais`, `ciclos_tarefa`, `logistica_interna`, `acoes_corretivas`) usa `NO ACTION`, o que faria o DELETE **falhar** quando houver esses registros |
| Hard delete | possível via API REST enquanto não existirem linhas nas tabelas `NO ACTION` |
| Autorização exigida | apenas papel `admin` no próprio tenant — **nenhuma confirmação, keyword, motivo ou aprovação global** |

**Severidade: ALTA.** Existe caminho destrutivo real, sem UI mas plenamente acessível pela API, que apaga fisicamente presenças, lançamentos financeiros e colaboradores. Contraria a estratégia de soft delete adotada nas tabelas de domínio e as invariantes de irreversibilidade temporal e reprodutibilidade do `OPERA_CORE`. Na prática, o dano é hoje *parcialmente* contido por acidente: tenants com apontamentos ou audit logs travam o DELETE por restrição de FK — proteção incidental, não projetada.

*(Nenhuma exclusão foi executada.)*

---

## 9. MODELO DE PAPÉIS EFETIVO

Enum remoto `app_role`: `admin`, `gestor`, `operacional`, `visualizador`. Não existe valor `superadmin` no enum — o papel global é a coluna booleana `profiles.is_super_admin`.

| Papel | Escopo | Como é autorizado no servidor |
|---|---|---|
| `is_super_admin` (flag em `profiles`) | **GLOBAL** | `is_super_admin(uid)`; policies `ALL` em `tenants`, `obras`, `user_roles`, `profiles` |
| `admin` | **TENANT** *(vaza para GLOBAL nas tabelas Beta — seção 4)* | `has_role(uid,'admin')`, `has_any_role(uid,{admin})`, combinados com `tenant_id = get_user_tenant_id(uid)` **quando a tabela possui `tenant_id`** |
| `gestor` | **TENANT** | `has_role(uid,'gestor')` + `tenant_id` |
| `operacional` | **TENANT / OBRA** | `has_any_role(...)` e `user_has_obra_access(uid, obra_id)` |
| `visualizador` | **TENANT (leitura)** | ausência dos papéis de escrita; leitura via policies de SELECT |
| Vínculo por obra | **OBRA** | `obra_membros` (com `expires_at`), lido por `user_has_obra_access` |

Funções server-side de autorização: `get_user_tenant_id`, `has_role`, `has_any_role`, `user_has_obra_access`, `is_super_admin` — todas SECURITY DEFINER com `search_path` fixado.

**Lacuna estrutural:** não existe papel intermediário "operador da plataforma". Toda ação de control plane recai sobre `admin` (papel do cliente) ou `is_super_admin` (flag), e as tabelas globais escolheram o primeiro.

---

## 10. AUDITORIA ADMINISTRATIVA

| AÇÃO | AUDITADA? | ONDE | CONFIANÇA |
|---|---|---|---|
| Criação de tenant | **NÃO** | — (`setup_tenant` não registra; `tenants` sem trigger) | Alta (verificado no catálogo de triggers e no corpo da função) |
| Atribuição de admin | **NÃO** | — (`user_roles` sem trigger de auditoria) | Alta |
| Mudança de role | **NÃO** no banco; parcialmente no app | `logAudit()` client-side em telas administrativas — depende do cliente e é falsificável/omissível | Média |
| Alteração de `limite_obras` | **NÃO** | — (`tenants` sem trigger) | Alta |
| Aprovação/rejeição Beta | **NÃO** | trigger existente em `beta_waitlist` apenas sincroniza `profiles`, não registra em `audit_logs_db` | Alta |
| Alteração de `portfolio_products` | **N/A** | tabelas inexistentes | Alta |
| Exclusão/desativação de tenant | **NÃO** | o DELETE em cascata destruiria também as linhas de contexto; `audit_logs.tenant_id` é `NO ACTION`, logo o histórico bloqueia ou sobrevive sem registro do ato | Alta |
| (Contraste) alterações em `obras` | **SIM** | `trg_audit_obras` → `audit_logs_db` | Alta |

Conclusão: a trilha de auditoria cobre bem o **plano de dados operacional** e praticamente **não cobre o plano de controle**.

---

## 11. MATRIZ FINAL

| CAPACIDADE | ESTADO REMOTO | QUEM PODE EXECUTAR | PROTEÇÃO SERVER-SIDE | RISCO | EVIDÊNCIA |
|---|---|---|---|---|---|
| Criar conta sem convite | Ativo | Qualquer pessoa | Nenhuma | **Alto** | `LoginPage.signUp`; ausência de allowlist em `handle_new_user` |
| Criar tenant e virar admin | Ativo | Qualquer autenticado sem tenant | Só "não ter tenant" | **Alto** | `setup_tenant` (EXECUTE p/ `authenticated`) |
| Aumentar a própria quota de obras | Ativo | Admin do tenant | Nenhuma (policy `ALL` sem `WITH CHECK`) | **Alto** | `pg_policies` em `tenants`; `check_obra_limit` lê a coluna editável |
| Ler waitlist Beta completa | Ativo | Qualquer admin de qualquer tenant | Papel admin sem escopo | **Alto** (PII) | policy `Admins can view beta_waitlist` |
| Aprovar/rejeitar/apagar Beta | Ativo | Qualquer admin de qualquer tenant | Papel admin sem escopo | **Alto** | policies UPDATE/DELETE + `sync_beta_approval` |
| Alterar `beta_config` (vagas, beta ativo) | Ativo | Qualquer admin de qualquer tenant | Papel admin sem escopo | **Alto** | policies INSERT/UPDATE |
| Criar/alterar códigos influenciador | Ativo | Qualquer admin de qualquer tenant | Papel admin sem escopo | **Alto** | policies em `influencer_codes` |
| Autoaprovação com código inválido | Ativo | Qualquer pessoa | Nenhuma (código não validado) | **Alto** | `beta-signup/index.ts`, `autoApprove` |
| Administração de portfólio global | Inexistente | — | — | **Latente** | ausência de tabelas `portfolio_*` no schema |
| Escrever após trial expirado | Ativo | Qualquer usuário com papel de escrita | Nenhuma | **Médio-Alto** | `computeTrialExpired` client-side; RLS sem cláusula de trial |
| Operar com `account_status = 'blocked'` via API | Ativo | Usuário bloqueado | Nenhuma | **Médio** | bloqueio apenas em `useAuth` |
| Excluir o próprio tenant (cascata) | Ativo (parcialmente travado por FK) | Admin do tenant | Nenhuma além do papel | **Alto** | policy `ALL` em `tenants` + `confdeltype='c'` em 16 FKs |
| Rastrear ações de control plane | Ausente | — | — | **Alto** | catálogo de triggers |
| Isolamento de dados operacionais por tenant | **Sólido** | — | RLS + helpers tenant-aware | Baixo | policies de `obras`, `registro_presencas`, financeiro |
| Integridade financeira (hash/fechamento) | **Sólido** | — | RPCs SECURITY DEFINER + `periodos_fechados` | Baixo | auditorias anteriores |

---

## 12. CONCLUSÃO

### CONFIRMADO
- Signup público sem convite, allowlist ou verificação comercial.
- `setup_tenant` executável por qualquer autenticado sem tenant, concedendo `admin` e sem emitir evento de auditoria.
- `limite_obras` (default 3) editável pelo próprio admin do tenant, sem `WITH CHECK` e sem trigger de validação.
- Tabelas globais de Beta e códigos influenciador acessíveis a qualquer `admin` de qualquer tenant, incluindo aprovação e exclusão.
- `beta-signup` autoaprova com qualquer string no campo de código influenciador.
- Trial 100% client-side; `account_status='blocked'` idem.
- DELETE de tenant permitido pela policy, com 16 FKs em cascata sobre dados operacionais e financeiros.
- Auditoria administrativa ausente no banco para tenant, papéis, quota e Beta.
- Domínio de portfólio inexistente no ambiente remoto.

### NÃO CONFIRMADO
- Configuração de provedor de autenticação no painel gerenciado (confirmação de e-mail obrigatória, provedores sociais ativos) — não inspecionável por leitura de schema; o comportamento de código pressupõe signup habilitado.
- Presença efetiva de `TURNSTILE_SECRET_KEY` no ambiente (não verificada para não tocar em secrets); o código possui fallback para o secret público de teste.
- Existência de fluxo de renovação de trial.
- Se algum tenant atual pode, de fato, ser deletado sem travar em FK `NO ACTION` (não testado — exigiria escrita).

### RISCO
Cadeia de escalonamento encadeável e integralmente confirmada por leitura:
`signup público` → `conta confirmada (autoaprovação por código inválido)` → `setup_tenant` → `admin de tenant` → `leitura e administração da waitlist Beta global + códigos + configuração do programa` + `autoaumento de quota` + `DELETE do próprio tenant em cascata`, **tudo sem trilha de auditoria no banco**.

O plano de **dados** (isolamento por tenant, integridade financeira, hash, fechamento de período) permanece sólido. O que está exposto é o plano de **controle**.

### DECISÃO NECESSÁRIA
1. Definir se `admin` é papel de cliente ou de plataforma; hoje é ambos. Requer um papel/critério global explícito (`is_super_admin`) nas tabelas globais.
2. Definir a política de provisionamento: signup público, convite obrigatório ou allowlist comercial.
3. Definir onde vive a quota (`limite_obras`): coluna editável pelo cliente ou atributo de plano fora do alcance do tenant.
4. Definir se trial é regra de produto (backend) ou apenas aviso (frontend).
5. Definir a política de encerramento de tenant (desativação com retenção vs. exclusão), sabendo que hoje o caminho é hard delete em cascata.
6. Decidir se a migration de portfólio comercial deve ser aplicada — e sob qual modelo de autorização.

### RESPOSTAS EXPLÍCITAS

| # | Pergunta | Resposta |
|---|---|---|
| 1 | Signup público permite autoprovisionamento? | **SIM** |
| 2 | Admin tenant pode aumentar a própria quota? | **SIM** |
| 3 | Admin tenant alcança o Beta global? | **SIM** (leitura, aprovação, rejeição, exclusão e configuração) |
| 4 | Admin tenant alcança a administração do portfólio? | **NÃO — o domínio não existe no ambiente remoto.** Risco latente se a migration for aplicada com o padrão atual |
| 5 | A aprovação Beta possui lógica insegura? | **SIM** — código influenciador não é validado; qualquer string autoaprova |
| 6 | O trial é realmente imposto pelo backend? | **NÃO** — é exclusivamente client-side |
| 7 | O tenant pode ser destruído pelo próprio admin? | **SIM**, via API (policy `ALL` + cascatas), com travamento incidental por FKs `NO ACTION` em parte dos casos |
| 8 | Quais lacunas impedem hoje um modelo comercial controlado? | Autoprovisionamento aberto (1); quota autoconfigurável (2); ausência de separação entre admin de cliente e operador de plataforma (3); autoaprovação Beta (5); trial não imposto (6); exclusão destrutiva de tenant (7); e ausência de trilha de auditoria administrativa (10). Sem tratar 1, 2, 5 e 6 não há como cobrar por limite, plano ou período de teste; sem tratar 3 e 10 não há governança demonstrável do programa comercial |

---

**Fim do relatório.** Somente documentação — nenhuma correção, migration ou alteração de configuração foi executada.
