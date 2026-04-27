-- 1. Coluna 'tipo' em apontamento_diarias para isolar legado
ALTER TABLE public.apontamento_diarias
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'ajuste';

-- Marca todos registros pré-existentes como legado (read-only no novo cálculo)
UPDATE public.apontamento_diarias
  SET tipo = 'legacy_historico'
  WHERE created_at < now() AND tipo = 'ajuste';

-- Constraint de domínio
ALTER TABLE public.apontamento_diarias
  DROP CONSTRAINT IF EXISTS apontamento_diarias_tipo_check;
ALTER TABLE public.apontamento_diarias
  ADD CONSTRAINT apontamento_diarias_tipo_check
  CHECK (tipo IN ('ajuste','complemento','correcao','legacy_historico'));

COMMENT ON COLUMN public.apontamento_diarias.tipo IS
  'ajuste|complemento|correcao = delta somado à base de presença. legacy_historico = só leitura, NÃO entra no cálculo novo.';

-- 2. Trigger sync_presenca_fracao: cobrir falta_justificada e falta_injustificada
CREATE OR REPLACE FUNCTION public.sync_presenca_fracao()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.tipo IS DISTINCT FROM OLD.tipo THEN
    NEW.fracao_diaria := CASE
      WHEN NEW.tipo IN ('falta','falta_justificada','falta_injustificada') THEN 0
      WHEN NEW.tipo = 'meio_periodo' THEN 0.5
      WHEN NEW.tipo = 'hora_extra' THEN 0
      ELSE 1
    END;
  ELSIF NEW.fracao_diaria IS DISTINCT FROM OLD.fracao_diaria THEN
    NEW.tipo := CASE
      WHEN NEW.fracao_diaria = 0 THEN 'falta'
      WHEN NEW.fracao_diaria = 0.5 THEN 'meio_periodo'
      ELSE 'presente'
    END;
  END IF;
  RETURN NEW;
END;
$function$;

-- Garantir que o trigger está ativo
DROP TRIGGER IF EXISTS trg_sync_presenca_fracao ON public.registro_presencas;
CREATE TRIGGER trg_sync_presenca_fracao
  BEFORE INSERT OR UPDATE ON public.registro_presencas
  FOR EACH ROW EXECUTE FUNCTION public.sync_presenca_fracao();