# Auditoria remota do control plane (somente leitura) — entrega do relatório

A investigação remota já foi executada nesta sessão (apenas leituras: catálogo de funções, policies, triggers, grants, FKs, defaults e leitura de código). Nada foi alterado: sem migration, sem RLS, sem usuários, sem tenants, sem publicação.

O que falta é apenas materializar o relatório em disco.

## Entregável

Criar `docs/decisoes/AUDITORIA-REMOTA-CONTROL-PLANE-ATLAS-2026-08-12.md` com as 12 seções pedidas (signup/autoprovisionamento, setup_tenant, limite_obras, Beta global, portfólio, código influenciador, trial, exclusão de tenant, papéis, auditoria administrativa, matriz final, conclusão), sem segredos e sem dados pessoais.

## Achados confirmados (entram no relatório)

1. **Signup / autoprovisionamento — ABERTO.** `LoginPage` chama `supabase.auth.signUp` diretamente; `handle_new_user` cria profile sem exigir allowlist/convite; `setup_tenant` tem EXECUTE para `authenticated` (e também `anon` no grant, embora exija `auth.uid()`). Não há checagem de Beta, convite ou aprovação comercial dentro de `setup_tenant` — a barreira Beta existe só no `ProtectedRoute` (client-side) e depende de `profiles.beta_status` ser não-nulo, o que só ocorre se o email estiver na waitlist.
2. **setup_tenant** — `(_nome text, _cnpj text)`, SECURITY DEFINER, `search_path=public`. Valida apenas autenticado e "ainda sem tenant". Cria tenant, define profile.tenant_id e concede `admin`. Não cria obra, não define limites (usa default), **não emite audit_log nem system_event**.
3. **limite_obras = 3 por padrão**; aplicado por `check_obra_limit` (BEFORE INSERT em `obras`). Policy `tenants: "Admins can manage own tenant" ALL` tem `USING` mas **sem `WITH CHECK`** → **SIM**, um admin de tenant pode alterar o próprio `limite_obras` de 2 para 100. Não há trigger nem validação server-side impedindo autoaumento; `tenants` também não tem trigger de auditoria.
4. **Beta global — vazamento de escopo.** `beta_waitlist` (SELECT/UPDATE/DELETE) e `influencer_codes` e `beta_config` (INSERT/UPDATE) usam apenas `has_any_role(auth.uid(),'admin')`, sem qualquer filtro de tenant e sem exigir `is_super_admin`. Resposta à pergunta crítica: **SIM**, um admin do Tenant A lê, aprova, rejeita e apaga inscrições Beta de qualquer tenant, e aprovar dispara `sync_beta_approval` (concede acesso).
5. **Portfólio — NÃO EXISTE no ambiente remoto.** Nenhuma tabela `portfolio_*` está presente; a migration `20260803223000_create_portfolio_commercial_domain.sql` existe no repositório mas não está aplicada. Risco atual: nulo; risco futuro: se aplicada com o mesmo padrão `has_any_role('admin')`, herda o problema do item 4.
6. **Código influenciador.** Decisão fica na edge function `beta-signup` (service role): `autoApprove = código presente + vaga + senha ≥ 6`. O código **não é validado** contra `influencer_codes` antes de decidir — a consulta à tabela serve só para incrementar contador. Ou seja, **qualquer string** funciona como código e produz autoaprovação + criação de usuário confirmado. `validar_codigo_influencer` existe mas não é usada nesse caminho.
7. **Trial — CLIENT-SIDE.** `computeTrialExpired()` compara `beta_approved_at + 30 dias` no navegador e só liga um banner e flags de UI (`usePermissions`). Nenhuma policy, trigger ou RPC bloqueia escrita por trial expirado. Início/duração/expiração/bypass: todos client-side; `account_status='blocked'` também é aplicado apenas no cliente (logout no `useAuth`).
8. **Exclusão de tenant — caminho destrutivo real (severidade alta).** A policy `ALL` em `tenants` cobre DELETE para o admin do próprio tenant. As FKs em cascata (`obras`, `registro_presencas`, `lancamentos_financeiros`, `colaboradores`, `user_roles`, `invites`…) apagariam dados financeiros fisicamente. Não há UI para isso hoje, mas a API REST permite. Contradiz as invariantes de soft-delete e irreversibilidade temporal.
9. **Papéis:** `app_role` = admin, gestor, operacional, visualizador; `is_super_admin` é flag booleana em `profiles` (escopo GLOBAL). Autorização server-side via `has_role`, `has_any_role`, `get_user_tenant_id`, `user_has_obra_access`, `is_super_admin`.
10. **Auditoria administrativa:** `obras` tem trigger de auditoria; `tenants`, `user_roles`, `profiles` e `beta_waitlist` **não** têm `fn_audit_log_changes`. Criação de tenant, atribuição de admin, mudança de role, alteração de quota e aprovação Beta não deixam trilha no banco.

## Resposta direta às 8 perguntas finais

1. Sim. 2. Sim. 3. Sim. 4. Não existe portfólio remoto (risco latente na migration não aplicada). 5. Sim — código influenciador não é validado. 6. Não, o trial é puramente client-side. 7. Sim, via API. 8. Itens 1, 3, 4, 6, 7, 8 e 10 impedem hoje um modelo comercial controlado.

## Condição de parada

Após gravar o documento: parar. Nenhuma correção, migration, alteração de signup, quota, Beta ou produtos.
