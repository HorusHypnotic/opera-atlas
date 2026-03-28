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

    let mounted = true;
    // CRITICAL: prevent the app from ejecting the user while Supabase is still
    // restoring / refreshing the session on startup (mobile PWA fix).
    let booted = false;

    // 1. First, kick off the initial session check
    ensureSession().then((sess) => {
      if (!mounted) return;
      booted = true;
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        fetchProfileAndRoles(sess.user.id);
      }
      setLoading(false);
    });

    // 2. Listen for auth changes, but IGNORE the initial null event
    //    that fires before getSession/ensureSession resolves.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, sess) => {
        if (!mounted) return;

        // While still booting, ignore null sessions — they are just the
        // "I haven't checked storage yet" initial state.
        if (!booted && !sess) {
          console.log("[Auth] Ignorando evento null durante boot (mobile fix)");
          return;
        }

        booted = true;
        setSession(sess);
        setUser(sess?.user ?? null);

        if (sess?.user) {
          setTimeout(() => fetchProfileAndRoles(sess.user.id), 0);
        } else if (event === "SIGNED_OUT") {
          setProfile(null);
          setRoles([]);
        }
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
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
