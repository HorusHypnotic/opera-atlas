import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createEdgeObservability, correlationResponseHeaders } from "../_shared/observability.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-correlation-id, x-causation-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Expose-Headers": "x-correlation-id",
};

// Simple in-memory rate limiter (per isolate lifetime)
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 15_000;

function isRateLimited(ip: string): boolean {
  const last = rateLimitMap.get(ip);
  const now = Date.now();
  if (last && now - last < RATE_LIMIT_MS) return true;
  rateLimitMap.set(ip, now);
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

  const obs = createEdgeObservability(req, "edge.beta-signup");
  const baseHeaders = { ...corsHeaders, ...correlationResponseHeaders(obs), "Content-Type": "application/json" };

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: baseHeaders });
  }

  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    if (isRateLimited(ip)) {
      await obs.log({
        event_type: "beta.signup.denied",
        status: "denied",
        severity: "warning",
        payload: { reason: "rate_limited", ip },
      });
      return new Response(
        JSON.stringify({ error: "Aguarde alguns segundos antes de tentar novamente." }),
        { status: 429, headers: baseHeaders },
      );
    }

    const body = await req.json();
    const { nome, email, telefone, empresa, influencer_code, turnstile_token, password } = body;

    // Verify Turnstile CAPTCHA
    const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY") || "1x0000000000000000000000000000000AA";
    if (turnstile_token) {
      const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `secret=${turnstileSecret}&response=${turnstile_token}&remoteip=${ip}`,
      });
      const verifyData = await verifyRes.json();
      if (!verifyData.success) {
        await obs.log({
          event_type: "beta.signup.denied",
          status: "denied",
          severity: "warning",
          payload: { reason: "captcha_failed" },
        });
        return new Response(
          JSON.stringify({ error: "Verificação CAPTCHA falhou. Tente novamente." }),
          { status: 403, headers: baseHeaders },
        );
      }
    } else {
      return new Response(JSON.stringify({ error: "CAPTCHA obrigatório." }), { status: 400, headers: baseHeaders });
    }

    if (!nome || typeof nome !== "string" || nome.trim().length < 2 || nome.trim().length > 100) {
      return new Response(JSON.stringify({ error: "Nome inválido (2-100 caracteres)." }), { status: 400, headers: baseHeaders });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanEmail = (email || "").trim().toLowerCase();
    if (!cleanEmail || !emailRegex.test(cleanEmail) || cleanEmail.length > 255) {
      return new Response(JSON.stringify({ error: "Email inválido." }), { status: 400, headers: baseHeaders });
    }

    const cleanTelefone = telefone ? telefone.replace(/\D/g, "").slice(0, 11) : null;
    const cleanEmpresa = empresa ? empresa.trim().slice(0, 100) : null;
    const cleanCode = influencer_code ? influencer_code.trim().toUpperCase().slice(0, 20) : null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: existing } = await supabase
      .from("beta_waitlist")
      .select("id, status")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (existing) {
      await obs.log({
        event_type: "beta.signup.duplicate",
        status: "info",
        payload: { email: cleanEmail, existing_status: existing.status },
      });
      return new Response(
        JSON.stringify({
          status: existing.status,
          message:
            existing.status === "aprovado"
              ? "Você já foi aprovado! Faça login para acessar."
              : "Este email já está cadastrado na lista.",
        }),
        { status: 200, headers: baseHeaders },
      );
    }

    const { data: config } = await supabase.from("beta_config").select("*").limit(1).maybeSingle();

    if (config && !config.beta_ativo) {
      await obs.log({
        event_type: "beta.signup.denied",
        status: "denied",
        severity: "warning",
        payload: { reason: "beta_inactive" },
      });
      return new Response(JSON.stringify({ error: "O programa beta não está ativo no momento." }), { status: 403, headers: baseHeaders });
    }

    const { count } = await supabase
      .from("beta_waitlist")
      .select("id", { count: "exact", head: true })
      .in("status", ["aguardando_aprovacao", "aprovado"]);

    const limite = config?.limite_vagas ?? 5;
    const hasSlot = (count ?? 0) < limite;

    const hasInfluencer = !!cleanCode;
    const hasPassword = password && typeof password === "string" && password.length >= 6;
    const autoApprove = hasInfluencer && hasSlot && hasPassword;

    const newStatus = autoApprove ? "aprovado" : hasSlot ? "aguardando_aprovacao" : "lista_de_espera";

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

    const { error } = await supabase.from("beta_waitlist").insert({
      nome: nome.trim(),
      email: cleanEmail,
      telefone: cleanTelefone || null,
      empresa: cleanEmpresa || null,
      influencer_code: cleanCode || null,
      status: newStatus,
    });

    if (error) {
      await obs.log({
        event_type: "beta.signup.failed",
        status: "failure",
        severity: "error",
        error_message: error.message,
      });
      return new Response(JSON.stringify({ error: "Erro ao cadastrar: " + error.message }), { status: 500, headers: baseHeaders });
    }

    if (autoApprove) {
      const { error: authError } = await supabase.auth.admin.createUser({
        email: cleanEmail,
        password,
        email_confirm: true,
        user_metadata: { full_name: nome.trim() },
      });

      if (authError && !authError.message.includes("already been registered")) {
        await obs.log({
          event_type: "beta.signup.failed",
          status: "failure",
          severity: "error",
          error_message: authError.message,
          payload: { stage: "createUser", email: cleanEmail },
        });
        return new Response(
          JSON.stringify({ error: "Erro ao criar conta: " + authError.message }),
          { status: 500, headers: baseHeaders },
        );
      }

      await obs.log({
        event_type: "beta.signup.approved",
        status: "success",
        payload: { email: cleanEmail, auto_login: true, influencer_code: cleanCode },
      });

      return new Response(
        JSON.stringify({
          status: "aprovado",
          auto_login: true,
          message: "Conta criada e aprovada! Fazendo login...",
          vagas_restantes: Math.max(0, limite - (count ?? 0) - 1),
        }),
        { status: 201, headers: baseHeaders },
      );
    }

    await obs.log({
      event_type: "beta.signup.queued",
      status: "success",
      payload: { email: cleanEmail, status: newStatus, has_slot: hasSlot, influencer_code: cleanCode },
    });

    return new Response(
      JSON.stringify({
        status: newStatus,
        message: hasSlot
          ? "Cadastro recebido! Você será notificado quando aprovado."
          : "Vagas preenchidas. Você entrou na lista de espera.",
        vagas_restantes: Math.max(0, limite - (count ?? 0) - 1),
      }),
      { status: 201, headers: baseHeaders },
    );
  } catch (err) {
    await obs.log({
      event_type: "beta.signup.failed",
      status: "failure",
      severity: "error",
      error_message: err instanceof Error ? err.message : String(err),
    });
    return new Response(JSON.stringify({ error: "Erro inesperado. Tente novamente." }), { status: 500, headers: baseHeaders });
  }
});
