
-- Add deleted_at for soft delete on critical tables
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.lancamentos_financeiros ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.apontamento_diarias ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Create index for efficient filtering of non-deleted rows
CREATE INDEX IF NOT EXISTS idx_obras_deleted_at ON public.obras (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_colaboradores_deleted_at ON public.colaboradores (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_lancamentos_deleted_at ON public.lancamentos_financeiros (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_apontamento_deleted_at ON public.apontamento_diarias (deleted_at) WHERE deleted_at IS NULL;
