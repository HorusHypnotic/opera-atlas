-- ============================================================
-- 1. CAPACIDADE: garantir default e remover NULLs
-- ============================================================
UPDATE public.obras SET tamanho_equipe_esperada = 0 WHERE tamanho_equipe_esperada IS NULL;
ALTER TABLE public.obras ALTER COLUMN tamanho_equipe_esperada SET DEFAULT 0;
ALTER TABLE public.obras ALTER COLUMN tamanho_equipe_esperada SET NOT NULL;

-- ============================================================
-- 2. PRODUÇÃO: coluna numérica derivada via trigger
-- ============================================================
ALTER TABLE public.registros_diarios
  ADD COLUMN IF NOT EXISTS producao_valor numeric;

CREATE OR REPLACE FUNCTION public.extract_producao_valor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _normalized text;
  _match text;
BEGIN
  IF NEW.producao IS NULL OR btrim(NEW.producao) = '' THEN
    NEW.producao_valor := NULL;
    RETURN NEW;
  END IF;
  -- Normaliza vírgula decimal para ponto
  _normalized := replace(NEW.producao, ',', '.');
  -- Extrai primeiro número (inteiro ou decimal) do texto
  _match := substring(_normalized FROM '([0-9]+(?:\.[0-9]+)?)');
  IF _match IS NOT NULL THEN
    NEW.producao_valor := _match::numeric;
  ELSE
    NEW.producao_valor := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_extract_producao_valor ON public.registros_diarios;
CREATE TRIGGER trg_extract_producao_valor
BEFORE INSERT OR UPDATE OF producao ON public.registros_diarios
FOR EACH ROW EXECUTE FUNCTION public.extract_producao_valor();

-- Backfill existente
UPDATE public.registros_diarios
SET producao_valor = CASE
  WHEN producao IS NULL OR btrim(producao) = '' THEN NULL
  WHEN substring(replace(producao, ',', '.') FROM '([0-9]+(?:\.[0-9]+)?)') IS NOT NULL
    THEN substring(replace(producao, ',', '.') FROM '([0-9]+(?:\.[0-9]+)?)')::numeric
  ELSE NULL
END
WHERE producao_valor IS NULL;

-- ============================================================
-- 3. EQUIPE: coluna normalizada gerada automaticamente
-- ============================================================
ALTER TABLE public.registros_diarios
  ADD COLUMN IF NOT EXISTS equipe_normalizada text
  GENERATED ALWAYS AS (
    CASE
      WHEN equipe IS NULL OR btrim(equipe) = '' THEN NULL
      ELSE regexp_replace(lower(btrim(equipe)), '\s+', '_', 'g')
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_registros_diarios_equipe_norm
  ON public.registros_diarios (obra_id, equipe_normalizada);

-- ============================================================
-- 4. PRESENÇA: deduplicar e bloquear futuras duplicatas
-- ============================================================
-- Remove duplicatas mantendo o mais recente por (colaborador_id, data, obra_id)
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY colaborador_id, data, obra_id
           ORDER BY created_at DESC, id DESC
         ) AS rn
  FROM public.registro_presencas
)
DELETE FROM public.registro_presencas
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_presenca_colab_data_obra
  ON public.registro_presencas (colaborador_id, data, obra_id);

-- ============================================================
-- 5. RPC produtividade_por_equipe — usa producao_valor + equipe_normalizada
-- ============================================================
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
    COALESCE(rd.equipe_normalizada, lower(btrim(COALESCE(rd.atividade, 'sem_equipe')))) AS equipe,
    COUNT(*)::bigint AS registros,
    COUNT(DISTINCT rd.data_registro)::bigint AS dias_trabalhados,
    COALESCE(SUM(rd.producao_valor), 0) AS producao_total,
    CASE
      WHEN COUNT(DISTINCT rd.data_registro) = 0 THEN 0
      ELSE ROUND(COALESCE(SUM(rd.producao_valor), 0) / COUNT(DISTINCT rd.data_registro)::numeric, 2)
    END AS producao_media_dia
  FROM public.registros_diarios rd
  WHERE rd.obra_id = _obra_id
    AND rd.tenant_id = get_user_tenant_id(auth.uid())
    AND rd.data_registro BETWEEN _start AND _end
    AND user_has_obra_access(auth.uid(), rd.obra_id)
  GROUP BY COALESCE(rd.equipe_normalizada, lower(btrim(COALESCE(rd.atividade, 'sem_equipe'))))
  ORDER BY producao_total DESC;
$$;