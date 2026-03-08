
-- =============================================
-- FIX: Recreate ALL RLS policies as PERMISSIVE
-- Root cause: all policies were RESTRICTIVE (no permissive = no access)
-- =============================================

-- ============ OPERATIONAL TABLES (14 tables) ============
-- Pattern: tenant_select, operational_insert, gestor_update, admin_delete, super_admin_all

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'acoes_corretivas','aditivos_contratuais','ativos','checklist_semanal',
    'ciclos_tarefa','compras_emergenciais','consumo_materiais','incidentes_seguranca',
    'lancamentos_financeiros','logistica_interna','registros_diarios','retrabalhos',
    'riscos','sequenciamento_equipes'
  ])
  LOOP
    -- Drop existing restrictive policies
    EXECUTE format('DROP POLICY IF EXISTS "tenant_select" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "operational_insert" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "gestor_update" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "admin_delete" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "super_admin_all" ON public.%I', tbl);

    -- Recreate as PERMISSIVE
    EXECUTE format('CREATE POLICY "tenant_select" ON public.%I FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()))', tbl);
    EXECUTE format('CREATE POLICY "operational_insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY[''admin''::app_role, ''gestor''::app_role, ''operacional''::app_role]))', tbl);
    EXECUTE format('CREATE POLICY "gestor_update" ON public.%I FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY[''admin''::app_role, ''gestor''::app_role]))', tbl);
    EXECUTE format('CREATE POLICY "admin_delete" ON public.%I FOR DELETE TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), ''admin''::app_role))', tbl);
    EXECUTE format('CREATE POLICY "super_admin_all" ON public.%I FOR ALL TO authenticated USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()))', tbl);
  END LOOP;
END
$$;

-- ============ OBRAS ============
DROP POLICY IF EXISTS "Users can view obras in their tenant" ON public.obras;
DROP POLICY IF EXISTS "Gestores+ can insert obras" ON public.obras;
DROP POLICY IF EXISTS "Gestores+ can update obras" ON public.obras;
DROP POLICY IF EXISTS "Admins can delete obras" ON public.obras;
DROP POLICY IF EXISTS "Super admin can manage all obras" ON public.obras;
DROP POLICY IF EXISTS "Super admin can view all obras" ON public.obras;

CREATE POLICY "Users can view obras in their tenant" ON public.obras FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Gestores+ can insert obras" ON public.obras FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role)));
CREATE POLICY "Gestores+ can update obras" ON public.obras FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role)));
CREATE POLICY "Admins can delete obras" ON public.obras FOR DELETE TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Super admin can manage all obras" ON public.obras FOR ALL TO authenticated USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

-- ============ PROFILES ============
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for auth" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles in tenant" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles in tenant" ON public.profiles;
DROP POLICY IF EXISTS "Super admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admin can update all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid() AND is_super_admin = false AND (tenant_id = get_user_tenant_id(auth.uid()) OR (get_user_tenant_id(auth.uid()) IS NULL AND EXISTS (SELECT 1 FROM invites i WHERE i.email = (auth.jwt() ->> 'email') AND i.tenant_id = profiles.tenant_id AND i.used = false AND i.expires_at > now()))));
CREATE POLICY "Enable insert for auth" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Admins can view all profiles in tenant" ON public.profiles FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update profiles in tenant" ON public.profiles FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role) AND is_super_admin = false);
CREATE POLICY "Super admin can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (is_super_admin(auth.uid()));
CREATE POLICY "Super admin can update all profiles" ON public.profiles FOR UPDATE TO authenticated USING (is_super_admin(auth.uid()));

-- ============ TENANTS ============
DROP POLICY IF EXISTS "Users can view own tenant" ON public.tenants;
DROP POLICY IF EXISTS "Admins can manage own tenant" ON public.tenants;
DROP POLICY IF EXISTS "Super admin can manage all tenants" ON public.tenants;

CREATE POLICY "Users can view own tenant" ON public.tenants FOR SELECT TO authenticated USING (id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Admins can manage own tenant" ON public.tenants FOR ALL TO authenticated USING (id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Super admin can manage all tenants" ON public.tenants FOR ALL TO authenticated USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

-- ============ USER_ROLES ============
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles in tenant" ON public.user_roles;
DROP POLICY IF EXISTS "Super admin can manage all roles" ON public.user_roles;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can manage roles in tenant" ON public.user_roles FOR ALL TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Super admin can manage all roles" ON public.user_roles FOR ALL TO authenticated USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

-- ============ OBRA_MEMBROS ============
DROP POLICY IF EXISTS "Users view own obra_membros" ON public.obra_membros;
DROP POLICY IF EXISTS "Admins manage obra_membros" ON public.obra_membros;

CREATE POLICY "Users view own obra_membros" ON public.obra_membros FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins manage obra_membros" ON public.obra_membros FOR ALL TO authenticated USING ((tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) OR is_super_admin(auth.uid())) WITH CHECK ((tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) OR is_super_admin(auth.uid()));

-- ============ INVITES ============
DROP POLICY IF EXISTS "Anyone can read invite by token" ON public.invites;
DROP POLICY IF EXISTS "Admins can manage invites" ON public.invites;

CREATE POLICY "Anyone can read invite by token" ON public.invites FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage invites" ON public.invites FOR ALL TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- ============ BETA_CONFIG ============
DROP POLICY IF EXISTS "Anyone can read beta config" ON public.beta_config;
DROP POLICY IF EXISTS "Admins can insert beta config" ON public.beta_config;
DROP POLICY IF EXISTS "Admins can update beta config" ON public.beta_config;

CREATE POLICY "Anyone can read beta config" ON public.beta_config FOR SELECT USING (true);
CREATE POLICY "Admins can insert beta config" ON public.beta_config FOR INSERT TO authenticated WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role]));
CREATE POLICY "Admins can update beta config" ON public.beta_config FOR UPDATE TO authenticated USING (has_any_role(auth.uid(), ARRAY['admin'::app_role]));

-- ============ BETA_WAITLIST ============
DROP POLICY IF EXISTS "Anyone can check status by email" ON public.beta_waitlist;
DROP POLICY IF EXISTS "Anyone can signup for beta" ON public.beta_waitlist;
DROP POLICY IF EXISTS "Admins can update beta_waitlist" ON public.beta_waitlist;
DROP POLICY IF EXISTS "Admins can delete beta_waitlist" ON public.beta_waitlist;

CREATE POLICY "Anyone can check status by email" ON public.beta_waitlist FOR SELECT USING (true);
CREATE POLICY "Anyone can signup for beta" ON public.beta_waitlist FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can update beta_waitlist" ON public.beta_waitlist FOR UPDATE TO authenticated USING (has_any_role(auth.uid(), ARRAY['admin'::app_role]));
CREATE POLICY "Admins can delete beta_waitlist" ON public.beta_waitlist FOR DELETE TO authenticated USING (has_any_role(auth.uid(), ARRAY['admin'::app_role]));

-- ============ INFLUENCER_CODES ============
DROP POLICY IF EXISTS "Anyone can read active codes" ON public.influencer_codes;
DROP POLICY IF EXISTS "Admins can insert codes" ON public.influencer_codes;
DROP POLICY IF EXISTS "Admins can update codes" ON public.influencer_codes;
DROP POLICY IF EXISTS "Admins can delete codes" ON public.influencer_codes;

CREATE POLICY "Anyone can read active codes" ON public.influencer_codes FOR SELECT USING (true);
CREATE POLICY "Admins can insert codes" ON public.influencer_codes FOR INSERT TO authenticated WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role]));
CREATE POLICY "Admins can update codes" ON public.influencer_codes FOR UPDATE TO authenticated USING (has_any_role(auth.uid(), ARRAY['admin'::app_role]));
CREATE POLICY "Admins can delete codes" ON public.influencer_codes FOR DELETE TO authenticated USING (has_any_role(auth.uid(), ARRAY['admin'::app_role]));
