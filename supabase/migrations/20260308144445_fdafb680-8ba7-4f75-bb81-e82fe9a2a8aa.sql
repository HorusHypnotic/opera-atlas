CREATE OR REPLACE FUNCTION public.setup_tenant(_nome text, _cnpj text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _tenant_id uuid;
  _existing_tenant uuid;
BEGIN
  -- Check user is authenticated
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check user doesn't already have a tenant
  SELECT tenant_id INTO _existing_tenant FROM public.profiles WHERE id = _user_id;
  IF _existing_tenant IS NOT NULL THEN
    RAISE EXCEPTION 'User already belongs to a tenant';
  END IF;

  -- Create tenant
  INSERT INTO public.tenants (nome, cnpj)
  VALUES (_nome, _cnpj)
  RETURNING id INTO _tenant_id;

  -- Link profile
  UPDATE public.profiles SET tenant_id = _tenant_id WHERE id = _user_id;

  -- Assign admin role
  INSERT INTO public.user_roles (user_id, role, tenant_id)
  VALUES (_user_id, 'admin', _tenant_id);

  RETURN _tenant_id;
END;
$$;