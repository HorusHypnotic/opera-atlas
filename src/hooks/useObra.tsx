import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Obra {
  id: string;
  nome: string;
  endereco: string | null;
  status: string;
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
  const { profile } = useAuth();
  const [obras, setObras] = useState<Obra[]>([]);
  const [selectedObraId, setSelectedObraId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchObras = async () => {
    if (!profile?.tenant_id) {
      setObras([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("obras")
      .select("id, nome, endereco, status")
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
  }, [profile?.tenant_id]);

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
