
-- Drop the restrictive "Anyone can read invite by token" policy
DROP POLICY IF EXISTS "Anyone can read invite by token" ON public.invites;

-- Recreate it as PERMISSIVE so unauthenticated users can read invites by token
CREATE POLICY "Anyone can read invite by token"
ON public.invites
FOR SELECT
TO anon, authenticated
USING (true);
