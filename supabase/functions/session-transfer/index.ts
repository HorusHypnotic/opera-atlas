import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createEdgeObservability, correlationResponseHeaders } from "../_shared/observability.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-correlation-id, x-causation-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Expose-Headers": "x-correlation-id",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const obs = createEdgeObservability(req, "edge.session-transfer");
  const baseHeaders = { ...corsHeaders, ...correlationResponseHeaders(obs), "Content-Type": "application/json" };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    if (req.method === "POST") {
      const authHeader = req.headers.get("authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        await obs.log({
          event_type: "session.transfer.issue.denied",
          status: "denied",
          severity: "warning",
          payload: { reason: "no_auth_header" },
        });
        return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: baseHeaders });
      }

      const token = authHeader.replace("Bearer ", "");
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });

      const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
      if (claimsErr || !claimsData?.claims?.sub) {
        await obs.log({
          event_type: "session.transfer.issue.denied",
          status: "denied",
          severity: "warning",
          payload: { reason: "invalid_token" },
        });
        return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers: baseHeaders });
      }

      const userId = claimsData.claims.sub as string;
      const userEmail = claimsData.claims.email as string;
      const code = crypto.randomUUID().slice(0, 8).toUpperCase();

      await admin.from("session_transfers").delete().eq("user_id", userId);

      const { error: insertErr } = await admin
        .from("session_transfers")
        .insert({ code, user_id: userId, refresh_token: userEmail });

      if (insertErr) {
        await obs.log({
          event_type: "session.transfer.issue.failed",
          status: "failure",
          severity: "error",
          error_message: insertErr.message,
          payload: { user_id: userId },
        });
        return new Response(JSON.stringify({ error: insertErr.message }), { status: 500, headers: baseHeaders });
      }

      await obs.log({
        event_type: "session.transfer.issued",
        status: "success",
        payload: { user_id: userId, code_prefix: code.slice(0, 2) },
      });

      return new Response(JSON.stringify({ code }), { headers: baseHeaders });
    }

    if (req.method === "GET") {
      const url = new URL(req.url);
      const code = url.searchParams.get("code");

      if (!code || code.length < 6) {
        return new Response(JSON.stringify({ error: "Código inválido" }), { status: 400, headers: baseHeaders });
      }

      const { data: transfer, error: fetchErr } = await admin
        .from("session_transfers")
        .select("*")
        .eq("code", code.toUpperCase())
        .eq("used", false)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (fetchErr || !transfer) {
        await obs.log({
          event_type: "session.transfer.consume.denied",
          status: "denied",
          severity: "warning",
          payload: { reason: "expired_or_invalid", code_prefix: code.slice(0, 2) },
        });
        return new Response(JSON.stringify({ error: "Código expirado ou inválido" }), { status: 404, headers: baseHeaders });
      }

      await admin.from("session_transfers").update({ used: true }).eq("id", transfer.id);

      const email = transfer.refresh_token;

      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
      });

      if (linkErr || !linkData) {
        await obs.log({
          event_type: "session.transfer.consume.failed",
          status: "failure",
          severity: "error",
          error_message: linkErr?.message ?? "generateLink_null",
          payload: { transfer_id: transfer.id, user_id: transfer.user_id },
        });
        return new Response(JSON.stringify({ error: "Erro ao gerar sessão" }), { status: 500, headers: baseHeaders });
      }

      const actionLink = new URL(linkData.properties.action_link);
      const tokenHash = actionLink.searchParams.get("token_hash") || actionLink.searchParams.get("token");

      await obs.log({
        event_type: "session.transfer.consumed",
        status: "success",
        payload: { user_id: transfer.user_id, transfer_id: transfer.id },
      });

      return new Response(
        JSON.stringify({ email, token_hash: tokenHash, user_id: transfer.user_id }),
        { headers: baseHeaders },
      );
    }

    return new Response(JSON.stringify({ error: "Método não suportado" }), { status: 405, headers: baseHeaders });
  } catch (err) {
    await obs.log({
      event_type: "session.transfer.failed",
      status: "failure",
      severity: "error",
      error_message: err instanceof Error ? err.message : String(err),
    });
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: baseHeaders });
  }
});
