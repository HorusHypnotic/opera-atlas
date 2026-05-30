import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createEdgeObservability, correlationResponseHeaders } from "../_shared/observability.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-correlation-id, x-causation-id, x-cron-secret",
  "Access-Control-Expose-Headers": "x-correlation-id",
};

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

  const obs = createEdgeObservability(req, "edge.data-retention");
  const baseHeaders = { ...corsHeaders, ...correlationResponseHeaders(obs), "Content-Type": "application/json" };

  const cronSecret = Deno.env.get("CRON_SECRET");
  const providedSecret = req.headers.get("x-cron-secret");
  const authHeader = req.headers.get("Authorization");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  let authorized = false;
  let triggeredBy: "cron" | "super_admin" | "unknown" = "unknown";
  let callerId: string | null = null;

  if (cronSecret && providedSecret && providedSecret === cronSecret) {
    authorized = true;
    triggeredBy = "cron";
  }

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
        if (prof?.is_super_admin) {
          authorized = true;
          triggeredBy = "super_admin";
          callerId = userId as string;
        }
      }
    } catch (e) {
      console.warn("[data-retention] auth check failed:", e);
    }
  }

  if (!authorized) {
    await obs.log({
      event_type: "retention.run.denied",
      status: "denied",
      severity: "warning",
      payload: { reason: "unauthorized" },
    });
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: baseHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const retentionMonths = 3;
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - retentionMonths);
    const cutoffISO = cutoffDate.toISOString();

    await obs.log({
      event_type: "retention.run.started",
      status: "info",
      payload: { cutoff: cutoffISO, retention_months: retentionMonths, triggered_by: triggeredBy, caller_id: callerId },
    });

    const results: Record<string, number> = {};

    for (const [table, dateColumn] of OPERATIONAL_TABLES) {
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
        await obs.log({
          event_type: "retention.table.failed",
          status: "failure",
          severity: "error",
          error_message: error.message,
          payload: { table },
        });
        results[table] = -1;
      } else {
        results[table] = deleted?.length ?? 0;
      }
    }

    const totalDeleted = Object.values(results).filter((v) => v > 0).reduce((a, b) => a + b, 0);

    await obs.log({
      event_type: "retention.run.completed",
      status: "success",
      payload: { total_deleted: totalDeleted, details: results, cutoff: cutoffISO },
    });

    return new Response(
      JSON.stringify({
        success: true,
        cutoff_date: cutoffISO,
        retention_months: retentionMonths,
        total_deleted: totalDeleted,
        details: results,
      }),
      { headers: baseHeaders },
    );
  } catch (err) {
    await obs.log({
      event_type: "retention.run.failed",
      status: "failure",
      severity: "critical",
      error_message: err instanceof Error ? err.message : String(err),
    });
    return new Response(JSON.stringify({ success: false, error: String(err) }), { status: 500, headers: baseHeaders });
  }
});
