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
    return new Response(null, { headers: corsHeaders });
  }

  const obs = createEdgeObservability(req, "edge.generate-reset-link");
  const baseHeaders = { ...corsHeaders, ...correlationResponseHeaders(obs), "Content-Type": "application/json" };

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: baseHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      await obs.log({ event_type: "auth.reset_link.denied", status: "denied", severity: "warning", payload: { reason: "no_auth_header" } });
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: baseHeaders });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller } } = await anonClient.auth.getUser();
    if (!caller) {
      await obs.log({ event_type: "auth.reset_link.denied", status: "denied", severity: "warning", payload: { reason: "invalid_jwt" } });
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: baseHeaders });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("is_super_admin, tenant_id")
      .eq("id", caller.id)
      .single();

    const { data: roles } = await adminClient
      .from("user_roles")
      .select("role, tenant_id")
      .eq("user_id", caller.id);

    const isSuperAdmin = callerProfile?.is_super_admin === true;
    const isTenantAdmin =
      !!callerProfile?.tenant_id &&
      (roles ?? []).some(
        (r: { role: string; tenant_id: string | null }) => r.role === "admin" && r.tenant_id === callerProfile?.tenant_id
      );

    if (!isSuperAdmin && !isTenantAdmin) {
      await obs.log({
        event_type: "auth.reset_link.denied",
        status: "denied",
        severity: "warning",
        payload: { reason: "not_admin", caller_id: caller.id },
      });
      return new Response(JSON.stringify({ error: "Apenas admins podem gerar links" }), { status: 403, headers: baseHeaders });
    }

    const { email, redirect_to } = await req.json();
    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "Email obrigatório" }), { status: 400, headers: baseHeaders });
    }

    if (!isSuperAdmin) {
      const { data: targetProfile } = await adminClient
        .from("profiles")
        .select("tenant_id, is_super_admin")
        .ilike("email", email)
        .maybeSingle();

      const denyCrossTenant = async (reason: string) => {
        await obs.log({
          event_type: "auth.reset_link.denied",
          status: "denied",
          severity: "warning",
          payload: { reason, caller_id: caller.id, caller_tenant: callerProfile?.tenant_id },
        });
      };

      if (!targetProfile) {
        await denyCrossTenant("target_not_found");
        return new Response(JSON.stringify({ error: "Não autorizado para este usuário" }), { status: 403, headers: baseHeaders });
      }
      if (targetProfile.is_super_admin === true) {
        await denyCrossTenant("target_is_super_admin");
        return new Response(JSON.stringify({ error: "Não autorizado para este usuário" }), { status: 403, headers: baseHeaders });
      }
      if (targetProfile.tenant_id !== callerProfile?.tenant_id) {
        await denyCrossTenant("cross_tenant_attempt");
        return new Response(JSON.stringify({ error: "Não autorizado para este usuário" }), { status: 403, headers: baseHeaders });
      }
    }

    const { data, error } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: redirect_to || undefined },
    });

    if (error) {
      await obs.log({
        event_type: "auth.reset_link.failed",
        status: "failure",
        severity: "error",
        error_message: error.message,
        payload: { caller_id: caller.id },
      });
      return new Response(JSON.stringify({ error: "Erro ao gerar link: " + error.message }), { status: 500, headers: baseHeaders });
    }

    await obs.log({
      event_type: "auth.reset_link.issued",
      status: "success",
      severity: "info",
      payload: { caller_id: caller.id, by_super_admin: isSuperAdmin },
    });

    const actionLink = data?.properties?.action_link || "";
    return new Response(JSON.stringify({ link: actionLink }), { status: 200, headers: baseHeaders });
  } catch (e) {
    await obs.log({
      event_type: "auth.reset_link.exception",
      status: "failure",
      severity: "critical",
      error_message: e instanceof Error ? e.message : String(e),
    });
    return new Response(JSON.stringify({ error: "Erro inesperado" }), { status: 500, headers: baseHeaders });
  }
});
