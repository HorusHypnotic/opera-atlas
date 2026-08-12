-- Baseline de Prazo V1 (Fase 1A): snapshot canônico, versionado e imutável.

ALTER TABLE public.cronograma_baseline
  ADD COLUMN IF NOT EXISTS formato_snapshot text,
  ADD COLUMN IF NOT EXISTS versao_formato integer,
  ADD COLUMN IF NOT EXISTS algoritmo_hash text,
  ADD COLUMN IF NOT EXISTS baseline_anterior_id uuid;

ALTER TABLE public.cronograma_baseline
  ADD CONSTRAINT cronograma_baseline_versao_positiva CHECK (versao > 0),
  ADD CONSTRAINT cronograma_baseline_versao_formato_positiva CHECK (versao_formato > 0),
  ADD CONSTRAINT cronograma_baseline_hash_sha256 CHECK (hash ~ '^[0-9a-f]{64}$') NOT VALID,
  ADD CONSTRAINT cronograma_baseline_formato_v1 CHECK (formato_snapshot = 'opera.atlas.schedule-baseline') NOT VALID,
  ADD CONSTRAINT cronograma_baseline_algoritmo_v1 CHECK (algoritmo_hash = 'SHA-256') NOT VALID,
  ADD CONSTRAINT cronograma_baseline_anterior_fkey
    FOREIGN KEY (baseline_anterior_id) REFERENCES public.cronograma_baseline(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cronograma_baseline_lineage
  ON public.cronograma_baseline(baseline_anterior_id)
  WHERE baseline_anterior_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cronograma_baseline_obra_versao
  ON public.cronograma_baseline(tenant_id, obra_id, versao DESC);

COMMENT ON COLUMN public.cronograma_baseline.congelado_em IS
  'Instante de criação e aprovação do baseline; a V1 não separa rascunho de aprovação.';
COMMENT ON COLUMN public.cronograma_baseline.congelado_por IS
  'Autor da criação e aprovação do baseline; autoridade validada pela RPC.';
COMMENT ON COLUMN public.cronograma_baseline.hash IS
  'SHA-256 do domínio de prazo (formato + versão + JSONB canônico); não é hash financeiro.';
COMMENT ON COLUMN public.cronograma_baseline.baseline_anterior_id IS
  'Predecessor imutável. A vigência é derivada da maior versão da obra.';

-- Escrita exclusivamente pela operação transacional. Leitura continua sob RLS.
DROP POLICY IF EXISTS admin_insert ON public.cronograma_baseline;
DROP POLICY IF EXISTS super_admin_all ON public.cronograma_baseline;
DROP POLICY IF EXISTS super_admin_select ON public.cronograma_baseline;
CREATE POLICY super_admin_select ON public.cronograma_baseline
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

REVOKE INSERT, UPDATE, DELETE ON public.cronograma_baseline FROM authenticated;
GRANT SELECT ON public.cronograma_baseline TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cronograma_baseline TO service_role;

CREATE OR REPLACE FUNCTION public.cronograma_baseline_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Baseline de cronograma aprovado é imutável; crie uma nova versão'
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS trg_cronograma_baseline_immutable ON public.cronograma_baseline;
CREATE TRIGGER trg_cronograma_baseline_immutable
  BEFORE UPDATE OR DELETE ON public.cronograma_baseline
  FOR EACH ROW EXECUTE FUNCTION public.cronograma_baseline_immutable();

CREATE OR REPLACE FUNCTION public.build_cronograma_snapshot(
  _tenant_id uuid,
  _obra_id uuid
) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'tenant_id', _tenant_id,
    'obra_id', _obra_id,
    'atividades', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'nome', a.nome,
          'data_inicio', to_char(a.data_inicio, 'YYYY-MM-DD'),
          'data_fim', to_char(a.data_fim, 'YYYY-MM-DD'),
          'duracao_dias', (a.data_fim - a.data_inicio) + 1,
          'responsavel', a.responsavel,
          'ordem', a.ordem
        ) ORDER BY a.id
      )
      FROM public.atividades a
      WHERE a.tenant_id = _tenant_id
        AND a.obra_id = _obra_id
        AND a.deleted_at IS NULL
    ), '[]'::jsonb),
    'dependencias', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'predecessora_id', d.predecessora_id,
          'sucessora_id', d.sucessora_id,
          'tipo', d.tipo,
          'lag_dias', d.lag_dias
        ) ORDER BY d.predecessora_id, d.sucessora_id, d.tipo, d.lag_dias
      )
      FROM public.atividade_dependencias d
      JOIN public.atividades predecessora
        ON predecessora.id = d.predecessora_id
       AND predecessora.tenant_id = d.tenant_id
       AND predecessora.obra_id = d.obra_id
       AND predecessora.deleted_at IS NULL
      JOIN public.atividades sucessora
        ON sucessora.id = d.sucessora_id
       AND sucessora.tenant_id = d.tenant_id
       AND sucessora.obra_id = d.obra_id
       AND sucessora.deleted_at IS NULL
      WHERE d.tenant_id = _tenant_id AND d.obra_id = _obra_id
    ), '[]'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION public.hash_cronograma_snapshot(
  _snapshot jsonb,
  _formato text DEFAULT 'opera.atlas.schedule-baseline',
  _versao_formato integer DEFAULT 1,
  _algoritmo text DEFAULT 'SHA-256'
) RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions, pg_temp
AS $$
  SELECT CASE
    WHEN _algoritmo <> 'SHA-256' THEN NULL
    ELSE encode(extensions.digest(
      convert_to(_formato || ':v' || _versao_formato::text || ':' || _snapshot::text, 'UTF8'),
      'sha256'
    ), 'hex')
  END;
$$;

REVOKE ALL ON FUNCTION public.build_cronograma_snapshot(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hash_cronograma_snapshot(jsonb, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.build_cronograma_snapshot(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.hash_cronograma_snapshot(jsonb, text, integer, text) TO service_role;

CREATE OR REPLACE FUNCTION public.aprovar_baseline_cronograma(
  _obra_id uuid,
  _motivo text DEFAULT NULL,
  _correlation_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  _actor_id uuid := auth.uid();
  _tenant_id uuid;
  _snapshot jsonb;
  _hash text;
  _versao integer;
  _anterior public.cronograma_baseline%ROWTYPE;
  _baseline_id uuid;
  _congelado_em timestamptz;
  _corr uuid := COALESCE(_correlation_id, gen_random_uuid());
BEGIN
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  _tenant_id := public.get_user_tenant_id(_actor_id);
  IF _tenant_id IS NULL OR public.is_super_admin(_actor_id) THEN
    RAISE EXCEPTION 'Aprovação exige admin contextual de tenant' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_role(_actor_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas admin contextual pode aprovar baseline' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_has_obra_access(_actor_id, _obra_id) THEN
    RAISE EXCEPTION 'Acesso negado à obra' USING ERRCODE = '42501';
  END IF;

  -- Serializa aprovações concorrentes por obra sem depender de relógio do cliente.
  PERFORM 1 FROM public.obras
   WHERE id = _obra_id AND tenant_id = _tenant_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Obra não encontrada no tenant' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _anterior
  FROM public.cronograma_baseline
  WHERE tenant_id = _tenant_id AND obra_id = _obra_id
  ORDER BY versao DESC
  LIMIT 1;

  _versao := COALESCE(_anterior.versao, 0) + 1;
  _snapshot := public.build_cronograma_snapshot(_tenant_id, _obra_id);
  _hash := public.hash_cronograma_snapshot(_snapshot);

  INSERT INTO public.cronograma_baseline (
    tenant_id, obra_id, versao, congelado_por, snapshot_json, hash, motivo,
    formato_snapshot, versao_formato, algoritmo_hash, baseline_anterior_id
  ) VALUES (
    _tenant_id, _obra_id, _versao, _actor_id, _snapshot, _hash, NULLIF(btrim(_motivo), ''),
    'opera.atlas.schedule-baseline', 1, 'SHA-256', _anterior.id
  )
  RETURNING id, congelado_em INTO _baseline_id, _congelado_em;

  INSERT INTO public.audit_logs (
    user_id, tenant_id, action, target_type, target_id, correlation_id, metadata
  ) VALUES (
    _actor_id, _tenant_id, 'cronograma.baseline_aprovado', 'cronograma_baseline',
    _baseline_id::text, _corr,
    jsonb_build_object('obra_id', _obra_id, 'versao', _versao, 'hash', _hash,
      'baseline_anterior_id', _anterior.id)
  );

  INSERT INTO public.system_events (
    correlation_id, causation_id, tenant_id, obra_id, actor_id,
    event_type, source, status, severity, payload
  ) VALUES (
    _corr, _anterior.id, _tenant_id, _obra_id, _actor_id,
    'cronograma.baseline_aprovado', 'rpc.aprovar_baseline_cronograma', 'success', 'info',
    jsonb_build_object('baseline_id', _baseline_id, 'versao', _versao, 'hash', _hash,
      'baseline_anterior_id', _anterior.id)
  );

  RETURN jsonb_build_object(
    'ok', true, 'baseline_id', _baseline_id, 'versao', _versao,
    'hash', _hash, 'congelado_em', _congelado_em, 'correlation_id', _corr
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.listar_baselines_cronograma(_obra_id uuid)
RETURNS TABLE (
  id uuid,
  versao integer,
  aprovado_em timestamptz,
  aprovado_por uuid,
  aprovado_por_nome text,
  hash_snapshot text,
  vigente boolean,
  motivo text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _actor_id uuid := auth.uid();
  _tenant_id uuid;
BEGIN
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;
  IF public.is_super_admin(_actor_id) THEN
    SELECT o.tenant_id INTO _tenant_id FROM public.obras o WHERE o.id = _obra_id;
  ELSE
    _tenant_id := public.get_user_tenant_id(_actor_id);
    IF _tenant_id IS NULL OR NOT public.user_has_obra_access(_actor_id, _obra_id) THEN
      RAISE EXCEPTION 'Acesso negado à obra' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF _tenant_id IS NULL THEN
    RAISE EXCEPTION 'Obra não encontrada' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT b.id, b.versao, b.congelado_em, b.congelado_por,
         COALESCE(NULLIF(p.full_name, ''), p.email, b.congelado_por::text),
         b.hash, b.versao = max(b.versao) OVER (), b.motivo
  FROM public.cronograma_baseline b
  LEFT JOIN public.profiles p ON p.id = b.congelado_por
  WHERE b.tenant_id = _tenant_id AND b.obra_id = _obra_id
  ORDER BY b.versao DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.aprovar_baseline_cronograma(uuid, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.listar_baselines_cronograma(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aprovar_baseline_cronograma(uuid, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.listar_baselines_cronograma(uuid) TO authenticated, service_role;
