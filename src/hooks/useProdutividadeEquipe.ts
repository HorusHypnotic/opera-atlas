import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export interface ProdutividadeEquipeRow {
  equipe: string;
  registros: number;
  dias_trabalhados: number;
  producao_total: number;
  producao_media_dia: number;
}

/**
 * RPC oficial — fonte única de verdade para produtividade por equipe.
 * Usa producao_valor (numérico) e equipe_normalizada (lowercase + underscore).
 */
export function useProdutividadeEquipe(obraId: string | null, start?: string, end?: string) {
  const { profile, isGuest, sessionStable } = useAuth();
  const tenantId = profile?.tenant_id || null;

  const today = new Date().toISOString().substring(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().substring(0, 10);
  const _start = start || thirtyDaysAgo;
  const _end = end || today;

  return useQuery({
    queryKey: ["produtividade_equipe", tenantId, obraId, _start, _end],
    queryFn: async (): Promise<ProdutividadeEquipeRow[]> => {
      if (!obraId || isGuest || !tenantId) return [];
      const { data, error } = await supabase.rpc("produtividade_por_equipe", {
        _obra_id: obraId,
        _start,
        _end,
      });
      if (error) throw error;
      return (data as ProdutividadeEquipeRow[]) || [];
    },
    enabled: !!obraId && !!tenantId && sessionStable && !isGuest,
    staleTime: 60_000,
  });
}
