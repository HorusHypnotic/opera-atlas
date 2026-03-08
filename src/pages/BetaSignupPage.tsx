import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Rocket, CheckCircle2, Clock, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

type SubmitStatus = "idle" | "loading" | "approved" | "waitlist";

export default function BetaSignupPage() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [codigo, setCodigo] = useState("");
  const [status, setStatus] = useState<SubmitStatus>("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !email.trim()) return;

    setStatus("loading");

    try {
      // Check if email already registered
      const { data: existing } = await supabase
        .from("beta_waitlist")
        .select("id, status")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();

      if (existing) {
        if (existing.status === "aprovado") {
          toast.info("Você já foi aprovado! Faça login para acessar o sistema.");
        } else {
          toast.info("Este email já está cadastrado na lista.");
        }
        setStatus(existing.status === "lista_de_espera" ? "waitlist" : "approved");
        return;
      }

      // Get beta config
      const { data: config } = await supabase
        .from("beta_config")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (config && !config.beta_ativo) {
        toast.error("O programa beta não está ativo no momento.");
        setStatus("idle");
        return;
      }

      // Count approved + pending
      const { count } = await supabase
        .from("beta_waitlist")
        .select("id", { count: "exact", head: true })
        .in("status", ["aguardando_aprovacao", "aprovado"]);

      const limite = config?.limite_vagas ?? 5;
      const hasSlot = (count ?? 0) < limite;

      const newStatus = hasSlot ? "aguardando_aprovacao" : "lista_de_espera";

      // Validate influencer code if provided
      if (codigo.trim()) {
        const { data: codeData } = await supabase
          .from("influencer_codes")
          .select("id, total_cadastros")
          .eq("codigo", codigo.trim().toUpperCase())
          .eq("ativo", true)
          .maybeSingle();

        if (codeData) {
          await supabase
            .from("influencer_codes")
            .update({ total_cadastros: (codeData.total_cadastros || 0) + 1 })
            .eq("id", codeData.id);
        }
      }

      const { error } = await supabase.from("beta_waitlist").insert({
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        telefone: telefone.trim() || null,
        empresa: empresa.trim() || null,
        influencer_code: codigo.trim().toUpperCase() || null,
        status: newStatus,
      });

      if (error) {
        toast.error("Erro ao cadastrar: " + error.message);
        setStatus("idle");
        return;
      }

      setStatus(hasSlot ? "approved" : "waitlist");
    } catch {
      toast.error("Erro inesperado. Tente novamente.");
      setStatus("idle");
    }
  };

  if (status === "approved") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Cadastro recebido!</h1>
          <p className="text-muted-foreground">
            Estamos liberando vagas gradualmente. Você receberá um email quando sua conta for aprovada.
          </p>
          <Link to="/landing">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Voltar ao site
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (status === "waitlist") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-chart-4/20 flex items-center justify-center mx-auto">
            <Clock className="h-8 w-8 text-chart-4" />
          </div>
          <h1 className="text-2xl font-bold">Lista de Espera</h1>
          <p className="text-muted-foreground">
            Todas as vagas iniciais foram preenchidas. Você entrou na lista de espera e será avisado quando abrirmos novas vagas.
          </p>
          <Link to="/landing">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Voltar ao site
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center mx-auto">
            <Rocket className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">BETA TEST – Lista de Espera</h1>
          <p className="text-muted-foreground text-sm">
            Garanta sua vaga no programa beta do Método O.P.E.R.A.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nome *</label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome completo" required />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Email *</label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" type="email" required />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Telefone</label>
            <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 99999-9999" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Empresa</label>
            <Input value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Nome da sua empresa" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Código de influenciador</label>
            <Input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Ex: EDU01 (opcional)"
              className="uppercase"
            />
          </div>
          <Button type="submit" className="w-full" disabled={status === "loading"}>
            {status === "loading" ? "Enviando..." : "Quero participar do Beta"}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Já tem conta?{" "}
          <Link to="/login" className="text-primary underline">Fazer login</Link>
        </p>
      </div>
    </div>
  );
}
