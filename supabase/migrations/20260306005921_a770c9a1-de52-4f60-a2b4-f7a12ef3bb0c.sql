
-- ============================================
-- TABELAS OPERACIONAIS O.P.E.R.A.
-- ============================================

-- ORGANIZAÇÃO: Registros diários de colaboradores
CREATE TABLE public.registros_diarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid REFERENCES public.obras(id) ON DELETE CASCADE NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  nome text NOT NULL,
  entrada time,
  saida time,
  atividade text,
  producao text,
  status text NOT NULL DEFAULT 'ok',
  data_registro date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- PADRONIZAÇÃO: Consumo de materiais
CREATE TABLE public.consumo_materiais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid REFERENCES public.obras(id) ON DELETE CASCADE NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  material text NOT NULL,
  previsto numeric NOT NULL DEFAULT 0,
  real_consumo numeric NOT NULL DEFAULT 0,
  unidade text NOT NULL DEFAULT 'un',
  data_registro date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- PADRONIZAÇÃO: Compras emergenciais
CREATE TABLE public.compras_emergenciais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid REFERENCES public.obras(id) ON DELETE CASCADE NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  material text NOT NULL,
  qtd numeric NOT NULL DEFAULT 0,
  motivo text,
  data date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- EFICIÊNCIA: Ativos e equipamentos
CREATE TABLE public.ativos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid REFERENCES public.obras(id) ON DELETE CASCADE NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  nome text NOT NULL,
  status text NOT NULL DEFAULT 'ativo',
  local_atual text,
  valor numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- REDUÇÃO DE PERDAS: Sequenciamento de equipes
CREATE TABLE public.sequenciamento_equipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid REFERENCES public.obras(id) ON DELETE CASCADE NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  equipe text NOT NULL,
  semana_inicio int NOT NULL,
  semana_fim int NOT NULL,
  status text NOT NULL DEFAULT 'planejado',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- REDUÇÃO DE PERDAS: Riscos
CREATE TABLE public.riscos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid REFERENCES public.obras(id) ON DELETE CASCADE NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  risco text NOT NULL,
  severidade text NOT NULL DEFAULT 'media',
  impacto text,
  prazo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- REDUÇÃO DE PERDAS: Retrabalhos
CREATE TABLE public.retrabalhos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid REFERENCES public.obras(id) ON DELETE CASCADE NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  etapa text NOT NULL,
  quantidade int NOT NULL DEFAULT 1,
  descricao text,
  data_registro date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ANÁLISE CONTÍNUA: Lançamentos financeiros
CREATE TABLE public.lancamentos_financeiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid REFERENCES public.obras(id) ON DELETE CASCADE NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  tipo text NOT NULL DEFAULT 'custo',
  valor numeric NOT NULL DEFAULT 0,
  descricao text,
  data date NOT NULL DEFAULT CURRENT_DATE,
  fornecedor text,
  status_pagamento text NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- SEGURANÇA & QUALIDADE: Incidentes
CREATE TABLE public.incidentes_seguranca (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid REFERENCES public.obras(id) ON DELETE CASCADE NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  tipo text NOT NULL DEFAULT 'nc',
  descricao text,
  data date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'aberto',
  severidade text NOT NULL DEFAULT 'media',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================
ALTER TABLE public.registros_diarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumo_materiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras_emergenciais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ativos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequenciamento_equipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riscos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retrabalhos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lancamentos_financeiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidentes_seguranca ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES (same pattern for all tables)
-- SELECT: authenticated users in same tenant
-- INSERT: operacional, gestor, admin
-- UPDATE: gestor, admin
-- DELETE: admin only
-- ============================================

-- Helper: check if user has any of the operational roles
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles app_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = ANY(_roles)
  )
$$;

-- REGISTROS_DIARIOS
CREATE POLICY "tenant_select" ON public.registros_diarios FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "operational_insert" ON public.registros_diarios FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','gestor','operacional']::app_role[]));
CREATE POLICY "gestor_update" ON public.registros_diarios FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','gestor']::app_role[]));
CREATE POLICY "admin_delete" ON public.registros_diarios FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- CONSUMO_MATERIAIS
CREATE POLICY "tenant_select" ON public.consumo_materiais FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "operational_insert" ON public.consumo_materiais FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','gestor','operacional']::app_role[]));
CREATE POLICY "gestor_update" ON public.consumo_materiais FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','gestor']::app_role[]));
CREATE POLICY "admin_delete" ON public.consumo_materiais FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- COMPRAS_EMERGENCIAIS
CREATE POLICY "tenant_select" ON public.compras_emergenciais FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "operational_insert" ON public.compras_emergenciais FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','gestor','operacional']::app_role[]));
CREATE POLICY "gestor_update" ON public.compras_emergenciais FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','gestor']::app_role[]));
CREATE POLICY "admin_delete" ON public.compras_emergenciais FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- ATIVOS
CREATE POLICY "tenant_select" ON public.ativos FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "operational_insert" ON public.ativos FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','gestor','operacional']::app_role[]));
CREATE POLICY "gestor_update" ON public.ativos FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','gestor']::app_role[]));
CREATE POLICY "admin_delete" ON public.ativos FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- SEQUENCIAMENTO_EQUIPES
CREATE POLICY "tenant_select" ON public.sequenciamento_equipes FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "operational_insert" ON public.sequenciamento_equipes FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','gestor','operacional']::app_role[]));
CREATE POLICY "gestor_update" ON public.sequenciamento_equipes FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','gestor']::app_role[]));
CREATE POLICY "admin_delete" ON public.sequenciamento_equipes FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- RISCOS
CREATE POLICY "tenant_select" ON public.riscos FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "operational_insert" ON public.riscos FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','gestor','operacional']::app_role[]));
CREATE POLICY "gestor_update" ON public.riscos FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','gestor']::app_role[]));
CREATE POLICY "admin_delete" ON public.riscos FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- RETRABALHOS
CREATE POLICY "tenant_select" ON public.retrabalhos FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "operational_insert" ON public.retrabalhos FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','gestor','operacional']::app_role[]));
CREATE POLICY "gestor_update" ON public.retrabalhos FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','gestor']::app_role[]));
CREATE POLICY "admin_delete" ON public.retrabalhos FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- LANCAMENTOS_FINANCEIROS
CREATE POLICY "tenant_select" ON public.lancamentos_financeiros FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "operational_insert" ON public.lancamentos_financeiros FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','gestor','operacional']::app_role[]));
CREATE POLICY "gestor_update" ON public.lancamentos_financeiros FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','gestor']::app_role[]));
CREATE POLICY "admin_delete" ON public.lancamentos_financeiros FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- INCIDENTES_SEGURANCA
CREATE POLICY "tenant_select" ON public.incidentes_seguranca FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "operational_insert" ON public.incidentes_seguranca FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','gestor','operacional']::app_role[]));
CREATE POLICY "gestor_update" ON public.incidentes_seguranca FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','gestor']::app_role[]));
CREATE POLICY "admin_delete" ON public.incidentes_seguranca FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));
