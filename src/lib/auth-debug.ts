/**
 * Remote auth debug logger — saves logs to mobile_debug_logs table
 * so we can diagnose mobile session drops without needing console access.
 * TEMPORARY — remove after diagnosis.
 */
import { supabase } from "@/lib/supabase";

const mlog = async (event: string, data: any = {}) => {
  try {
    await supabase.from("mobile_debug_logs").insert([{
      event,
      data,
      url: location.href,
      ua: navigator.userAgent,
      ts: new Date().toISOString(),
    }]);
  } catch {}
};

export const installAuthDebug = (_supabase: any) => {
  // Log auth state changes
  supabase.auth.onAuthStateChange((event, session) => {
    mlog("auth_change", {
      event,
      uid: session?.user?.id ?? null,
      email: session?.user?.email ?? null,
      expires_at: session?.expires_at ?? null,
      provider: session?.user?.app_metadata?.provider ?? null,
    });
  });

  // Intercept signOut
  const origSignOut = supabase.auth.signOut.bind(supabase.auth);
  supabase.auth.signOut = async (...args: any[]) => {
    await mlog("signout_called", { stack: new Error().stack });
    return origSignOut(...args);
  };

  // Visibility changes
  document.addEventListener("visibilitychange", async () => {
    const { data } = await supabase.auth.getSession();
    mlog("visibility", {
      state: document.visibilityState,
      has_session: !!data.session,
      uid: data.session?.user?.id ?? null,
      expires_at: data.session?.expires_at ?? null,
    });
  });

  // Network changes
  window.addEventListener("online", () => mlog("network", { status: "online" }));
  window.addEventListener("offline", () => mlog("network", { status: "offline" }));

  // JS errors
  window.addEventListener("error", (e) =>
    mlog("js_error", { msg: e.message, filename: e.filename, lineno: e.lineno })
  );
  window.addEventListener("unhandledrejection", (e) =>
    mlog("promise_error", { reason: String(e.reason) })
  );

  // Initial state
  supabase.auth.getSession().then(({ data }) => {
    mlog("init", {
      has_session: !!data.session,
      uid: data.session?.user?.id ?? null,
      expires_at: data.session?.expires_at ?? null,
      storage_type: "indexeddb_localforage",
    });
  });

  console.log("[AUTHDBG] Logger remoto instalado");
};
