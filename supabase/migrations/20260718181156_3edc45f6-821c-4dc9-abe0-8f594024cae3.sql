
CREATE TABLE public.obras_pesquisa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  dono_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  grupo text NOT NULL CHECK (grupo IN ('piloto','controle')),
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','finalizada','desistente')),
  data_inicio date NOT NULL DEFAULT '2026-08-03',
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obras_pesquisa TO authenticated;
GRANT ALL ON public.obras_pesquisa TO service_role;

ALTER TABLE public.obras_pesquisa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_select" ON public.obras_pesquisa
  FOR SELECT TO authenticated USING (dono_id = auth.uid());
CREATE POLICY "own_insert" ON public.obras_pesquisa
  FOR INSERT TO authenticated WITH CHECK (dono_id = auth.uid());
CREATE POLICY "own_update" ON public.obras_pesquisa
  FOR UPDATE TO authenticated USING (dono_id = auth.uid()) WITH CHECK (dono_id = auth.uid());
CREATE POLICY "own_delete" ON public.obras_pesquisa
  FOR DELETE TO authenticated USING (dono_id = auth.uid());

CREATE OR REPLACE FUNCTION public.fn_obras_pesquisa_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_obras_pesquisa_updated_at
BEFORE UPDATE ON public.obras_pesquisa
FOR EACH ROW EXECUTE FUNCTION public.fn_obras_pesquisa_updated_at();
