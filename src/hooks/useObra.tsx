import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DEMO_OBRAS } from "@/data/demoData";

interface Obra {
  id: string;
  nome: string;
  endereco: string | null;
  status: string;
  data_inicio: string | null;
  data_previsao: string | null;
  orcamento_total: number;
  custo_orcado_m2: number;
  area_m2: number;
  fase_atual: string;
  abordagem: string;
  responsavel: string | null;
  descricao: string | null;
  tipo_obra: string;
}

interface ObraContextType {
  obras: Obra[];
  selectedObraId: string | null;
  setSelectedObraId: (id: string | null) => void;
  selectedObra: Obra | null;
  loading: boolean;
  refetch: () => void;
}

const ObraContext = createContext<ObraContextType | undefined>(undefined);

export function ObraProvider({ children }: { children: ReactNode }) {
  const { profile, isGuest } = useAuth();
  const [obras, setObras] = useState<Obra[]>([]);
  const [selectedObraId, setSelectedObraId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchObras = async () => {
    if (isGuest) {
      setObras(DEMO_OBRAS);
      if (!selectedObraId) setSelectedObraId(DEMO_OBRAS[0].id);
      setLoading(false);
      return;
    }
    if (!profile?.tenant_id) {
      setObras([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("obras")
      .select("id, nome, endereco, status, data_inicio, data_previsao, orcamento_total, custo_orcado_m2, area_m2, fase_atual, abordagem, responsavel, descricao, tipo_obra")
      .eq("tenant_id", profile.tenant_id)
      .order("created_at", { ascending: false });

    const list = (data || []) as Obra[];
    setObras(list);
    if (!selectedObraId && list.length > 0) {
      setSelectedObraId(list[0].id);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchObras();
  }, [profile?.tenant_id, isGuest]);

  const selectedObra = obras.find((o) => o.id === selectedObraId) || null;

  return (
    <ObraContext.Provider
      value={{ obras, selectedObraId, setSelectedObraId, selectedObra, loading, refetch: fetchObras }}
    >
      {children}
    </ObraContext.Provider>
  );
}

export function useObra() {
  const ctx = useContext(ObraContext);
  if (!ctx) throw new Error("useObra must be used within ObraProvider");
  return ctx;
}
