import { supabase } from './client';

export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) console.warn('[Auth] Erro ao obter sessão:', error.message);
  return session;
}

export async function ensureSession() {
  let session = await getSession();
  if (!session) {
    console.log('[Auth] Nenhuma sessão ativa. Tentando reconectar...');
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      console.warn('[Auth] Falha ao reconectar sessão:', error.message);
      return null;
    }
    session = data.session;
  }
  return session;
}

export function onAuthChange(callback: (event: string, session: any) => void) {
  return supabase.auth.onAuthStateChange((event, session) => {
    console.log('[Auth] Evento:', event);
    callback(event, session);
  });
}
