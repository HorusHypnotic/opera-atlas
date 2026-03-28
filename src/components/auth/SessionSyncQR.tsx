import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { QrCode, Loader2, CheckCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export function SessionSyncQR() {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expiresIn, setExpiresIn] = useState(180);

  const generateCode = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Você precisa estar logado para gerar o QR Code.");
        return;
      }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/session-transfer`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ refresh_token: session.refresh_token }),
        }
      );

      const result = await resp.json();
      if (!resp.ok) {
        throw new Error(result.error || "Erro ao gerar código");
      }

      setCode(result.code);
      setExpiresIn(180);

      // Countdown
      const interval = setInterval(() => {
        setExpiresIn((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setCode(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar QR Code");
    } finally {
      setLoading(false);
    }
  };

  const syncUrl = code
    ? `${window.location.origin}/login?sync=${code}`
    : "";

  return (
    <div className="flex flex-col items-center gap-4 p-4 rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <QrCode className="h-4 w-4 text-primary" />
        Sincronizar sessão no celular
      </div>

      {!code ? (
        <Button
          onClick={generateCode}
          disabled={loading}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <QrCode className="h-4 w-4" />
          )}
          {loading ? "Gerando..." : "Gerar QR Code"}
        </Button>
      ) : (
        <>
          <div className="bg-white p-3 rounded-lg">
            <QRCodeSVG value={syncUrl} size={180} level="M" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-xs text-muted-foreground">
              Escaneie com seu celular para transferir a sessão
            </p>
            <p className="text-xs font-mono text-primary font-medium">
              Código: {code}
            </p>
            <p className="text-[10px] text-muted-foreground">
              Expira em {Math.floor(expiresIn / 60)}:{String(expiresIn % 60).padStart(2, "0")}
            </p>
          </div>
          <Button
            onClick={generateCode}
            variant="ghost"
            size="sm"
            className="gap-1 text-xs"
          >
            <RefreshCw className="h-3 w-3" />
            Gerar novo
          </Button>
        </>
      )}

      <p className="text-[10px] text-muted-foreground text-center max-w-[220px]">
        O QR transfere sua sessão para outro dispositivo. Válido por 3 minutos, uso único.
      </p>
    </div>
  );
}
