-- Fix crítico: qualificar extensions.digest() pois search_path = 'public' não enxerga schema extensions
CREATE OR REPLACE FUNCTION public.folha_pagamento(_obra_id uuid, _data_inicio date, _data_fim date, _colaborador_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tenant_id uuid; _result jsonb; _dados jsonb; _hash text; _totais jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501'; END IF;
  _tenant_id := get_user_tenant_id(auth.uid());
  IF _tenant_id IS NULL THEN RAISE EXCEPTION 'Sem tenant' USING ERRCODE = '42501'; END IF;
  IF _obra_id IS NULL OR _data_inicio IS NULL OR _data_fim IS NULL THEN
    RAISE EXCEPTION 'Parâmetros obrigatórios ausentes';
  END IF;
  IF _data_fim < _data_inicio THEN RAISE EXCEPTION 'data_fim < data_inicio'; END IF;
  IF (_data_fim - _data_inicio) > 366 THEN RAISE EXCEPTION 'Período máximo: 366 dias'; END IF;
  IF NOT EXISTS (SELECT 1 FROM obras WHERE id = _obra_id AND tenant_id = _tenant_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Obra inválida' USING ERRCODE = '42501';
  END IF;
  IF NOT user_has_obra_access(auth.uid(), _obra_id) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  WITH presencas AS (
    SELECT p.id, p.colaborador_id, p.data, p.tipo, p.fracao_diaria, p.valor_diaria_usado,
      ROUND((p.fracao_diaria * COALESCE(p.valor_diaria_usado, 0))::numeric, 2) AS valor
    FROM registro_presencas p
    WHERE p.tenant_id = _tenant_id AND p.obra_id = _obra_id
      AND p.data BETWEEN _data_inicio AND _data_fim
      AND (_colaborador_id IS NULL OR p.colaborador_id = _colaborador_id)
      AND p.tipo NOT IN ('falta','falta_justificada','falta_injustificada','hora_extra')
  ),
  ajustes AS (
    SELECT a.id, a.colaborador_id, a.periodo_inicio, a.periodo_fim, a.tipo,
      a.quantidade_diarias, a.valor_diaria,
      ROUND((a.quantidade_diarias * a.valor_diaria)::numeric, 2) AS valor
    FROM apontamento_diarias a
    WHERE a.tenant_id = _tenant_id AND a.obra_id = _obra_id AND a.deleted_at IS NULL
      AND a.periodo_fim >= _data_inicio AND a.periodo_inicio <= _data_fim
      AND (_colaborador_id IS NULL OR a.colaborador_id = _colaborador_id)
  ),
  consolidado AS (
    SELECT c.id AS colaborador_id, c.nome,
      COALESCE((SELECT SUM(p.fracao_diaria) FROM presencas p WHERE p.colaborador_id = c.id), 0) AS qtd_presenca,
      COALESCE((SELECT SUM(p.valor) FROM presencas p WHERE p.colaborador_id = c.id), 0) AS valor_presenca,
      COALESCE((SELECT SUM(a.quantidade_diarias) FROM ajustes a WHERE a.colaborador_id = c.id AND a.tipo <> 'legacy_historico'), 0) AS qtd_ajuste,
      COALESCE((SELECT SUM(a.valor) FROM ajustes a WHERE a.colaborador_id = c.id AND a.tipo <> 'legacy_historico'), 0) AS valor_ajuste,
      COALESCE((SELECT SUM(a.valor) FROM ajustes a WHERE a.colaborador_id = c.id AND a.tipo = 'legacy_historico'), 0) AS valor_legado
    FROM colaboradores c
    WHERE c.tenant_id = _tenant_id AND c.deleted_at IS NULL
      AND (_colaborador_id IS NULL OR c.id = _colaborador_id)
      AND (EXISTS (SELECT 1 FROM presencas p WHERE p.colaborador_id = c.id)
        OR EXISTS (SELECT 1 FROM ajustes a WHERE a.colaborador_id = c.id))
  ),
  linhas AS (
    SELECT jsonb_build_object(
      'colaborador_id', co.colaborador_id, 'nome', co.nome,
      'qtd_presenca', co.qtd_presenca, 'valor_presenca', co.valor_presenca,
      'qtd_ajuste', co.qtd_ajuste, 'valor_ajuste', co.valor_ajuste,
      'valor_legado', co.valor_legado,
      'valor_total', ROUND((co.valor_presenca + co.valor_ajuste + co.valor_legado)::numeric, 2),
      'breakdown', jsonb_build_object(
        'presencas', COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'data', p.data, 'tipo', p.tipo, 'fracao', p.fracao_diaria,
          'valor_diaria', p.valor_diaria_usado, 'valor', p.valor) ORDER BY p.data, p.id)
          FROM presencas p WHERE p.colaborador_id = co.colaborador_id), '[]'::jsonb),
        'ajustes', COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'inicio', a.periodo_inicio, 'fim', a.periodo_fim, 'tipo', a.tipo,
          'quantidade', a.quantidade_diarias, 'valor_diaria', a.valor_diaria, 'valor', a.valor) ORDER BY a.periodo_inicio, a.id)
          FROM ajustes a WHERE a.colaborador_id = co.colaborador_id), '[]'::jsonb)
      )
    ) AS linha, co.nome AS sort_nome, co.colaborador_id AS sort_id
    FROM consolidado co
  ),
  ordered AS (SELECT COALESCE(jsonb_agg(linha ORDER BY sort_nome, sort_id), '[]'::jsonb) AS data FROM linhas),
  totais_calc AS (
    SELECT jsonb_build_object(
      'qtd_presenca_total', COALESCE(SUM((l->>'qtd_presenca')::numeric), 0),
      'valor_presenca_total', COALESCE(SUM((l->>'valor_presenca')::numeric), 0),
      'qtd_ajuste_total', COALESCE(SUM((l->>'qtd_ajuste')::numeric), 0),
      'valor_ajuste_total', COALESCE(SUM((l->>'valor_ajuste')::numeric), 0),
      'valor_legado_total', COALESCE(SUM((l->>'valor_legado')::numeric), 0),
      'valor_total_geral', COALESCE(SUM((l->>'valor_total')::numeric), 0),
      'colaboradores_count', COUNT(*)
    ) AS t FROM jsonb_array_elements((SELECT data FROM ordered)) l
  )
  SELECT data, t INTO _dados, _totais FROM ordered, totais_calc;

  -- FIX: qualificar extensions.digest pois search_path = 'public' não enxerga schema extensions
  _hash := encode(extensions.digest(convert_to(jsonb_build_object(
    'rule_version', 'v1', 'obra_id', _obra_id,
    'periodo', jsonb_build_object('inicio', _data_inicio, 'fim', _data_fim),
    'colaborador_id', _colaborador_id, 'rows', _dados)::text, 'UTF8'), 'sha256'), 'hex');

  _result := jsonb_build_object(
    'rule_version', 'v1', 'obra_id', _obra_id, 'tenant_id', _tenant_id,
    'periodo', jsonb_build_object('inicio', _data_inicio, 'fim', _data_fim),
    'colaborador_id', _colaborador_id, 'gerado_em', now(), 'gerado_por', auth.uid(),
    'totais', _totais, 'rows', _dados, 'hash', _hash);
  RETURN _result;
END; $function$;

-- verificar_hash_periodo já chama folha_pagamento, então herda o fix.
-- Sem mudanças adicionais necessárias.