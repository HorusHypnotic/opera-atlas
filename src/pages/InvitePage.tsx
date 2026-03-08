import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";

export default function InvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const [invite, setInvite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    (supabase as any).from("invites").select("*").eq("token", token).eq("used", false).single()
      .then(({ data }: any) => {
        if (data && new Date(data.expires_at) > new Date()) {
          setInvite(data);
          setEmail(data.email);
        }
        setLoading(false);
      });
  }, [token]);

  const handleSignUp = async () => {
    if (!email || !password || !invite) return;
    setSubmitting(true);

    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: window.location.origin },
    });

    if (authErr) {
      toast.error("Erro ao criar conta: " + authErr.message);
      setSubmitting(false);
      return;
    }

    // Link profile to tenant and assign role
    if (authData.user) {
      await supabase.from("profiles").update({ tenant_id: invite.tenant_id } as any).eq("id", authData.user.id);
      await supabase.from("user_roles").insert({ user_id: authData.user.id, role: invite.role, tenant_id: invite.tenant_id } as any);
      await (supabase as any).from("invites").update({ used: true }).eq("id", invite.id);
    }

    toast.success("Conta criada! Verifique seu email para confirmar.");
    setSubmitting(false);
    navigate("/login");
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div>;

  if (!invite) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="glass-card p-8 max-w-sm text-center space-y-4">
        <p className="text-lg font-semibold">Convite inválido ou expirado</p>
        <Button onClick={() => navigate("/login")}>Ir para login</Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="glass-card p-8 w-full max-w-sm space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
            <UserPlus className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Convite O.P.E.R.A.</h1>
            <p className="text-xs text-muted-foreground">Crie sua conta para acessar o sistema</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">Você foi convidado como <strong className="text-foreground">{invite.role}</strong>.</p>
        <div className="space-y-3">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Criar senha" />
          <Button onClick={handleSignUp} disabled={submitting || !password} className="w-full">
            {submitting ? "Criando..." : "Criar Conta"}
          </Button>
        </div>
      </div>
    </div>
  );
}
