
-- =========================================================
-- Cronograma — Fase 1: atividades, dependências, baseline
-- =========================================================

-- ---------- atividades ----------
CREATE TABLE public.atividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  obra_id uuid NOT NULL,
  nome text NOT NULL,
  descricao text,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  progresso numeric(5,2) NOT NULL DEFAULT 0,
  ordem int NOT NULL DEFAULT 0,
  parent_id uuid REFERENCES public.atividades(id) ON DELETE SET NULL,
  responsavel text,
  cor text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  deleted_at timestamptz
);

CREATE INDEX idx_atividades_obra ON public.atividades(obra_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_atividades_tenant ON public.atividades(tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.atividades TO authenticated;
GRANT ALL ON public.atividades TO service_role;

ALTER TABLE public.atividades ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_select ON public.atividades
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND user_has_obra_access(auth.uid(), obra_id));

CREATE POLICY operational_insert ON public.atividades
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gestor'::app_role, 'operacional'::app_role])
  );

CREATE POLICY gestor_update ON public.atividades
  FOR UPDATE TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gestor'::app_role])
  );

CREATE POLICY admin_delete ON public.atividades
  FOR DELETE TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY super_admin_all ON public.atividades
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Validação datas (trigger, não CHECK — OPERA_CORE: invariantes mutáveis no tempo via função)
CREATE OR REPLACE FUNCTION public.atividades_validate()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.data_fim < NEW.data_inicio THEN
    RAISE EXCEPTION 'data_fim (%) deve ser maior ou igual a data_inicio (%)', NEW.data_fim, NEW.data_inicio
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.progresso < 0 OR NEW.progresso > 100 THEN
    RAISE EXCEPTION 'progresso (%) deve estar entre 0 e 100', NEW.progresso
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.parent_id IS NOT NULL AND NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'atividade não pode ser pai de si mesma'
      USING ERRCODE = 'check_violation';
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END $$;

CREATE TRIGGER trg_atividades_validate
  BEFORE INSERT OR UPDATE ON public.atividades
  FOR EACH ROW EXECUTE FUNCTION public.atividades_validate();

-- Bloqueio por período fechado (mesmo padrão de apontamento_diarias)
CREATE POLICY block_closed_periods_atividades_insert ON public.atividades
  FOR INSERT TO authenticated
  WITH CHECK (
    is_super_admin(auth.uid())
    OR NOT EXISTS (
      SELECT 1 FROM periodos_fechados pf
      WHERE pf.tenant_id = atividades.tenant_id
        AND pf.obra_id = atividades.obra_id
        AND pf.mes = (date_trunc('month', atividades.data_fim::timestamptz))::date
        AND pf.reaberto_em IS NULL
    )
  );

CREATE POLICY block_closed_periods_atividades_update ON public.atividades
  FOR UPDATE TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR NOT EXISTS (
      SELECT 1 FROM periodos_fechados pf
      WHERE pf.tenant_id = atividades.tenant_id
        AND pf.obra_id = atividades.obra_id
        AND pf.mes = (date_trunc('month', atividades.data_fim::timestamptz))::date
        AND pf.reaberto_em IS NULL
    )
  );

CREATE POLICY block_closed_periods_atividades_delete ON public.atividades
  FOR DELETE TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR NOT EXISTS (
      SELECT 1 FROM periodos_fechados pf
      WHERE pf.tenant_id = atividades.tenant_id
        AND pf.obra_id = atividades.obra_id
        AND pf.mes = (date_trunc('month', atividades.data_fim::timestamptz))::date
        AND pf.reaberto_em IS NULL
    )
  );

-- ---------- atividade_dependencias ----------
CREATE TABLE public.atividade_dependencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  obra_id uuid NOT NULL,
  predecessora_id uuid NOT NULL REFERENCES public.atividades(id) ON DELETE CASCADE,
  sucessora_id uuid NOT NULL REFERENCES public.atividades(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'FS',
  lag_dias int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (predecessora_id, sucessora_id)
);

CREATE INDEX idx_dep_sucessora ON public.atividade_dependencias(sucessora_id);
CREATE INDEX idx_dep_predecessora ON public.atividade_dependencias(predecessora_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.atividade_dependencias TO authenticated;
GRANT ALL ON public.atividade_dependencias TO service_role;

ALTER TABLE public.atividade_dependencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_select ON public.atividade_dependencias
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND user_has_obra_access(auth.uid(), obra_id));

CREATE POLICY operational_insert ON public.atividade_dependencias
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gestor'::app_role, 'operacional'::app_role])
  );

CREATE POLICY gestor_update ON public.atividade_dependencias
  FOR UPDATE TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gestor'::app_role])
  );

CREATE POLICY admin_delete ON public.atividade_dependencias
  FOR DELETE TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY super_admin_all ON public.atividade_dependencias
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.atividade_dep_validate()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.predecessora_id = NEW.sucessora_id THEN
    RAISE EXCEPTION 'atividade não pode depender de si mesma'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_atividade_dep_validate
  BEFORE INSERT OR UPDATE ON public.atividade_dependencias
  FOR EACH ROW EXECUTE FUNCTION public.atividade_dep_validate();

-- ---------- cronograma_baseline (append-only) ----------
CREATE TABLE public.cronograma_baseline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  obra_id uuid NOT NULL,
  versao int NOT NULL DEFAULT 1,
  congelado_em timestamptz NOT NULL DEFAULT now(),
  congelado_por uuid NOT NULL,
  snapshot_json jsonb NOT NULL,
  hash text NOT NULL,
  motivo text,
  UNIQUE (obra_id, versao)
);

CREATE INDEX idx_baseline_obra ON public.cronograma_baseline(obra_id);

GRANT SELECT, INSERT ON public.cronograma_baseline TO authenticated;
GRANT ALL ON public.cronograma_baseline TO service_role;

ALTER TABLE public.cronograma_baseline ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_select ON public.cronograma_baseline
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND user_has_obra_access(auth.uid(), obra_id));

CREATE POLICY admin_insert ON public.cronograma_baseline
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND has_role(auth.uid(), 'admin'::app_role)
    AND congelado_por = auth.uid()
  );

CREATE POLICY super_admin_all ON public.cronograma_baseline
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));
