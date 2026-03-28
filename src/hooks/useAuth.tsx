import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { ensureSession } from "@/integrations/supabase/authWrapper";
import type { User, Session } from "@supabase/supabase-js";

type AppRole = "admin" | "gestor" | "operacional" | "visualizador";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  tenant_id: string | null;
  is_super_admin: boolean;
  beta_approved_at: string | null;
}

const GUEST_PROFILE: Profile = {
  id: "guest",
  email: "convidado@opera.demo",
  full_name: "Convidado",
  avatar_url: null,
  tenant_id: "guest-tenant",
  is_super_admin: false,
  beta_approved_at: null,
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  hasRole: (role: AppRole) => boolean;
  isAdmin: boolean;
  isGestor: boolean;
  isGuest: boolean;
  isSuperAdmin: boolean;
  isTrialExpired: boolean;
  signOut: () => Promise<void>;
  enterGuestMode: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  const fetchProfileAndRoles = async (userId: string) => {
    const [profileRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);

    if (profileRes.data) {
      const p = profileRes.data as any;
      setProfile({ ...p, is_super_admin: p.is_super_admin === true } as Profile);
    }
    if (rolesRes.data) {
      setRoles((rolesRes.data as { role: AppRole }[]).map((r) => r.role));
    }
  };

  useEffect(() => {
    // Restore guest mode from sessionStorage
    const savedGuest = sessionStorage.getItem("opera_guest");
    if (savedGuest === "true") {
      setIsGuest(true);
      setProfile(GUEST_PROFILE);
      setRoles(["admin", "gestor", "operacional", "visualizador"]);
      setLoading(false);
      return;
    }

    let alive = true;

    // Rehydrate: tries getSession first, then refreshSession as fallback.
    // This prevents ejecting the user when the access token expired while
    // the PWA was in the background or after an OS kill.
    const rehydrate = async () => {
      try {
        const { data: { session: current } } = await supabase.auth.getSession();
        let sess = current;

        if (!sess) {
          console.log("[Auth] Sessão expirada, tentando refresh...");
          const { data } = await supabase.auth.refreshSession();
          sess = data.session;
        }

        if (!alive) return;

        setSession(sess);
        setUser(sess?.user ?? null);

        if (sess?.user) {
          await fetchProfileAndRoles(sess.user.id);
        }
      } catch (err) {
        console.warn("[Auth] Erro no rehydrate:", err);
      } finally {
        if (alive) setLoading(false);
      }
    };

    // Listen for auth changes. If session becomes null (but it's NOT a
    // SIGNED_OUT event), try to rehydrate instead of ejecting.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, sess) => {
        if (!alive) return;

        if (sess?.user) {
          setSession(sess);
          setUser(sess.user);
          setTimeout(() => fetchProfileAndRoles(sess.user.id), 0);
          setLoading(false);
          return;
        }

        if (event === "SIGNED_OUT") {
          setSession(null);
          setUser(null);
          setProfile(null);
          setRoles([]);
          setLoading(false);
          return;
        }

        // null session but NOT a sign-out → try to recover
        console.log("[Auth] Sessão null recebida (event:", event, ") — tentando rehydrate");
        await rehydrate();
      }
    );

    // When the PWA comes back from background, rehydrate the session
    const onVisibilityChange = () => {
      if (!document.hidden) {
        console.log("[Auth] App voltou ao foco — rehydrate");
        rehydrate();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", rehydrate);

    // Initial load
    rehydrate();

    return () => {
      alive = false;
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", rehydrate);
    };
  }, []);

  const enterGuestMode = () => {
    setIsGuest(true);
    setProfile(GUEST_PROFILE);
    setRoles(["admin", "gestor", "operacional", "visualizador"]);
    setUser({ id: "guest" } as User);
    sessionStorage.setItem("opera_guest", "true");
  };

  const hasRole = (role: AppRole) => roles.includes(role);

  const signOut = async () => {
    if (isGuest) {
      setIsGuest(false);
      sessionStorage.removeItem("opera_guest");
    } else {
      await supabase.auth.signOut();
    }
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
  };

  const computeTrialExpired = (): boolean => {
    if (!profile?.beta_approved_at) return false;
    if (profile.is_super_admin) return false;
    const approvedAt = new Date(profile.beta_approved_at);
    const now = new Date();
    const diffDays = (now.getTime() - approvedAt.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > 30;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        roles,
        loading,
        hasRole,
        isAdmin: hasRole("admin"),
        isGestor: hasRole("gestor"),
        isGuest,
        isSuperAdmin: profile?.is_super_admin ?? false,
        isTrialExpired: computeTrialExpired(),
        signOut,
        enterGuestMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
