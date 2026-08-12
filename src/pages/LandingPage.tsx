import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowRight,
  Banknote,
  Building2,
  CalendarRange,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Database,
  Download,
  FileCheck2,
  FileSpreadsheet,
  Fingerprint,
  HardHat,
  History,
  Layers3,
  LockKeyhole,
  MessageCircle,
  PackageSearch,
  Route,
  ShieldCheck,
  Users,
} from "lucide-react";

const whatsapp = "5594992193129";

const preservedDomains = [
  { icon: HardHat, title: "Operação", text: "Registros diários, produtividade e execução por obra." },
  { icon: Banknote, title: "Financeiro", text: "Custos, receitas, aditivos, economia e fluxo de caixa." },
  { icon: Users, title: "Equipe", text: "Colaboradores, presença, diárias e relatórios de mão de obra." },
  { icon: PackageSearch, title: "Materiais", text: "Consumo, estoque, lotes e compras emergenciais." },
  { icon: CalendarRange, title: "Cronograma", text: "Atividades, dependências, Gantt e baseline da obra." },
  { icon: ShieldCheck, title: "Riscos e evidências", text: "Riscos, incidentes, retrabalho e ações corretivas." },
];

const timeline = [
  { icon: ClipboardCheck, label: "Registro", text: "A execução entra com obra, período e responsável." },
  { icon: Layers3, label: "Consolidação", text: "Operação, equipe, materiais e custos ganham contexto comum." },
  { icon: LockKeyhole, label: "Fechamento", text: "O período é validado e fechado com regras verificáveis." },
  { icon: FileCheck2, label: "Snapshot", text: "O estado consolidado recebe versão e hash de integridade." },
  { icon: History, label: "Histórico", text: "Reaberturas e mudanças permanecem rastreáveis no tempo." },
];

const productFacts = [
  { title: "Multiobra", text: "Cada obra mantém seu contexto dentro de uma visão consolidada." },
  { title: "Fechamento auditável", text: "Períodos, snapshots, versões e hashes formam uma trilha verificável." },
  { title: "Histórico preservado", text: "Mudanças relevantes e reaberturas deixam registro de autoria e momento." },
  { title: "Dados exportáveis", text: "Relatórios e dados podem sair em PDF, XLSX e CSV." },
];

const traceability = [
  "Quem registrou",
  "Quando aconteceu",
  "Em qual obra",
  "Em qual período",
  "O que mudou",
];

const faq = [
  {
    q: "O OPERA Atlas substitui um ERP?",
    a: "Não. O Atlas organiza e preserva o histórico operacional da obra. Ele não pretende ser um ERP financeiro genérico.",
  },
  {
    q: "É possível acompanhar mais de uma obra?",
    a: "Sim. O produto é multiobra e mantém a identidade, os acessos e os períodos de cada obra separados.",
  },
  {
    q: "O que acontece quando um período é fechado?",
    a: "O fechamento consolida o período em um snapshot versionado, com hash e histórico de reabertura auditada.",
  },
  {
    q: "Os dados podem ser exportados?",
    a: "Sim. O Atlas possui relatórios e exportações em PDF, XLSX e CSV, conforme o módulo e a permissão do usuário.",
  },
  {
    q: "Como posso conhecer o produto?",
    a: "Você pode entrar na demonstração pelo fluxo de login, solicitar uma apresentação ou participar do programa Beta disponível no produto.",
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const atlasMessage = encodeURIComponent(
    "Olá! Quero solicitar uma demonstração do OPERA Atlas.",
  );
  const demoUrl = `https://wa.me/${whatsapp}?text=${atlasMessage}`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <a href="#inicio" className="flex items-center gap-3" aria-label="OPERA Atlas — início">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary font-black text-primary-foreground">
              OA
            </span>
            <span>
              <span className="block text-sm font-black tracking-tight">OPERA Atlas</span>
              <span className="hidden text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:block">
                Memória operacional da obra
              </span>
            </span>
          </a>

          <nav className="hidden items-center gap-6 text-sm text-muted-foreground lg:flex" aria-label="Navegação principal">
            <a href="#atlas" className="transition-colors hover:text-foreground">O Atlas</a>
            <a href="#fluxo" className="transition-colors hover:text-foreground">Como funciona</a>
            <a href="#rastreabilidade" className="transition-colors hover:text-foreground">Rastreabilidade</a>
            <a href="#duvidas" className="transition-colors hover:text-foreground">Dúvidas</a>
            <button onClick={() => navigate("/beta")} className="font-semibold text-primary transition-colors hover:text-primary/80">
              Programa Beta
            </button>
          </nav>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>Entrar</Button>
            <Button size="sm" className="hidden gap-1 sm:flex" asChild>
              <a href={demoUrl} target="_blank" rel="noopener noreferrer">
                Solicitar demo <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section id="inicio" className="relative overflow-hidden px-4 pb-20 pt-32 sm:px-6 sm:pb-28 sm:pt-40">
          <div className="absolute left-1/2 top-24 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />
          <div className="relative mx-auto max-w-6xl text-center">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary">
              <Fingerprint className="h-3.5 w-3.5" /> Histórico operacional reconstruível
            </div>
            <h1 className="mx-auto max-w-5xl text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              A obra acontece.
              <span className="block text-primary">O Atlas preserva o que aconteceu.</span>
            </h1>
            <p className="mx-auto mt-7 max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-xl">
              Para construtoras e equipes que precisam consolidar execução, custo, prazo e responsabilidade — da rotina de campo ao fechamento auditável de cada obra.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" className="w-full gap-2 px-8 text-base sm:w-auto" asChild>
                <a href={demoUrl} target="_blank" rel="noopener noreferrer">
                  Solicitar demonstração <MessageCircle className="h-4 w-4" />
                </a>
              </Button>
              <Button size="lg" variant="outline" className="w-full gap-2 px-8 text-base sm:w-auto" onClick={() => navigate("/login")}>
                Entrar ou explorar a demo <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-2 text-left sm:grid-cols-4">
              {productFacts.map((fact) => (
                <div key={fact.title} className="glass-card p-4 sm:p-5">
                  <p className="text-sm font-bold text-primary">{fact.title}</p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{fact.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="atlas" className="border-y border-border bg-card/30 px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="grid items-end gap-8 lg:grid-cols-[1fr_0.8fr]">
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-primary">O problema</p>
                <h2 className="max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">
                  Uma obra produz decisões todos os dias. Sem contexto, elas viram fragmentos.
                </h2>
              </div>
              <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
                Planilhas, conversas e relatórios isolados registram partes da execução. O Atlas reúne esses fatos por obra e período para que o histórico continue explicando o resultado.
              </p>
            </div>

            <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {preservedDomains.map(({ icon: Icon, title, text }) => (
                <article key={title} className="glass-card group p-6 transition-colors hover:border-primary/40">
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="fluxo" className="px-4 py-20 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-primary">Do campo ao fechamento</p>
              <h2 className="text-3xl font-black tracking-tight sm:text-5xl">O histórico nasce na execução.</h2>
              <p className="mt-5 text-muted-foreground">
                O Atlas conecta o registro diário ao estado consolidado que precisa sobreviver ao tempo.
              </p>
            </div>

            <div className="mt-14 grid gap-3 lg:grid-cols-5">
              {timeline.map(({ icon: Icon, label, text }, index) => (
                <div key={label} className="relative rounded-xl border border-border bg-card p-5">
                  <div className="mb-8 flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">0{index + 1}</span>
                  </div>
                  <h3 className="font-bold">{label}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{text}</p>
                  {index < timeline.length - 1 && (
                    <ArrowRight className="absolute -right-5 top-1/2 z-10 hidden h-4 w-4 text-primary lg:block" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-card/30 px-4 py-20 sm:px-6">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Building2 className="h-6 w-6" />
              </div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-primary">Multiobra</p>
              <h2 className="text-3xl font-black tracking-tight sm:text-5xl">Visão consolidada sem apagar a identidade de cada obra.</h2>
              <p className="mt-6 max-w-xl leading-relaxed text-muted-foreground">
                Organizações, usuários, papéis e acessos respeitam o contexto da obra. A leitura pode ser ampla; a origem de cada registro continua explícita.
              </p>
            </div>
            <div className="glass-card glow-orange p-6 sm:p-8">
              <div className="flex items-center gap-3 border-b border-border pb-5">
                <Route className="h-5 w-5 text-primary" />
                <span className="font-bold">Organização</span>
              </div>
              {["Obra Norte", "Obra Centro", "Obra Sul"].map((obra, index) => (
                <div key={obra} className="flex items-center justify-between border-b border-border/70 py-5 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-xs font-bold text-muted-foreground">0{index + 1}</span>
                    <span className="text-sm font-medium">{obra}</span>
                  </div>
                  <span className="rounded-full bg-status-ok/10 px-3 py-1 text-[11px] font-medium text-status-ok">Contexto próprio</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="rastreabilidade" className="px-4 py-20 sm:px-6 sm:py-24">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 to-card p-7 sm:p-10">
              <div className="mb-8 flex items-center gap-3">
                <Fingerprint className="h-6 w-6 text-primary" />
                <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Trilha operacional</span>
              </div>
              <div className="space-y-3">
                {traceability.map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-lg border border-border/80 bg-background/50 p-4">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                    <span className="text-sm font-medium">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-primary">Rastreabilidade</p>
              <h2 className="text-3xl font-black tracking-tight sm:text-5xl">Saber o resultado é pouco. É preciso saber como ele foi formado.</h2>
              <p className="mt-6 leading-relaxed text-muted-foreground">
                O Atlas mantém autoria, tempo, obra e período próximos do dado. Fechamentos, snapshots, hashes e reaberturas auditadas ajudam a explicar o estado consolidado sem esconder sua história.
              </p>
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-card/30 px-4 py-20 sm:px-6">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-primary">Soberania do dado</p>
              <h2 className="text-3xl font-black tracking-tight sm:text-5xl">O histórico não deve ficar preso à tela.</h2>
              <p className="mt-6 leading-relaxed text-muted-foreground">
                Exporte relatórios e dados para análise, prestação de contas e continuidade operacional.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: FileCheck2, label: "PDF" },
                { icon: FileSpreadsheet, label: "XLSX" },
                { icon: Database, label: "CSV" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="glass-card flex min-h-36 flex-col items-center justify-center gap-4 p-5 text-center">
                  <Icon className="h-7 w-7 text-primary" />
                  <span className="font-mono text-sm font-bold">{label}</span>
                  <Download className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="duvidas" className="px-4 py-20 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-3xl">
            <div className="text-center">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-primary">Dúvidas</p>
              <h2 className="text-3xl font-black tracking-tight sm:text-5xl">O essencial, sem promessa vazia.</h2>
            </div>
            <Accordion type="single" collapsible className="mt-10">
              {faq.map((item, index) => (
                <AccordionItem key={item.q} value={`item-${index}`}>
                  <AccordionTrigger className="text-left">{item.q}</AccordionTrigger>
                  <AccordionContent className="leading-relaxed text-muted-foreground">{item.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <section id="contato" className="border-y border-border bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-4xl text-center">
            <Clock3 className="mx-auto h-8 w-8 text-primary" />
            <h2 className="mt-6 text-3xl font-black tracking-tight sm:text-5xl">Veja o Atlas com o contexto da sua operação.</h2>
            <p className="mx-auto mt-5 max-w-2xl text-muted-foreground">
              Solicite uma demonstração, explore os dados de exemplo ou acompanhe o programa Beta pelo fluxo oficial do produto.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Button size="lg" className="gap-2 px-8" asChild>
                <a href={demoUrl} target="_blank" rel="noopener noreferrer">
                  Solicitar demonstração <MessageCircle className="h-4 w-4" />
                </a>
              </Button>
              <Button size="lg" variant="outline" className="gap-2 px-8" onClick={() => navigate("/login")}>
                Entrar no Atlas <ArrowRight className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="ghost" onClick={() => navigate("/beta")}>Programa Beta</Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 text-center sm:flex-row sm:text-left">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-black text-primary-foreground">OA</span>
            <div>
              <span className="block text-sm font-bold">OPERA Atlas</span>
              <span className="text-xs text-muted-foreground">Da execução ao histórico da obra.</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} OPERA Atlas. Dados com contexto, história e responsabilidade.</p>
        </div>
      </footer>
    </div>
  );
}
