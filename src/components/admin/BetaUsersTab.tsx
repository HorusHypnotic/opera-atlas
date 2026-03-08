import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, UserCheck } from "lucide-react";

interface BetaUser {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  empresa: string | null;
  influencer_code: string | null;
  status: string;
  created_at: string;
}

const statusLabels: Record<string, string> = {
  aguardando_aprovacao: "Pendente",
  aprovado: "Aprovado",
  lista_de_espera: "Lista de Espera",
  rejeitado: "Rejeitado",
};

const statusColors: Record<string, string> = {
  aguardando_aprovacao: "bg-chart-4/20 text-chart-4",
  aprovado: "bg-status-ok/20 text-status-ok",
  lista_de_espera: "bg-muted text-muted-foreground",
  rejeitado: "bg-destructive/20 text-destructive",
};

export function BetaUsersTab() {
  const [users, setUsers] = useState<BetaUser[]>([]);
  const [filterStatus, setFilterStatus] = useState("todos");

  const fetchUsers = async () => {
    let q = supabase.from("beta_waitlist").select("*").order("created_at", { ascending: false });
    if (filterStatus !== "todos") q = q.eq("status", filterStatus);
    const { data } = await q;
    if (data) setUsers(data as BetaUser[]);
  };

  useEffect(() => { fetchUsers(); }, [filterStatus]);

  const updateStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase.from("beta_waitlist").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error("Erro: " + error.message);
    else { toast.success("Status atualizado!"); fetchUsers(); }
  };

  const filtered = users;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrar status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="aguardando_aprovacao">Pendentes</SelectItem>
            <SelectItem value="aprovado">Aprovados</SelectItem>
            <SelectItem value="lista_de_espera">Lista de Espera</SelectItem>
            <SelectItem value="rejeitado">Rejeitados</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="text-xs">{filtered.length} registros</Badge>
      </div>

      <div className="glass-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="w-[180px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.nome}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                <TableCell className="text-sm">{u.empresa || "—"}</TableCell>
                <TableCell className="text-sm font-mono">{u.influencer_code || "—"}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={`text-xs ${statusColors[u.status] || ""}`}>
                    {statusLabels[u.status] || u.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(u.created_at).toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {u.status !== "aprovado" && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Aprovar" onClick={() => updateStatus(u.id, "aprovado")}>
                        <CheckCircle2 className="h-3.5 w-3.5 text-status-ok" />
                      </Button>
                    )}
                    {u.status !== "rejeitado" && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Rejeitar" onClick={() => updateStatus(u.id, "rejeitado")}>
                        <XCircle className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                    {u.status !== "lista_de_espera" && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Lista de espera" onClick={() => updateStatus(u.id, "lista_de_espera")}>
                        <Clock className="h-3.5 w-3.5 text-chart-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhum registro encontrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
