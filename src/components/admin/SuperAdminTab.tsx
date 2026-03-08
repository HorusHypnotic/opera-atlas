import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Building2, Users, HardHat, Crown, Save } from "lucide-react";

interface TenantRow {
  id: string;
  nome: string;
  cnpj: string | null;
  limite_obras: number;
  created_at: string;
  _obra_count?: number;
  _user_count?: number;
}

export function SuperAdminTab() {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [editingLimits, setEditingLimits] = useState<Record<string, number>>({});

  const fetchTenants = async () => {
    const { data: tenantData } = await supabase
      .from("tenants")
      .select("*")
      .order("created_at", { ascending: false });

    if (!tenantData) return;

    // Fetch obra counts and user counts per tenant
    const enriched = await Promise.all(
      tenantData.map(async (t: any) => {
        const [obrasRes, usersRes] = await Promise.all([
          supabase.from("obras").select("id", { count: "exact", head: true }).eq("tenant_id", t.id),
          supabase.from("profiles").select("id", { count: "exact", head: true }).eq("tenant_id", t.id),
        ]);
        return {
          ...t,
          _obra_count: obrasRes.count ?? 0,
          _user_count: usersRes.count ?? 0,
        } as TenantRow;
      })
    );

    setTenants(enriched);
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const updateLimit = async (tenantId: string) => {
    const newLimit = editingLimits[tenantId];
    if (newLimit === undefined || newLimit < 1) return;

    const { error } = await supabase
      .from("tenants")
      .update({ limite_obras: newLimit })
      .eq("id", tenantId);

    if (error) {
      toast.error("Erro ao atualizar limite: " + error.message);
    } else {
      toast.success("Limite atualizado!");
      setEditingLimits((prev) => {
        const copy = { ...prev };
        delete copy[tenantId];
        return copy;
      });
      fetchTenants();
    }
  };

  const totalObras = tenants.reduce((acc, t) => acc + (t._obra_count || 0), 0);
  const totalUsers = tenants.reduce((acc, t) => acc + (t._user_count || 0), 0);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="glass-card">
          <CardContent className="p-4 text-center space-y-1">
            <Building2 className="h-5 w-5 mx-auto text-primary" />
            <p className="text-2xl font-bold text-primary">{tenants.length}</p>
            <p className="text-xs text-muted-foreground">Clientes</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 text-center space-y-1">
            <Users className="h-5 w-5 mx-auto text-chart-4" />
            <p className="text-2xl font-bold text-chart-4">{totalUsers}</p>
            <p className="text-xs text-muted-foreground">Usuários</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 text-center space-y-1">
            <HardHat className="h-5 w-5 mx-auto text-status-ok" />
            <p className="text-2xl font-bold text-status-ok">{totalObras}</p>
            <p className="text-xs text-muted-foreground">Obras Total</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 text-center space-y-1">
            <Crown className="h-5 w-5 mx-auto text-destructive" />
            <p className="text-2xl font-bold text-destructive">∞</p>
            <p className="text-xs text-muted-foreground">Super Admin</p>
          </CardContent>
        </Card>
      </div>

      {/* Tenants Table */}
      <Card className="glass-card overflow-x-auto">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Clientes (Tenants)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table className="min-w-[600px]">
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead className="text-center">Usuários</TableHead>
                <TableHead className="text-center">Obras</TableHead>
                <TableHead className="text-center">Limite Obras</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="w-[80px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.nome}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.cnpj || "—"}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="text-xs">{t._user_count}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant="secondary"
                      className={`text-xs ${(t._obra_count || 0) >= t.limite_obras ? "bg-destructive/20 text-destructive" : "bg-status-ok/20 text-status-ok"}`}
                    >
                      {t._obra_count}/{t.limite_obras}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      className="w-20 h-7 text-center mx-auto"
                      value={editingLimits[t.id] ?? t.limite_obras}
                      onChange={(e) => setEditingLimits((prev) => ({ ...prev, [t.id]: parseInt(e.target.value) || 1 }))}
                    />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    {editingLimits[t.id] !== undefined && editingLimits[t.id] !== t.limite_obras && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateLimit(t.id)}>
                        <Save className="h-3.5 w-3.5 text-status-ok" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {tenants.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum cliente cadastrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
