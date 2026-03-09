import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useObra } from "@/hooks/useObra";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DEMO_DATA } from "@/data/demoData";
import { toast } from "sonner";

export function useTableData<T = any>(table: string) {
  const { profile, isGuest } = useAuth();
  const { selectedObraId } = useObra();
  const tenantId = profile?.tenant_id || null;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [table, tenantId, selectedObraId, isGuest],
    queryFn: async () => {
      if (isGuest) {
        const demoRows = (DEMO_DATA[table] || []) as T[];
        if (selectedObraId) {
          return demoRows.filter((r: any) => r.obra_id === selectedObraId);
        }
        return demoRows;
      }
      let q = (supabase as any).from(table).select("*");
      if (tenantId) q = q.eq("tenant_id", tenantId);
      if (selectedObraId) q = q.eq("obra_id", selectedObraId);
      q = q.order("created_at", { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as T[];
    },
    enabled: isGuest || !!tenantId,
  });

  const refetchAll = () => {
    queryClient.invalidateQueries({ queryKey: [table] });
  };

  // Tables that do NOT have an obra_id column
  const tablesWithoutObraId = ["colaboradores", "profiles", "tenants", "user_roles", "obra_membros", "invites", "beta_waitlist", "beta_config", "influencer_codes"];

  const insert = async (record: Record<string, any>) => {
    if (isGuest) {
      toast.info("Modo convidado: dados não são salvos no banco");
      return { error: null };
    }
    if (!tenantId) return { error: { message: "Sem tenant" } };
    const payload = { ...record, tenant_id: tenantId } as any;
    if (selectedObraId && !tablesWithoutObraId.includes(table)) payload.obra_id = selectedObraId;
    const { error } = await (supabase as any).from(table).insert(payload);
    if (!error) refetchAll();
    return { error };
  };

  const update = async (id: string, values: Record<string, any>) => {
    if (isGuest) {
      toast.info("Modo convidado: dados não são salvos no banco");
      return { error: null };
    }
    const { error } = await (supabase as any).from(table).update(values).eq("id", id);
    if (!error) refetchAll();
    return { error };
  };

  const remove = async (id: string) => {
    if (isGuest) {
      toast.info("Modo convidado: dados não são salvos no banco");
      return;
    }
    const { error } = await (supabase as any).from(table).delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir: " + error.message);
    } else {
      toast.success("Registro excluído");
      refetchAll();
    }
  };

  return { ...query, insert, update, remove };
}
