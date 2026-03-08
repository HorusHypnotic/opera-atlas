
-- Add beta_approved_at to track when user was approved
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS beta_approved_at timestamp with time zone;

-- Update existing approved users: set beta_approved_at to their updated_at as best estimate
UPDATE public.profiles 
SET beta_approved_at = updated_at 
WHERE beta_status = 'aprovado' AND beta_approved_at IS NULL;

-- Replace sync_beta_approval trigger function to also set beta_approved_at
CREATE OR REPLACE FUNCTION public.sync_beta_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'aprovado' AND (OLD.status IS NULL OR OLD.status != 'aprovado') THEN
    UPDATE public.profiles 
    SET beta_status = 'aprovado',
        beta_approved_at = now()
    WHERE email = NEW.email;
  END IF;
  RETURN NEW;
END;
$function$;
