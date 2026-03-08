
-- 1. Add super admin flag to profiles (NOT a role, a flag for cross-tenant access)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false;

-- 2. Create security definer function to check super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_super_admin FROM public.profiles WHERE id = _user_id),
    false
  )
$$;

-- 3. Add limite_obras to tenants
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS limite_obras integer NOT NULL DEFAULT 3;

-- 4. Create obra_membros table for per-obra team assignment
CREATE TABLE IF NOT EXISTS public.obra_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(obra_id, user_id)
);

ALTER TABLE public.obra_membros ENABLE ROW LEVEL SECURITY;

-- Admin can manage obra_membros in their tenant
CREATE POLICY "Admins manage obra_membros"
ON public.obra_membros
FOR ALL
TO authenticated
USING (
  (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
  OR is_super_admin(auth.uid())
);

-- Users can see their own obra memberships
CREATE POLICY "Users view own obra_membros"
ON public.obra_membros
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 5. Create function to validate obra limit before insert
CREATE OR REPLACE FUNCTION public.check_obra_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _limite integer;
  _count integer;
BEGIN
  SELECT limite_obras INTO _limite FROM public.tenants WHERE id = NEW.tenant_id;
  SELECT COUNT(*) INTO _count FROM public.obras WHERE tenant_id = NEW.tenant_id;
  
  IF _count >= _limite THEN
    RAISE EXCEPTION 'Limite de obras atingido para este cliente (% de %)', _count, _limite;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_obra_limit
  BEFORE INSERT ON public.obras
  FOR EACH ROW
  EXECUTE FUNCTION public.check_obra_limit();

-- 6. Update RLS on key tables to allow super admin cross-tenant access
-- profiles: super admin can see all
CREATE POLICY "Super admin can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admin can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (is_super_admin(auth.uid()));

-- tenants: super admin can see and manage all
CREATE POLICY "Super admin can manage all tenants"
ON public.tenants
FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- obras: super admin can see all
CREATE POLICY "Super admin can view all obras"
ON public.obras
FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admin can manage all obras"
ON public.obras
FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- user_roles: super admin can see and manage all
CREATE POLICY "Super admin can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- 7. Set current user as super admin
UPDATE public.profiles SET is_super_admin = true WHERE id = 'd0406216-d13c-4d30-b946-76ac85016635';
