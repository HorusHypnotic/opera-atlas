import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useObra } from "@/hooks/useObra";
import { useQuery } from "@tanstack/react-query";

export function useTableData<T = any>(table: string) {
  const { profile } = useAuth();
  const { selectedObraId } = useObra();
  const tenantId = profile?.tenant_id || null;

  const query = useQuery({
    queryKey: [table, tenantId, selectedObraId],
    queryFn: async () => {
      let q = (supabase as any).from(table).select("*");
      if (tenantId) q = q.eq("tenant_id", tenantId);
      if (selectedObraId) q = q.eq("obra_id", selectedObraId);
      q = q.order("created_at", { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as T[];
    },
    enabled: !!tenantId,
  });

  const insert = async (record: Record<string, any>) => {
    if (!tenantId) return { error: { message: "Sem tenant" } };
    const payload = { ...record, tenant_id: tenantId } as any;
    if (selectedObraId) payload.obra_id = selectedObraId;
    const { error } = await (supabase as any).from(table).insert(payload);
    if (!error) query.refetch();
    return { error };
  };

  return { ...query, insert };
}
