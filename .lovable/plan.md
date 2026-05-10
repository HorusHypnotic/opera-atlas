## Diagnóstico de Segurança — Atlas O.P.E.R.A.

### Estado geral
Backend operacional. RLS ativo em 34 tabelas. 147 políticas. Porém existem **falhas estruturais de isolamento** que tornam o multi-tenancy permeável.

---

### Falhas CRÍTICAS (bloqueantes para piloto com dados reais)

#### 1. `session_transfers` — Zero políticas RLS
- **Impacto:** Qualquer usuário autenticado pode ler todos os refresh tokens de todos os usuários do sistema. Account takeover em massa.
- **Causa:** A tabela foi criada mas nenhuma política foi adicionada.
- **Fix:** Adicionar SELECT/INSERT/UPDATE/DELETE com scoping por `user_id = auth.uid()`.

#### 2. `generate-reset-link` Edge Function — Cross-tenant privilege escalation
- **Impacto:** Admin de qualquer tenant pode gerar link de recuperação de senha para QUALQUER email do sistema, incluindo super admins. Account takeover total.
- **Causa:** A função verifica `isAdmin` mas não cruza `tenant_id` do chamador com `tenant_id` do alvo.
- **Fix:** Restringir a `is_super_admin` OU verificar `tenant_id` do alvo antes de gerar link.

#### 3. `has_role` / `has_any_role` — Sem scoping de tenant
- **Impacto:** Usuário com role "admin" no tenant A satisfaz checagens de admin no tenant B. Escalada de privilégio cross-tenant em TODAS as políticas RLS que usam essas funções.
- **Causa:** As funções verificam apenas `user_id + role`, ignorando `tenant_id`.
- **Fix:** Atualizar funções para exigir `tenant_id = get_user_tenant_id(_user_id)`. Isso afeta ~40 políticas RLS.

#### 4. `obra-fotos` Storage — DELETE/UPDATE sem owner check
- **Impacto:** Qualquer usuário autenticado pode deletar ou sobrescrever fotos de QUALQUER obra de QUALQUER tenant.
- **Causa:** Políticas de DELETE/UPDATE em `storage.objects` verificam apenas `bucket_id = 'obra-fotos'`.
- **Fix:** Restaurar scoping por `storage.foldername(name))[1] = auth.uid()::text` ou por tenant.

#### 5. `invites` — Convidado não pode verificar próprio convite
- **Impacto:** Fluxo de aceite de convite pode quebrar ou exigir workarounds que exponham tokens.
- **Causa:** Apenas admins do tenant têm acesso à tabela. Sem política para o convidado ler seu próprio invite por email/token.
- **Fix:** Adicionar SELECT para `email = auth.jwt() ->> 'email'` com token não expirado.

---

### Falhas ALTO (risco operacional/financeiro)

#### 6. `beta_waitlist` — INSERT público sem validação
- **Impacto:** Spam, data poisoning, enumeration. Qualquer bot pode encher a tabela.
- **Fix:** Restringir INSERT a um Edge Function com rate limiting, ou adicionar validação mínima.

#### 7. `mobile_debug_logs` — INSERT público
- **Impacto:** Storage exhaustion, log injection, potencial exfiltração de dados via logs.
- **Fix:** Restringir INSERT a authenticated, ou mover para Edge Function.

#### 8. `beta_waitlist` / `beta_config` SELECT — Sem tenant scoping
- **Impacto:** Admin de tenant A vê waitlist de tenant B (dados de concorrentes).
- **Fix:** Adicionar `tenant_id` ou escopar por tenant do admin.

#### 9. `user_has_obra_access` — Permite acesso baseado em role global
- **Impacto:** Gestor de tenant A pode ter acesso visual a obra de tenant B se houver vazamento de IDs.
- **Causa:** A função verifica roles mas não verifica se o usuário pertence ao tenant da obra.
- **Fix:** Adicionar verificação de `tenant_id` da obra contra `get_user_tenant_id(_user_id)`.

#### 10. Funções SECURITY DEFINER — Permissões EXECUTE amplas
- **Impacto:** ~26 funções SECURITY DEFINER (incluindo `has_role`, `is_super_admin`, `folha_pagamento`) podem ser chamadas por usuários autenticados ou anônimos sem controle de acesso adequado.
- **Fix:** Revogar EXECUTE de public/anon em funções sensíveis; manter apenas para authenticated com necessidade real.

---

### Falhas MÉDIO (higiene)

#### 11. Public bucket `obra-fotos` permite listagem
- Qualquer um pode listar todos os arquivos do bucket. Fotos de obra não devem ser listáveis publicamente.

#### 12. Leaked Password Protection desabilitado
- Sem proteção contra senhas vazadas em breaches conhecidos.

#### 13. Políticas `USING (true)` / `WITH CHECK (true)` em INSERT/UPDATE/DELETE
- Detectado pelo linter: políticas excessivamente permissivas em operações de escrita.

---

## Plano de Correção (5 blocos)

### Bloco 1 — RLS em `session_transfers`
- Adicionar: SELECT (user_id = auth.uid()), INSERT (user_id = auth.uid()), UPDATE (user_id = auth.uid()), DELETE (user_id = auth.uid() OR is_super_admin)

### Bloco 2 — Edge Function `generate-reset-link`
- Adicionar verificação cross-tenant: consultar `profiles` do alvo e validar `tenant_id == caller.tenant_id`
- OU restringir a `is_super_admin`

### Bloco 3 — Tenant scoping em funções de role
- Alterar `has_role`, `has_any_role`, `user_has_obra_access` para filtrar por `tenant_id`
- Backward compatibility: criar versões v2 das funções e migrar políticas gradualmente

### Bloco 4 — Storage `obra-fotos`
- Restaurar owner-scoped DELETE/UPDATE em `storage.objects`
- Remover listagem pública do bucket

### Bloco 5 — Higiene (beta_waitlist, mobile_debug_logs, invites, auth config)
- Restringir INSERTs públicos
- Adicionar SELECT para convidado em `invites`
- Habilitar leaked password protection
- Limpar políticas USING(true) para INSERT/UPDATE/DELETE

---

## Ordem de execução

1. Bloco 1 (session_transfers) — Impacto imediato, alteração isolada
2. Bloco 2 (generate-reset-link) — Correção de código, sem risco ao DB
3. Bloco 3 (funções de role) — Alteração profunda, afeta todas as políticas; testar em ambiente seguro
4. Bloco 4 (storage) — Correção rápida
5. Bloco 5 (higiene) — Finalização

Cada bloco testável isoladamente. Bloco 3 requer validação cruzada exaustiva pois toca no coração do isolamento multi-tenant.