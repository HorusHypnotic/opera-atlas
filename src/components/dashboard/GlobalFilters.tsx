import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { obras, equipes } from "@/data/mockData";
import { Filter } from "lucide-react";

export function GlobalFilters() {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-6 p-4 glass-card">
      <Filter className="h-4 w-4 text-primary" />
      <span className="text-sm font-medium text-muted-foreground mr-1">Filtros:</span>
      <Select defaultValue="all">
        <SelectTrigger className="w-[200px] h-9 bg-secondary border-border">
          <SelectValue placeholder="Obra" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as obras</SelectItem>
          {obras.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select defaultValue="all">
        <SelectTrigger className="w-[160px] h-9 bg-secondary border-border">
          <SelectValue placeholder="Período" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="7d">Últimos 7 dias</SelectItem>
          <SelectItem value="15d">Últimos 15 dias</SelectItem>
          <SelectItem value="30d">Últimos 30 dias</SelectItem>
        </SelectContent>
      </Select>
      <Select defaultValue="all">
        <SelectTrigger className="w-[160px] h-9 bg-secondary border-border">
          <SelectValue placeholder="Equipe" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          {equipes.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
