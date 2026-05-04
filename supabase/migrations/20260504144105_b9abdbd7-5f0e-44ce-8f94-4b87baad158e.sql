-- 1. Snapshot endurecido
CREATE OR REPLACE FUNCTION public.fn_snapshot_valor_diaria()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _val_colab numeric;
BEGIN
  IF NEW.valor_diaria_usado IS NULL OR NEW.valor_diaria_usado <= 0 THEN
    SELECT valor_diaria INTO _val_colab FROM public.colaboradores WHERE id = NEW.colaborador_id;
    NEW.valor_diaria_usado := COALESCE(NULLIF(NEW.valor_diaria_especial, 0), _val_colab, 0);
  END IF;
  RETURN NEW;
END; $$;

-- 2. Períodos fechados — RLS policy (dupla proteção com o trigger)
CREATE POLICY block_closed_periods_rp_insert ON public.registro_presencas
FOR INSERT TO authenticated WITH CHECK (
  is_super_admin(auth.uid()) OR NOT EXISTS (
    SELECT 1 FROM public.periodos_fechados pf
    WHERE pf.tenant_id = registro_presencas.tenant_id
      AND pf.obra_id = registro_presencas.obra_id
      AND pf.mes = date_trunc('month', registro_presencas.data)::date
      AND pf.reaberto_em IS NULL
  )
);

CREATE POLICY block_closed_periods_rp_update ON public.registro_presencas
FOR UPDATE TO authenticated USING (
  is_super_admin(auth.uid()) OR NOT EXISTS (
    SELECT 1 FROM public.periodos_fechados pf
    WHERE pf.tenant_id = registro_presencas.tenant_id
      AND pf.obra_id = registro_presencas.obra_id
      AND pf.mes = date_trunc('month', registro_presencas.data)::date
      AND pf.reaberto_em IS NULL
  )
);

CREATE POLICY block_closed_periods_rp_delete ON public.registro_presencas
FOR DELETE TO authenticated USING (
  is_super_admin(auth.uid()) OR NOT EXISTS (
    SELECT 1 FROM public.periodos_fechados pf
    WHERE pf.tenant_id = registro_presencas.tenant_id
      AND pf.obra_id = registro_presencas.obra_id
      AND pf.mes = date_trunc('month', registro_presencas.data)::date
      AND pf.reaberto_em IS NULL
  )
);

CREATE POLICY block_closed_periods_ad_insert ON public.apontamento_diarias
FOR INSERT TO authenticated WITH CHECK (
  is_super_admin(auth.uid()) OR NOT EXISTS (
    SELECT 1 FROM public.periodos_fechados pf
    WHERE pf.tenant_id = apontamento_diarias.tenant_id
      AND pf.obra_id = apontamento_diarias.obra_id
      AND pf.mes = date_trunc('month', apontamento_diarias.periodo_inicio)::date
      AND pf.reaberto_em IS NULL
  )
);

CREATE POLICY block_closed_periods_ad_update ON public.apontamento_diarias
FOR UPDATE TO authenticated USING (
  is_super_admin(auth.uid()) OR NOT EXISTS (
    SELECT 1 FROM public.periodos_fechados pf
    WHERE pf.tenant_id = apontamento_diarias.tenant_id
      AND pf.obra_id = apontamento_diarias.obra_id
      AND pf.mes = date_trunc('month', apontamento_diarias.periodo_inicio)::date
      AND pf.reaberto_em IS NULL
  )
);

CREATE POLICY block_closed_periods_ad_delete ON public.apontamento_diarias
FOR DELETE TO authenticated USING (
  is_super_admin(auth.uid()) OR NOT EXISTS (
    SELECT 1 FROM public.periodos_fechados pf
    WHERE pf.tenant_id = apontamento_diarias.tenant_id
      AND pf.obra_id = apontamento_diarias.obra_id
      AND pf.mes = date_trunc('month', apontamento_diarias.periodo_inicio)::date
      AND pf.reaberto_em IS NULL
  )
);

-- 3. folha_pagamento — validações reforçadas
CREATE OR REPLACE FUNCTION public.folha_pagamento(
  _obra_id uuid, _data_inicio date, _data_fim date, _colaborador_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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

  _hash := encode(digest(convert_to(jsonb_build_object(
    'rule_version', 'v1', 'obra_id', _obra_id,
    'periodo', jsonb_build_object('inicio', _data_inicio, 'fim', _data_fim),
    'colaborador_id', _colaborador_id, 'rows', _dados)::text, 'UTF8'), 'sha256'), 'hex');

  _result := jsonb_build_object(
    'rule_version', 'v1', 'obra_id', _obra_id, 'tenant_id', _tenant_id,
    'periodo', jsonb_build_object('inicio', _data_inicio, 'fim', _data_fim),
    'colaborador_id', _colaborador_id, 'gerado_em', now(), 'gerado_por', auth.uid(),
    'totais', _totais, 'rows', _dados, 'hash', _hash);
  RETURN _result;
END; $$;

-- 4. dashboard_aggregates — auth check + obra_access check
CREATE OR REPLACE FUNCTION public.dashboard_aggregates(
  _obra_id uuid DEFAULT NULL, _start date DEFAULT NULL, _end date DEFAULT CURRENT_DATE,
  _include_finance boolean DEFAULT true, _include_safety boolean DEFAULT false,
  _include_score_components boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _tenant_id uuid; _result jsonb := '{}'::jsonb;
  _financeiro jsonb; _presenca jsonb; _consumo jsonb; _incidentes jsonb;
  _capacidade jsonb; _safety jsonb; _score_comp jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RETURN '{}'::jsonb; END IF;
  _tenant_id := get_user_tenant_id(auth.uid());
  IF _tenant_id IS NULL THEN RETURN '{}'::jsonb; END IF;
  IF _obra_id IS NOT NULL AND NOT user_has_obra_access(auth.uid(), _obra_id) THEN
    RETURN '{}'::jsonb;
  END IF;

  _result := _result || jsonb_build_object('periodo', jsonb_build_object('inicio', _start, 'fim', _end));

  IF _include_finance THEN
    SELECT jsonb_build_object(
      'receita', COALESCE(SUM(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END), 0),
      'custo', COALESCE(SUM(CASE WHEN tipo = 'custo' THEN valor ELSE 0 END), 0),
      'saldo', COALESCE(SUM(CASE WHEN tipo = 'receita' THEN valor ELSE -valor END), 0),
      'pendentes', COALESCE(SUM(CASE WHEN status_pagamento = 'pendente' THEN valor ELSE 0 END), 0),
      'custo_retrabalho', COALESCE(SUM(CASE WHEN tipo = 'custo' AND lower(coalesce(descricao,'')) LIKE '%retrabalho%' THEN valor ELSE 0 END), 0)
    ) INTO _financeiro FROM lancamentos_financeiros
    WHERE tenant_id = _tenant_id AND deleted_at IS NULL
      AND (_obra_id IS NULL OR obra_id = _obra_id)
      AND (_start IS NULL OR data >= _start) AND data <= _end;
    _result := _result || jsonb_build_object('financeiro', COALESCE(_financeiro, '{}'::jsonb));
  END IF;

  SELECT jsonb_build_object(
    'total_diarias', COALESCE(SUM(fracao_diaria), 0),
    'faltas', COALESCE(SUM(CASE WHEN tipo = 'falta' THEN 1 ELSE 0 END), 0),
    'registros', COUNT(*)) INTO _presenca FROM registro_presencas
  WHERE tenant_id = _tenant_id AND (_obra_id IS NULL OR obra_id = _obra_id)
    AND (_start IS NULL OR data >= _start) AND data <= _end;
  _result := _result || jsonb_build_object('presenca', COALESCE(_presenca, '{}'::jsonb));

  SELECT jsonb_build_object(
    'previsto', COALESCE(SUM(previsto), 0),
    'real', COALESCE(SUM(real_consumo), 0),
    'desvio_pct', CASE WHEN COALESCE(SUM(previsto),0) > 0
      THEN ROUND(((SUM(real_consumo) - SUM(previsto)) / SUM(previsto) * 100)::numeric, 2) ELSE 0 END,
    'itens', COUNT(*)) INTO _consumo FROM consumo_materiais
  WHERE tenant_id = _tenant_id AND (_obra_id IS NULL OR obra_id = _obra_id)
    AND (_start IS NULL OR data_registro >= _start) AND data_registro <= _end;
  _result := _result || jsonb_build_object('consumo', COALESCE(_consumo, '{}'::jsonb));

  SELECT jsonb_build_object(
    'abertos', COALESCE(SUM(CASE WHEN status = 'aberto' THEN 1 ELSE 0 END), 0),
    'total', COUNT(*)) INTO _incidentes FROM incidentes_seguranca
  WHERE tenant_id = _tenant_id AND (_obra_id IS NULL OR obra_id = _obra_id)
    AND (_start IS NULL OR data >= _start) AND data <= _end;
  _result := _result || jsonb_build_object('incidentes', COALESCE(_incidentes, '{}'::jsonb));

  IF _obra_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'esperado_total', COALESCE(o.tamanho_equipe_esperada, 0),
      'eficiencia_pct', CASE WHEN COALESCE(o.tamanho_equipe_esperada,0) > 0
        THEN ROUND((COALESCE(SUM(rp.fracao_diaria),0) / NULLIF(o.tamanho_equipe_esperada,0) * 100)::numeric, 2)
        ELSE NULL END) INTO _capacidade FROM obras o
    LEFT JOIN registro_presencas rp ON rp.obra_id = o.id AND rp.data = _end
    WHERE o.id = _obra_id AND o.tenant_id = _tenant_id
    GROUP BY o.id, o.tamanho_equipe_esperada;
    _result := _result || jsonb_build_object('capacidade', COALESCE(_capacidade, '{}'::jsonb));
  END IF;

  IF _include_safety AND _obra_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'dias_sem_acidente', COALESCE(
        EXTRACT(DAY FROM (CURRENT_DATE - MAX(CASE WHEN tipo IN ('acidente','grave') THEN data END)))::int,
        EXTRACT(DAY FROM (CURRENT_DATE - MIN(data)))::int, 0),
      'incidentes_graves', COALESCE(SUM(CASE WHEN severidade = 'alta' THEN 1 ELSE 0 END), 0),
      'taxa_resolucao', CASE WHEN COUNT(*) > 0
        THEN ROUND((SUM(CASE WHEN status = 'resolvido' THEN 1 ELSE 0 END)::numeric / COUNT(*) * 100)::numeric, 2)
        ELSE 100 END,
      'indice_severidade', CASE WHEN COUNT(*) > 0
        THEN ROUND((SUM(CASE WHEN severidade = 'alta' THEN 3 WHEN severidade = 'media' THEN 2 ELSE 1 END)::numeric / COUNT(*))::numeric, 2)
        ELSE 0 END,
      'checklist_compliance', (SELECT CASE WHEN COUNT(*) > 0
          THEN ROUND((SUM(CASE WHEN verificado THEN 1 ELSE 0 END)::numeric / COUNT(*) * 100)::numeric, 2) ELSE 0 END
        FROM checklist_semanal WHERE tenant_id = _tenant_id AND obra_id = _obra_id
          AND (_start IS NULL OR semana >= _start) AND semana <= _end)
    ) INTO _safety FROM incidentes_seguranca
    WHERE tenant_id = _tenant_id AND obra_id = _obra_id
      AND (_start IS NULL OR data >= _start) AND data <= _end;
    _result := _result || jsonb_build_object('safety', COALESCE(_safety, '{}'::jsonb));
  END IF;

  IF _include_score_components AND _obra_id IS NOT NULL THEN
    _score_comp := jsonb_build_object(
      'organizacao', jsonb_build_object(
        'registros', (SELECT COUNT(*) FROM registros_diarios WHERE tenant_id = _tenant_id AND obra_id = _obra_id
          AND (_start IS NULL OR data_registro >= _start) AND data_registro <= _end),
        'producao_total', (SELECT COALESCE(SUM(producao_valor),0) FROM registros_diarios WHERE tenant_id = _tenant_id AND obra_id = _obra_id
          AND (_start IS NULL OR data_registro >= _start) AND data_registro <= _end)),
      'padronizacao', jsonb_build_object(
        'desvio_consumo_pct', COALESCE((_result->'consumo'->>'desvio_pct')::numeric, 0),
        'retrabalhos', (SELECT COALESCE(SUM(quantidade),0) FROM retrabalhos WHERE tenant_id = _tenant_id AND obra_id = _obra_id
          AND (_start IS NULL OR data_registro >= _start) AND data_registro <= _end)),
      'eficiencia', jsonb_build_object(
        'ativos_total', (SELECT COUNT(*) FROM ativos WHERE tenant_id = _tenant_id AND obra_id = _obra_id),
        'ativos_ok', (SELECT COUNT(*) FROM ativos WHERE tenant_id = _tenant_id AND obra_id = _obra_id AND status = 'ativo')),
      'reducao_perdas', jsonb_build_object(
        'riscos_total', (SELECT COUNT(*) FROM riscos WHERE tenant_id = _tenant_id AND obra_id = _obra_id),
        'riscos_altos', (SELECT COUNT(*) FROM riscos WHERE tenant_id = _tenant_id AND obra_id = _obra_id AND severidade = 'alta')),
      'analise', COALESCE(_financeiro, '{}'::jsonb));
    _result := _result || jsonb_build_object('score_components', _score_comp);
  END IF;

  RETURN _result;
END; $$;

-- 5. eficiencia_presenca — auth check
CREATE OR REPLACE FUNCTION public.eficiencia_presenca(_obra_id uuid, _data date DEFAULT CURRENT_DATE)
RETURNS TABLE(esperado integer, presente numeric, eficiencia numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(o.tamanho_equipe_esperada, 0) AS esperado,
    COALESCE(SUM(rp.fracao_diaria), 0) AS presente,
    CASE WHEN COALESCE(o.tamanho_equipe_esperada, 0) = 0 THEN NULL
      ELSE ROUND((COALESCE(SUM(rp.fracao_diaria), 0) / o.tamanho_equipe_esperada::numeric) * 100, 2) END AS eficiencia
  FROM public.obras o
  LEFT JOIN public.registro_presencas rp ON rp.obra_id = o.id AND rp.data = _data AND rp.tenant_id = o.tenant_id
  WHERE auth.uid() IS NOT NULL AND o.id = _obra_id
    AND o.tenant_id = get_user_tenant_id(auth.uid())
    AND user_has_obra_access(auth.uid(), o.id)
  GROUP BY o.id, o.tamanho_equipe_esperada;
$$;

-- 6. Colunas em periodos_fechados
ALTER TABLE public.periodos_fechados
  ADD COLUMN IF NOT EXISTS snapshot_json jsonb,
  ADD COLUMN IF NOT EXISTS pdf_url text;

-- 7. validar_fechamento
CREATE OR REPLACE FUNCTION public.validar_fechamento(_obra_id uuid, _data_inicio date, _data_fim date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _tenant_id uuid; _erros jsonb := '[]'::jsonb; _warnings jsonb := '[]'::jsonb;
  _count_presencas int; _count_zerados int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501'; END IF;
  _tenant_id := get_user_tenant_id(auth.uid());
  IF _tenant_id IS NULL THEN RAISE EXCEPTION 'Sem tenant' USING ERRCODE = '42501'; END IF;
  IF NOT user_has_obra_access(auth.uid(), _obra_id) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*) INTO _count_presencas FROM registro_presencas
  WHERE tenant_id = _tenant_id AND obra_id = _obra_id
    AND data BETWEEN _data_inicio AND _data_fim;

  IF _count_presencas = 0 THEN
    _warnings := _warnings || jsonb_build_array('Nenhuma presença registrada no período');
  END IF;

  SELECT COUNT(*) INTO _count_zerados FROM registro_presencas
  WHERE tenant_id = _tenant_id AND obra_id = _obra_id
    AND data BETWEEN _data_inicio AND _data_fim
    AND COALESCE(valor_diaria_usado, 0) = 0
    AND tipo NOT IN ('falta','falta_justificada','falta_injustificada','hora_extra');

  IF _count_zerados > 0 THEN
    _erros := _erros || jsonb_build_array(format('%s registros com valor_diaria_usado = 0', _count_zerados));
  END IF;

  IF EXISTS (SELECT 1 FROM periodos_fechados
    WHERE tenant_id = _tenant_id AND obra_id = _obra_id
      AND mes BETWEEN date_trunc('month', _data_inicio)::date AND date_trunc('month', _data_fim)::date
      AND reaberto_em IS NULL) THEN
    _erros := _erros || jsonb_build_array('Algum mês deste período já está fechado');
  END IF;

  RETURN jsonb_build_object(
    'ok', jsonb_array_length(_erros) = 0,
    'erros', _erros, 'warnings', _warnings,
    'stats', jsonb_build_object('total_presencas', _count_presencas, 'registros_zerados', _count_zerados));
END; $$;

-- 8. verificar_hash_periodo
CREATE OR REPLACE FUNCTION public.verificar_hash_periodo(_periodo_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _pf record; _resultado jsonb; _hash_atual text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501'; END IF;
  SELECT * INTO _pf FROM periodos_fechados WHERE id = _periodo_id;
  IF _pf IS NULL THEN RAISE EXCEPTION 'Período não encontrado'; END IF;
  IF _pf.tenant_id <> get_user_tenant_id(auth.uid()) AND NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  _resultado := folha_pagamento(_pf.obra_id, _pf.mes,
    (date_trunc('month', _pf.mes) + interval '1 month - 1 day')::date, NULL);
  _hash_atual := _resultado->>'hash';

  RETURN jsonb_build_object(
    'periodo_id', _periodo_id, 'mes', _pf.mes,
    'hash_original', _pf.hash_snapshot, 'hash_atual', _hash_atual,
    'integro', (_pf.hash_snapshot = _hash_atual),
    'verificado_em', now(), 'verificado_por', auth.uid());
END; $$;

-- 9. REVOKE EXECUTE de anon nas RPCs sensíveis
REVOKE EXECUTE ON FUNCTION public.folha_pagamento(uuid, date, date, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.validar_fechamento(uuid, date, date) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.verificar_hash_periodo(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.dashboard_aggregates(uuid, date, date, boolean, boolean, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.eficiencia_presenca(uuid, date) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.produtividade_por_equipe(uuid, date, date) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.folha_pagamento(uuid, date, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validar_fechamento(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verificar_hash_periodo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_aggregates(uuid, date, date, boolean, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.eficiencia_presenca(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.produtividade_por_equipe(uuid, date, date) TO authenticated;

-- 10. Recria view sem SECURITY DEFINER (security_invoker)
DROP VIEW IF EXISTS public.audit_logs_safe;
CREATE VIEW public.audit_logs_safe WITH (security_invoker = true) AS
SELECT id, table_name, row_id, operation, user_id, tenant_id, created_at,
  CASE WHEN old_data IS NOT NULL THEN public.jsonb_object_keys_count(old_data) ELSE 0 END AS old_fields_count,
  CASE WHEN new_data IS NOT NULL THEN public.jsonb_object_keys_count(new_data) ELSE 0 END AS new_fields_count
FROM public.audit_logs_db;
GRANT SELECT ON public.audit_logs_safe TO authenticated;