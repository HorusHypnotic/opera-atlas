-- =====================================================================
-- Expansão dashboard_aggregates: modular com flags + novos domínios
-- Coordenadas: RPC modular, componentes para Score, paralelo com legacy
-- =====================================================================

-- 1) Substituir dashboard_aggregates com flags opcionais
DROP FUNCTION IF EXISTS public.dashboard_aggregates(uuid, date, date);

CREATE OR REPLACE FUNCTION public.dashboard_aggregates(
  _obra_id uuid DEFAULT NULL,
  _start date DEFAULT NULL,
  _end date DEFAULT CURRENT_DATE,
  _include_finance boolean DEFAULT true,
  _include_safety boolean DEFAULT false,
  _include_score_components boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant_id uuid;
  _result jsonb := '{}'::jsonb;
  _financeiro jsonb;
  _presenca jsonb;
  _consumo jsonb;
  _incidentes jsonb;
  _capacidade jsonb;
  _safety jsonb;
  _score_comp jsonb;
BEGIN
  _tenant_id := get_user_tenant_id(auth.uid());
  IF _tenant_id IS NULL THEN RETURN '{}'::jsonb; END IF;

  -- Período sempre presente no payload (auditoria)
  _result := _result || jsonb_build_object(
    'periodo', jsonb_build_object('inicio', _start, 'fim', _end)
  );

  -- ---------- FINANCEIRO (sempre por padrão) ----------
  IF _include_finance THEN
    SELECT jsonb_build_object(
      'receita', COALESCE(SUM(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END), 0),
      'custo', COALESCE(SUM(CASE WHEN tipo = 'custo' THEN valor ELSE 0 END), 0),
      'saldo', COALESCE(SUM(CASE WHEN tipo = 'receita' THEN valor ELSE -valor END), 0),
      'pendentes', COALESCE(SUM(CASE WHEN status_pagamento = 'pendente' THEN valor ELSE 0 END), 0),
      'custo_retrabalho', COALESCE(SUM(CASE WHEN tipo = 'custo' AND lower(coalesce(descricao,'')) LIKE '%retrabalho%' THEN valor ELSE 0 END), 0)
    ) INTO _financeiro
    FROM lancamentos_financeiros
    WHERE tenant_id = _tenant_id
      AND deleted_at IS NULL
      AND (_obra_id IS NULL OR obra_id = _obra_id)
      AND (_start IS NULL OR data >= _start)
      AND data <= _end;

    _result := _result || jsonb_build_object('financeiro', COALESCE(_financeiro, '{}'::jsonb));
  END IF;

  -- ---------- PRESENÇA (sempre — barato) ----------
  SELECT jsonb_build_object(
    'total_diarias', COALESCE(SUM(fracao_diaria), 0),
    'faltas', COALESCE(SUM(CASE WHEN tipo = 'falta' THEN 1 ELSE 0 END), 0),
    'registros', COUNT(*)
  ) INTO _presenca
  FROM registro_presencas
  WHERE tenant_id = _tenant_id
    AND (_obra_id IS NULL OR obra_id = _obra_id)
    AND (_start IS NULL OR data >= _start)
    AND data <= _end;
  _result := _result || jsonb_build_object('presenca', COALESCE(_presenca, '{}'::jsonb));

  -- ---------- CONSUMO ----------
  SELECT jsonb_build_object(
    'previsto', COALESCE(SUM(previsto), 0),
    'real', COALESCE(SUM(real_consumo), 0),
    'desvio_pct', CASE WHEN COALESCE(SUM(previsto),0) > 0
      THEN ROUND(((SUM(real_consumo) - SUM(previsto)) / SUM(previsto) * 100)::numeric, 2)
      ELSE 0 END,
    'itens', COUNT(*)
  ) INTO _consumo
  FROM consumo_materiais
  WHERE tenant_id = _tenant_id
    AND (_obra_id IS NULL OR obra_id = _obra_id)
    AND (_start IS NULL OR data_registro >= _start)
    AND data_registro <= _end;
  _result := _result || jsonb_build_object('consumo', COALESCE(_consumo, '{}'::jsonb));

  -- ---------- INCIDENTES (header) ----------
  SELECT jsonb_build_object(
    'abertos', COALESCE(SUM(CASE WHEN status = 'aberto' THEN 1 ELSE 0 END), 0),
    'total', COUNT(*)
  ) INTO _incidentes
  FROM incidentes_seguranca
  WHERE tenant_id = _tenant_id
    AND (_obra_id IS NULL OR obra_id = _obra_id)
    AND (_start IS NULL OR data >= _start)
    AND data <= _end;
  _result := _result || jsonb_build_object('incidentes', COALESCE(_incidentes, '{}'::jsonb));

  -- ---------- CAPACIDADE (precisa de obra) ----------
  IF _obra_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'esperado_total', COALESCE(o.tamanho_equipe_esperada, 0),
      'eficiencia_pct', CASE WHEN COALESCE(o.tamanho_equipe_esperada,0) > 0
        THEN ROUND((COALESCE(SUM(rp.fracao_diaria),0) / NULLIF(o.tamanho_equipe_esperada,0) * 100)::numeric, 2)
        ELSE NULL END
    ) INTO _capacidade
    FROM obras o
    LEFT JOIN registro_presencas rp ON rp.obra_id = o.id AND rp.data = _end
    WHERE o.id = _obra_id AND o.tenant_id = _tenant_id
    GROUP BY o.id, o.tamanho_equipe_esperada;
    _result := _result || jsonb_build_object('capacidade', COALESCE(_capacidade, '{}'::jsonb));
  END IF;

  -- ---------- SAFETY (opt-in) ----------
  IF _include_safety AND _obra_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'dias_sem_acidente', COALESCE(
        EXTRACT(DAY FROM (CURRENT_DATE - MAX(CASE WHEN tipo IN ('acidente','grave') THEN data END)))::int,
        EXTRACT(DAY FROM (CURRENT_DATE - MIN(data)))::int,
        0),
      'incidentes_graves', COALESCE(SUM(CASE WHEN severidade = 'alta' THEN 1 ELSE 0 END), 0),
      'taxa_resolucao', CASE WHEN COUNT(*) > 0
        THEN ROUND((SUM(CASE WHEN status = 'resolvido' THEN 1 ELSE 0 END)::numeric / COUNT(*) * 100)::numeric, 2)
        ELSE 100 END,
      'indice_severidade', CASE WHEN COUNT(*) > 0
        THEN ROUND((SUM(CASE WHEN severidade = 'alta' THEN 3 WHEN severidade = 'media' THEN 2 ELSE 1 END)::numeric / COUNT(*))::numeric, 2)
        ELSE 0 END,
      'checklist_compliance', (
        SELECT CASE WHEN COUNT(*) > 0
          THEN ROUND((SUM(CASE WHEN verificado THEN 1 ELSE 0 END)::numeric / COUNT(*) * 100)::numeric, 2)
          ELSE 0 END
        FROM checklist_semanal
        WHERE tenant_id = _tenant_id AND obra_id = _obra_id
          AND (_start IS NULL OR semana >= _start) AND semana <= _end
      )
    ) INTO _safety
    FROM incidentes_seguranca
    WHERE tenant_id = _tenant_id AND obra_id = _obra_id
      AND (_start IS NULL OR data >= _start) AND data <= _end;
    _result := _result || jsonb_build_object('safety', COALESCE(_safety, '{}'::jsonb));
  END IF;

  -- ---------- SCORE COMPONENTS (opt-in — bruto, client compõe pesos) ----------
  IF _include_score_components AND _obra_id IS NOT NULL THEN
    _score_comp := jsonb_build_object(
      'organizacao', jsonb_build_object(
        'registros', (SELECT COUNT(*) FROM registros_diarios
          WHERE tenant_id = _tenant_id AND obra_id = _obra_id
          AND (_start IS NULL OR data_registro >= _start) AND data_registro <= _end),
        'producao_total', (SELECT COALESCE(SUM(producao_valor),0) FROM registros_diarios
          WHERE tenant_id = _tenant_id AND obra_id = _obra_id
          AND (_start IS NULL OR data_registro >= _start) AND data_registro <= _end)
      ),
      'padronizacao', jsonb_build_object(
        'desvio_consumo_pct', COALESCE((_result->'consumo'->>'desvio_pct')::numeric, 0),
        'retrabalhos', (SELECT COALESCE(SUM(quantidade),0) FROM retrabalhos
          WHERE tenant_id = _tenant_id AND obra_id = _obra_id
          AND (_start IS NULL OR data_registro >= _start) AND data_registro <= _end)
      ),
      'eficiencia', jsonb_build_object(
        'ativos_total', (SELECT COUNT(*) FROM ativos WHERE tenant_id = _tenant_id AND obra_id = _obra_id),
        'ativos_ok', (SELECT COUNT(*) FROM ativos WHERE tenant_id = _tenant_id AND obra_id = _obra_id AND status = 'ativo')
      ),
      'reducao_perdas', jsonb_build_object(
        'riscos_total', (SELECT COUNT(*) FROM riscos WHERE tenant_id = _tenant_id AND obra_id = _obra_id),
        'riscos_altos', (SELECT COUNT(*) FROM riscos WHERE tenant_id = _tenant_id AND obra_id = _obra_id AND severidade = 'alta')
      ),
      'analise', COALESCE(_financeiro, '{}'::jsonb)
    );
    _result := _result || jsonb_build_object('score_components', _score_comp);
  END IF;

  RETURN _result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_aggregates(uuid, date, date, boolean, boolean, boolean) TO authenticated;