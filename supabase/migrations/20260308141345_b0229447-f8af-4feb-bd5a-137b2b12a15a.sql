
-- Add custo_orcado_m2 to obras
ALTER TABLE public.obras ADD COLUMN custo_orcado_m2 numeric NOT NULL DEFAULT 0;

-- Logística interna
CREATE TABLE public.logistica_interna (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  obra_id uuid NOT NULL REFERENCES public.obras(id),
  equipe text NOT NULL,
  tempo_deslocamento_min integer NOT NULL DEFAULT 0,
  origem text,
  destino text,
  observacao text,
  data_registro date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.logistica_interna ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON public.logistica_interna FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "operational_insert" ON public.logistica_interna FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','gestor','operacional']::app_role[]));
CREATE POLICY "gestor_update" ON public.logistica_interna FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','gestor']::app_role[]));
CREATE POLICY "admin_delete" ON public.logistica_interna FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- Ciclos de tarefa
CREATE TABLE public.ciclos_tarefa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  obra_id uuid NOT NULL REFERENCES public.obras(id),
  tarefa text NOT NULL,
  tempo_medio_min numeric NOT NULL DEFAULT 0,
  tempo_alvo_min numeric NOT NULL DEFAULT 0,
  qtd_medicoes integer NOT NULL DEFAULT 1,
  data_registro date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ciclos_tarefa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON public.ciclos_tarefa FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "operational_insert" ON public.ciclos_tarefa FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','gestor','operacional']::app_role[]));
CREATE POLICY "gestor_update" ON public.ciclos_tarefa FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','gestor']::app_role[]));
CREATE POLICY "admin_delete" ON public.ciclos_tarefa FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- Aditivos contratuais
CREATE TABLE public.aditivos_contratuais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  obra_id uuid NOT NULL REFERENCES public.obras(id),
  descricao text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  tipo text NOT NULL DEFAULT 'aditivo',
  aprovado boolean NOT NULL DEFAULT false,
  data date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.aditivos_contratuais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON public.aditivos_contratuais FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "operational_insert" ON public.aditivos_contratuais FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','gestor','operacional']::app_role[]));
CREATE POLICY "gestor_update" ON public.aditivos_contratuais FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','gestor']::app_role[]));
CREATE POLICY "admin_delete" ON public.aditivos_contratuais FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));
