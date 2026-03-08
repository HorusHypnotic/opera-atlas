import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, email, password, full_name } = await req.json();

    if (!token || !email || !password) {
      return new Response(JSON.stringify({ error: "token, email e password são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      return new Response(JSON.stringify({ error: "Convite inválido ou já utilizado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(invite.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Convite expirado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (invite.email.toLowerCase() !== email.toLowerCase()) {
      return new Response(JSON.stringify({ error: "Email não corresponde ao convite" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      // Update profile to link tenant
      await supabase
        .from("profiles")
        .update({ tenant_id: invite.tenant_id })
        .eq("id", userId);
    } else {
      // 3. Create user with confirmed email
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: full_name || "" },
      });

      if (createErr || !newUser.user) {
        return new Response(JSON.stringify({ error: "Erro ao criar conta: " + (createErr?.message || "desconhecido") }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      userId = newUser.user.id;

      // Wait for trigger to create profile, then update tenant
      await new Promise((r) => setTimeout(r, 500));
      await supabase
        .from("profiles")
        .update({ tenant_id: invite.tenant_id })
        .eq("id", userId);
    }

    // 4. Assign role (upsert to avoid duplicates)
    await supabase.from("user_roles").upsert(
      { user_id: userId, role: invite.role, tenant_id: invite.tenant_id },
      { onConflict: "user_id,role" }
    );

    // 5. Mark invite as used
    await supabase.from("invites").update({ used: true }).eq("id", invite.id);

    return new Response(
      JSON.stringify({ success: true, auto_login: !existingUser }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
