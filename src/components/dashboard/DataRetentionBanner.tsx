import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";

export function DataRetentionBanner() {
  return (
    <div className="mb-6">
      <Alert className="border-primary/30 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertTitle className="text-sm font-semibold">Política de Retenção — Beta</AlertTitle>
        <AlertDescription className="text-xs text-muted-foreground">
          Durante o período beta, os dados operacionais permanecem preservados enquanto a política definitiva de retenção e arquivamento é validada.
        </AlertDescription>
      </Alert>
    </div>
  );
}
