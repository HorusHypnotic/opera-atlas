
-- Tabela de lotes de consumo por atividade/etapa
CREATE TABLE public.lotes_consumo (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  obra_id uuid NOT NULL REFERENCES public.obras(id),
  atividade text NOT NULL,
  area_executada numeric NOT NULL DEFAULT 0,
  unidade_area text NOT NULL DEFAULT 'm²',
  data_inicio date NOT NULL DEFAULT CURRENT_DATE,
  data_fim date,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Materiais dentro de cada lote
CREATE TABLE public.lote_materiais (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lote_id uuid NOT NULL REFERENCES public.lotes_consumo(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  material text NOT NULL,
  unidade text NOT NULL DEFAULT 'un',
  previsto numeric NOT NULL DEFAULT 0,
  real_consumo numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.lotes_consumo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lote_materiais ENABLE ROW LEVEL SECURITY;

-- lotes_consumo policies
CREATE POLICY "tenant_select" ON public.lotes_consumo FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "operational_insert" ON public.lotes_consumo FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','gestor','operacional']::app_role[]));

CREATE POLICY "gestor_update" ON public.lotes_consumo FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','gestor']::app_role[]));

CREATE POLICY "admin_delete" ON public.lotes_consumo FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "super_admin_all" ON public.lotes_consumo FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

-- lote_materiais policies
CREATE POLICY "tenant_select" ON public.lote_materiais FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "operational_insert" ON public.lote_materiais FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','gestor','operacional']::app_role[]));

CREATE POLICY "gestor_update" ON public.lote_materiais FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','gestor']::app_role[]));

CREATE POLICY "admin_delete" ON public.lote_materiais FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "super_admin_all" ON public.lote_materiais FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
