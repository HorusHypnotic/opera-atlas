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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    if (req.method === "POST") {
      // Generate a transfer code — requires auth
      const authHeader = req.headers.get("authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Não autenticado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { authorization: authHeader } },
      });

      const { data: { user }, error: userErr } = await userClient.auth.getUser();
      if (userErr || !user) {
        return new Response(JSON.stringify({ error: "Token inválido" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const refreshToken = body.refresh_token;
      if (!refreshToken || typeof refreshToken !== "string") {
        return new Response(JSON.stringify({ error: "refresh_token obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Generate random 6-char code
      const code = crypto.randomUUID().slice(0, 8).toUpperCase();

      // Clean up old expired/used transfers for this user
      await supabase
        .from("session_transfers")
        .delete()
        .eq("user_id", user.id);

      // Insert new transfer
      const { error: insertErr } = await supabase
        .from("session_transfers")
        .insert({
          code,
          user_id: user.id,
          refresh_token: refreshToken,
        });

      if (insertErr) {
        return new Response(JSON.stringify({ error: insertErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ code }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "GET") {
      // Consume a transfer code — no auth needed
      const url = new URL(req.url);
      const code = url.searchParams.get("code");

      if (!code || code.length < 6) {
        return new Response(JSON.stringify({ error: "Código inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find valid transfer
      const { data: transfer, error: fetchErr } = await supabase
        .from("session_transfers")
        .select("*")
        .eq("code", code.toUpperCase())
        .eq("used", false)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (fetchErr || !transfer) {
        return new Response(
          JSON.stringify({ error: "Código expirado ou inválido" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Mark as used
      await supabase
        .from("session_transfers")
        .update({ used: true })
        .eq("id", transfer.id);

      return new Response(
        JSON.stringify({ refresh_token: transfer.refresh_token }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ error: "Método não suportado" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
