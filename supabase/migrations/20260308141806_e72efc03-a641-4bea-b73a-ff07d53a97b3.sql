
CREATE TABLE public.checklist_semanal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  obra_id uuid NOT NULL REFERENCES public.obras(id),
  semana date NOT NULL DEFAULT CURRENT_DATE,
  item_key text NOT NULL,
  verificado boolean NOT NULL DEFAULT false,
  verificado_por text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, obra_id, semana, item_key)
);
ALTER TABLE public.checklist_semanal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON public.checklist_semanal FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "operational_insert" ON public.checklist_semanal FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','gestor','operacional']::app_role[]));
CREATE POLICY "gestor_update" ON public.checklist_semanal FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','gestor']::app_role[]));
CREATE POLICY "admin_delete" ON public.checklist_semanal FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));
