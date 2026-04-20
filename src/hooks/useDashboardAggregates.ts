import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useObra } from "@/hooks/useObra";

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
 * Cache de 60s — invalidate manualmente após mutations críticas.
 */
export function useDashboardAggregates(start?: string, end?: string) {
  const { profile, isGuest, sessionStable } = useAuth();
  const { selectedObraId } = useObra();
  const tenantId = profile?.tenant_id || null;

  const today = new Date().toISOString().substring(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().substring(0, 10);
  const _start = start || thirtyDaysAgo;
  const _end = end || today;

  return useQuery({
    queryKey: ["dashboard_aggregates", tenantId, selectedObraId, _start, _end],
    queryFn: async (): Promise<DashboardAggregates> => {
      if (isGuest || !tenantId) return {};
      const { data, error } = await supabase.rpc("dashboard_aggregates", {
        _obra_id: selectedObraId || null,
        _start,
        _end,
      });
      if (error) throw error;
      return (data as DashboardAggregates) || {};
    },
    enabled: !!tenantId && sessionStable && !isGuest,
    staleTime: 60_000, // 60s cache
  });
}

export interface EficienciaPresencaRow {
  esperado: number;
  presente: number;
  eficiencia: number | null;
}

export function useEficienciaPresenca(obraId: string | null, data?: string) {
  const { profile, isGuest, sessionStable } = useAuth();
  const tenantId = profile?.tenant_id || null;
  const _data = data || new Date().toISOString().substring(0, 10);

  return useQuery({
    queryKey: ["eficiencia_presenca", obraId, _data],
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
    enabled: !!obraId && !!tenantId && sessionStable && !isGuest,
    staleTime: 60_000,
  });
}
