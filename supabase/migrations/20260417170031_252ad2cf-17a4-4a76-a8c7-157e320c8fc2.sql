-- 1. Add fracao_diaria column
ALTER TABLE public.registro_presencas
ADD COLUMN IF NOT EXISTS fracao_diaria numeric NOT NULL DEFAULT 1;

-- 2. Backfill existing data based on tipo
UPDATE public.registro_presencas
SET fracao_diaria = CASE
  WHEN tipo = 'falta' THEN 0
  WHEN tipo = 'meio_periodo' THEN 0.5
  ELSE 1
END
WHERE fracao_diaria = 1; -- only update defaults

-- 3. Validation: fracao must be 0, 0.5 or 1
ALTER TABLE public.registro_presencas
DROP CONSTRAINT IF EXISTS registro_presencas_fracao_check;

ALTER TABLE public.registro_presencas
ADD CONSTRAINT registro_presencas_fracao_check
CHECK (fracao_diaria IN (0, 0.5, 1));

-- 4. Sync trigger: keep tipo and fracao_diaria consistent
CREATE OR REPLACE FUNCTION public.sync_presenca_fracao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- If tipo changed but fracao didn't, derive fracao from tipo
  IF TG_OP = 'INSERT' OR NEW.tipo IS DISTINCT FROM OLD.tipo THEN
    NEW.fracao_diaria := CASE
      WHEN NEW.tipo = 'falta' THEN 0
      WHEN NEW.tipo = 'meio_periodo' THEN 0.5
      ELSE 1
    END;
  -- If fracao changed but tipo didn't, derive tipo from fracao
  ELSIF NEW.fracao_diaria IS DISTINCT FROM OLD.fracao_diaria THEN
    NEW.tipo := CASE
      WHEN NEW.fracao_diaria = 0 THEN 'falta'
      WHEN NEW.fracao_diaria = 0.5 THEN 'meio_periodo'
      ELSE 'presente'
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_presenca_fracao_trigger ON public.registro_presencas;
CREATE TRIGGER sync_presenca_fracao_trigger
BEFORE INSERT OR UPDATE ON public.registro_presencas
FOR EACH ROW
EXECUTE FUNCTION public.sync_presenca_fracao();

-- 5. Index for fast aggregation by colaborador/period
CREATE INDEX IF NOT EXISTS idx_presencas_colab_data
ON public.registro_presencas(colaborador_id, data);