
CREATE TABLE public.apontamento_diarias (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  obra_id uuid NOT NULL REFERENCES public.obras(id),
  colaborador_id uuid NOT NULL REFERENCES public.colaboradores(id),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  periodo_inicio date NOT NULL DEFAULT CURRENT_DATE,
  periodo_fim date NOT NULL DEFAULT CURRENT_DATE,
  quantidade_diarias numeric NOT NULL DEFAULT 0,
  valor_diaria numeric NOT NULL DEFAULT 0,
  observacao text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.apontamento_diarias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON public.apontamento_diarias FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "operational_insert" ON public.apontamento_diarias FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gestor'::app_role, 'operacional'::app_role]));

CREATE POLICY "gestor_update" ON public.apontamento_diarias FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gestor'::app_role]));

CREATE POLICY "admin_delete" ON public.apontamento_diarias FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "super_admin_all" ON public.apontamento_diarias FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));
