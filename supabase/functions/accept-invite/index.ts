import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createEdgeObservability, correlationResponseHeaders } from "../_shared/observability.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-correlation-id, x-causation-id",
  "Access-Control-Expose-Headers": "x-correlation-id",
};

/** Poll until profile exists, max 5 attempts */
// deno-lint-ignore no-explicit-any
async function waitForProfile(supabase: any, userId: string, maxRetries = 5): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    const { data } = await supabase.from("profiles").select("id").eq("id", userId).single();
    if (data) return true;
    await new Promise((r) => setTimeout(r, 300 * (i + 1)));
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const obs = createEdgeObservability(req, "edge.accept-invite");
  const baseHeaders = { ...corsHeaders, ...correlationResponseHeaders(obs), "Content-Type": "application/json" };

  try {
    const { token, email, password, full_name } = await req.json();

    if (!token || !email || !password) {
      await obs.log({
        event_type: "auth.invite.accept.denied",
        status: "denied",
        severity: "warning",
        payload: { reason: "missing_fields" },
      });
      return new Response(JSON.stringify({ error: "token, email e password são obrigatórios" }), {
        status: 400,
        headers: baseHeaders,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Validate invite
    const { data: invite, error: invErr } = await supabase
      .from("invites")
      .select("*")
      .eq("token", token)
      .eq("used", false)
      .single();

    if (invErr || !invite) {
      await obs.log({
        event_type: "auth.invite.accept.denied",
        status: "denied",
        severity: "warning",
        payload: { reason: "invalid_or_used" },
      });
      return new Response(JSON.stringify({ error: "Convite inválido ou já utilizado" }), {
        status: 400,
        headers: baseHeaders,
      });
    }

    if (new Date(invite.expires_at) < new Date()) {
      await obs.log({
        event_type: "auth.invite.accept.denied",
        status: "denied",
        severity: "warning",
        payload: { reason: "expired", invite_id: invite.id, tenant_id: invite.tenant_id },
      });
      return new Response(JSON.stringify({ error: "Convite expirado" }), { status: 400, headers: baseHeaders });
    }

    if (invite.email.toLowerCase() !== email.toLowerCase()) {
      await obs.log({
        event_type: "auth.invite.accept.denied",
        status: "denied",
        severity: "warning",
        payload: { reason: "email_mismatch", invite_id: invite.id },
      });
      return new Response(JSON.stringify({ error: "Email não corresponde ao convite" }), {
        status: 400,
        headers: baseHeaders,
      });
    }

    // 2. Check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    // deno-lint-ignore no-explicit-any
    const existingUser = existingUsers?.users?.find(
      (u: any) => u.email?.toLowerCase() === email.toLowerCase(),
    );

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      await supabase.from("profiles").update({ tenant_id: invite.tenant_id }).eq("id", userId);
    } else {
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: full_name || "" },
      });

      if (createErr || !newUser.user) {
        await obs.log({
          event_type: "auth.invite.accept.failed",
          status: "failure",
          severity: "error",
          error_message: createErr?.message ?? "createUser_unknown",
          payload: { invite_id: invite.id },
        });
        return new Response(
          JSON.stringify({ error: "Erro ao criar conta: " + (createErr?.message || "desconhecido") }),
          { status: 400, headers: baseHeaders },
        );
      }

      userId = newUser.user.id;

      const profileReady = await waitForProfile(supabase, userId);
      if (!profileReady) {
        await supabase.from("profiles").upsert({
          id: userId,
          email,
          full_name: full_name || "",
          tenant_id: invite.tenant_id,
          is_super_admin: false,
        });
      } else {
        await supabase.from("profiles").update({ tenant_id: invite.tenant_id }).eq("id", userId);
      }
    }

    // 4. Assign role
    await supabase.from("user_roles").upsert(
      { user_id: userId, role: invite.role, tenant_id: invite.tenant_id },
      { onConflict: "user_id,role" },
    );

    // 5. Auto-link obra membership
    if (invite.obra_id) {
      await supabase.from("obra_membros").upsert(
        { user_id: userId, obra_id: invite.obra_id, tenant_id: invite.tenant_id },
        { onConflict: "obra_id,user_id" },
      );
    }

    // 6. Mark invite as used
    await supabase.from("invites").update({ used: true }).eq("id", invite.id);

    await obs.log({
      event_type: "auth.invite.accepted",
      status: "success",
      payload: {
        invite_id: invite.id,
        tenant_id: invite.tenant_id,
        obra_id: invite.obra_id ?? null,
        role: invite.role,
        user_id: userId,
        new_user: !existingUser,
      },
    });

    return new Response(
      JSON.stringify({ success: true, auto_login: !existingUser }),
      { headers: baseHeaders },
    );
  } catch (err) {
    await obs.log({
      event_type: "auth.invite.accept.failed",
      status: "failure",
      severity: "error",
      error_message: err instanceof Error ? err.message : String(err),
    });
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: baseHeaders },
    );
  }
});
