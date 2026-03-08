import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, UserPlus, Building2, HardHat, Shield, Trash2, Mail, Copy, Check, Rocket, Link2, Settings, BarChart3, Crown, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Navigate } from "react-router-dom";
import { BetaUsersTab } from "@/components/admin/BetaUsersTab";
import { InfluencerCodesTab } from "@/components/admin/InfluencerCodesTab";
import { BetaConfigTab } from "@/components/admin/BetaConfigTab";
import { BetaMetricsTab } from "@/components/admin/BetaMetricsTab";
import { SuperAdminTab } from "@/components/admin/SuperAdminTab";
import { ObraMembrosTab } from "@/components/admin/ObraMembrosTab";

type AppRole = "admin" | "gestor" | "operacional" | "visualizador";

interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  tenant_id: string | null;
}

interface RoleRow {
  id: string;
  user_id: string;
  role: AppRole;
  tenant_id: string | null;
}

interface ObraRow {
  id: string;
  nome: string;
  endereco: string | null;
  status: string;
  data_inicio: string | null;
  data_previsao: string | null;
}

const roleBadgeColor: Record<AppRole, string> = {
  admin: "bg-destructive/20 text-destructive",
  gestor: "bg-primary/20 text-primary",
  operacional: "bg-chart-4/20 text-chart-4",
  visualizador: "bg-muted text-muted-foreground",
};

export default function AdminPage() {
  const { isAdmin, profile, isSuperAdmin } = useAuth();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [userRoles, setUserRoles] = useState<RoleRow[]>([]);
  const [obras, setObras] = useState<ObraRow[]>([]);
  const [newObraNome, setNewObraNome] = useState("");
  const [newObraEndereco, setNewObraEndereco] = useState("");
  const [obraDialogOpen, setObraDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AppRole>("visualizador");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("visualizador");
  const [invites, setInvites] = useState<any[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const tenantId = profile?.tenant_id;

  const fetchData = async () => {
    if (!tenantId) return;

    const [profRes, rolesRes, obrasRes, invitesRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("tenant_id", tenantId),
      supabase.from("user_roles").select("*").eq("tenant_id", tenantId),
      supabase.from("obras").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
      supabase.from("invites").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
    ]);

    if (profRes.data) setProfiles(profRes.data as ProfileRow[]);
    if (rolesRes.data) setUserRoles(rolesRes.data as RoleRow[]);
    if (obrasRes.data) setObras(obrasRes.data as ObraRow[]);
    if (invitesRes.data) setInvites(invitesRes.data);
  };

  useEffect(() => {
    fetchData();
  }, [tenantId]);

  if (!isAdmin && !isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  const getUserRoles = (userId: string) => userRoles.filter((r) => r.user_id === userId);

  const addRole = async () => {
    if (!selectedUserId || !tenantId) return;
    const { error } = await supabase.from("user_roles").insert({
      user_id: selectedUserId,
      role: selectedRole,
      tenant_id: tenantId,
    } as any);
    if (error) {
      toast.error("Erro ao adicionar papel: " + error.message);
    } else {
      toast.success("Papel adicionado!");
      fetchData();
    }
  };

  const removeRole = async (roleId: string) => {
    const { error } = await supabase.from("user_roles").delete().eq("id", roleId);
    if (error) {
      toast.error("Erro ao remover papel");
    } else {
      toast.success("Papel removido");
      fetchData();
    }
  };

  const addObra = async () => {
    if (!newObraNome.trim() || !tenantId) return;
    const { error } = await supabase.from("obras").insert({
      nome: newObraNome,
      endereco: newObraEndereco || null,
      tenant_id: tenantId,
    } as any);
    if (error) {
      const msg = error.message.includes("Limite de obras") 
        ? "Limite de obras atingido para este cliente. Aumente o limite nas configurações do tenant."
        : "Erro ao criar obra: " + error.message;
      toast.error(msg);
    } else {
      toast.success("Obra criada!");
      setNewObraNome("");
      setNewObraEndereco("");
      setObraDialogOpen(false);
      fetchData();
    }
  };

  const deleteObra = async (id: string) => {
    const { error } = await supabase.from("obras").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir obra");
    } else {
      toast.success("Obra excluída");
      fetchData();
    }
  };

  const sendInvite = async () => {
    if (!inviteEmail.trim() || !tenantId) return;
    setInviteLoading(true);
    const { error } = await supabase.from("invites").insert({
      email: inviteEmail,
      role: inviteRole,
      tenant_id: tenantId,
    } as any);
    setInviteLoading(false);
    if (error) {
      toast.error("Erro ao criar convite: " + error.message);
    } else {
      toast.success("Convite criado!");
      setInviteEmail("");
      fetchData();
    }
  };

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/invite?token=${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    toast.success("Link copiado!");
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const deleteInvite = async (id: string) => {
    const { error } = await supabase.from("invites").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir convite");
    else { toast.success("Convite removido"); fetchData(); }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Painel Administrativo"
        subtitle="Gerencie usuários, permissões e obras"
        icon={<Shield className="h-6 w-6" />}
      />

      <Tabs defaultValue="usuarios" className="space-y-4">
        <TabsList className="w-full overflow-x-auto flex flex-nowrap h-auto gap-1 p-1 justify-start">
          <TabsTrigger value="usuarios" className="gap-1.5 shrink-0 text-xs sm:text-sm">
            <UserPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Usuários &</span> Permissões
          </TabsTrigger>
          <TabsTrigger value="convites" className="gap-1.5 shrink-0 text-xs sm:text-sm">
            <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Convites
          </TabsTrigger>
          <TabsTrigger value="obras" className="gap-1.5 shrink-0 text-xs sm:text-sm">
            <HardHat className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Obras
          </TabsTrigger>
          <TabsTrigger value="equipe-obra" className="gap-1.5 shrink-0 text-xs sm:text-sm">
            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Equipe
          </TabsTrigger>
          <TabsTrigger value="beta-users" className="gap-1.5 shrink-0 text-xs sm:text-sm">
            <Rocket className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Beta
          </TabsTrigger>
          <TabsTrigger value="influencers" className="gap-1.5 shrink-0 text-xs sm:text-sm">
            <Link2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Influenciadores</span><span className="sm:hidden">Inflr.</span>
          </TabsTrigger>
          <TabsTrigger value="beta-config" className="gap-1.5 shrink-0 text-xs sm:text-sm">
            <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Config
          </TabsTrigger>
          <TabsTrigger value="beta-metrics" className="gap-1.5 shrink-0 text-xs sm:text-sm">
            <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Métricas
          </TabsTrigger>
          {isSuperAdmin && (
            <TabsTrigger value="super-admin" className="gap-1.5 shrink-0 text-xs sm:text-sm">
              <Crown className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Super Admin
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="usuarios" className="space-y-4">
          {/* Assign role */}
          <div className="glass-card p-4 flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Usuário</label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Selecionar usuário" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name || p.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Papel</label>
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="gestor">Gestor</SelectItem>
                  <SelectItem value="operacional">Operacional</SelectItem>
                  <SelectItem value="visualizador">Visualizador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={addRole} className="gap-1.5">
              <Plus className="h-4 w-4" /> Atribuir
            </Button>
          </div>

          {/* Users table */}
          <div className="glass-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Papéis</TableHead>
                  <TableHead className="w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.full_name || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {getUserRoles(p.id).map((r) => (
                          <Badge key={r.id} variant="secondary" className={`${roleBadgeColor[r.role]} text-xs cursor-pointer`} onClick={() => removeRole(r.id)}>
                            {r.role} ✕
                          </Badge>
                        ))}
                        {getUserRoles(p.id).length === 0 && (
                          <span className="text-xs text-muted-foreground">Sem papel</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                ))}
                {profiles.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Nenhum usuário encontrado neste tenant
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="convites" className="space-y-4">
          <div className="glass-card p-4 flex flex-wrap items-end gap-3">
            <div className="space-y-1 flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground">Email do convidado</label>
              <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colaborador@empresa.com" type="email" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Papel</label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="gestor">Gestor</SelectItem>
                  <SelectItem value="operacional">Operacional</SelectItem>
                  <SelectItem value="visualizador">Visualizador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={sendInvite} disabled={inviteLoading || !inviteEmail.trim()} className="gap-1.5">
              <Mail className="h-4 w-4" /> {inviteLoading ? "Enviando..." : "Criar Convite"}
            </Button>
          </div>

          <div className="glass-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expira em</TableHead>
                  <TableHead className="w-[120px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((inv) => {
                  const expired = new Date(inv.expires_at) < new Date();
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.email}</TableCell>
                      <TableCell><Badge variant="secondary" className={`${roleBadgeColor[inv.role as AppRole] || ""} text-xs`}>{inv.role}</Badge></TableCell>
                      <TableCell>
                        {inv.used ? <Badge variant="secondary" className="text-xs">Usado</Badge> :
                         expired ? <Badge variant="destructive" className="text-xs">Expirado</Badge> :
                         <Badge variant="secondary" className="bg-status-ok/20 text-status-ok text-xs">Ativo</Badge>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(inv.expires_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyInviteLink(inv.token)} disabled={inv.used || expired}>
                            {copiedToken === inv.token ? <Check className="h-3.5 w-3.5 text-status-ok" /> : <Copy className="h-3.5 w-3.5" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteInvite(inv.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {invites.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhum convite enviado ainda
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="obras" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Obras cadastradas</h3>
            <Dialog open={obraDialogOpen} onOpenChange={setObraDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" /> Nova Obra
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cadastrar Nova Obra</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Nome da obra</label>
                    <Input value={newObraNome} onChange={(e) => setNewObraNome(e.target.value)} placeholder="Ex: Residencial Vila Nova" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Endereço</label>
                    <Input value={newObraEndereco} onChange={(e) => setNewObraEndereco(e.target.value)} placeholder="Ex: Rua das Flores, 123" />
                  </div>
                  <Button onClick={addObra} className="w-full">Criar Obra</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="glass-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Endereço</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {obras.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.nome}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{o.endereco || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {o.status === "em_andamento" ? "Em andamento" : o.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => deleteObra(o.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {obras.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Nenhuma obra cadastrada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="equipe-obra" className="space-y-4">
          <ObraMembrosTab />
        </TabsContent>

        <TabsContent value="beta-users" className="space-y-4">
          <BetaUsersTab />
        </TabsContent>

        <TabsContent value="influencers" className="space-y-4">
          <InfluencerCodesTab />
        </TabsContent>

        <TabsContent value="beta-config" className="space-y-4">
          <BetaConfigTab />
        </TabsContent>

        <TabsContent value="beta-metrics" className="space-y-4">
          <BetaMetricsTab />
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="super-admin" className="space-y-4">
            <SuperAdminTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
