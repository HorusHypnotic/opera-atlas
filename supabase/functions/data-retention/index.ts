import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Tables with operational data to clean up
// Each entry: [table_name, date_column]
const OPERATIONAL_TABLES: [string, string][] = [
  ["registros_diarios", "created_at"],
  ["consumo_materiais", "created_at"],
  ["incidentes_seguranca", "created_at"],
  ["lancamentos_financeiros", "created_at"],
  ["retrabalhos", "created_at"],
  ["ativos", "created_at"],
  ["riscos", "created_at"],
  ["ciclos_tarefa", "created_at"],
  ["logistica_interna", "created_at"],
  ["sequenciamento_equipes", "created_at"],
  ["compras_emergenciais", "created_at"],
  ["aditivos_contratuais", "created_at"],
  ["checklist_semanal", "created_at"],
  ["acoes_corretivas", "created_at"],
];

// Protected tables that should NEVER be cleaned
const PROTECTED_TABLES = [
  "profiles",
  "tenants",
  "user_roles",
  "invites",
  "beta_waitlist",
  "beta_config",
  "influencer_codes",
  "obras",
  "obra_membros",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // 🔒 Auth: require either a valid cron secret OR a super_admin JWT
  const cronSecret = Deno.env.get("CRON_SECRET");
  const providedSecret = req.headers.get("x-cron-secret");
  const authHeader = req.headers.get("Authorization");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  let authorized = false;

  // Path 1: cron secret match
  if (cronSecret && providedSecret && providedSecret === cronSecret) {
    authorized = true;
  }

  // Path 2: super_admin JWT
  if (!authorized && authHeader?.startsWith("Bearer ")) {
    try {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData } = await userClient.auth.getClaims(token);
      const userId = claimsData?.claims?.sub;
      if (userId) {
        const adminClient = createClient(supabaseUrl, serviceRoleKey);
        const { data: prof } = await adminClient
          .from("profiles")
          .select("is_super_admin")
          .eq("id", userId)
          .maybeSingle();
        if (prof?.is_super_admin) authorized = true;
      }
    } catch (e) {
      console.warn("[data-retention] auth check failed:", e);
    }
  }

  if (!authorized) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Default retention: 3 months. Can be configured per plan later.
    const retentionMonths = 3;
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - retentionMonths);
    const cutoffISO = cutoffDate.toISOString();

    console.log(`[data-retention] Running cleanup. Cutoff: ${cutoffISO}`);

    const results: Record<string, number> = {};

    for (const [table, dateColumn] of OPERATIONAL_TABLES) {
      // Safety check
      if (PROTECTED_TABLES.includes(table)) {
        console.warn(`[data-retention] Skipping protected table: ${table}`);
        continue;
      }

      const { data: deleted, error } = await supabase
        .from(table)
        .delete()
        .lt(dateColumn, cutoffISO)
        .select("id");

      if (error) {
        console.error(`[data-retention] Error cleaning ${table}:`, error.message);
        results[table] = -1;
      } else {
        results[table] = deleted?.length ?? 0;
        if ((deleted?.length ?? 0) > 0) {
          console.log(`[data-retention] Deleted ${deleted!.length} rows from ${table}`);
        }
      }
    }

    const totalDeleted = Object.values(results).filter((v) => v > 0).reduce((a, b) => a + b, 0);

    return new Response(
      JSON.stringify({
        success: true,
        cutoff_date: cutoffISO,
        retention_months: retentionMonths,
        total_deleted: totalDeleted,
        details: results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[data-retention] Fatal error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
