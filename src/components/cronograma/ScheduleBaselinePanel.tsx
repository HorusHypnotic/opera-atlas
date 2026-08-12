import { useCallback, useEffect, useState } from "react";
import { History, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

type BaselineHistoryItem = {
  id: string;
  versao: number;
  aprovado_em: string;
  aprovado_por: string;
  aprovado_por_nome: string;
  hash_snapshot: string;
  vigente: boolean;
  motivo: string | null;
};

export function ScheduleBaselinePanel({ obraId }: { obraId: string }) {
  const { isAdmin, isGuest, isSuperAdmin } = useAuth();
  const [history, setHistory] = useState<BaselineHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const canApprove = isAdmin && !isGuest && !isSuperAdmin;

  const loadHistory = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("listar_baselines_cronograma", { _obra_id: obraId });
    setLoading(false);
    if (error) {
      toast.error(`Não foi possível carregar os baselines: ${error.message}`);
      return;
    }
    setHistory((data ?? []) as BaselineHistoryItem[]);
  }, [obraId]);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  const approve = async () => {
    setApproving(true);
    const { data, error } = await supabase.rpc("aprovar_baseline_cronograma", {
      _obra_id: obraId,
      _motivo: null,
    });
    setApproving(false);
    if (error) {
      toast.error(`Baseline não aprovado: ${error.message}`);
      return;
    }
    const result = data as { versao?: number } | null;
    toast.success(`Baseline v${result?.versao ?? ""} aprovado`);
    setConfirmOpen(false);
    await loadHistory();
  };

  const current = history.find((item) => item.vigente);

  return (
    <>
      <Card className="flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="flex items-center gap-2">
          <LockKeyhole className="h-4 w-4 text-primary" />
          <div>
            <p className="text-sm font-medium">
              {loading ? "Carregando baseline…" : current ? `Baseline v${current.versao} vigente` : "Sem baseline aprovado"}
            </p>
            {current && <p className="font-mono text-xs text-muted-foreground">SHA-256 {current.hash_snapshot.slice(0, 12)}…</p>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
            <History className="mr-1 h-4 w-4" /> Histórico
          </Button>
          {canApprove && <Button size="sm" onClick={() => setConfirmOpen(true)}>Aprovar baseline</Button>}
        </div>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprovar baseline do cronograma?</DialogTitle>
            <DialogDescription>
              Esta ação congela o compromisso de prazo atual em uma versão imutável. Mudanças futuras exigirão uma nova versão.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button onClick={() => void approve()} disabled={approving}>
              {approving ? "Aprovando…" : "Aprovar e congelar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Histórico de baselines</DialogTitle>
            <DialogDescription>Versões aprovadas do compromisso de prazo desta obra.</DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {history.length === 0 && <p className="text-sm text-muted-foreground">Nenhum baseline aprovado.</p>}
            {history.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 rounded-md border p-3 text-sm">
                <div>
                  <p className="font-medium">v{item.versao} {item.vigente ? "· vigente" : "· histórica"}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.aprovado_em))}
                    {` · ${item.aprovado_por_nome}`}
                  </p>
                </div>
                <code className="text-xs text-muted-foreground">{item.hash_snapshot.slice(0, 12)}…</code>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
