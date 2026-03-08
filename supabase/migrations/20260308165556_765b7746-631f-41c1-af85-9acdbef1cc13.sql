
-- Add beta_status to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS beta_status text DEFAULT NULL;

-- Create function to sync beta approval to profile
CREATE OR REPLACE FUNCTION public.sync_beta_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- When beta_waitlist status changes to 'aprovado', update matching profile
  IF NEW.status = 'aprovado' AND (OLD.status IS NULL OR OLD.status != 'aprovado') THEN
    UPDATE public.profiles 
    SET beta_status = 'aprovado'
    WHERE email = NEW.email;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on beta_waitlist
CREATE TRIGGER on_beta_status_change
  AFTER UPDATE ON public.beta_waitlist
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_beta_approval();

-- Create function for influencer conversion tracking
CREATE OR REPLACE FUNCTION public.track_influencer_conversion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _code text;
BEGIN
  -- When a profile gets a tenant_id (becomes a real user), track conversion
  IF NEW.tenant_id IS NOT NULL AND (OLD.tenant_id IS NULL) THEN
    SELECT influencer_code INTO _code
    FROM public.beta_waitlist
    WHERE email = NEW.email
    AND influencer_code IS NOT NULL
    LIMIT 1;
    
    IF _code IS NOT NULL THEN
      UPDATE public.influencer_codes
      SET total_convertidos = total_convertidos + 1
      WHERE codigo = _code;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for conversion tracking
CREATE TRIGGER on_profile_conversion
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.track_influencer_conversion();
