-- ============================================================
-- BLOCO 1 — ENFORCEMENT NO BANCO (Imutabilidade + Auditoria)
-- Determinismo, rastreabilidade e defesa jurídica
-- ============================================================

-- 0) Extensão para hash (usada na RPC folha_pagamento)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1) CHECK CONSTRAINTS (Lei no banco, não na UI)
-- ============================================================

-- registro_presencas
ALTER TABLE public.registro_presencas
  ADD CONSTRAINT chk_rp_tipo
    CHECK (tipo IN ('presente','presenca','falta','falta_justificada','falta_injustificada','meio_periodo','hora_extra'));

ALTER TABLE public.registro_presencas
  ADD CONSTRAINT chk_rp_fracao_range
    CHECK (fracao_diaria >= 0 AND fracao_diaria <= 1);

ALTER TABLE public.registro_presencas
  ADD CONSTRAINT chk_rp_valor_diaria_usado_pos
    CHECK (valor_diaria_usado IS NULL OR valor_diaria_usado >= 0);

ALTER TABLE public.registro_presencas
  ADD CONSTRAINT chk_rp_horas_extra_pos
    CHECK (horas_extra IS NULL OR horas_extra >= 0);

-- apontamento_diarias
ALTER TABLE public.apontamento_diarias
  ADD CONSTRAINT chk_ap_tipo
    CHECK (tipo IN ('ajuste','complemento','correcao','legacy_historico','presenca'));

ALTER TABLE public.apontamento_diarias
  ADD CONSTRAINT chk_ap_periodo_valido
    CHECK (periodo_fim >= periodo_inicio);

ALTER TABLE public.apontamento_diarias
  ADD CONSTRAINT chk_ap_valor_diaria_pos
    CHECK (valor_diaria >= 0);

-- lancamentos_financeiros
ALTER TABLE public.lancamentos_financeiros
  ADD CONSTRAINT chk_lf_valor_nonneg
    CHECK (valor >= 0);

ALTER TABLE public.lancamentos_financeiros
  ADD CONSTRAINT chk_lf_tipo
    CHECK (tipo IN ('receita','custo'));

-- obras
ALTER TABLE public.obras
  ADD CONSTRAINT chk_obras_orcamento_nonneg
    CHECK (orcamento_total >= 0);

ALTER TABLE public.obras
  ADD CONSTRAINT chk_obras_area_nonneg
    CHECK (area_m2 >= 0);

-- ============================================================
-- 2) SNAPSHOT OBRIGATÓRIO + IMUTABILIDADE TEMPORAL
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_snapshot_valor_diaria()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _val_colab numeric;
BEGIN
  -- Snapshot: se valor_diaria_usado for NULL ou 0, congela com valor atual do colaborador
  IF NEW.valor_diaria_usado IS NULL OR NEW.valor_diaria_usado = 0 THEN
    SELECT valor_diaria INTO _val_colab
    FROM public.colaboradores
    WHERE id = NEW.colaborador_id;

    NEW.valor_diaria_usado := COALESCE(NEW.valor_diaria_especial, _val_colab, 0);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshot_valor_diaria ON public.registro_presencas;
CREATE TRIGGER trg_snapshot_valor_diaria
  BEFORE INSERT ON public.registro_presencas
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_snapshot_valor_diaria();

-- Bloqueia alteração de snapshot após 7 dias (exceto admin/super_admin)
CREATE OR REPLACE FUNCTION public.fn_protect_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.valor_diaria_usado IS DISTINCT FROM NEW.valor_diaria_usado
     AND OLD.created_at < (now() - INTERVAL '7 days')
     AND NOT (
       public.has_role(auth.uid(), 'admin'::app_role)
       OR public.is_super_admin(auth.uid())
     ) THEN
    RAISE EXCEPTION 'Alteração de valor_diaria_usado bloqueada após 7 dias (registro de %). Apenas admin pode alterar.', OLD.created_at::date
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_snapshot ON public.registro_presencas;
CREATE TRIGGER trg_protect_snapshot
  BEFORE UPDATE ON public.registro_presencas
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_protect_snapshot();

-- ============================================================
-- 3) PERÍODOS FECHADOS (Bloqueia mutações em meses fechados)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.periodos_fechados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  obra_id uuid NOT NULL,
  mes date NOT NULL, -- sempre dia 1 do mês
  fechado_em timestamptz NOT NULL DEFAULT now(),
  fechado_por uuid NOT NULL,
  hash_snapshot text NOT NULL,
  motivo text,
  reaberto_em timestamptz,
  reaberto_por uuid,
  motivo_reabertura text,
  CONSTRAINT chk_pf_mes_dia1 CHECK (EXTRACT(DAY FROM mes) = 1),
  UNIQUE (tenant_id, obra_id, mes)
);

ALTER TABLE public.periodos_fechados ENABLE ROW LEVEL SECURITY;

CREATE POLICY pf_select ON public.periodos_fechados
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND user_has_obra_access(auth.uid(), obra_id));

CREATE POLICY pf_insert_admin ON public.periodos_fechados
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id(auth.uid())
    AND has_role(auth.uid(), 'admin'::app_role)
    AND fechado_por = auth.uid()
  );

CREATE POLICY pf_update_admin ON public.periodos_fechados
  FOR UPDATE TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY pf_super_admin ON public.periodos_fechados
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Função genérica para checar período fechado
CREATE OR REPLACE FUNCTION public.fn_check_periodo_fechado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _data date;
  _tenant uuid;
  _obra uuid;
  _fechado boolean;
BEGIN
  -- Determina data e tenant/obra conforme tabela
  IF TG_TABLE_NAME = 'registro_presencas' THEN
    _data := COALESCE(NEW.data, OLD.data);
    _tenant := COALESCE(NEW.tenant_id, OLD.tenant_id);
    _obra := COALESCE(NEW.obra_id, OLD.obra_id);
  ELSIF TG_TABLE_NAME = 'apontamento_diarias' THEN
    _data := COALESCE(NEW.periodo_inicio, OLD.periodo_inicio);
    _tenant := COALESCE(NEW.tenant_id, OLD.tenant_id);
    _obra := COALESCE(NEW.obra_id, OLD.obra_id);
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.periodos_fechados
    WHERE tenant_id = _tenant
      AND obra_id = _obra
      AND mes = date_trunc('month', _data)::date
      AND reaberto_em IS NULL
  ) INTO _fechado;

  IF _fechado AND NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Período % está fechado para esta obra. Reabra primeiro (apenas super admin).', to_char(_data, 'MM/YYYY')
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_rp_periodo_fechado ON public.registro_presencas;
CREATE TRIGGER trg_rp_periodo_fechado
  BEFORE INSERT OR UPDATE OR DELETE ON public.registro_presencas
  FOR EACH ROW EXECUTE FUNCTION public.fn_check_periodo_fechado();

DROP TRIGGER IF EXISTS trg_ap_periodo_fechado ON public.apontamento_diarias;
CREATE TRIGGER trg_ap_periodo_fechado
  BEFORE INSERT OR UPDATE OR DELETE ON public.apontamento_diarias
  FOR EACH ROW EXECUTE FUNCTION public.fn_check_periodo_fechado();

-- ============================================================
-- 4) AUDITORIA FORENSE DB-LEVEL (append-only)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_logs_db (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  row_id text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
  old_data jsonb,
  new_data jsonb,
  user_id uuid,
  tenant_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_db_table_row ON public.audit_logs_db(table_name, row_id);
CREATE INDEX IF NOT EXISTS idx_audit_db_tenant_created ON public.audit_logs_db(tenant_id, created_at DESC);

ALTER TABLE public.audit_logs_db ENABLE ROW LEVEL SECURITY;

-- Append-only: ninguém pode UPDATE/DELETE (nem mesmo admin via UI)
CREATE POLICY audit_db_select_admin ON public.audit_logs_db
  FOR SELECT TO authenticated
  USING (
    (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
    OR is_super_admin(auth.uid())
  );

-- INSERT só via trigger (nenhuma policy = bloqueado para usuários, trigger usa SECURITY DEFINER)
-- Sem policies de UPDATE/DELETE = imutável

CREATE OR REPLACE FUNCTION public.fn_audit_log_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row_id text;
  _tenant uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _row_id := OLD.id::text;
    _tenant := OLD.tenant_id;
  ELSE
    _row_id := NEW.id::text;
    _tenant := NEW.tenant_id;
  END IF;

  INSERT INTO public.audit_logs_db (
    table_name, row_id, operation, old_data, new_data, user_id, tenant_id
  ) VALUES (
    TG_TABLE_NAME,
    _row_id,
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    auth.uid(),  -- pega do JWT, não do client
    _tenant
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_rp ON public.registro_presencas;
CREATE TRIGGER trg_audit_rp
  AFTER INSERT OR UPDATE OR DELETE ON public.registro_presencas
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log_changes();

DROP TRIGGER IF EXISTS trg_audit_ap ON public.apontamento_diarias;
CREATE TRIGGER trg_audit_ap
  AFTER INSERT OR UPDATE OR DELETE ON public.apontamento_diarias
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log_changes();

DROP TRIGGER IF EXISTS trg_audit_colab ON public.colaboradores;
CREATE TRIGGER trg_audit_colab
  AFTER INSERT OR UPDATE OR DELETE ON public.colaboradores
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log_changes();

DROP TRIGGER IF EXISTS trg_audit_lf ON public.lancamentos_financeiros;
CREATE TRIGGER trg_audit_lf
  AFTER INSERT OR UPDATE OR DELETE ON public.lancamentos_financeiros
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log_changes();

DROP TRIGGER IF EXISTS trg_audit_obras ON public.obras;
CREATE TRIGGER trg_audit_obras
  AFTER INSERT OR UPDATE OR DELETE ON public.obras
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log_changes();

-- ============================================================
-- 5) UPDATED_AT / UPDATED_BY automáticos
-- ============================================================

ALTER TABLE public.registro_presencas
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid;

ALTER TABLE public.apontamento_diarias
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid;

ALTER TABLE public.lancamentos_financeiros
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid;

CREATE OR REPLACE FUNCTION public.fn_set_updated_meta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_updated_meta_rp ON public.registro_presencas;
CREATE TRIGGER trg_updated_meta_rp
  BEFORE UPDATE ON public.registro_presencas
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_meta();

DROP TRIGGER IF EXISTS trg_updated_meta_ap ON public.apontamento_diarias;
CREATE TRIGGER trg_updated_meta_ap
  BEFORE UPDATE ON public.apontamento_diarias
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_meta();

DROP TRIGGER IF EXISTS trg_updated_meta_lf ON public.lancamentos_financeiros;
CREATE TRIGGER trg_updated_meta_lf
  BEFORE UPDATE ON public.lancamentos_financeiros
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_meta();

-- ============================================================
-- 6) ÍNDICES de performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_rp_obra_data ON public.registro_presencas(obra_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_rp_colab_data ON public.registro_presencas(colaborador_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_ap_obra_periodo ON public.apontamento_diarias(obra_id, periodo_inicio DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_lf_obra_data ON public.lancamentos_financeiros(obra_id, data DESC) WHERE deleted_at IS NULL;
