
-- Beta waitlist table
CREATE TABLE public.beta_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email text NOT NULL UNIQUE,
  telefone text,
  empresa text,
  influencer_code text,
  status text NOT NULL DEFAULT 'aguardando_aprovacao',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.beta_waitlist ENABLE ROW LEVEL SECURITY;

-- Public can insert (signup)
CREATE POLICY "Anyone can signup for beta" ON public.beta_waitlist
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Public can check own email status
CREATE POLICY "Anyone can check status by email" ON public.beta_waitlist
  FOR SELECT TO anon, authenticated
  USING (true);

-- Admins can manage all
CREATE POLICY "Admins can update beta_waitlist" ON public.beta_waitlist
  FOR UPDATE TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role]));

CREATE POLICY "Admins can delete beta_waitlist" ON public.beta_waitlist
  FOR DELETE TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role]));

-- Influencer codes table
CREATE TABLE public.influencer_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  codigo text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  total_cadastros integer NOT NULL DEFAULT 0,
  total_convertidos integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.influencer_codes ENABLE ROW LEVEL SECURITY;

-- Anyone can read active codes (for validation)
CREATE POLICY "Anyone can read active codes" ON public.influencer_codes
  FOR SELECT TO anon, authenticated
  USING (true);

-- Admins can manage codes
CREATE POLICY "Admins can insert codes" ON public.influencer_codes
  FOR INSERT TO authenticated
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role]));

CREATE POLICY "Admins can update codes" ON public.influencer_codes
  FOR UPDATE TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role]));

CREATE POLICY "Admins can delete codes" ON public.influencer_codes
  FOR DELETE TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role]));

-- Beta config table (single row)
CREATE TABLE public.beta_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  limite_vagas integer NOT NULL DEFAULT 5,
  beta_ativo boolean NOT NULL DEFAULT true,
  lista_espera_ativa boolean NOT NULL DEFAULT true,
  tempo_teste_dias integer NOT NULL DEFAULT 30,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.beta_config ENABLE ROW LEVEL SECURITY;

-- Anyone can read config
CREATE POLICY "Anyone can read beta config" ON public.beta_config
  FOR SELECT TO anon, authenticated
  USING (true);

-- Admins can manage config
CREATE POLICY "Admins can update beta config" ON public.beta_config
  FOR UPDATE TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role]));

CREATE POLICY "Admins can insert beta config" ON public.beta_config
  FOR INSERT TO authenticated
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role]));

-- Insert default config row
INSERT INTO public.beta_config (limite_vagas, beta_ativo, lista_espera_ativa, tempo_teste_dias) VALUES (5, true, true, 30);
