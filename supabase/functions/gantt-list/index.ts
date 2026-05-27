import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createEdgeObservability, correlationResponseHeaders } from "../_shared/observability.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-correlation-id, x-causation-id",
  "Access-Control-Expose-Headers": "x-correlation-id",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const obs = createEdgeObservability(req, "edge.gantt-list");
  const baseHeaders = { ...corsHeaders, ...correlationResponseHeaders(obs), "Content-Type": "application/json" };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: baseHeaders });
    }

    const url = new URL(req.url);
    const obraId = url.searchParams.get("obra_id");
    if (!obraId) {
      return new Response(JSON.stringify({ error: "obra_id obrigatório" }), { status: 400, headers: baseHeaders });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: baseHeaders });
    }

    // Verifica role para decidir readonly por permissão
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const canEdit = (roles ?? []).some((r: { role: string }) => r.role === "admin" || r.role === "gestor");

    const { data: tasks, error: tErr } = await userClient
      .from("atividades")
      .select("id, obra_id, nome, descricao, data_inicio, data_fim, progresso, ordem, parent_id, responsavel, cor")
      .eq("obra_id", obraId)
      .is("deleted_at", null)
      .order("ordem", { ascending: true })
      .order("data_inicio", { ascending: true });

    if (tErr) {
      await obs.log({
        event_type: "gantt.list.failed",
        status: "failure",
        severity: "error",
        obra_id: obraId,
        error_message: tErr.message,
      });
      return new Response(JSON.stringify({ error: tErr.message }), { status: 400, headers: baseHeaders });
    }

    const { data: deps } = await userClient
      .from("atividade_dependencias")
      .select("predecessora_id, sucessora_id, tipo, lag_dias")
      .eq("obra_id", obraId);

    // Períodos fechados (não-reabertos)
    const { data: closed } = await userClient
      .from("periodos_fechados")
      .select("mes")
      .eq("obra_id", obraId)
      .is("reaberto_em", null);

    const closedMonths = new Set(
      (closed ?? []).map((c: { mes: string }) => c.mes.slice(0, 7)),
    );

    const enriched = (tasks ?? []).map((t: { id: string; data_fim: string }) => {
      const monthKey = (t.data_fim ?? "").slice(0, 7);
      const locked = closedMonths.has(monthKey);
      return {
        ...t,
        readonly: locked || !canEdit,
        locked_reason: locked ? "periodo_fechado" : !canEdit ? "sem_permissao" : null,
      };
    });

    await obs.log({
      event_type: "gantt.list.read",
      obra_id: obraId,
      payload: { count: enriched.length, can_edit: canEdit },
    });

    return new Response(
      JSON.stringify({
        tasks: enriched,
        dependencies: deps ?? [],
        can_edit: canEdit,
      }),
      { status: 200, headers: baseHeaders },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: baseHeaders },
    );
  }
});
