
ALTER TABLE public.obras
  ADD COLUMN IF NOT EXISTS responsavel text,
  ADD COLUMN IF NOT EXISTS orcamento_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS area_m2 numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fase_atual text NOT NULL DEFAULT 'iniciacao',
  ADD COLUMN IF NOT EXISTS abordagem text NOT NULL DEFAULT 'preditiva',
  ADD COLUMN IF NOT EXISTS descricao text,
  ADD COLUMN IF NOT EXISTS tipo_obra text NOT NULL DEFAULT 'residencial';
