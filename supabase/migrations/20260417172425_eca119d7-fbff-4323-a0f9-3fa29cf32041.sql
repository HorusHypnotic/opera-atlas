-- 1. BETA_WAITLIST: remove leitura pública, restringe a admins + função por email
DROP POLICY IF EXISTS "Anyone can check status by email" ON public.beta_waitlist;

CREATE POLICY "Admins can view beta_waitlist"
ON public.beta_waitlist
FOR SELECT
TO authenticated
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role]) OR is_super_admin(auth.uid()));

-- Função segura para usuário consultar próprio status por email (sem expor lista)
CREATE OR REPLACE FUNCTION public.get_beta_status_by_email(_email text)
RETURNS TABLE(status text, nome text, created_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT status, nome, created_at
  FROM public.beta_waitlist
  WHERE lower(email) = lower(_email)
  LIMIT 1;
$$;

-- Função pública para contar vagas (sem expor dados pessoais)
CREATE OR REPLACE FUNCTION public.get_beta_vagas_ocupadas()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.beta_waitlist
  WHERE status IN ('aguardando_aprovacao', 'aprovado');
$$;

GRANT EXECUTE ON FUNCTION public.get_beta_status_by_email(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_beta_vagas_ocupadas() TO anon, authenticated;

-- 2. INVITES: remove leitura aberta, cria função segura para validar token
DROP POLICY IF EXISTS "Anyone can read invite by token" ON public.invites;

CREATE OR REPLACE FUNCTION public.get_invite_by_token(_token text)
RETURNS TABLE(
  id uuid,
  email text,
  role app_role,
  tenant_id uuid,
  obra_id uuid,
  expires_at timestamptz,
  used boolean,
  tenant_nome text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.id, i.email, i.role, i.tenant_id, i.obra_id, i.expires_at, i.used, t.nome AS tenant_nome
  FROM public.invites i
  LEFT JOIN public.tenants t ON t.id = i.tenant_id
  WHERE i.token = _token
    AND i.used = false
    AND i.expires_at > now()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_invite_by_token(text) TO anon, authenticated;

-- 3. INFLUENCER_CODES: remove leitura pública, restringe a admins; cria função pública apenas para validar código
DROP POLICY IF EXISTS "Anyone can read active codes" ON public.influencer_codes;

CREATE POLICY "Admins can view influencer_codes"
ON public.influencer_codes
FOR SELECT
TO authenticated
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role]) OR is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.validar_codigo_influencer(_codigo text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.influencer_codes
    WHERE upper(codigo) = upper(_codigo) AND ativo = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.validar_codigo_influencer(text) TO anon, authenticated;

-- 4. STORAGE: remover policies que permitem listagem ampla do bucket obra-fotos
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Allow public list" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view obra-fotos" ON storage.objects;

-- Acesso por URL direta (objetos individuais), sem listing
CREATE POLICY "Read individual obra-fotos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'obra-fotos');

-- Upload restrito a usuários autenticados do tenant
CREATE POLICY "Authenticated upload obra-fotos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'obra-fotos');

CREATE POLICY "Authenticated update obra-fotos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'obra-fotos');

CREATE POLICY "Authenticated delete obra-fotos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'obra-fotos');