import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, ShieldCheck, ShieldOff, Trash2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

type AppRole = "admin" | "gestor" | "operacional" | "visualizador";

interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  account_status?: string;
}

interface RoleRow {
  id: string;
  user_id: string;
  role: AppRole;
}

const roleBadgeColor: Record<AppRole, string> = {
  admin: "bg-destructive/20 text-destructive",
  gestor: "bg-primary/20 text-primary",
  operacional: "bg-chart-4/20 text-chart-4",
  visualizador: "bg-muted text-muted-foreground",
};

interface UsersTabProps {
  profiles: ProfileRow[];
  userRoles: RoleRow[];
  tenantId: string;
  onRefresh: () => void;
  currentUserId?: string;
}

export function UsersTab({ profiles, userRoles, tenantId, onRefresh, currentUserId }: UsersTabProps) {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<AppRole>("visualizador");
  const isMobile = useIsMobile();

  const getUserRoles = (userId: string) => userRoles.filter((r) => r.user_id === userId);

  const addRole = async () => {
    if (!selectedUserId || !tenantId) return;
    const { error } = await supabase.from("user_roles").insert({
      user_id: selectedUserId,
      role: selectedRole,
      tenant_id: tenantId,
    } as any);
    if (error) toast.error("Erro ao adicionar papel: " + error.message);
    else { toast.success("Papel adicionado!"); onRefresh(); }
  };

  const removeRole = async (roleId: string) => {
    const { error } = await supabase.from("user_roles").delete().eq("id", roleId);
    if (error) toast.error("Erro ao remover papel");
    else { toast.success("Papel removido"); onRefresh(); }
  };

  const toggleBlock = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === "blocked" ? "active" : "blocked";
    const { error } = await supabase.from("profiles").update({ account_status: newStatus } as any).eq("id", userId);
    if (error) toast.error("Erro ao alterar status: " + error.message);
    else {
      toast.success(newStatus === "blocked" ? "Usuário bloqueado" : "Usuário desbloqueado");
      onRefresh();
    }
  };

  const statusBadge = (status: string) => {
    if (status === "blocked") return <Badge variant="destructive" className="text-[10px]">Bloqueado</Badge>;
    return <Badge variant="secondary" className="bg-status-ok/20 text-status-ok text-[10px]">Ativo</Badge>;
  };

  if (isMobile) {
    return (
      <div className="space-y-3">
        {/* Add role */}
        <Card className="glass-card">
          <CardContent className="p-3 space-y-2">
            <p className="text-xs font-semibold">Atribuir papel</p>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar usuário" /></SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">{p.full_name || p.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
                <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="gestor">Gestor</SelectItem>
                  <SelectItem value="operacional">Operacional</SelectItem>
                  <SelectItem value="visualizador">Visualizador</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={addRole} size="sm" className="gap-1 h-8 text-xs">
                <Plus className="h-3 w-3" /> Atribuir
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* User cards */}
        {profiles.map((p) => {
          const status = (p as any).account_status || "active";
          const isCurrentUser = p.id === currentUserId;
          return (
            <Card key={p.id} className={`glass-card ${status === "blocked" ? "opacity-60" : ""}`}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{p.full_name || "—"}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{p.email}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {statusBadge(status)}
                    {!isCurrentUser && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => toggleBlock(p.id, status)}
                        title={status === "blocked" ? "Desbloquear" : "Bloquear"}
                      >
                        {status === "blocked" ? <ShieldCheck className="h-3.5 w-3.5 text-status-ok" /> : <ShieldOff className="h-3.5 w-3.5 text-destructive" />}
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {getUserRoles(p.id).map((r) => (
                    <Badge key={r.id} variant="secondary" className={`${roleBadgeColor[r.role]} text-[10px] cursor-pointer`} onClick={() => removeRole(r.id)}>
                      {r.role} ✕
                    </Badge>
                  ))}
                  {getUserRoles(p.id).length === 0 && <span className="text-[10px] text-muted-foreground">Sem papel</span>}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {profiles.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">Nenhum usuário encontrado</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add role */}
      <div className="glass-card p-4 flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="space-y-1 flex-1 min-w-0">
          <label className="text-xs text-muted-foreground">Usuário</label>
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger><SelectValue placeholder="Selecionar usuário" /></SelectTrigger>
            <SelectContent>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Papel</label>
          <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
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
      <div className="glass-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Papéis</TableHead>
              <TableHead className="w-[80px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((p) => {
              const status = (p as any).account_status || "active";
              const isCurrentUser = p.id === currentUserId;
              return (
                <TableRow key={p.id} className={status === "blocked" ? "opacity-60" : ""}>
                  <TableCell className="font-medium">{p.full_name || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.email}</TableCell>
                  <TableCell>{statusBadge(status)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {getUserRoles(p.id).map((r) => (
                        <Badge key={r.id} variant="secondary" className={`${roleBadgeColor[r.role]} text-xs cursor-pointer`} onClick={() => removeRole(r.id)}>
                          {r.role} ✕
                        </Badge>
                      ))}
                      {getUserRoles(p.id).length === 0 && <span className="text-xs text-muted-foreground">Sem papel</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    {!isCurrentUser && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => toggleBlock(p.id, status)}
                        title={status === "blocked" ? "Desbloquear" : "Bloquear"}
                      >
                        {status === "blocked" ? <ShieldCheck className="h-4 w-4 text-status-ok" /> : <ShieldOff className="h-4 w-4 text-destructive" />}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {profiles.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Nenhum usuário encontrado neste tenant
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
