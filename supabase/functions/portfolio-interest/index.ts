import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://horushypnotic.github.io",
  "http://127.0.0.1:8090",
  "http://localhost:8090",
]);
const rateLimit = new Map<string, number>();
const RATE_LIMIT_MS = 20_000;

function headers(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : "https://horushypnotic.github.io";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "content-type, x-correlation-id",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: headers(req) });
}

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizeEmail(value: unknown) {
  return cleanText(value, 255).toLowerCase();
}

function normalizePhone(value: unknown) {
  return cleanText(value, 30).replace(/\D/g, "").slice(0, 13);
}

async function verifyTurnstile(token: string, ip: string) {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) throw new Error("TURNSTILE_NOT_CONFIGURED");
  const body = new URLSearchParams({ secret, response: token, remoteip: ip });
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const result = await response.json();
  return result.success === true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: headers(req) });
  if (!ALLOWED_ORIGINS.has(req.headers.get("origin") || "")) return json(req, { error: "Origem não permitida." }, 403);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  if (req.method === "GET") {
    const { data, error } = await supabase.rpc("get_portfolio_public_metrics");
    if (error) return json(req, { error: "Não foi possível carregar os indicadores." }, 500);
    return json(req, { metrics: data }, 200);
  }
  if (req.method !== "POST") return json(req, { error: "Método não permitido." }, 405);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("cf-connecting-ip") || "unknown";
  const lastRequest = rateLimit.get(ip) || 0;
  if (Date.now() - lastRequest < RATE_LIMIT_MS) return json(req, { error: "Aguarde alguns segundos e tente novamente." }, 429);
  rateLimit.set(ip, Date.now());

  try {
    const body = await req.json();
    const nome = cleanText(body.nome, 100);
    const email = normalizeEmail(body.email);
    const telefone = normalizePhone(body.telefone);
    const empresa = cleanText(body.empresa, 140);
    const cidade = cleanText(body.cidade, 100);
    const uf = cleanText(body.uf, 2).toUpperCase();
    const origem = cleanText(body.origem, 80) || "portfolio_site";
    const mensagem = cleanText(body.mensagem, 1000);
    const modalidade = cleanText(body.modalidade, 40);
    const products = Array.isArray(body.produtos) ? [...new Set(body.produtos.map((p: unknown) => cleanText(p, 80)).filter(Boolean))] : [];
    const token = cleanText(body.turnstile_token, 4096);
    const sessionId = cleanText(body.session_id, 36);

    if (nome.length < 2) return json(req, { error: "Informe seu nome." }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(req, { error: "Informe um e-mail válido." }, 400);
    if (telefone && telefone.length < 10) return json(req, { error: "Informe um telefone válido ou deixe o campo vazio." }, 400);
    if (!body.consentimento) return json(req, { error: "O consentimento é necessário para registrar e responder ao pedido." }, 400);
    if (!['interesse','solicitacao_diagnostico','solicitacao_proposta','lista_prioritaria'].includes(modalidade)) return json(req, { error: "Modalidade inválida." }, 400);
    if (!products.length || products.length > 12) return json(req, { error: "Selecione ao menos um produto." }, 400);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) return json(req, { error: "Sessão inválida. Recarregue a página." }, 400);
    if (!token || !(await verifyTurnstile(token, ip))) return json(req, { error: "A verificação de segurança falhou." }, 403);

    const { data: productRows, error: productError } = await supabase
      .from("portfolio_products").select("id,slug").in("slug", products).eq("status", "ativo");
    if (productError || !productRows || productRows.length !== products.length) return json(req, { error: "Um dos produtos selecionados não está disponível." }, 400);

    let companyId: string | null = null;
    const byEmail = await supabase.from("portfolio_leads").select("id,company_id").eq("email_normalized", email).maybeSingle();
    if (byEmail.error) throw byEmail.error;
    let leadData = byEmail.data;
    companyId = leadData?.company_id || null;

    if (!companyId && empresa) {
      const company = await supabase.from("portfolio_companies").insert({
        nome: empresa, nome_normalized: empresa.toLowerCase(), cidade: cidade || null, uf: uf || null,
      }).select("id").single();
      if (company.error) throw company.error;
      companyId = company.data.id;
    }

    if (!leadData) {
      const created = await supabase.from("portfolio_leads").insert({
        company_id: companyId, nome, email, email_normalized: email,
        telefone: telefone || null, telefone_normalized: telefone || null,
        cidade: cidade || null, uf: uf || null, origem,
        consentimento: true, consentimento_em: new Date().toISOString(),
      }).select("id,company_id").single();
      if (created.error) throw created.error;
      leadData = created.data;
    } else {
      await supabase.from("portfolio_leads").update({
        company_id: companyId, nome, telefone: telefone || null, telefone_normalized: telefone || null,
        cidade: cidade || null, uf: uf || null,
        consentimento: true, consentimento_em: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq("id", leadData.id);
    }

    let diagnosisId: string | null = null;
    const diagnosis = body.diagnostico;
    if (diagnosis && modalidade === "solicitacao_diagnostico") {
      const axes = ['custo','prazo','execucao','controle','risco'];
      if (!axes.every((axis) => Number.isInteger(diagnosis[axis]) && diagnosis[axis] >= 0 && diagnosis[axis] <= 2)) {
        return json(req, { error: "Pontuação do diagnóstico inválida." }, 400);
      }
      const score = axes.reduce((sum, axis) => sum + diagnosis[axis], 0);
      const classificacao = score <= 3 ? "baixo" : score <= 6 ? "medio" : "alto";
      const result = await supabase.from("portfolio_diagnoses").insert({
        lead_id: leadData.id, session_id: sessionId,
        custo_score: diagnosis.custo, prazo_score: diagnosis.prazo,
        execucao_score: diagnosis.execucao, controle_score: diagnosis.controle,
        risco_score: diagnosis.risco, classificacao,
        resultado: cleanText(diagnosis.resultado, 500), recomendacao: cleanText(diagnosis.recomendacao, 500),
        respostas: diagnosis.respostas || {},
      }).select("id").single();
      if (result.error) throw result.error;
      diagnosisId = result.data.id;
    }

    const status = modalidade === "solicitacao_diagnostico" ? "diagnostico"
      : modalidade === "solicitacao_proposta" ? "proposta" : "interesse";
    const interestRows = productRows.map((product) => ({
      lead_id: leadData.id, product_id: product.id, diagnosis_id: diagnosisId,
      modalidade, mensagem: mensagem || null, status, updated_at: new Date().toISOString(),
    }));
    const interests = await supabase.from("portfolio_interests").upsert(interestRows, { onConflict: "lead_id,product_id" });
    if (interests.error) throw interests.error;

    await supabase.from("portfolio_events").insert({
      session_id: sessionId, event_type: "portfolio.interest.recorded",
      page_path: cleanText(body.page_path, 200), metadata: { modalidade, products_count: products.length },
    });

    return json(req, { success: true, protocolo: crypto.randomUUID(), produtos_registrados: products.length }, 201);
  } catch (error) {
    console.error("portfolio-interest", error);
    const message = error instanceof Error && error.message === "TURNSTILE_NOT_CONFIGURED"
      ? "Formulário temporariamente indisponível." : "Não foi possível registrar agora. Tente novamente.";
    return json(req, { error: message }, 500);
  }
});
