import { useState, ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useObra } from "@/hooks/useObra";

interface FieldDef {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "time" | "select";
  placeholder?: string;
  options?: { value: string; label: string }[];
  defaultValue?: string;
  required?: boolean;
}

interface AddRecordDialogProps {
  title: string;
  fields: FieldDef[];
  onSubmit: (values: Record<string, any>) => Promise<{ error: any }>;
  trigger?: ReactNode;
}

export function AddRecordDialog({ title, fields, onSubmit, trigger }: AddRecordDialogProps) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const { selectedObraId, obras } = useObra();

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      const defaults: Record<string, string> = {};
      fields.forEach((f) => {
        if (f.defaultValue) defaults[f.name] = f.defaultValue;
      });
      setValues(defaults);
    }
  };

  const handleSubmit = async () => {
    if (!selectedObraId) {
      toast.error("Selecione uma obra antes de adicionar registros");
      return;
    }
    const required = fields.filter((f) => f.required !== false);
    const missing = required.find((f) => !values[f.name]?.trim());
    if (missing) {
      toast.error(`Campo "${missing.label}" é obrigatório`);
      return;
    }

    setLoading(true);
    const parsed: Record<string, any> = {};
    fields.forEach((f) => {
      const v = values[f.name];
      if (v !== undefined && v !== "") {
        parsed[f.name] = f.type === "number" ? Number(v) : v;
      }
    });

    const { error } = await onSubmit(parsed);
    setLoading(false);
    if (error) {
      toast.error("Erro ao salvar: " + (error.message || error));
    } else {
      toast.success("Registro adicionado!");
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Adicionar Registro
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {!selectedObraId && (
          <p className="text-sm text-status-critical">⚠ Selecione uma obra nos filtros antes de adicionar registros.</p>
        )}
        <div className="space-y-3 pt-2">
          {fields.map((f) => (
            <div key={f.name} className="space-y-1">
              <label className="text-sm font-medium">{f.label}</label>
              {f.type === "select" && f.options ? (
                <Select value={values[f.name] || ""} onValueChange={(v) => setValues({ ...values, [f.name]: v })}>
                  <SelectTrigger><SelectValue placeholder={f.placeholder || "Selecionar"} /></SelectTrigger>
                  <SelectContent>
                    {f.options.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type={f.type || "text"}
                  placeholder={f.placeholder}
                  value={values[f.name] || ""}
                  onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                  step={f.type === "number" ? "any" : undefined}
                />
              )}
            </div>
          ))}
          <Button onClick={handleSubmit} disabled={loading || !selectedObraId} className="w-full mt-2">
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
