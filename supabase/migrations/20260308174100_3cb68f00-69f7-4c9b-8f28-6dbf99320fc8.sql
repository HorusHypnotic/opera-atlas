
-- 1. Bind sync_beta_approval trigger to beta_waitlist
CREATE TRIGGER on_beta_waitlist_status_change
  AFTER UPDATE OF status ON public.beta_waitlist
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_beta_approval();

-- 2. Bind track_influencer_conversion trigger to profiles
CREATE TRIGGER on_profile_tenant_assigned
  AFTER UPDATE OF tenant_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.track_influencer_conversion();

-- 3. Fix existing profiles: set beta_status = 'aprovado' for users with approved beta_waitlist entries
UPDATE public.profiles p
SET beta_status = 'aprovado'
FROM public.beta_waitlist bw
WHERE p.email = bw.email
  AND bw.status = 'aprovado'
  AND (p.beta_status IS NULL OR p.beta_status != 'aprovado');
