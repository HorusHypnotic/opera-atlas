import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is admin/super_admin
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller } } = await anonClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if caller is admin or super_admin
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
        (r: any) => r.role === "admin" && r.tenant_id === callerProfile?.tenant_id
      );

    if (!isSuperAdmin && !isTenantAdmin) {
      return new Response(JSON.stringify({ error: "Apenas admins podem gerar links" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, redirect_to } = await req.json();
    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "Email obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cross-tenant guard: tenant admin só pode gerar reset para usuário do PRÓPRIO tenant
    if (!isSuperAdmin) {
      const { data: targetProfile } = await adminClient
        .from("profiles")
        .select("tenant_id, is_super_admin")
        .ilike("email", email)
        .maybeSingle();

      if (!targetProfile) {
        // Não revela se o email existe ou não — retorna 403 genérico
        return new Response(JSON.stringify({ error: "Não autorizado para este usuário" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (targetProfile.is_super_admin === true) {
        return new Response(JSON.stringify({ error: "Não autorizado para este usuário" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (targetProfile.tenant_id !== callerProfile?.tenant_id) {
        return new Response(JSON.stringify({ error: "Não autorizado para este usuário" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Generate recovery link using admin API
    const { data, error } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: redirect_to || undefined,
      },
    });

    if (error) {
      return new Response(JSON.stringify({ error: "Erro ao gerar link: " + error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build the full recovery URL with the token hash
    const properties = data?.properties;
    const actionLink = properties?.action_link || "";

    return new Response(
      JSON.stringify({ link: actionLink }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Erro inesperado" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
