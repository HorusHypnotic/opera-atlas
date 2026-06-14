
CREATE POLICY "Admins read own tenant exports"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'exports'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
  AND (storage.foldername(name))[1] = public.get_user_tenant_id(auth.uid())::text
);
