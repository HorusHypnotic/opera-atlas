import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(() => fetchProfileAndRoles(session.user.id), 0);
        } else {
          setProfile(null);
          setRoles([]);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfileAndRoles(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
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
