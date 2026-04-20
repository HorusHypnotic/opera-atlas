-- 1. Capacidade planejada na obra
ALTER TABLE public.obras
  ADD COLUMN IF NOT EXISTS tamanho_equipe_esperada integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.obras.tamanho_equipe_esperada IS 'Quantidade de colaboradores planejados/esperados para a obra. Usado para calcular Eficiência de Presença.';

-- 2. Equipe nos registros diários (vínculo leve produção <-> mão de obra)
ALTER TABLE public.registros_diarios
  ADD COLUMN IF NOT EXISTS equipe text;

CREATE INDEX IF NOT EXISTS idx_registros_diarios_equipe
  ON public.registros_diarios(obra_id, equipe, data_registro);

COMMENT ON COLUMN public.registros_diarios.equipe IS 'Nome/identificador da equipe responsável pelo registro de produção. Permite produtividade por equipe.';

-- 3. RPC: Eficiência de Presença (capacidade real vs esperada)
CREATE OR REPLACE FUNCTION public.eficiencia_presenca(
  _obra_id uuid,
  _data date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  esperado integer,
  presente numeric,
  eficiencia numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(o.tamanho_equipe_esperada, 0) AS esperado,
    COALESCE(SUM(rp.fracao_diaria), 0) AS presente,
    CASE
      WHEN COALESCE(o.tamanho_equipe_esperada, 0) = 0 THEN NULL
      ELSE ROUND((COALESCE(SUM(rp.fracao_diaria), 0) / o.tamanho_equipe_esperada::numeric) * 100, 2)
    END AS eficiencia
  FROM public.obras o
  LEFT JOIN public.registro_presencas rp
    ON rp.obra_id = o.id
   AND rp.data = _data
   AND rp.tenant_id = o.tenant_id
  WHERE o.id = _obra_id
    AND o.tenant_id = get_user_tenant_id(auth.uid())
    AND user_has_obra_access(auth.uid(), o.id)
  GROUP BY o.id, o.tamanho_equipe_esperada;
$$;

GRANT EXECUTE ON FUNCTION public.eficiencia_presenca(uuid, date) TO authenticated;

-- 4. RPC: Produtividade por equipe (vínculo produção x presença)
CREATE OR REPLACE FUNCTION public.produtividade_por_equipe(
  _obra_id uuid,
  _start date DEFAULT (CURRENT_DATE - INTERVAL '30 days')::date,
  _end date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  equipe text,
  registros bigint,
  dias_trabalhados bigint,
  producao_total numeric,
  producao_media_dia numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(rd.equipe, COALESCE(rd.atividade, 'Sem equipe')) AS equipe,
    COUNT(*)::bigint AS registros,
    COUNT(DISTINCT rd.data_registro)::bigint AS dias_trabalhados,
    COALESCE(SUM(
      CASE
        WHEN rd.producao ~ '^[0-9]+(\.[0-9]+)?$' THEN rd.producao::numeric
        ELSE 0
      END
    ), 0) AS producao_total,
    CASE
      WHEN COUNT(DISTINCT rd.data_registro) = 0 THEN 0
      ELSE ROUND(
        COALESCE(SUM(
          CASE
            WHEN rd.producao ~ '^[0-9]+(\.[0-9]+)?$' THEN rd.producao::numeric
            ELSE 0
          END
        ), 0) / COUNT(DISTINCT rd.data_registro)::numeric, 2
      )
    END AS producao_media_dia
  FROM public.registros_diarios rd
  WHERE rd.obra_id = _obra_id
    AND rd.tenant_id = get_user_tenant_id(auth.uid())
    AND rd.data_registro BETWEEN _start AND _end
    AND user_has_obra_access(auth.uid(), rd.obra_id)
  GROUP BY COALESCE(rd.equipe, COALESCE(rd.atividade, 'Sem equipe'))
  ORDER BY producao_total DESC;
$$;

GRANT EXECUTE ON FUNCTION public.produtividade_por_equipe(uuid, date, date) TO authenticated;

-- 5. RPC: Dashboard aggregates (1 round-trip ao invés de 12)
CREATE OR REPLACE FUNCTION public.dashboard_aggregates(
  _obra_id uuid DEFAULT NULL,
  _start date DEFAULT (CURRENT_DATE - INTERVAL '30 days')::date,
  _end date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant uuid := get_user_tenant_id(auth.uid());
  _result jsonb;
BEGIN
  IF _tenant IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  WITH
  fin AS (
    SELECT
      COALESCE(SUM(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END), 0) AS receita,
      COALESCE(SUM(CASE WHEN tipo = 'custo' THEN valor ELSE 0 END), 0) AS custo,
      COUNT(*) FILTER (WHERE status_pagamento = 'pendente') AS pendentes
    FROM public.lancamentos_financeiros
    WHERE tenant_id = _tenant
      AND deleted_at IS NULL
      AND data BETWEEN _start AND _end
      AND (_obra_id IS NULL OR obra_id = _obra_id)
  ),
  pres AS (
    SELECT
      COALESCE(SUM(fracao_diaria), 0) AS total_diarias,
      COUNT(*) FILTER (WHERE tipo = 'falta') AS faltas,
      COUNT(*) AS total_registros
    FROM public.registro_presencas
    WHERE tenant_id = _tenant
      AND data BETWEEN _start AND _end
      AND (_obra_id IS NULL OR obra_id = _obra_id)
  ),
  cons AS (
    SELECT
      COALESCE(SUM(previsto), 0) AS previsto,
      COALESCE(SUM(real_consumo), 0) AS real,
      COUNT(*) AS itens
    FROM public.consumo_materiais
    WHERE tenant_id = _tenant
      AND data_registro BETWEEN _start AND _end
      AND (_obra_id IS NULL OR obra_id = _obra_id)
  ),
  inc AS (
    SELECT
      COUNT(*) FILTER (WHERE status = 'aberto') AS abertos,
      COUNT(*) AS total
    FROM public.incidentes_seguranca
    WHERE tenant_id = _tenant
      AND data BETWEEN _start AND _end
      AND (_obra_id IS NULL OR obra_id = _obra_id)
  ),
  cap AS (
    SELECT
      COALESCE(SUM(o.tamanho_equipe_esperada), 0) AS esperado_total
    FROM public.obras o
    WHERE o.tenant_id = _tenant
      AND o.deleted_at IS NULL
      AND (_obra_id IS NULL OR o.id = _obra_id)
  )
  SELECT jsonb_build_object(
    'periodo', jsonb_build_object('inicio', _start, 'fim', _end),
    'financeiro', jsonb_build_object(
      'receita', fin.receita,
      'custo', fin.custo,
      'saldo', fin.receita - fin.custo,
      'pendentes', fin.pendentes
    ),
    'presenca', jsonb_build_object(
      'total_diarias', pres.total_diarias,
      'faltas', pres.faltas,
      'registros', pres.total_registros
    ),
    'consumo', jsonb_build_object(
      'previsto', cons.previsto,
      'real', cons.real,
      'desvio_pct', CASE WHEN cons.previsto > 0 THEN ROUND(((cons.real - cons.previsto) / cons.previsto) * 100, 2) ELSE 0 END,
      'itens', cons.itens
    ),
    'incidentes', jsonb_build_object(
      'abertos', inc.abertos,
      'total', inc.total
    ),
    'capacidade', jsonb_build_object(
      'esperado_total', cap.esperado_total,
      'eficiencia_pct', CASE WHEN cap.esperado_total > 0 THEN ROUND((pres.total_diarias / cap.esperado_total::numeric / GREATEST((_end - _start + 1), 1)) * 100, 2) ELSE NULL END
    )
  ) INTO _result
  FROM fin, pres, cons, inc, cap;

  RETURN COALESCE(_result, '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_aggregates(uuid, date, date) TO authenticated;