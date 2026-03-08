
-- Fix: "Admins can manage invites" must be PERMISSIVE, not RESTRICTIVE
DROP POLICY IF EXISTS "Admins can manage invites" ON public.invites;

CREATE POLICY "Admins can manage invites"
ON public.invites
FOR ALL
TO authenticated
USING (
  (tenant_id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  (tenant_id = get_user_tenant_id(auth.uid())) AND has_role(auth.uid(), 'admin'::app_role)
);
