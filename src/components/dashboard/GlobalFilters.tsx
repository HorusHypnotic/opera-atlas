import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useObra } from "@/hooks/useObra";
import { Filter } from "lucide-react";

export function GlobalFilters() {
  const { obras, selectedObraId, setSelectedObraId } = useObra();

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6 p-4 glass-card">
      <Filter className="h-4 w-4 text-primary" />
      <span className="text-sm font-medium text-muted-foreground mr-1">Filtros:</span>
      <Select value={selectedObraId || "all"} onValueChange={(v) => setSelectedObraId(v === "all" ? null : v)}>
        <SelectTrigger className="w-[200px] h-9 bg-secondary border-border">
          <SelectValue placeholder="Obra" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as obras</SelectItem>
          {obras.map((o) => (
            <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select defaultValue="30d">
        <SelectTrigger className="w-[160px] h-9 bg-secondary border-border">
          <SelectValue placeholder="Período" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="7d">Últimos 7 dias</SelectItem>
          <SelectItem value="15d">Últimos 15 dias</SelectItem>
          <SelectItem value="30d">Últimos 30 dias</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
