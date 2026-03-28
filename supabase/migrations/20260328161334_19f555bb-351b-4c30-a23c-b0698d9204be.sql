CREATE TABLE public.mobile_debug_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text NOT NULL,
  data jsonb DEFAULT '{}',
  url text,
  ua text,
  ts timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.mobile_debug_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert debug logs" ON public.mobile_debug_logs
  FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Super admin can read debug logs" ON public.mobile_debug_logs
  FOR SELECT TO authenticated USING (is_super_admin(auth.uid()));