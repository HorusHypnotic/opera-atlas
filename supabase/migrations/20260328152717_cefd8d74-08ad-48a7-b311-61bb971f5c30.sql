
CREATE TABLE public.session_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  refresh_token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '3 minutes'),
  used boolean NOT NULL DEFAULT false
);

ALTER TABLE public.session_transfers ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_session_transfers_code ON public.session_transfers(code);
CREATE INDEX idx_session_transfers_expires ON public.session_transfers(expires_at);
