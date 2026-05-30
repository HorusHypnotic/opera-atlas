-- Frente 1 — Conclusão da camada causal: triggers herdam correlation_id da transação.
-- Convenção: qualquer RPC ou bloco que queira propagar lineage chama
--   perform set_config('opera.correlation_id', _corr::text, true);
--   perform set_config('opera.causation_id',   _caus::text, true);
-- antes de mutações. Como is_local=true, o setting vive só na transação corrente.

-- Helper opcional: pode ser chamado dentro de outras SECURITY DEFINER RPCs.
CREATE OR REPLACE FUNCTION public.set_correlation_context(
  _correlation_id uuid,
  _causation_id   uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF _correlation_id IS NOT NULL THEN
    PERFORM set_config('opera.correlation_id', _correlation_id::text, true);
  END IF;
  IF _causation_id IS NOT NULL THEN
    PERFORM set_config('opera.causation_id', _causation_id::text, true);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_correlation_context(uuid, uuid) TO authenticated, service_role;

-- Atualiza trigger genérico de audit para ler setting da sessão/transação.
-- Sem fallback inventado: se não houver setting, grava NULL.
CREATE OR REPLACE FUNCTION public.fn_audit_log_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _row_id text;
  _tenant uuid;
  _corr   uuid;
  _caus   uuid;
  _corr_raw text;
  _caus_raw text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _row_id := OLD.id::text;
    _tenant := OLD.tenant_id;
  ELSE
    _row_id := NEW.id::text;
    _tenant := NEW.tenant_id;
  END IF;

  -- Lê opportunisticamente o correlation/causation da transação.
  -- current_setting(name, true) retorna '' quando não definido — não levanta erro.
  BEGIN
    _corr_raw := nullif(current_setting('opera.correlation_id', true), '');
    _caus_raw := nullif(current_setting('opera.causation_id',   true), '');
    _corr := CASE WHEN _corr_raw IS NOT NULL THEN _corr_raw::uuid ELSE NULL END;
    _caus := CASE WHEN _caus_raw IS NOT NULL THEN _caus_raw::uuid ELSE NULL END;
  EXCEPTION WHEN OTHERS THEN
    _corr := NULL;
    _caus := NULL;
  END;

  INSERT INTO public.audit_logs_db (
    table_name, row_id, operation, old_data, new_data,
    user_id, tenant_id, correlation_id, causation_id
  ) VALUES (
    TG_TABLE_NAME,
    _row_id,
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    auth.uid(),
    _tenant,
    _corr,
    _caus
  );

  RETURN COALESCE(NEW, OLD);
END;
$function$;