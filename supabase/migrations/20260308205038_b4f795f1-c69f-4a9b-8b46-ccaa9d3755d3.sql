
-- Add obra_id and created_by to invites for granular access control
ALTER TABLE public.invites 
  ADD COLUMN IF NOT EXISTS obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by uuid;
