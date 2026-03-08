import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple in-memory rate limiter (per isolate lifetime)
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 15_000; // 15 seconds per IP

function isRateLimited(ip: string): boolean {
  const last = rateLimitMap.get(ip);
  const now = Date.now();
  if (last && now - last < RATE_LIMIT_MS) return true;
  rateLimitMap.set(ip, now);
  // Clean old entries periodically
  if (rateLimitMap.size > 1000) {
    const cutoff = now - RATE_LIMIT_MS * 2;
    for (const [k, v] of rateLimitMap) {
      if (v < cutoff) rateLimitMap.delete(k);
    }
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Rate limit by IP
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    if (isRateLimited(ip)) {
      return new Response(
        JSON.stringify({ error: "Aguarde alguns segundos antes de tentar novamente." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { nome, email, telefone, empresa, influencer_code, turnstile_token } = body;

    // Verify Turnstile CAPTCHA
    const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY") || "1x0000000000000000000000000000000AA"; // Test secret
    if (turnstile_token) {
      const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `secret=${turnstileSecret}&response=${turnstile_token}&remoteip=${ip}`,
      });
      const verifyData = await verifyRes.json();
      if (!verifyData.success) {
        return new Response(
          JSON.stringify({ error: "Verificação CAPTCHA falhou. Tente novamente." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ error: "CAPTCHA obrigatório." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Server-side validation
    if (!nome || typeof nome !== "string" || nome.trim().length < 2 || nome.trim().length > 100) {
      return new Response(
        JSON.stringify({ error: "Nome inválido (2-100 caracteres)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanEmail = (email || "").trim().toLowerCase();
    if (!cleanEmail || !emailRegex.test(cleanEmail) || cleanEmail.length > 255) {
      return new Response(
        JSON.stringify({ error: "Email inválido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanTelefone = telefone ? telefone.replace(/\D/g, "").slice(0, 11) : null;
    const cleanEmpresa = empresa ? empresa.trim().slice(0, 100) : null;
    const cleanCode = influencer_code ? influencer_code.trim().toUpperCase().slice(0, 20) : null;

    // Use service role for DB operations
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check duplicate
    const { data: existing } = await supabase
      .from("beta_waitlist")
      .select("id, status")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({
          status: existing.status,
          message:
            existing.status === "aprovado"
              ? "Você já foi aprovado! Faça login para acessar."
              : "Este email já está cadastrado na lista.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check beta config
    const { data: config } = await supabase
      .from("beta_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (config && !config.beta_ativo) {
      return new Response(
        JSON.stringify({ error: "O programa beta não está ativo no momento." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Count current slots
    const { count } = await supabase
      .from("beta_waitlist")
      .select("id", { count: "exact", head: true })
      .in("status", ["aguardando_aprovacao", "aprovado"]);

    const limite = config?.limite_vagas ?? 5;
    const hasSlot = (count ?? 0) < limite;
    const newStatus = hasSlot ? "aguardando_aprovacao" : "lista_de_espera";

    // Track influencer code
    if (cleanCode) {
      const { data: codeData } = await supabase
        .from("influencer_codes")
        .select("id, total_cadastros")
        .eq("codigo", cleanCode)
        .eq("ativo", true)
        .maybeSingle();

      if (codeData) {
        await supabase
          .from("influencer_codes")
          .update({ total_cadastros: (codeData.total_cadastros || 0) + 1 })
          .eq("id", codeData.id);
      }
    }

    // Insert
    const { error } = await supabase.from("beta_waitlist").insert({
      nome: nome.trim(),
      email: cleanEmail,
      telefone: cleanTelefone || null,
      empresa: cleanEmpresa || null,
      influencer_code: cleanCode || null,
      status: newStatus,
    });

    if (error) {
      return new Response(
        JSON.stringify({ error: "Erro ao cadastrar: " + error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        status: newStatus,
        message: hasSlot
          ? "Cadastro recebido! Você será notificado quando aprovado."
          : "Vagas preenchidas. Você entrou na lista de espera.",
        vagas_restantes: Math.max(0, limite - (count ?? 0) - 1),
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "Erro inesperado. Tente novamente." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
