import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { LogIn, UserCheck } from "lucide-react";

export default function LoginPage() {
  const { user, loading, enterGuestMode } = useAuth();
  const navigate = useNavigate();
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate("/", { replace: true });
    }
  }, [user, loading, navigate]);

  const handleGoogleLogin = async () => {
    setSigningIn(true);
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (error) {
      console.error("Login error:", error);
      setSigningIn(false);
    }
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

        <p className="text-sm text-muted-foreground">
          Faça login para acessar o sistema de gestão
        </p>

        <div className="space-y-3">
          <Button
            onClick={handleGoogleLogin}
            disabled={signingIn}
            className="w-full gap-2"
            size="lg"
          >
            <LogIn className="h-4 w-4" />
            {signingIn ? "Redirecionando..." : "Entrar com Google"}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 text-muted-foreground">ou</span>
            </div>
          </div>

          <Button
            onClick={handleGuest}
            variant="outline"
            className="w-full gap-2"
            size="lg"
          >
            <UserCheck className="h-4 w-4" />
            Entrar como Convidado
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground">
          Modo convidado permite explorar o sistema com dados de demonstração.
        </p>
      </div>
    </div>
  );
}
