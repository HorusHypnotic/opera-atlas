import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogIn, UserCheck, Mail } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const { user, loading, enterGuestMode } = useAuth();
  const navigate = useNavigate();
  const [signingIn, setSigningIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate("/", { replace: true });
    }
  }, [user, loading, navigate]);

  const handleGoogleLogin = async () => {
    setSigningIn(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) {
      toast.error("Erro ao conectar com Google: " + error.message);
      setSigningIn(false);
    }
  };

  const handleEmailAuth = async () => {
    if (!email || !password) {
      toast.error("Preencha email e senha");
      return;
    }
    setEmailLoading(true);

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) {
        toast.error("Erro ao cadastrar: " + error.message);
      } else {
        toast.success("Conta criada! Verifique seu email para confirmar.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error("Erro ao entrar: " + error.message);
      }
    }
    setEmailLoading(false);
  };

  const handleGuest = () => {
    enterGuestMode();
    navigate("/", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="glass-card p-8 w-full max-w-sm text-center space-y-6">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center font-bold text-primary-foreground text-lg">
            OP
          </div>
          <div className="text-left">
            <h1 className="text-xl font-bold tracking-tight">Método O.P.E.R.A.</h1>
            <p className="text-xs text-muted-foreground">Gestão Inteligente de Obras</p>
          </div>
        </div>

        <div className="space-y-3">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleEmailAuth()}
          />
          <Button
            onClick={handleEmailAuth}
            disabled={emailLoading}
            className="w-full gap-2"
            size="lg"
          >
            <Mail className="h-4 w-4" />
            {emailLoading ? "Aguarde..." : isSignUp ? "Criar Conta" : "Entrar com Email"}
          </Button>
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            {isSignUp ? "Já tem conta? Faça login" : "Não tem conta? Cadastre-se"}
          </button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-card px-2 text-muted-foreground">ou</span>
          </div>
        </div>

        <div className="space-y-3">
          <Button
            onClick={handleGoogleLogin}
            disabled={signingIn}
            variant="outline"
            className="w-full gap-2"
            size="lg"
          >
            <LogIn className="h-4 w-4" />
            {signingIn ? "Redirecionando..." : "Entrar com Google"}
          </Button>

          <Button
            onClick={handleGuest}
            variant="ghost"
            className="w-full gap-2 text-muted-foreground"
            size="lg"
          >
            <UserCheck className="h-4 w-4" />
            Entrar como Convidado (Demo)
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground">
          Modo convidado permite explorar o sistema com dados de demonstração.
        </p>
      </div>
    </div>
  );
}
