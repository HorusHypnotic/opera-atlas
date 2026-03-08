import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Building2, LogOut } from "lucide-react";

/**
 * First-time setup: when a user has no tenant_id,
 * they create their company (tenant) and become admin.
 */
export default function SetupPage() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSetup = async () => {
    if (!nome.trim() || !user) return;
    setLoading(true);

    // 1. Create tenant
    const { data: tenant, error: tenantErr } = await supabase
      .from("tenants")
      .insert({ nome, cnpj: cnpj || null } as any)
      .select()
      .single();

    if (tenantErr || !tenant) {
      toast.error("Erro ao criar empresa: " + (tenantErr?.message || ""));
      setLoading(false);
      return;
    }

    // 2. Link profile to tenant
    const { error: profileErr } = await supabase
      .from("profiles")
      .update({ tenant_id: (tenant as any).id } as any)
      .eq("id", user.id);

    if (profileErr) {
      toast.error("Erro ao vincular perfil: " + profileErr.message);
      setLoading(false);
      return;
    }

    // 3. Assign admin role
    const { error: roleErr } = await supabase
      .from("user_roles")
      .insert({
        user_id: user.id,
        role: "admin",
        tenant_id: (tenant as any).id,
      } as any);

    if (roleErr) {
      toast.error("Erro ao atribuir papel: " + roleErr.message);
      setLoading(false);
      return;
    }

    toast.success("Empresa criada com sucesso!");
    // Force reload to re-fetch profile/roles
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="glass-card p-8 w-full max-w-md space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
            <Building2 className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Configuração Inicial</h1>
            <p className="text-xs text-muted-foreground">Cadastre sua empresa para começar</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Nome da Empresa</label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Construtora ABC" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">CNPJ (opcional)</label>
            <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
          </div>
          <Button onClick={handleSetup} disabled={loading || !nome.trim()} className="w-full">
            {loading ? "Criando..." : "Criar Empresa e Continuar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
