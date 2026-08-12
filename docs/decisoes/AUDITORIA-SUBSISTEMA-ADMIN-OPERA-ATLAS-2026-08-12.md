# Auditoria do subsistema Admin do OPERA Atlas

**Data da auditoria:** 2026-08-12

**Escopo:** análise estática do repositório no commit `274cc234ebef6f1ff401321287e9512cd3361715`

**Natureza:** investigação documental; nenhuma alteração funcional, de banco, RLS, usuário ou organização

**Estado remoto:** não consultado. As conclusões descrevem o código versionado, não comprovam o estado implantado no Lovable Cloud/Supabase.

## 1. Resumo executivo

O Admin atual é uma **console administrativa do tenant**, acrescida de um painel global incompleto para `is_super_admin`. Ele administra usuários, papéis, convites, obras, membros por obra, períodos, exportações, logs e perfil da organização. O superadmin também enxerga organizações, limites de obras e superfícies do Programa Beta. Isso ainda não constitui um control plane comercial completo do ecossistema OPERA.

Existe uma unidade operacional próxima de `organização -> N obras`: `tenants` é a organização canônica, `profiles.tenant_id` liga cada usuário a uma única organização, `obras.tenant_id` liga obras à organização e `tenants.limite_obras` é aplicado por trigger na criação de obra. Porém, não existe entidade de cliente/contrato/assinatura/entitlement, nem vínculo do catálogo de produtos com tenants ou permissões. Além disso, o próprio admin do tenant aparentemente pode alterar ou excluir seu tenant diretamente pela API por causa de uma policy `FOR ALL`, tornando o limite comercial não confiável.

O cadastro não é hoje “autorizado pelo owner OPERA”: a tela de login oferece signup público e OAuth; um autenticado sem tenant pode chamar `setup_tenant`, criar uma organização e receber papel `admin`. O Beta funciona como formulário de interesse, fila, provisionamento automático opcional e gate/trial principalmente client-side. Esses controles não formam uma cadeia de autorização robusta.

Os achados estáticos mais graves são:

1. **CRÍTICO:** autoaprovação Beta aceita qualquer código de influenciador não vazio, mesmo inexistente, quando há senha e vaga.
2. **CRÍTICO:** signup público + `setup_tenant` permitem autoprovisionamento de organização e papel admin sem aprovação comercial.
3. **CRÍTICO:** policies globais de Beta e Portfólio usam o papel tenant-scoped `admin`; um admin de qualquer tenant pode, pela API, ler ou administrar dados globais que a UI reserva ao superadmin.
4. **ALTO:** admin do tenant pode aparentemente alterar `limite_obras` e excluir o próprio tenant pela API; a exclusão aciona cascatas relevantes.
5. **ALTO:** bloqueio, aprovação Beta e expiração do trial são predominantemente controles do cliente e podem não ser garantidos por RLS/backend.

Não houve exploração ofensiva nem confirmação remota. Antes de qualquer desenho definitivo, os achados devem ser validados contra migrations efetivamente aplicadas, policies atuais, configuração Auth e versões implantadas das Edge Functions.

## 2. Inventário

### 2.1 Rotas e frontend

- `src/App.tsx`: `/admin` fica sob `ProtectedRoute` e `AppLayout`; `/login`, `/invite`, `/beta` e `/beta-status` são públicas; `/setup` exige `ProtectedRoute`.
- `src/components/auth/ProtectedRoute.tsx`: autenticação, redirecionamento por Beta e tenant; convidado/demo atravessa o guard; trial expirado gera aviso, não bloqueio server-side.
- `src/pages/AdminPage.tsx`: gate client-side por `isAdmin || isSuperAdmin`; agrega todas as abas administrativas.
- `src/components/admin/UsersTab.tsx`: usuários, papéis e bloqueio.
- `src/components/admin/UserPermissionsEditor.tsx`: papéis e vínculos com obras.
- `src/components/admin/InvitesTab.tsx`: emissão e revogação de convites.
- `src/components/admin/ObraMembrosTab.tsx`: associação usuário-obra.
- `src/components/admin/TenantProfileTab.tsx`: dados e consumo de obras do tenant.
- `src/components/admin/SuperAdminTab.tsx`: listagem global de tenants e edição de `limite_obras`.
- `src/components/admin/BetaUsersTab.tsx`, `BetaConfigTab.tsx`, `BetaMetricsTab.tsx` e `InfluencerCodesTab.tsx`: administração Beta, exibida apenas a superadmin.
- `src/components/admin/PeriodosFechadosTab.tsx`, `ExportarDadosTab.tsx`, `AuditLogTab.tsx` e `AdminKPIs.tsx`.
- `src/pages/LoginPage.tsx`, `SetupPage.tsx`, `InvitePage.tsx`, `BetaSignupPage.tsx` e `BetaStatusPage.tsx`: entrada e provisionamento.
- `src/hooks/useAuth.tsx`: perfil, papéis, `is_super_admin`, convidado/demo, status Beta, bloqueio e trial.
- `src/hooks/usePermissions.ts`: capacidades de UI por papel e modo somente leitura do trial.
- `src/lib/auditLog.ts`: escrita client-side em `audit_logs`.

### 2.2 Backend e banco

- Entidades centrais: `tenants`, `profiles`, `user_roles`, `obras`, `obra_membros`, `invites`.
- Beta: `beta_waitlist`, `influencer_codes`, `beta_config` e RPCs públicas de status/capacidade.
- Portfólio: `portfolio_companies`, `portfolio_leads`, `portfolio_products`, `portfolio_product_versions`, `portfolio_offers`, `portfolio_diagnoses`, `portfolio_interests`, `portfolio_events`, `portfolio_interest_history`, `portfolio_daily_metrics`.
- Auditoria: `audit_logs`, `audit_logs_db` e `system_events`.
- Funções relevantes: `setup_tenant`, `has_role`, `has_any_role`, `user_has_obra_access`, `get_user_tenant_id`, `check_obra_limit`, `get_invite_by_token`, `get_beta_status_by_email`, `get_beta_vagas_ocupadas` e funções de eventos/auditoria.
- Edge Functions: `accept-invite`, `beta-signup`, `generate-reset-link`, `portfolio-interest` e exportação/rotinas operacionais correlatas.
- Testes estáticos relevantes: `supabase/tests/database/tenant_isolation.test.sql` e `permission_contract.test.sql`.

### 2.3 Configurações e feature flags

O repositório tem flags de experiência de frontend, mas não foi encontrada uma camada de entitlement por tenant. `beta_config` contém capacidade global, ativação de Beta/lista de espera e duração de teste; parte desses valores não governa efetivamente os fluxos. Não há tabela de planos, assinaturas, licenças, módulos contratados ou capabilities por cliente.

## 3. Arquitetura e mapa de acesso

O navegador carrega Auth/Perfil/Papéis, o `ProtectedRoute` decide os redirecionamentos e `AdminPage` decide se renderiza a console. Queries do navegador seguem para o Supabase e dependem de RLS; operações com identidade ou bypass controlado usam Edge Functions com service role. Isso cria duas camadas diferentes: visibilidade/gating client-side e autoridade real de banco/função.

| Ator | Acessa a UI Admin? | Mecanismo | Evidência e limite |
|---|---:|---|---|
| Visitante não autenticado | Não | `ProtectedRoute` redireciona | `/admin` está na árvore protegida de `App.tsx`. |
| Convidado/demo | **Sim, por URL direta** | Bypass no `ProtectedRoute`; contexto sintético inclui papel admin | O menu oculta Admin para guest, mas `AdminPage` aceita `isAdmin`; as consultas anônimas ainda dependem de RLS e não deveriam revelar/mutar dados reais. É bypass de shell, não prova de bypass no banco. |
| `visualizador` | Não | Gate de `AdminPage` | Sem `admin` e sem superadmin, retorna à aplicação. |
| `operacional` | Não | Gate de `AdminPage` | Idem. |
| `gestor` | Não | Gate de `AdminPage` | Embora tenha capacidades operacionais amplas, não abre a console. |
| `admin` | Sim | Papel em `user_roles` + gate client-side + policies | Administra o próprio tenant na UI; algumas policies concedem alcance global indevido. |
| `owner` | Não aplicável | Papel inexistente | Não há enum, campo ou fluxo de owner organizacional. |
| `is_super_admin = true` | Sim | Flag global em `profiles`, verificada no cliente e em policies/funções | Vê abas globais. Se não tiver `tenant_id`, as abas tenant-scoped ficam sem contexto. |

Ocultar uma aba não é autorização. As garantias reais são RLS, validação em RPC/Edge Function e invariantes SQL. Onde a UI exige superadmin mas a policy aceita `admin`, a API prevalece e a fronteira global falha.

## 4. Papéis e autoridade real

O enum `app_role` contém exatamente:

`admin`, `gestor`, `operacional`, `visualizador`.

`is_super_admin` é uma flag separada no perfil, não um papel do enum. `guest` é estado sintético do cliente. Não existem `owner`, `member` ou `convidado` como papéis persistidos.

O modelo real não é uma hierarquia estrita, pois um usuário pode acumular papéis:

`is_super_admin` global

`admin` do tenant

`gestor` do tenant

`operacional` do tenant

`visualizador` do tenant

- Armazenamento: `user_roles(user_id, role, tenant_id)` com unicidade por usuário, papel e tenant.
- Escopo: helpers mais recentes aceitam papel legado com `tenant_id IS NULL` ou papel do tenant corrente do perfil.
- Múltiplos papéis: permitidos; permissões efetivas são a união calculada pelo cliente/policies.
- Atribuição: admins gerenciam papéis pela UI. Convites permitem `gestor`, `operacional` e `visualizador`, não `admin`.
- Revogação: exclusão de `user_roles`; o editor também revoga associações de obra.
- Superadmin: só deve ser alterável por fronteira privilegiada; a policy de perfil impede que o usuário marque a si mesmo como superadmin.
- Escopo por obra: `obra_membros` dá vínculo explícito. Contudo, `user_has_obra_access` concede automaticamente todas as obras do tenant a `admin`, `gestor` e `operacional`; `visualizador` depende de membership ativo. Portanto, membership não restringe os três primeiros papéis.
- Capacidades de UI: admin tem CRUD amplo; gestor insere/atualiza; operacional insere; visualizador consulta. RLS/funções, não o hook, são a autoridade final.

Há auditoria client-side em um dos caminhos de atribuição/revogação, mas não há trigger de banco geral para `user_roles`; mudanças fora da UI podem ficar sem trilha.

## 5. Organizações e tenancy

### Modelo comprovado

- `tenants` é a entidade canônica de organização.
- Cada `profile` tem no máximo um `tenant_id`; não há tabela de memberships multi-organização nem seletor de organização.
- Um tenant possui N `obras` por `obras.tenant_id`.
- `obra_membros` relaciona usuário e obra, inclui tenant e pode expirar.
- `setup_tenant` é `SECURITY DEFINER`: autenticado sem tenant cria o tenant, liga seu perfil e recebe papel admin.
- O isolamento principal usa `get_user_tenant_id`, `has_role`/`has_any_role` e `user_has_obra_access` em RLS/RPCs.
- Não existe owner canônico. Um ou mais admins são controladores de fato.
- Não existe troca de organização; aceitar convite pode reatribuir `profiles.tenant_id`.
- Não foi encontrado estado de tenant desativado. A policy `Admins can manage own tenant` usa `FOR ALL`; em leitura estática, isso inclui UPDATE e DELETE do próprio tenant.
- FKs com `ON DELETE CASCADE` tornam uma exclusão materialmente destrutiva para obras, papéis e dados dependentes.

### Unidade comercial

Existe tecnicamente `ORGANIZAÇÃO -> N OBRAS`, inclusive com `limite_obras`. Não existe a camada anterior `CLIENTE/CONTRATO/ENTITLEMENT -> ORGANIZAÇÃO`, nem prova de que o limite seja controlado exclusivamente pelo OPERA. A unidade é operacional, não uma unidade comercial completa.

## 6. Cadastro, autenticação e convites

### Entrada pública

A tela de login oferece cadastro email/senha e OAuth. Não foi encontrada allowlist, restrição por domínio ou aprovação server-side obrigatória antes de `setup_tenant`. O fluxo comprovado é:

visitante -> signup público -> `auth.users`/`profiles` -> `/setup` -> `setup_tenant` -> tenant + papel admin -> aplicação.

Assim, qualquer pessoa capaz de concluir o signup configurado no Auth pode tentar autoprovisionar uma organização. A configuração remota pode desabilitar provedores/signup, mas isso exige confirmação.

### Convite

- `invites` contém email, papel, tenant, token, expiração, consumo e obra opcional.
- O link é bearer-token, expira e é single-use.
- O convite define tenant e papel; pode ainda criar membership de obra.
- `get_invite_by_token` expõe somente convite válido/não usado.
- `accept-invite` valida token, expiração e igualdade do email; usa service role para criar/atualizar identidade e vínculos.
- Um usuário existente pode ter `profile.tenant_id` sobrescrito pelo tenant convidante, sem uma operação transacional explícita de saída da organização anterior.
- O `upsert` de papel informa conflito `user_id,role`, enquanto a unicidade observada inclui `tenant_id`; isso pode produzir falha ou comportamento diferente do pretendido.
- A sequência não é atômica: criação de usuário, atualização de perfil, papel, membership e consumo do convite podem ficar parcialmente aplicados.
- Convite limita papel e opcionalmente obra, mas não plano, módulo, prazo contratual, número de obras ou produto.

### Bloqueio e trial

`profiles.account_status` é interpretado pelo cliente, que encerra sessão de bloqueado. Como a atualização do próprio perfil não aparenta restringir essa coluna, um usuário com sessão ainda válida pode tentar restaurar `active` pela API. O trial é calculado no cliente e aciona modo somente leitura no hook, não uma política de banco abrangente.

## 7. Limites e quotas

O único limite contratual semelhante encontrado é `tenants.limite_obras integer NOT NULL DEFAULT 3`.

- `check_obra_limit` roda antes de INSERT em `obras`, conta as obras do tenant e rejeita quando o limite foi alcançado.
- `SuperAdminTab` permite edição individual/em massa do limite.
- `TenantProfileTab` mostra uso/limite ao admin do tenant.
- A contagem aparenta incluir obras soft-deleted, pois não filtra `deleted_at`.
- A policy de tenants concede `FOR ALL` ao admin do próprio tenant. Sem restrição de coluna, ele pode alterar diretamente `limite_obras`, quebrando o valor como entitlement controlado pelo fornecedor.

Não foram encontrados limites de usuários, storage, registros, integrações, módulos, funcionalidades ou produto; tampouco plano, tier, assinatura ou licença por organização. `beta_config.limite_vagas` é capacidade global do programa, não quota de um tenant.

Portanto, **há um ponto técnico para representar “Organização X tem limite de 5 obras”**, mas ele ainda não é uma garantia comercial segura nem está ligado a contrato/entitlement.

## 8. Programa Beta

### Componentes

- `beta_waitlist`: identidade comercial e status da inscrição.
- `influencer_codes`: códigos e uso.
- `beta_config`: vagas, ativação, lista de espera e dias de teste.
- Rotas públicas `/beta` e `/beta-status`.
- Edge Function `beta-signup`, protegida por Turnstile e rate limit em memória por instância.
- UI global para usuários, códigos, configuração e métricas.
- Trigger de sincronização da aprovação para `profiles.beta_status` e `beta_approved_at`.
- RPCs públicas de vagas ocupadas e consulta por email.

### Função real

Beta é uma combinação de:

- **A — formulário comercial:** sim;
- **B — provisionamento real:** parcial, quando há autoaprovação com senha;
- **C — trial funcional:** parcial e principalmente client-side;
- **D — cadastro de interesse/fila:** sim.

Na autoaprovação, a função insere waitlist, pode criar usuário confirmado via service role e o usuário segue para `/setup`; não há vínculo prévio com tenant/produto/contrato. Aprovação manual atualiza status, mas não cria necessariamente usuário nem envia convite. A geração de reset depende de identidade já existente.

### Inconsistências comprovadas no código

- `hasInfluencer` é derivado apenas da presença de texto. `autoApprove` não exige que a busca do código tenha encontrado registro válido; qualquer código não vazio pode disparar aprovação com senha e vaga.
- `lista_espera_ativa` não governa claramente a decisão em `beta-signup`.
- `tempo_teste_dias` é configurável, mas o cliente usa 30 dias fixos.
- `beta_status` e expiração de trial não são incorporados de modo geral às policies de dados.
- `get_beta_status_by_email` permite consulta anônima por email e devolve status/nome/data, criando superfície de enumeração e privacidade.
- As policies globais aceitam `has_any_role(... admin ...)`; como `admin` é tenant-scoped, qualquer tenant admin pode alcançar dados Beta globais pela API, apesar de a UI esconder as abas.
- Alterações de status/config/códigos não têm cobertura uniforme em `audit_logs`.

## 9. Portfólio de produtos

O domínio comercial versiona empresas, leads, produtos, versões, ofertas, diagnósticos, interesses, eventos, histórico e métricas. A migration semeia ofertas de diagnóstico, Copiloto por obra, OPERA Atlas e OPERA Control, incluindo faixas/preços comerciais.

Não há `tenant_id`, `user_id` operacional, role, entitlement ou capability ligando `portfolio_products`/`portfolio_offers` a tenants. Não foi encontrado consumo dessas tabelas no frontend Atlas nem tipos gerados correspondentes. A Edge Function pública `portfolio-interest` alimenta o funil usando service role, valida origem/Turnstile e registra leads, interesses e eventos.

Conclusão: o catálogo é **metadata comercial operacional e funil versionado**, não mecanismo de provisionamento. Ele sabe descrever produtos/ofertas e registrar interesse, mas não habilita um produto para uma organização.

Há ainda risco crítico: policies de leitura/escrita/manutenção do domínio global aceitam tenant admin. Como as tabelas não têm tenant, um admin pode alcançar leads, empresas, interesses e catálogo globais pela API. A ausência de UI Admin para portfólio não reduz essa autorização.

## 10. Admin como control plane

| Capacidade | Estado | Fundamentação |
|---|---|---|
| Criar organizações | PARCIAL | Há self-service `setup_tenant`; não há criação/aprovação governada pelo owner na console global. |
| Habilitar clientes | PARCIAL | Beta/status e bloqueio existem, mas não formam ativação comercial server-side confiável. |
| Controlar usuários | PARCIAL | Lista, convite, bloqueio e papéis; ciclo de identidade/remoção/mudança de tenant é incompleto. |
| Atribuir papéis | IMPLEMENTADA | `user_roles`, UI e policies; sem papel owner e com lacunas de auditoria. |
| Controlar acesso | PARCIAL | RLS e memberships existem, mas gates Beta/trial/bloqueio são frágeis e memberships não restringem vários papéis. |
| Definir limites | PARCIAL | Só obras; o admin do tenant pode aparentemente alterar o próprio limite. |
| Acompanhar Beta | IMPLEMENTADA | Fila, status, métricas, códigos e configuração existem, embora com falhas críticas. |
| Governar produtos | AUSENTE | Schema comercial existe, mas não há UI Admin nem vínculo de entitlement/provisionamento. |
| Visualizar eventos | PARCIAL | `audit_logs` na UI; `audit_logs_db` e `system_events` ficam fragmentados. |
| Administrar obras | IMPLEMENTADA | CRUD, limite, members e períodos; observar regras amplas por papel. |
| Auditar ações | PARCIAL | Três trilhas heterogêneas, cobertura incompleta e parte best-effort/client-side. |
| Configurar sistema | PARCIAL | Configuração Beta e limite de obras; nenhuma camada geral de settings/entitlements. |
| Impersonar usuário | AUSENTE | Nenhum mecanismo encontrado. |
| Multi-organização | AUSENTE | Perfil tem um único tenant, sem membership/switcher. |

O Admin é, portanto, **uma console de operação por tenant com apêndices globais**, não o control plane comercial do ecossistema.

## 11. Segurança

### CRÍTICO

1. **Bypass lógico de código Beta.** Código não vazio é tratado como suficiente para autoaprovação, mesmo quando inexistente. Impacto: criação privilegiada de conta/entrada Beta fora do canal esperado. Evidência: `supabase/functions/beta-signup/index.ts`.
2. **Autoprovisionamento público de admin/tenant.** Signup público + perfil sem tenant + `setup_tenant SECURITY DEFINER` permite criar organização e tornar-se admin sem autorização comercial. Evidências: `LoginPage`, `SetupPage` e migration de `setup_tenant`.
3. **Fronteira global Beta quebrada.** Policies usam papel `admin`, que é do tenant, para tabelas globais. Impacto: leitura/alteração de inscritos, códigos e configuração por admins de clientes.
4. **Fronteira global Portfólio quebrada.** Policies globais permitem a tenant admins ler dados comerciais de todos e administrar partes do catálogo/funil.

### ALTO

1. **Quota autogerenciável pelo cliente.** Policy `FOR ALL` em `tenants` permite ao admin atualizar `limite_obras` via API.
2. **Exclusão destrutiva do próprio tenant.** A mesma policy aparenta permitir DELETE, com FKs em cascata. Não há confirmação de um bloqueio posterior.
3. **Bloqueio reversível pelo próprio perfil.** Policy de update do perfil não aparenta restringir `account_status`; o gate de bloqueio é client-side.
4. **Beta/trial sem enforcement de dados.** Redirecionamento e read-only são majoritariamente client-side; chamadas diretas podem continuar sob RLS comum.
5. **Aceite de convite não atômico e reatribui tenant.** Falha intermediária pode deixar identidade, perfil, papel, membership e consumo divergentes; usuário existente pode ser movido de organização.

### MÉDIO

1. `get_beta_status_by_email` permite enumeração por email de nome/status/data.
2. Conflito do upsert de papel em `accept-invite` não corresponde à chave única observada.
3. `check_obra_limit` inclui aparentemente obras soft-deleted.
4. Convidado/demo renderiza `/admin` por URL direta. RLS limita impacto conhecido, mas o gate e a intenção divergem.
5. Rate limit Beta em memória é local à instância e não é controle distribuído durável.
6. `audit_logs` é escrito pelo cliente e erros são ignorados; não é trilha autoritativa.

### BAIXO / INFORMATIVO

- Superadmin sem tenant vê superfícies globais, mas abas comuns não carregam contexto; é limitação de UX/modelo.
- Papéis legados com `tenant_id IS NULL` continuam aceitos pelos helpers; é necessário medir sua existência remota.
- UI e RLS expressam modelos de autorização diferentes, aumentando risco de regressão.

## 12. Auditoria e rastreabilidade

Há três trilhas:

1. `audit_logs`: chamadas best-effort do cliente, metadata fornecida pelo cliente.
2. `audit_logs_db`: triggers de banco para alterações em obras e algumas entidades operacionais.
3. `system_events`: eventos de Edge Functions/RPCs para fluxos como convite, reset, exportação e períodos.

| Ação | Auditada? | Onde | Conteúdo/limite |
|---|---:|---|---|
| Criar organização | Não comprovado | — | `setup_tenant` não mostra trilha específica. |
| Alterar perfil do tenant | Não | — | Sem chamada/trigger observado. |
| Alterar limite de obras | Não | — | Edição individual/em massa sem log uniforme. |
| Criar/excluir obra | Sim | `audit_logs_db`; delete também no cliente | Before/after de banco para obra; duplicidade possível no delete. |
| Criar/excluir convite | Parcial | `audit_logs` | Ação e metadata client-side; falha de log é ignorada. |
| Aceitar/negar convite | Sim | `system_events` | Sucesso, negação e falha na Edge Function; não torna a transação atômica. |
| Adicionar/remover papel | Parcial | `audit_logs` em caminhos específicos | Editor/Users registra; mudança direta ou outro caminho não é garantido. |
| Bloquear/desbloquear usuário | Parcial | `audit_logs` | Client-side. |
| Adicionar/remover membro de obra | Inconsistente | `audit_logs` no editor | A aba dedicada executa caminhos sem a mesma cobertura. |
| Revogar todos os acessos | Parcial | `audit_logs` | Client-side. |
| Aprovar/rejeitar Beta | Não uniforme | — | Trigger sincroniza estado, mas não há trilha administrativa dedicada. |
| Alterar `beta_config` | Não | — | Sem log observado. |
| Criar/alterar código influenciador | Não | — | Sem log observado. |
| Signup Beta | Parcial | `system_events`/dados do funil | Eventos existem; origem da decisão e integridade do código precisam confirmação. |
| Gerar link de reset | Sim | `system_events` | Edge Function registra tentativa/resultado. |
| Exportar dados | Sim | `system_events` | Solicitação/execução registrada. |
| Reabrir/refechar período | Sim/parcial | eventos/RPCs | Trilha server-side observada no fluxo específico. |
| Acesso privilegiado à tela/API | Não | — | Não há log de leitura ou sessão administrativa. |
| Impersonation | Não aplicável | — | Recurso não encontrado. |
| Alterar dados do portfólio | Parcial | histórico/eventos do funil | Histórico cobre interesse; não há auditoria administrativa geral do catálogo. |

`AuditLogTab` consulta apenas `audit_logs`; logo a UI não apresenta uma visão unificada das três fontes.

## 13. Fluxos reais

### Fluxo A — criação de organização

**Entrada:** autenticado com perfil sem tenant -> **validação:** `ProtectedRoute` envia a `/setup`; RPC verifica condição -> **banco:** insere `tenants`, atualiza `profiles.tenant_id`, insere `user_roles(admin)` -> **autorização:** `SECURITY DEFINER` + identidade autenticada -> **resultado:** organização e admin autoprovisionados -> **auditoria:** não comprovada.

### Fluxo B — entrada de usuário

**Entrada:** signup público/OAuth ou convite -> **validação:** Auth; no convite, token/expiração/email -> **banco:** `auth.users`, profile por trigger, possível tenant/papel -> **autorização:** cliente + Edge Function service role no convite -> **resultado:** usuário entra, segue a Beta status/setup/app -> **auditoria:** Auth remoto desconhecido; convite gera `system_events`; signup comum sem trilha administrativa observada.

### Fluxo C — atribuição de papel

**Entrada:** admin seleciona papel ou convite é aceito -> **validação:** UI/policy ou Edge Function -> **banco:** INSERT/DELETE/UPSERT em `user_roles` -> **autorização:** admin do tenant/RLS; service role no convite -> **resultado:** capabilities agregadas -> **auditoria:** client-side em caminhos de Admin; evento no convite; sem trigger universal.

### Fluxo D — criação de obra

**Entrada:** usuário autorizado cria obra -> **validação:** RLS e `check_obra_limit` -> **banco:** `obras` com tenant -> **autorização:** papel/RLS tenant-scoped -> **resultado:** obra disponível; acesso amplo para admin/gestor/operacional -> **auditoria:** trigger em `audit_logs_db`.

### Fluxo E — Programa Beta

**Entrada:** formulário público + Turnstile -> **validação:** configuração, capacidade, email e código (com falha descrita) -> **banco:** waitlist/código e possível Auth/profile -> **autorização:** Edge Function service role -> **resultado:** fila, espera ou autoaprovação; usuário aprovado segue para setup -> **auditoria:** dados/eventos parciais; decisões administrativas não uniformemente auditadas.

### Fluxo F — superadmin/global

**Entrada:** perfil com `is_super_admin` -> **validação:** gate do cliente e policies -> **banco:** tenants/Beta e domínios globais -> **autorização:** flag global -> **resultado:** métricas, limites e Beta; sem governança de entitlement/produto -> **auditoria:** edição de limites/Beta incompleta.

### Fluxo G — convidado/demo

**Entrada:** modo guest -> **validação:** `ProtectedRoute` ignora checks e contexto fornece papéis sintéticos -> **banco:** consultas usam cliente anônimo/tenant falso -> **autorização:** RLS deve negar dados reais -> **resultado:** `/admin` pode renderizar diretamente, embora o menu esconda a entrada -> **auditoria:** nenhuma; tráfego anônimo remoto depende de logs da plataforma.

## 14. Confronto com a hipótese comercial

Modelo candidato:

`OWNER OPERA -> CLIENTE aprovado -> ORGANIZAÇÃO -> CONTRATO/ENTITLEMENT -> limite de obras -> convite -> usuários/papéis -> capacidades contratadas`

| Peça | Reuso possível | Lacuna/perigo |
|---|---|---|
| Owner OPERA | `is_super_admin` é ponto de partida | Não há papel owner, segregação fina nem auditoria global completa. |
| Cliente aprovado | Waitlist/status Beta podem informar workflow | Signup/setup contornam aprovação; Beta mistura marketing e provisionamento. |
| Organização | `tenants` é reutilizável como entidade operacional | Ausência de ownership, lifecycle/desativação e multi-membership. |
| Contrato/entitlement | Catálogo/ofertas dão vocabulário comercial | Não existe vínculo entre oferta e tenant; não usar Beta como substituto implícito. |
| Limite de obras | `limite_obras` + trigger são base concreta | Cliente pode aparentemente editar o limite; contagem soft-delete e auditoria deficientes. |
| Convite autorizado | Token, expiração, papel e tenant já existem | Aceite não atômico, reatribuição de tenant e sem escopo de produto/capability. |
| Usuários/papéis | `profiles`, `user_roles`, memberships e RLS são reutilizáveis | Sem owner, multi-tenant e auditoria universal; semântica de obra é mais ampla que a UI sugere. |
| Capacidades contratadas | Nenhuma camada encontrada | Hooks de papel/flags não equivalem a entitlement server-side. |

O núcleo operacional `tenant -> obras -> usuários/papéis` existe. Faltam a autoridade comercial anterior, entitlement posterior, lifecycle seguro e enforcement/auditoria coerentes. As peças mais perigosas para reaproveitar sem revisão são policies globais baseadas em `admin`, gates client-side, `setup_tenant` aberto, o fluxo Beta e a policy `FOR ALL` de tenants.

## 15. Lacunas funcionais

- Cliente/conta comercial distinta de lead e tenant.
- Owner organizacional e transferência de ownership.
- Contrato, assinatura, plano, entitlement, módulos e capabilities.
- Provisionamento explícito de produto para tenant.
- Lifecycle de tenant: pending, active, suspended, closed; exclusão protegida.
- Aprovação obrigatória antes de criar tenant/admin.
- Multi-organização e mudança de contexto segura, caso seja requisito.
- Quotas além de obras e métricas confiáveis de consumo/storage.
- Fronteira global exclusiva para superadmin.
- Auditoria autoritativa e unificada das ações administrativas.
- Transações atômicas para convite/provisionamento.
- UI Admin para portfólio, se o domínio vier a ser governado aqui.
- Testes de contrato para Beta, portfólio, quota e operações destrutivas de tenant.

## 16. Relação com próximas investigações

Ordem recomendada de investigação, sem antecipar solução:

1. **Fronteiras de autoridade e estado remoto:** confirmar policies/migrations/functions implantadas e fechar o significado de admin versus superadmin.
2. **Cadastro autorizado e Beta:** ambos convergem em criação de identidade, profile, tenant e admin; devem ser estudados juntos antes de “Solicitar demonstração”.
3. **Entitlement e quantidade de obras:** validar ownership de `limite_obras`, contagem e modelo contratual antes de ampliar quotas.
4. **Demo/guest:** confirmar que nenhum acesso anônimo real atravessa RLS e separar experiência demonstrativa de autoridade sintética.
5. **Stakeholders:** definir se são usuários, contatos do portfólio, memberships de obra ou nova entidade; hoje esses conceitos não são equivalentes.
6. **Storage:** inventariar buckets, ownership, consumo e políticas antes de prometer capacidade por plano.
7. **Integrações:** mapear segredos, conexões e scopes por tenant antes de incluí-las em capabilities contratadas.

## 17. Perguntas para o agente Lovable

Estas perguntas exigem confirmação no Lovable Cloud/Supabase. Devem ser respondidas sem alterar dados:

1. Qual é o SHA/migration set efetivamente implantado? Liste migrations aplicadas e versões/hashes das Edge Functions `beta-signup`, `accept-invite`, `portfolio-interest` e `generate-reset-link`.
2. Auth permite signup público por email e OAuth? Quais provedores, confirmação de email, redirect URLs e restrições estão ativos?
3. Liste as policies e grants atuais de `tenants`, `profiles`, `user_roles`, `obras`, `obra_membros`, `invites`, tabelas Beta e todas as `portfolio_*`. Confirme se diferem das migrations versionadas.
4. Um admin de tenant consegue, em transação read-only/ambiente seguro, satisfazer policies SELECT/UPDATE das tabelas globais Beta e Portfólio? Não execute mutações para testar.
5. Quantos tenants, profiles, usuários Auth e papéis existem? Quantos profiles estão sem tenant, quantos tenants sem admin, quantos com múltiplos admins e quantos roles têm `tenant_id IS NULL`?
6. Quais valores atuais de `limite_obras`, contagem de obras ativas/soft-deleted e excedentes por tenant? Há logs de admins de tenant alterando o próprio limite?
7. Existe algum bloqueio remoto adicional que impeça admin do tenant de UPDATE em `limite_obras` ou DELETE do tenant?
8. Quais valores atuais de `beta_config`? `beta_ativo`, `lista_espera_ativa` e `tempo_teste_dias` são consumidos por alguma automação não versionada?
9. Há inscrições autoaprovadas com `influencer_code` inexistente/inativo/esgotado? Correlacione somente por consulta read-only, sem expor PII no relatório.
10. Quantos usuários aprovados Beta não têm Auth user, profile, tenant ou role? Quantos usuários Auth têm Beta não aprovado/expirado mas atividade recente?
11. Há estados parciais de convite: `used=true` sem papel/membership, usuário movido de tenant, roles duplicados ou falhas ligadas ao `onConflict`?
12. Quais colunas de `profiles` o próprio usuário pode atualizar hoje? Existem column grants/triggers adicionais para proteger `account_status`, `beta_status`, `beta_approved_at`, `tenant_id` e `is_super_admin`?
13. Quais trilhas remotas existem além de `audit_logs`, `audit_logs_db` e `system_events`? Há retenção, imutabilidade, actor/IP e correlação de request?
14. Há funções, secrets, automações, webhooks ou tabelas não versionados que implementem contrato, assinatura, entitlement, capacidade, storage ou provisionamento de produtos?
15. Há consumo de `portfolio_*` por outra aplicação/deploy? Quais origens reais chamam `portfolio-interest` e quem operacionaliza os leads?
16. Quais buckets/storage policies existem e é possível medir consumo por tenant/obra?
17. Há logs de acesso anônimo à rota/queries Admin em modo demo e alguma policy concede dados ao papel `anon` nessas superfícies?

## 18. Conclusão

O repositório já contém um bom esqueleto operacional: tenant, obras, usuários, papéis, convites, limite de obras, Beta, eventos e catálogo comercial. Mas as fronteiras não estão alinhadas a um control plane contratual. O sistema confunde em pontos críticos autoridade de tenant com autoridade global, trata aprovação/trial/bloqueio principalmente no cliente e permite autoprovisionamento fora de um fluxo comercial governado.

Nenhuma decisão arquitetural definitiva deve ser tomada apenas com esta leitura. A próxima etapa correta é confirmar o estado remoto e os quatro riscos críticos, ainda de forma investigativa, antes de especificar cadastro autorizado, entitlement ou evolução do Admin.
