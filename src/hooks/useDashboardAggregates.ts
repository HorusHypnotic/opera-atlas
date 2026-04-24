import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useObra } from "@/hooks/useObra";
import { usePeriodFilter } from "@/hooks/usePeriodFilter";

export interface DashboardAggregates {
  periodo?: { inicio: string; fim: string };
  financeiro?: { receita: number; custo: number; saldo: number; pendentes: number };
  presenca?: { total_diarias: number; faltas: number; registros: number };
  consumo?: { previsto: number; real: number; desvio_pct: number; itens: number };
  incidentes?: { abertos: number; total: number };
  capacidade?: { esperado_total: number; eficiencia_pct: number | null };
}

/**
 * Server-side aggregates via RPC (1 round-trip ao invés de 12).
 * Período vem do PeriodFilterContext — queryKey inclui start/end para refetch automático.
 */
export function useDashboardAggregates(start?: string, end?: string) {
  const { profile, isGuest, sessionStable } = useAuth();
  const { selectedObraId } = useObra();
  const { start: ctxStart, end: ctxEnd } = usePeriodFilter();
  const tenantId = profile?.tenant_id || null;

  const _start = start ?? ctxStart ?? null; // null = sem corte (todo o período)
  const _end = end ?? ctxEnd;

  return useQuery({
    queryKey: ["dashboard_aggregates", tenantId, selectedObraId, _start, _end],
    queryFn: async (): Promise<DashboardAggregates> => {
      if (isGuest || !tenantId) return {};
      const args: any = { _obra_id: selectedObraId || null, _end };
      if (_start) args._start = _start;
      const { data, error } = await supabase.rpc("dashboard_aggregates", args);
      if (error) throw error;
      return (data as DashboardAggregates) || {};
    },
    enabled: !!tenantId && !!_end && sessionStable && !isGuest,
    staleTime: 0, // filtros = sempre fresh (coordenada #6)
    gcTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

export interface EficienciaPresencaRow {
  esperado: number;
  presente: number;
  eficiencia: number | null;
}

/**
 * Eficiência de presença (capacidade real vs. esperada). Fonte oficial — substitui calculateCapacidade no client.
 */
export function useEficienciaPresenca(obraId: string | null, data?: string) {
  const { profile, isGuest, sessionStable } = useAuth();
  const { end: ctxEnd } = usePeriodFilter();
  const tenantId = profile?.tenant_id || null;
  const _data = data || ctxEnd;

  return useQuery({
    queryKey: ["eficiencia_presenca", tenantId, obraId, _data],
    queryFn: async (): Promise<EficienciaPresencaRow | null> => {
      if (!obraId || isGuest || !tenantId) return null;
      const { data: rows, error } = await supabase.rpc("eficiencia_presenca", {
        _obra_id: obraId,
        _data,
      });
      if (error) throw error;
      const row = Array.isArray(rows) ? rows[0] : rows;
      return row || null;
    },
    enabled: !!obraId && !!tenantId && !!_data && sessionStable && !isGuest,
    staleTime: 0, // filtros = sempre fresh (coordenada #6)
    gcTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
