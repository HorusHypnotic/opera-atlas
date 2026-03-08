
-- Tabela de Ações Corretivas
CREATE TABLE public.acoes_corretivas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  obra_id UUID NOT NULL REFERENCES public.obras(id),
  descricao TEXT NOT NULL,
  responsavel TEXT,
  prazo DATE,
  status TEXT NOT NULL DEFAULT 'pendente',
  prioridade TEXT NOT NULL DEFAULT 'media',
  pilar TEXT NOT NULL DEFAULT 'geral',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.acoes_corretivas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON public.acoes_corretivas
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "operational_insert" ON public.acoes_corretivas
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gestor'::app_role, 'operacional'::app_role])
  );

CREATE POLICY "gestor_update" ON public.acoes_corretivas
  FOR UPDATE TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gestor'::app_role])
  );

CREATE POLICY "admin_delete" ON public.acoes_corretivas
  FOR DELETE TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND has_role(auth.uid(), 'admin'::app_role)
  );
