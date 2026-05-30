
-- =============================================================
-- OPERA_CORE v1.3 — Reabertura Formal de Períodos
-- =============================================================

-- 1) Versionamento em periodos_fechados
ALTER TABLE public.periodos_fechados
  ADD COLUMN IF NOT EXISTS versao integer NOT NULL DEFAULT 1;

-- Drop antigo unique (não inclui versao) se existir
ALTER TABLE public.periodos_fechados
  DROP CONSTRAINT IF EXISTS periodos_fechados_tenant_id_obra_id_mes_key;

-- Unique por versão
CREATE UNIQUE INDEX IF NOT EXISTS uq_periodos_fechados_versao
  ON public.periodos_fechados(tenant_id, obra_id, mes, versao);

-- Apenas uma versão ATIVA por (tenant, obra, mes)
CREATE UNIQUE INDEX IF NOT EXISTS uq_periodos_fechados_ativo
  ON public.periodos_fechados(tenant_id, obra_id, mes)
  WHERE reaberto_em IS NULL;

-- 2) Tabela append-only de reaberturas
CREATE TABLE IF NOT EXISTS public.periodos_reaberturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  obra_id uuid NOT NULL,
  mes date NOT NULL,
  versao_anterior integer NOT NULL,
  hash_anterior text NOT NULL,
  snapshot_anterior_json jsonb,
  reaberto_por uuid NOT NULL,
  reaberto_em timestamptz NOT NULL DEFAULT now(),
  motivo text NOT NULL,
  correlation_id uuid,
  causation_id uuid,
  refechado_em timestamptz,
  refechado_por uuid,
  versao_nova integer,
  hash_novo text,
  CONSTRAINT chk_pr_mes_dia1 CHECK (EXTRACT(day FROM mes) = 1),
  CONSTRAINT chk_pr_motivo_min CHECK (char_length(motivo) >= 20)
);

GRANT SELECT ON public.periodos_reaberturas TO authenticated;
GRANT ALL ON public.periodos_reaberturas TO service_role;

ALTER TABLE public.periodos_reaberturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY pr_select_admin ON public.periodos_reaberturas
  FOR SELECT TO authenticated
  USING (
    (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
    OR is_super_admin(auth.uid())
  );

CREATE POLICY pr_super_admin_all ON public.periodos_reaberturas
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Bloqueia INSERT/UPDATE/DELETE direto (apenas via RPCs SECURITY DEFINER)
-- Nenhuma policy INSERT/UPDATE/DELETE para 'authenticated' = bloqueado.

CREATE INDEX IF NOT EXISTS idx_pr_obra_mes
  ON public.periodos_reaberturas(tenant_id, obra_id, mes);

-- 3) RPC: reabrir_periodo
CREATE OR REPLACE FUNCTION public.reabrir_periodo(
  _obra_id uuid,
  _mes date,
  _motivo text,
  _correlation_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _tenant_id uuid;
  _pf RECORD;
  _reabertura_id uuid;
  _corr uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;
  _tenant_id := get_user_tenant_id(auth.uid());
  IF _tenant_id IS NULL THEN
    RAISE EXCEPTION 'Sem tenant' USING ERRCODE = '42501';
  END IF;
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas admin pode reabrir período' USING ERRCODE = '42501';
  END IF;
  IF NOT user_has_obra_access(auth.uid(), _obra_id) THEN
    RAISE EXCEPTION 'Acesso negado à obra' USING ERRCODE = '42501';
  END IF;
  IF _motivo IS NULL OR char_length(trim(_motivo)) < 20 THEN
    RAISE EXCEPTION 'Motivo da reabertura deve ter pelo menos 20 caracteres';
  END IF;

  _corr := COALESCE(_correlation_id, gen_random_uuid());
  PERFORM set_config('app.correlation_id', _corr::text, true);

  -- Normaliza mes para dia 1
  _mes := date_trunc('month', _mes)::date;

  -- Busca versão ativa
  SELECT * INTO _pf
  FROM periodos_fechados
  WHERE tenant_id = _tenant_id
    AND obra_id = _obra_id
    AND mes = _mes
    AND reaberto_em IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nenhum fechamento ativo encontrado para % nesta obra', to_char(_mes, 'YYYY-MM');
  END IF;

  -- Grava reabertura (append-only)
  INSERT INTO periodos_reaberturas (
    tenant_id, obra_id, mes, versao_anterior, hash_anterior,
    snapshot_anterior_json, reaberto_por, motivo, correlation_id
  ) VALUES (
    _tenant_id, _obra_id, _mes, _pf.versao, _pf.hash_snapshot,
    _pf.snapshot_json, auth.uid(), trim(_motivo), _corr
  ) RETURNING id INTO _reabertura_id;

  -- Marca versão como reaberta
  UPDATE periodos_fechados
  SET reaberto_em = now(),
      reaberto_por = auth.uid(),
      motivo_reabertura = trim(_motivo)
  WHERE id = _pf.id;

  -- Log estruturado
  INSERT INTO audit_logs (user_id, tenant_id, action, target_type, target_id, correlation_id, metadata)
  VALUES (auth.uid(), _tenant_id, 'periodo.reaberto', 'periodos_fechados', _pf.id::text, _corr,
    jsonb_build_object('obra_id', _obra_id, 'mes', _mes, 'versao', _pf.versao,
                       'hash_anterior', _pf.hash_snapshot, 'reabertura_id', _reabertura_id));

  BEGIN
    INSERT INTO system_events (event_type, source, correlation_id, causation_id, tenant_id, user_id, payload)
    VALUES ('periodo.reaberto', 'rpc.reabrir_periodo', _corr, NULL, _tenant_id, auth.uid(),
      jsonb_build_object('obra_id', _obra_id, 'mes', _mes, 'versao_anterior', _pf.versao,
                         'hash_anterior', _pf.hash_snapshot, 'reabertura_id', _reabertura_id));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'reabertura_id', _reabertura_id,
    'versao_anterior', _pf.versao,
    'hash_anterior', _pf.hash_snapshot,
    'correlation_id', _corr
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.reabrir_periodo(uuid, date, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reabrir_periodo(uuid, date, text, uuid) TO authenticated;

-- 4) RPC: refechar_periodo
CREATE OR REPLACE FUNCTION public.refechar_periodo(
  _obra_id uuid,
  _mes date,
  _reabertura_id uuid,
  _correlation_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _tenant_id uuid;
  _reab RECORD;
  _validacao jsonb;
  _data_inicio date; _data_fim date;
  _folha jsonb; _novo_hash text; _nova_versao integer; _novo_pf_id uuid;
  _corr uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;
  _tenant_id := get_user_tenant_id(auth.uid());
  IF _tenant_id IS NULL THEN
    RAISE EXCEPTION 'Sem tenant' USING ERRCODE = '42501';
  END IF;
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas admin pode refechar período' USING ERRCODE = '42501';
  END IF;
  IF NOT user_has_obra_access(auth.uid(), _obra_id) THEN
    RAISE EXCEPTION 'Acesso negado à obra' USING ERRCODE = '42501';
  END IF;

  _mes := date_trunc('month', _mes)::date;
  _corr := COALESCE(_correlation_id, gen_random_uuid());
  PERFORM set_config('app.correlation_id', _corr::text, true);
  PERFORM set_config('app.causation_id', _reabertura_id::text, true);

  SELECT * INTO _reab FROM periodos_reaberturas
  WHERE id = _reabertura_id AND tenant_id = _tenant_id AND obra_id = _obra_id AND mes = _mes
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reabertura não encontrada';
  END IF;
  IF _reab.refechado_em IS NOT NULL THEN
    RAISE EXCEPTION 'Esta reabertura já foi refechada';
  END IF;

  _data_inicio := _mes;
  _data_fim := (_mes + interval '1 month' - interval '1 day')::date;

  -- Valida (status_contabil = prevista bloqueia, etc.)
  _validacao := public.validar_fechamento(_obra_id, _data_inicio, _data_fim);
  IF NOT (_validacao->>'ok')::boolean THEN
    RAISE EXCEPTION 'Validação falhou: %', _validacao->'erros';
  END IF;

  -- Recalcula folha + hash
  _folha := public.folha_pagamento(_obra_id, _data_inicio, _data_fim);
  _novo_hash := _folha->>'hash';
  IF _novo_hash IS NULL THEN
    RAISE EXCEPTION 'Falha ao gerar hash da folha';
  END IF;

  _nova_versao := _reab.versao_anterior + 1;

  -- Nova versão ativa
  INSERT INTO periodos_fechados (
    tenant_id, obra_id, mes, fechado_por, hash_snapshot, motivo, snapshot_json, versao
  ) VALUES (
    _tenant_id, _obra_id, _mes, auth.uid(), _novo_hash,
    format('Refechamento após reabertura (%s)', to_char(now(), 'YYYY-MM-DD HH24:MI')),
    _folha, _nova_versao
  ) RETURNING id INTO _novo_pf_id;

  -- Atualiza reabertura
  UPDATE periodos_reaberturas
  SET refechado_em = now(),
      refechado_por = auth.uid(),
      versao_nova = _nova_versao,
      hash_novo = _novo_hash,
      causation_id = COALESCE(causation_id, _reab.correlation_id)
  WHERE id = _reabertura_id;

  INSERT INTO audit_logs (user_id, tenant_id, action, target_type, target_id, correlation_id, causation_id, metadata)
  VALUES (auth.uid(), _tenant_id, 'periodo.refechado', 'periodos_fechados', _novo_pf_id::text, _corr, _reab.correlation_id,
    jsonb_build_object('obra_id', _obra_id, 'mes', _mes, 'versao_nova', _nova_versao,
                       'hash_novo', _novo_hash, 'hash_anterior', _reab.hash_anterior,
                       'reabertura_id', _reabertura_id));

  BEGIN
    INSERT INTO system_events (event_type, source, correlation_id, causation_id, tenant_id, user_id, payload)
    VALUES ('periodo.refechado', 'rpc.refechar_periodo', _corr, _reab.correlation_id, _tenant_id, auth.uid(),
      jsonb_build_object('obra_id', _obra_id, 'mes', _mes, 'reabertura_id', _reabertura_id,
                         'versao_nova', _nova_versao, 'hash_novo', _novo_hash));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'periodo_fechado_id', _novo_pf_id,
    'versao_nova', _nova_versao,
    'hash_novo', _novo_hash,
    'correlation_id', _corr
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.refechar_periodo(uuid, date, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refechar_periodo(uuid, date, uuid, uuid) TO authenticated;

-- 5) RPC: listar_historico_periodo
CREATE OR REPLACE FUNCTION public.listar_historico_periodo(
  _obra_id uuid,
  _mes date
) RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _tenant_id uuid;
  _versoes jsonb;
  _reaberturas jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;
  _tenant_id := get_user_tenant_id(auth.uid());
  IF NOT user_has_obra_access(auth.uid(), _obra_id) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  _mes := date_trunc('month', _mes)::date;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'versao', versao, 'hash', hash_snapshot,
    'fechado_em', fechado_em, 'fechado_por', fechado_por, 'motivo', motivo,
    'reaberto_em', reaberto_em, 'reaberto_por', reaberto_por, 'motivo_reabertura', motivo_reabertura,
    'ativo', (reaberto_em IS NULL)
  ) ORDER BY versao), '[]'::jsonb) INTO _versoes
  FROM periodos_fechados
  WHERE tenant_id = _tenant_id AND obra_id = _obra_id AND mes = _mes;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'versao_anterior', versao_anterior, 'hash_anterior', hash_anterior,
    'reaberto_em', reaberto_em, 'reaberto_por', reaberto_por, 'motivo', motivo,
    'correlation_id', correlation_id,
    'refechado_em', refechado_em, 'refechado_por', refechado_por,
    'versao_nova', versao_nova, 'hash_novo', hash_novo,
    'pendente_refechamento', (refechado_em IS NULL)
  ) ORDER BY reaberto_em), '[]'::jsonb) INTO _reaberturas
  FROM periodos_reaberturas
  WHERE tenant_id = _tenant_id AND obra_id = _obra_id AND mes = _mes;

  RETURN jsonb_build_object(
    'obra_id', _obra_id, 'mes', _mes,
    'versoes', _versoes, 'reaberturas', _reaberturas
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.listar_historico_periodo(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_historico_periodo(uuid, date) TO authenticated;
