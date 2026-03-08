
-- Add Super Admin full access policies to all operational tables
-- This allows Super Admin to SELECT, UPDATE, DELETE across all tenants for debugging/support

-- registros_diarios
CREATE POLICY "super_admin_all" ON public.registros_diarios FOR ALL TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- consumo_materiais
CREATE POLICY "super_admin_all" ON public.consumo_materiais FOR ALL TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- incidentes_seguranca
CREATE POLICY "super_admin_all" ON public.incidentes_seguranca FOR ALL TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- lancamentos_financeiros
CREATE POLICY "super_admin_all" ON public.lancamentos_financeiros FOR ALL TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- retrabalhos
CREATE POLICY "super_admin_all" ON public.retrabalhos FOR ALL TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- ativos
CREATE POLICY "super_admin_all" ON public.ativos FOR ALL TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- riscos
CREATE POLICY "super_admin_all" ON public.riscos FOR ALL TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- ciclos_tarefa
CREATE POLICY "super_admin_all" ON public.ciclos_tarefa FOR ALL TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- logistica_interna
CREATE POLICY "super_admin_all" ON public.logistica_interna FOR ALL TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- sequenciamento_equipes
CREATE POLICY "super_admin_all" ON public.sequenciamento_equipes FOR ALL TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- compras_emergenciais
CREATE POLICY "super_admin_all" ON public.compras_emergenciais FOR ALL TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- aditivos_contratuais
CREATE POLICY "super_admin_all" ON public.aditivos_contratuais FOR ALL TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- checklist_semanal
CREATE POLICY "super_admin_all" ON public.checklist_semanal FOR ALL TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- acoes_corretivas
CREATE POLICY "super_admin_all" ON public.acoes_corretivas FOR ALL TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));
