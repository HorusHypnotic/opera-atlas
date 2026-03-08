-- Security hardening: prevent privilege escalation via profile updates

-- 1) Admins can update profiles in their tenant, but cannot elevate super admin
DROP POLICY IF EXISTS "Admins can update profiles in tenant" ON public.profiles;
CREATE POLICY "Admins can update profiles in tenant"
ON public.profiles
FOR UPDATE
USING (
  (tenant_id = public.get_user_tenant_id(auth.uid()))
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  (tenant_id = public.get_user_tenant_id(auth.uid()))
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
  AND is_super_admin = false
);

-- 2) Users can update their own profile, but cannot self-promote to super admin
--    and cannot jump to another tenant unless they have a valid pending invite.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND is_super_admin = false
  AND (
    tenant_id = public.get_user_tenant_id(auth.uid())
    OR (
      public.get_user_tenant_id(auth.uid()) IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.invites i
        WHERE i.email = (auth.jwt() ->> 'email')
          AND i.tenant_id = profiles.tenant_id
          AND i.used = false
          AND i.expires_at > now()
      )
    )
  )
);