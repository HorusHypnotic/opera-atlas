ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active';

COMMENT ON COLUMN public.profiles.account_status IS 'Status da conta: active, blocked, suspended';