import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    if (req.method === "POST") {
      // Generate a transfer code — requires auth
      const authHeader = req.headers.get("authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Não autenticado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const token = authHeader.replace("Bearer ", "");
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });

      const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
      if (claimsErr || !claimsData?.claims?.sub) {
        return new Response(JSON.stringify({ error: "Token inválido" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userId = claimsData.claims.sub as string;
      const userEmail = claimsData.claims.email as string;

      const code = crypto.randomUUID().slice(0, 8).toUpperCase();

      // Clean old transfers
      await supabase.from("session_transfers").delete().eq("user_id", userId);

      // Store user email instead of refresh_token — mobile will get its own session
      const { error: insertErr } = await supabase
        .from("session_transfers")
        .insert({
          code,
          user_id: userId,
          refresh_token: userEmail, // reusing column to store email
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
      const url = new URL(req.url);
      const code = url.searchParams.get("code");

      if (!code || code.length < 6) {
        return new Response(JSON.stringify({ error: "Código inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Mark as used
      await supabase.from("session_transfers").update({ used: true }).eq("id", transfer.id);

      // Generate a magic link for the user's email — gives mobile its OWN independent session
      const email = transfer.refresh_token; // we stored email here
      const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email,
      });

      if (linkErr || !linkData) {
        console.error("generateLink error:", linkErr);
        return new Response(
          JSON.stringify({ error: "Erro ao gerar link de sessão" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Return the hashed token so the client can verify it via verifyOtp
      const hashToken = linkData.properties?.hashed_token;

      return new Response(
        JSON.stringify({ email, token: hashToken }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Método não suportado" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
