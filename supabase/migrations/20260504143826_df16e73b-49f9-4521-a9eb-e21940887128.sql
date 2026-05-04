-- helper precisa existir antes da view
CREATE OR REPLACE FUNCTION public.jsonb_object_keys_count(_obj jsonb)
RETURNS integer
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE((SELECT COUNT(*)::int FROM jsonb_object_keys(_obj)), 0)
$$;

CREATE OR REPLACE VIEW public.audit_logs_safe AS
SELECT
  id, table_name, row_id, operation, user_id, tenant_id, created_at,
  CASE WHEN old_data IS NOT NULL THEN public.jsonb_object_keys_count(old_data) ELSE 0 END AS old_fields_count,
  CASE WHEN new_data IS NOT NULL THEN public.jsonb_object_keys_count(new_data) ELSE 0 END AS new_fields_count
FROM public.audit_logs_db;

GRANT SELECT ON public.audit_logs_safe TO authenticated;