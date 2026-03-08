
-- Tabela central de colaboradores
CREATE TABLE public.colaboradores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  telefone TEXT,
  pix_tipo TEXT, -- cpf, telefone, email, aleatoria
  pix_chave TEXT,
  valor_diaria NUMERIC NOT NULL DEFAULT 0,
  turno TEXT NOT NULL DEFAULT 'diurno', -- diurno, noturno, integral
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Vínculo colaborador <-> obra (multi-obra simultâneo)
CREATE TABLE public.colaborador_obras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  colaborador_id UUID NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  valor_diaria_especial NUMERIC, -- null = usa valor padrão do colaborador
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(colaborador_id, obra_id)
);

-- Registro de presenças, faltas e horas extras
CREATE TABLE public.registro_presencas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  colaborador_id UUID NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo TEXT NOT NULL DEFAULT 'presente', -- presente, falta_justificada, falta_injustificada, hora_extra
  horas_extra NUMERIC DEFAULT 0,
  valor_diaria_usado NUMERIC DEFAULT 0,
  servico_especial TEXT, -- descrição do serviço especial (diária diferenciada)
  valor_diaria_especial NUMERIC, -- valor especial para esse dia específico
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colaborador_obras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registro_presencas ENABLE ROW LEVEL SECURITY;

-- Colaboradores policies
CREATE POLICY "tenant_select" ON public.colaboradores FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "operational_insert" ON public.colaboradores FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','gestor','operacional']::app_role[]));
CREATE POLICY "gestor_update" ON public.colaboradores FOR UPDATE USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','gestor']::app_role[]));
CREATE POLICY "admin_delete" ON public.colaboradores FOR DELETE USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "super_admin_all" ON public.colaboradores FOR ALL USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

-- Colaborador_obras policies
CREATE POLICY "tenant_select" ON public.colaborador_obras FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "operational_insert" ON public.colaborador_obras FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','gestor','operacional']::app_role[]));
CREATE POLICY "gestor_update" ON public.colaborador_obras FOR UPDATE USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','gestor']::app_role[]));
CREATE POLICY "admin_delete" ON public.colaborador_obras FOR DELETE USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "super_admin_all" ON public.colaborador_obras FOR ALL USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));

-- Registro_presencas policies
CREATE POLICY "tenant_select" ON public.registro_presencas FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "operational_insert" ON public.registro_presencas FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','gestor','operacional']::app_role[]));
CREATE POLICY "gestor_update" ON public.registro_presencas FOR UPDATE USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_any_role(auth.uid(), ARRAY['admin','gestor']::app_role[]));
CREATE POLICY "admin_delete" ON public.registro_presencas FOR DELETE USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "super_admin_all" ON public.registro_presencas FOR ALL USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
