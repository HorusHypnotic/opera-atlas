import { supabase } from '@/lib/supabase';

/**
 * Resilient auth wrapper for mobile/PWA session persistence.
 * Handles cases where localStorage may be cleared by the browser.
 */

// Try to detect session from URL hash (OAuth redirects, magic links)
export async function detectSessionFromUrl(): Promise<boolean> {
  const hash = window.location.hash;
  if (hash && (hash.includes('access_token') || hash.includes('refresh_token'))) {
    console.log('[Auth] Token detectado na URL, processando...');
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.warn('[Auth] Erro ao processar token da URL:', error.message);
      return false;
    }
    if (data.session) {
      console.log('[Auth] Sessão restaurada via URL');
      // Clean the hash to avoid re-processing
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      return true;
    }
  }
  return false;
}

export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) console.warn('[Auth] Erro ao obter sessão:', error.message);
  return session;
}

export async function ensureSession() {
  // 1. Try URL detection first (OAuth redirects)
  await detectSessionFromUrl();

  // 2. Try normal session
  let session = await getSession();
  if (session) return session;

  // 3. Try refresh
  console.log('[Auth] Nenhuma sessão ativa. Tentando reconectar...');
  const { data, error } = await supabase.auth.refreshSession();
  if (error) {
    console.warn('[Auth] Falha ao reconectar sessão:', error.message);
    return null;
  }
  return data.session;
}

export function onAuthChange(callback: (event: string, session: any) => void) {
  return supabase.auth.onAuthStateChange((event, session) => {
    console.log('[Auth] Evento:', event);
    callback(event, session);
  });
}
