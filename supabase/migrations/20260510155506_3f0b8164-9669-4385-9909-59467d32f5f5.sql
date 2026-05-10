
-- =====================================================
-- SECURITY HARDENING MIGRATION
-- Atlas O.P.E.R.A. — Pre-piloto
-- =====================================================

-- ============================================
-- BLOCO 1: session_transfers — Add RLS policies
-- ============================================
DROP POLICY IF EXISTS "session_transfers_own_select" ON public.session_transfers;
DROP POLICY IF EXISTS "session_transfers_own_insert" ON public.session_transfers;
DROP POLICY IF EXISTS "session_transfers_own_update" ON public.session_transfers;
DROP POLICY IF EXISTS "session_transfers_own_delete" ON public.session_transfers;
DROP POLICY IF EXISTS "session_transfers_super_admin" ON public.session_transfers;

CREATE POLICY "session_transfers_own_select"
ON public.session_transfers
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "session_transfers_own_insert"
ON public.session_transfers
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "session_transfers_own_update"
ON public.session_transfers
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "session_transfers_own_delete"
ON public.session_transfers
FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

-- ============================================
-- BLOCO 3: Tenant scoping in role functions
-- ============================================
-- Atualizar has_role para exigir tenant atual do usuário
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = _role
      AND (
        ur.tenant_id IS NULL
        OR ur.tenant_id = public.get_user_tenant_id(_user_id)
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles app_role[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = ANY(_roles)
      AND (
        ur.tenant_id IS NULL
        OR ur.tenant_id = public.get_user_tenant_id(_user_id)
      )
  )
$$;

-- user_has_obra_access agora valida que o tenant da obra bate com o tenant do usuário
CREATE OR REPLACE FUNCTION public.user_has_obra_access(_user_id uuid, _obra_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.is_super_admin(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.obras o
      WHERE o.id = _obra_id
        AND o.tenant_id = public.get_user_tenant_id(_user_id)
        AND (
          public.has_any_role(_user_id, ARRAY['admin','gestor','operacional']::app_role[])
          OR EXISTS (
            SELECT 1 FROM public.obra_membros om
            WHERE om.user_id = _user_id
              AND om.obra_id = _obra_id
              AND (om.expires_at IS NULL OR om.expires_at > now())
          )
        )
    )
$$;

-- ============================================
-- BLOCO 4: Storage obra-fotos — owner scoped
-- ============================================
-- Drop overly permissive policies
DROP POLICY IF EXISTS "Authenticated delete obra-fotos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update obra-fotos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload obra-fotos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;

-- Recreate with owner check
CREATE POLICY "obra_fotos_owner_or_admin_delete"
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'obra-fotos'
  AND (
    owner = auth.uid()
    OR (storage.foldername(name))[1] = (auth.uid())::text
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_super_admin(auth.uid())
  )
);

CREATE POLICY "obra_fotos_owner_or_admin_update"
ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'obra-fotos'
  AND (
    owner = auth.uid()
    OR (storage.foldername(name))[1] = (auth.uid())::text
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_super_admin(auth.uid())
  )
);

CREATE POLICY "obra_fotos_authenticated_upload"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'obra-fotos');

-- ============================================
-- BLOCO 5: Hygiene
-- ============================================

-- 5a. invites — invitee pode ler próprio convite por email
DROP POLICY IF EXISTS "invitee_can_read_own_invite" ON public.invites;
CREATE POLICY "invitee_can_read_own_invite"
ON public.invites
FOR SELECT TO authenticated
USING (
  email = (auth.jwt() ->> 'email')
  AND used = false
  AND expires_at > now()
);

-- 5b. mobile_debug_logs — remover INSERT público
DROP POLICY IF EXISTS "Anyone can insert debug logs" ON public.mobile_debug_logs;
CREATE POLICY "authenticated_insert_debug_logs"
ON public.mobile_debug_logs
FOR INSERT TO authenticated
WITH CHECK (true);

-- 5c. beta_waitlist — remover INSERT público (fluxo passa por edge function service role)
DROP POLICY IF EXISTS "Anyone can signup for beta" ON public.beta_waitlist;

-- 5d. beta_config — restringir leitura a authenticated
DROP POLICY IF EXISTS "Anyone can read beta config" ON public.beta_config;
CREATE POLICY "Authenticated can read beta config"
ON public.beta_config
FOR SELECT TO authenticated
USING (true);
