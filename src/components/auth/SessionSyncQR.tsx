import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { QrCode, Loader2, RefreshCw, Copy, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export function SessionSyncQR() {
  const [link, setLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expiresIn, setExpiresIn] = useState(300);

  const generateLink = async () => {
    setLoading(true);
    setCopied(false);
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
          body: JSON.stringify({
            redirect_to: window.location.origin,
          }),
        }
      );

      const result = await resp.json();
      if (!resp.ok) {
        throw new Error(result.error || "Erro ao gerar link");
      }

      if (!result.link) {
        throw new Error("Link não retornado");
      }

      setLink(result.link);
      setExpiresIn(300);

      const interval = setInterval(() => {
        setExpiresIn((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setLink(null);
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

  const copyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4 rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <QrCode className="h-4 w-4 text-primary" />
        Login no celular via QR
      </div>

      {!link ? (
        <div className="text-center space-y-3">
          <p className="text-xs text-muted-foreground max-w-[240px]">
            Gera um link de login único para o celular. Sua sessão no PC não será afetada.
          </p>
          <Button
            onClick={generateLink}
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
        </div>
      ) : (
        <>
          <div className="bg-white p-3 rounded-lg">
            <QRCodeSVG value={link} size={200} level="M" />
          </div>
          <div className="text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              Escaneie com a câmera do celular para fazer login
            </p>
            <p className="text-[10px] text-muted-foreground">
              Expira em {Math.floor(expiresIn / 60)}:{String(expiresIn % 60).padStart(2, "0")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={copyLink}
              variant="outline"
              size="sm"
              className="gap-1 text-xs"
            >
              {copied ? <CheckCircle className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copiado" : "Copiar link"}
            </Button>
            <Button
              onClick={generateLink}
              variant="ghost"
              size="sm"
              className="gap-1 text-xs"
            >
              <RefreshCw className="h-3 w-3" />
              Novo
            </Button>
          </div>
        </>
      )}

      <p className="text-[10px] text-muted-foreground text-center max-w-[240px]">
        O link cria uma sessão independente no celular. O PC continua logado normalmente.
      </p>
    </div>
  );
}
