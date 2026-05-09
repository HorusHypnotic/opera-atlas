-- Bloco 1: Estado contábil explícito em registro_presencas

-- 1. Adicionar coluna status_contabil
ALTER TABLE public.registro_presencas
  ADD COLUMN IF NOT EXISTS status_contabil text NOT NULL DEFAULT 'confirmada';

-- 2. Backfill seguro:
-- Datas futuras lançadas recentemente => prevista
-- Resto => confirmada (default)
UPDATE public.registro_presencas
SET status_contabil = 'prevista'
WHERE data > CURRENT_DATE
  AND created_at >= (now() - interval '7 days');

-- 3. Índice para consultas de folha
CREATE INDEX IF NOT EXISTS idx_rp_obra_data_status
  ON public.registro_presencas(obra_id, data, status_contabil);

-- 4. Trigger: define status automaticamente
CREATE OR REPLACE FUNCTION public.fn_set_status_contabil()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Define inicial baseado na data
    IF NEW.data > CURRENT_DATE THEN
      NEW.status_contabil := 'prevista';
    ELSE
      NEW.status_contabil := 'confirmada';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Validar valores permitidos
    IF NEW.status_contabil NOT IN ('prevista','confirmada','ajustada') THEN
      RAISE EXCEPTION 'status_contabil inválido: %', NEW.status_contabil;
    END IF;

    -- Auto-promoção: prevista cuja data já passou => confirmada (sem virar ajustada)
    IF OLD.status_contabil = 'prevista' AND NEW.data <= CURRENT_DATE
       AND NEW.fracao_diaria IS NOT DISTINCT FROM OLD.fracao_diaria
       AND NEW.valor_diaria_usado IS NOT DISTINCT FROM OLD.valor_diaria_usado
       AND NEW.tipo IS NOT DISTINCT FROM OLD.tipo THEN
      NEW.status_contabil := 'confirmada';
      RETURN NEW;
    END IF;

    -- Mudança material em registro cuja data já passou => ajustada
    IF OLD.data < CURRENT_DATE AND (
         NEW.fracao_diaria IS DISTINCT FROM OLD.fracao_diaria
      OR NEW.valor_diaria_usado IS DISTINCT FROM OLD.valor_diaria_usado
      OR NEW.tipo IS DISTINCT FROM OLD.tipo
    ) THEN
      NEW.status_contabil := 'ajustada';
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_status_contabil ON public.registro_presencas;
CREATE TRIGGER trg_set_status_contabil
  BEFORE INSERT OR UPDATE ON public.registro_presencas
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_set_status_contabil();

-- 5. RPC para promover previsões em massa (chamável por cron ou no boot)
CREATE OR REPLACE FUNCTION public.promover_previsoes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _count integer;
BEGIN
  UPDATE public.registro_presencas
  SET status_contabil = 'confirmada'
  WHERE status_contabil = 'prevista'
    AND data <= CURRENT_DATE;
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

-- 6. Atualizar folha_pagamento para v2: separar confirmada/prevista/ajustada
CREATE OR REPLACE FUNCTION public.folha_pagamento(_obra_id uuid, _data_inicio date, _data_fim date, _colaborador_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tenant_id uuid; _result jsonb; _dados jsonb; _hash text; _totais jsonb;
  _contem_previsoes boolean;
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
      p.status_contabil,
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
      -- Confirmadas (presença real registrada)
      COALESCE((SELECT SUM(p.fracao_diaria) FROM presencas p WHERE p.colaborador_id = c.id AND p.status_contabil = 'confirmada'), 0) AS qtd_confirmada,
      COALESCE((SELECT SUM(p.valor) FROM presencas p WHERE p.colaborador_id = c.id AND p.status_contabil = 'confirmada'), 0) AS valor_confirmado,
      -- Previstas (dias futuros assumidos)
      COALESCE((SELECT SUM(p.fracao_diaria) FROM presencas p WHERE p.colaborador_id = c.id AND p.status_contabil = 'prevista'), 0) AS qtd_prevista,
      COALESCE((SELECT SUM(p.valor) FROM presencas p WHERE p.colaborador_id = c.id AND p.status_contabil = 'prevista'), 0) AS valor_previsto,
      -- Ajustadas (alteração manual após data)
      COALESCE((SELECT SUM(p.fracao_diaria) FROM presencas p WHERE p.colaborador_id = c.id AND p.status_contabil = 'ajustada'), 0) AS qtd_ajustada_presenca,
      COALESCE((SELECT SUM(p.valor) FROM presencas p WHERE p.colaborador_id = c.id AND p.status_contabil = 'ajustada'), 0) AS valor_ajustado_presenca,
      -- Ajustes manuais (apontamento_diarias)
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
      -- Compatibilidade v1 (qtd_presenca/valor_presenca = soma de confirmada+ajustada+prevista)
      'qtd_presenca', co.qtd_confirmada + co.qtd_ajustada_presenca + co.qtd_prevista,
      'valor_presenca', co.valor_confirmado + co.valor_ajustado_presenca + co.valor_previsto,
      -- Detalhamento por estado contábil
      'qtd_confirmada', co.qtd_confirmada, 'valor_confirmado', co.valor_confirmado,
      'qtd_prevista', co.qtd_prevista, 'valor_previsto', co.valor_previsto,
      'qtd_ajustada_presenca', co.qtd_ajustada_presenca, 'valor_ajustado_presenca', co.valor_ajustado_presenca,
      'qtd_ajuste', co.qtd_ajuste, 'valor_ajuste', co.valor_ajuste,
      'valor_legado', co.valor_legado,
      -- Totais
      'valor_consolidado', ROUND((co.valor_confirmado + co.valor_ajustado_presenca + co.valor_ajuste + co.valor_legado)::numeric, 2),
      'valor_projetado', ROUND((co.valor_confirmado + co.valor_ajustado_presenca + co.valor_previsto + co.valor_ajuste + co.valor_legado)::numeric, 2),
      'valor_total', ROUND((co.valor_confirmado + co.valor_ajustado_presenca + co.valor_previsto + co.valor_ajuste + co.valor_legado)::numeric, 2),
      'tem_previsao', (co.qtd_prevista > 0),
      'breakdown', jsonb_build_object(
        'presencas', COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'data', p.data, 'tipo', p.tipo, 'fracao', p.fracao_diaria,
          'valor_diaria', p.valor_diaria_usado, 'valor', p.valor,
          'status_contabil', p.status_contabil) ORDER BY p.data, p.id)
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
      'qtd_confirmada_total', COALESCE(SUM((l->>'qtd_confirmada')::numeric), 0),
      'valor_confirmado_total', COALESCE(SUM((l->>'valor_confirmado')::numeric), 0),
      'qtd_prevista_total', COALESCE(SUM((l->>'qtd_prevista')::numeric), 0),
      'valor_previsto_total', COALESCE(SUM((l->>'valor_previsto')::numeric), 0),
      'qtd_ajustada_presenca_total', COALESCE(SUM((l->>'qtd_ajustada_presenca')::numeric), 0),
      'valor_ajustado_presenca_total', COALESCE(SUM((l->>'valor_ajustado_presenca')::numeric), 0),
      'qtd_presenca_total', COALESCE(SUM((l->>'qtd_presenca')::numeric), 0),
      'valor_presenca_total', COALESCE(SUM((l->>'valor_presenca')::numeric), 0),
      'qtd_ajuste_total', COALESCE(SUM((l->>'qtd_ajuste')::numeric), 0),
      'valor_ajuste_total', COALESCE(SUM((l->>'valor_ajuste')::numeric), 0),
      'valor_legado_total', COALESCE(SUM((l->>'valor_legado')::numeric), 0),
      'valor_consolidado_total', COALESCE(SUM((l->>'valor_consolidado')::numeric), 0),
      'valor_projetado_total', COALESCE(SUM((l->>'valor_projetado')::numeric), 0),
      'valor_total_geral', COALESCE(SUM((l->>'valor_total')::numeric), 0),
      'colaboradores_count', COUNT(*),
      'colaboradores_com_previsao', COUNT(*) FILTER (WHERE (l->>'tem_previsao')::boolean = true)
    ) AS t FROM jsonb_array_elements((SELECT data FROM ordered)) l
  )
  SELECT data, t INTO _dados, _totais FROM ordered, totais_calc;

  _contem_previsoes := COALESCE((_totais->>'valor_previsto_total')::numeric, 0) > 0;

  -- Hash v2: inclui status_contabil em cada presença (já presente no breakdown)
  _hash := encode(extensions.digest(convert_to(jsonb_build_object(
    'rule_version', 'v2', 'obra_id', _obra_id,
    'periodo', jsonb_build_object('inicio', _data_inicio, 'fim', _data_fim),
    'colaborador_id', _colaborador_id, 'rows', _dados)::text, 'UTF8'), 'sha256'), 'hex');

  _result := jsonb_build_object(
    'rule_version', 'v2', 'obra_id', _obra_id, 'tenant_id', _tenant_id,
    'periodo', jsonb_build_object('inicio', _data_inicio, 'fim', _data_fim),
    'colaborador_id', _colaborador_id, 'gerado_em', now(), 'gerado_por', auth.uid(),
    'contem_previsoes', _contem_previsoes,
    'totais', _totais, 'rows', _dados, 'hash', _hash);
  RETURN _result;
END; $function$;

-- 7. validar_fechamento: bloquear fechamento com previsões pendentes
CREATE OR REPLACE FUNCTION public.validar_fechamento(_obra_id uuid, _data_inicio date, _data_fim date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tenant_id uuid; _erros jsonb := '[]'::jsonb; _warnings jsonb := '[]'::jsonb;
  _count_presencas int; _count_zerados int; _count_previsoes int;
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

  -- Bloqueio crítico: não permitir fechar com previsões
  SELECT COUNT(*) INTO _count_previsoes FROM registro_presencas
  WHERE tenant_id = _tenant_id AND obra_id = _obra_id
    AND data BETWEEN _data_inicio AND _data_fim
    AND status_contabil = 'prevista';

  IF _count_previsoes > 0 THEN
    _erros := _erros || jsonb_build_array(format('%s registros ainda em estado PREVISTA. Confirme ou remova antes de fechar.', _count_previsoes));
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
    'stats', jsonb_build_object(
      'total_presencas', _count_presencas,
      'registros_zerados', _count_zerados,
      'registros_previsao', _count_previsoes));
END; $function$;