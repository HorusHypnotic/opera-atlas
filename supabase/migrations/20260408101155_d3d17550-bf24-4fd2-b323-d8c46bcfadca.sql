
-- =============================================
-- 1. FIX: Change {public} policies to {authenticated}
-- =============================================

-- colaboradores
DROP POLICY IF EXISTS "admin_delete" ON public.colaboradores;
DROP POLICY IF EXISTS "gestor_update" ON public.colaboradores;
DROP POLICY IF EXISTS "operational_insert" ON public.colaboradores;
DROP POLICY IF EXISTS "super_admin_all" ON public.colaboradores;
DROP POLICY IF EXISTS "tenant_select" ON public.colaboradores;

CREATE POLICY "admin_delete" ON public.colaboradores FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "gestor_update" ON public.colaboradores FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','gestor']::app_role[]));

CREATE POLICY "operational_insert" ON public.colaboradores FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','gestor','operacional']::app_role[]));

CREATE POLICY "super_admin_all" ON public.colaboradores FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

-- colaboradores: visualizador should only see colaboradores linked to their permitted obras
CREATE POLICY "tenant_select" ON public.colaboradores FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      has_any_role(auth.uid(), ARRAY['admin','gestor','operacional']::app_role[])
      OR is_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.colaborador_obras co
        JOIN public.obra_membros om ON om.obra_id = co.obra_id AND om.user_id = auth.uid()
        WHERE co.colaborador_id = colaboradores.id
      )
    )
  );

-- colaborador_obras
DROP POLICY IF EXISTS "admin_delete" ON public.colaborador_obras;
DROP POLICY IF EXISTS "gestor_update" ON public.colaborador_obras;
DROP POLICY IF EXISTS "operational_insert" ON public.colaborador_obras;
DROP POLICY IF EXISTS "super_admin_all" ON public.colaborador_obras;

CREATE POLICY "admin_delete" ON public.colaborador_obras FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "gestor_update" ON public.colaborador_obras FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','gestor']::app_role[]));

CREATE POLICY "operational_insert" ON public.colaborador_obras FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','gestor','operacional']::app_role[]));

CREATE POLICY "super_admin_all" ON public.colaborador_obras FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

-- registro_presencas
DROP POLICY IF EXISTS "admin_delete" ON public.registro_presencas;
DROP POLICY IF EXISTS "gestor_update" ON public.registro_presencas;
DROP POLICY IF EXISTS "operational_insert" ON public.registro_presencas;
DROP POLICY IF EXISTS "super_admin_all" ON public.registro_presencas;

CREATE POLICY "admin_delete" ON public.registro_presencas FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "gestor_update" ON public.registro_presencas FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','gestor']::app_role[]));

CREATE POLICY "operational_insert" ON public.registro_presencas FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','gestor','operacional']::app_role[]));

CREATE POLICY "super_admin_all" ON public.registro_presencas FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

-- =============================================
-- 2. FIX: lote_materiais - add obra-level access via lotes_consumo
-- =============================================
DROP POLICY IF EXISTS "tenant_select" ON public.lote_materiais;

CREATE POLICY "tenant_select" ON public.lote_materiais FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      has_any_role(auth.uid(), ARRAY['admin','gestor','operacional']::app_role[])
      OR is_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.lotes_consumo lc
        WHERE lc.id = lote_materiais.lote_id
        AND user_has_obra_access(auth.uid(), lc.obra_id)
      )
    )
  );

-- =============================================
-- 3. ADD: expires_at column to obra_membros for access expiration
-- =============================================
ALTER TABLE public.obra_membros ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT NULL;

-- Update user_has_obra_access to check expiration
CREATE OR REPLACE FUNCTION public.user_has_obra_access(_user_id uuid, _obra_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT
    public.is_super_admin(_user_id)
    OR public.has_any_role(_user_id, ARRAY['admin','gestor','operacional']::app_role[])
    OR EXISTS (
      SELECT 1 FROM public.obra_membros
      WHERE user_id = _user_id
        AND obra_id = _obra_id
        AND (expires_at IS NULL OR expires_at > now())
    )
$$;
