CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _beta_status text;
BEGIN
  SELECT status INTO _beta_status
  FROM public.beta_waitlist
  WHERE email = NEW.email
  LIMIT 1;

  INSERT INTO public.profiles (id, email, full_name, avatar_url, beta_status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', ''),
    _beta_status
  );
  RETURN NEW;
END;
$function$;