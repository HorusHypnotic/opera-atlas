
-- =====================================================
-- CORREÇÃO CRÍTICA DE SEGURANÇA: Isolamento por Obra
-- =====================================================

-- 1. Função SECURITY DEFINER para verificar acesso à obra
-- Retorna TRUE se o usuário pode acessar dados da obra
CREATE OR REPLACE FUNCTION public.user_has_obra_access(_user_id uuid, _obra_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Super admin: acesso total
    public.is_super_admin(_user_id)
    -- Admin/Gestor/Operacional: acesso total dentro do tenant
    OR public.has_any_role(_user_id, ARRAY['admin','gestor','operacional']::app_role[])
    -- Visualizador: somente se for membro da obra
    OR EXISTS (
      SELECT 1 FROM public.obra_membros
      WHERE user_id = _user_id AND obra_id = _obra_id
    )
$$;

-- 2. Atualizar tenant_select em TODAS as tabelas com obra_id
-- Agora: tenant match + acesso à obra

-- acoes_corretivas
DROP POLICY IF EXISTS "tenant_select" ON public.acoes_corretivas;
CREATE POLICY "tenant_select" ON public.acoes_corretivas
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND user_has_obra_access(auth.uid(), obra_id));

-- aditivos_contratuais
DROP POLICY IF EXISTS "tenant_select" ON public.aditivos_contratuais;
CREATE POLICY "tenant_select" ON public.aditivos_contratuais
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND user_has_obra_access(auth.uid(), obra_id));

-- apontamento_diarias
DROP POLICY IF EXISTS "tenant_select" ON public.apontamento_diarias;
CREATE POLICY "tenant_select" ON public.apontamento_diarias
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND user_has_obra_access(auth.uid(), obra_id));

-- ativos
DROP POLICY IF EXISTS "tenant_select" ON public.ativos;
CREATE POLICY "tenant_select" ON public.ativos
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND user_has_obra_access(auth.uid(), obra_id));

-- checklist_semanal
DROP POLICY IF EXISTS "tenant_select" ON public.checklist_semanal;
CREATE POLICY "tenant_select" ON public.checklist_semanal
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND user_has_obra_access(auth.uid(), obra_id));

-- ciclos_tarefa
DROP POLICY IF EXISTS "tenant_select" ON public.ciclos_tarefa;
CREATE POLICY "tenant_select" ON public.ciclos_tarefa
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND user_has_obra_access(auth.uid(), obra_id));

-- colaborador_obras
DROP POLICY IF EXISTS "tenant_select" ON public.colaborador_obras;
CREATE POLICY "tenant_select" ON public.colaborador_obras
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND user_has_obra_access(auth.uid(), obra_id));

-- compras_emergenciais
DROP POLICY IF EXISTS "tenant_select" ON public.compras_emergenciais;
CREATE POLICY "tenant_select" ON public.compras_emergenciais
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND user_has_obra_access(auth.uid(), obra_id));

-- consumo_materiais
DROP POLICY IF EXISTS "tenant_select" ON public.consumo_materiais;
CREATE POLICY "tenant_select" ON public.consumo_materiais
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND user_has_obra_access(auth.uid(), obra_id));

-- incidentes_seguranca
DROP POLICY IF EXISTS "tenant_select" ON public.incidentes_seguranca;
CREATE POLICY "tenant_select" ON public.incidentes_seguranca
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND user_has_obra_access(auth.uid(), obra_id));

-- lancamentos_financeiros
DROP POLICY IF EXISTS "tenant_select" ON public.lancamentos_financeiros;
CREATE POLICY "tenant_select" ON public.lancamentos_financeiros
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND user_has_obra_access(auth.uid(), obra_id));

-- logistica_interna
DROP POLICY IF EXISTS "tenant_select" ON public.logistica_interna;
CREATE POLICY "tenant_select" ON public.logistica_interna
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND user_has_obra_access(auth.uid(), obra_id));

-- lotes_consumo
DROP POLICY IF EXISTS "tenant_select" ON public.lotes_consumo;
CREATE POLICY "tenant_select" ON public.lotes_consumo
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND user_has_obra_access(auth.uid(), obra_id));

-- registros_diarios
DROP POLICY IF EXISTS "tenant_select" ON public.registros_diarios;
CREATE POLICY "tenant_select" ON public.registros_diarios
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND user_has_obra_access(auth.uid(), obra_id));

-- registro_presencas
DROP POLICY IF EXISTS "tenant_select" ON public.registro_presencas;
CREATE POLICY "tenant_select" ON public.registro_presencas
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND user_has_obra_access(auth.uid(), obra_id));

-- retrabalhos
DROP POLICY IF EXISTS "tenant_select" ON public.retrabalhos;
CREATE POLICY "tenant_select" ON public.retrabalhos
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND user_has_obra_access(auth.uid(), obra_id));

-- riscos
DROP POLICY IF EXISTS "tenant_select" ON public.riscos;
CREATE POLICY "tenant_select" ON public.riscos
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND user_has_obra_access(auth.uid(), obra_id));

-- sequenciamento_equipes
DROP POLICY IF EXISTS "tenant_select" ON public.sequenciamento_equipes;
CREATE POLICY "tenant_select" ON public.sequenciamento_equipes
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND user_has_obra_access(auth.uid(), obra_id));

-- 3. Tabela obras: visualizador só vê obras onde é membro
DROP POLICY IF EXISTS "Users can view obras in their tenant" ON public.obras;
CREATE POLICY "Users can view obras in their tenant" ON public.obras
  FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND user_has_obra_access(auth.uid(), id)
  );
