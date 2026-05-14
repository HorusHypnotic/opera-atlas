
-- ============================================================
-- OBSERVABILIDADE CAUSAL — passo #2 pós OPERA_CORE
-- ============================================================

-- 1. Estender tabelas de auditoria com correlação causal
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS correlation_id uuid,
  ADD COLUMN IF NOT EXISTS causation_id uuid;

ALTER TABLE public.audit_logs_db
  ADD COLUMN IF NOT EXISTS correlation_id uuid,
  ADD COLUMN IF NOT EXISTS causation_id uuid;

CREATE INDEX IF NOT EXISTS idx_audit_logs_correlation
  ON public.audit_logs(correlation_id) WHERE correlation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_db_correlation
  ON public.audit_logs_db(correlation_id) WHERE correlation_id IS NOT NULL;

-- 2. Tabela de eventos operacionais semânticos (system nervous system)
CREATE TABLE IF NOT EXISTS public.system_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id  uuid NOT NULL,
  causation_id    uuid,
  tenant_id       uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  obra_id         uuid,
  actor_id        uuid,
  event_type      text NOT NULL,
  source          text NOT NULL,
  status          text NOT NULL DEFAULT 'success'
    CHECK (status IN ('success','failure','warning','info','denied')),
  severity        text NOT NULL DEFAULT 'info'
    CHECK (severity IN ('debug','info','warning','error','critical')),
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message   text,
  duration_ms     integer,
  created_at      timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sysev_correlation
  ON public.system_events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_sysev_tenant_created
  ON public.system_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sysev_event_type
  ON public.system_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sysev_status
  ON public.system_events(status) WHERE status IN ('failure','denied');
CREATE INDEX IF NOT EXISTS idx_sysev_obra
  ON public.system_events(obra_id, created_at DESC) WHERE obra_id IS NOT NULL;

-- 3. RLS — append-only via RPC, leitura restrita
ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_events_select_admin"
  ON public.system_events FOR SELECT TO authenticated
  USING (
    (tenant_id = public.get_user_tenant_id(auth.uid())
       AND public.has_role(auth.uid(), 'admin'::app_role))
    OR public.is_super_admin(auth.uid())
  );

-- Sem policy de INSERT direta — apenas via log_system_event() SECURITY DEFINER

-- 4. RPC para gravar evento (invariante I1/I2: tenant validado server-side)
CREATE OR REPLACE FUNCTION public.log_system_event(
  _correlation_id uuid,
  _event_type     text,
  _source         text,
  _causation_id   uuid    DEFAULT NULL,
  _obra_id        uuid    DEFAULT NULL,
  _status         text    DEFAULT 'success',
  _severity       text    DEFAULT 'info',
  _payload        jsonb   DEFAULT '{}'::jsonb,
  _error_message  text    DEFAULT NULL,
  _duration_ms    integer DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id   uuid := auth.uid();
  _tenant_id uuid;
  _event_id  uuid;
BEGIN
  IF _correlation_id IS NULL THEN
    RAISE EXCEPTION 'correlation_id é obrigatório' USING ERRCODE = '22023';
  END IF;
  IF _event_type IS NULL OR btrim(_event_type) = '' THEN
    RAISE EXCEPTION 'event_type é obrigatório' USING ERRCODE = '22023';
  END IF;

  -- Tenant SEMPRE derivado server-side (I2). Se anônimo, vira NULL (system-level).
  IF _user_id IS NOT NULL THEN
    _tenant_id := public.get_user_tenant_id(_user_id);

    -- Se obra fornecida, validar acesso (I1 / I6)
    IF _obra_id IS NOT NULL AND NOT public.user_has_obra_access(_user_id, _obra_id) THEN
      RAISE EXCEPTION 'Acesso negado à obra' USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public.system_events (
    correlation_id, causation_id, tenant_id, obra_id, actor_id,
    event_type, source, status, severity, payload, error_message, duration_ms
  ) VALUES (
    _correlation_id, _causation_id, _tenant_id, _obra_id, _user_id,
    btrim(_event_type), btrim(_source),
    COALESCE(_status,'success'), COALESCE(_severity,'info'),
    COALESCE(_payload,'{}'::jsonb), _error_message, _duration_ms
  ) RETURNING id INTO _event_id;

  RETURN _event_id;
END;
$$;

-- Permitir execução via JWT autenticado e anon (edge functions sem JWT podem logar como sistema)
REVOKE ALL ON FUNCTION public.log_system_event(uuid,text,text,uuid,uuid,text,text,jsonb,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_system_event(uuid,text,text,uuid,uuid,text,text,jsonb,text,integer) TO authenticated, anon, service_role;
