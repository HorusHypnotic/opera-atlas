/**
 * Auth debug logger — temporary diagnostic tool.
 * Logs every auth event, visibility change, and signOut call
 * so we can see exactly WHY the mobile session drops.
 */
export const installAuthDebug = (supabase: any) => {
  const log = (...args: any[]) =>
    console.log("[AUTHDBG]", new Date().toISOString(), ...args);

  // Intercept signOut to trace WHO is calling it
  const origSignOut = supabase.auth.signOut.bind(supabase.auth);
  supabase.auth.signOut = async (...args: any[]) => {
    console.trace("[AUTHDBG] signOut() CHAMADO — stack trace:");
    return origSignOut(...args);
  };

  // Log visibility changes with session status
  document.addEventListener("visibilitychange", async () => {
    const { data } = await supabase.auth.getSession();
    log(
      "visibility:", document.visibilityState,
      "session:", !!data.session,
      "userId:", data.session?.user?.id ?? "null",
      "expires_at:", data.session?.expires_at ?? "null"
    );
  });

  // Online/offline
  window.addEventListener("online", () => log("ONLINE"));
  window.addEventListener("offline", () => log("OFFLINE"));

  // Every auth state change
  supabase.auth.onAuthStateChange((event: string, session: any) => {
    log(
      "AUTH EVENT:", event,
      "userId:", session?.user?.id ?? "null",
      "expires_at:", session?.expires_at ?? "null",
      "provider:", session?.user?.app_metadata?.provider ?? "null"
    );
  });

  log("Auth debug logger instalado");
};
