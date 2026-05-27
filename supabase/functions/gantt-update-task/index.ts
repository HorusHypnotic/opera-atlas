import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createEdgeObservability, correlationResponseHeaders } from "../_shared/observability.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-correlation-id, x-causation-id",
  "Access-Control-Expose-Headers": "x-correlation-id",
};

interface UpdateBody {
  task_id: string;
  data_inicio?: string;
  data_fim?: string;
  nome?: string;
  progresso?: number;
  reason?: string;
}

function monthKey(d: string): string {
  return d.slice(0, 7);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const obs = createEdgeObservability(req, "edge.gantt-update-task");
  const baseHeaders = { ...corsHeaders, ...correlationResponseHeaders(obs), "Content-Type": "application/json" };

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: baseHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      await obs.log({ event_type: "gantt.task.update.denied", status: "denied", severity: "warning", payload: { reason: "no_auth" } });
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: baseHeaders });
    }

    const body = (await req.json()) as UpdateBody;
    if (!body?.task_id) {
      return new Response(JSON.stringify({ error: "task_id obrigatório" }), { status: 400, headers: baseHeaders });
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

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1) Buscar tarefa atual (server-side authority)
    const { data: current, error: cErr } = await admin
      .from("atividades")
      .select("id, tenant_id, obra_id, nome, data_inicio, data_fim, progresso")
      .eq("id", body.task_id)
      .is("deleted_at", null)
      .single();

    if (cErr || !current) {
      return new Response(JSON.stringify({ error: "Tarefa não encontrada" }), { status: 404, headers: baseHeaders });
    }

    // 2) Validar role do usuário no tenant
    const { data: roles } = await admin
      .from("user_roles")
      .select("role, tenant_id")
      .eq("user_id", user.id);
    const canEdit = (roles ?? []).some(
      (r: { role: string; tenant_id: string | null }) =>
        (r.role === "admin" || r.role === "gestor") && r.tenant_id === current.tenant_id,
    );
    const { data: profile } = await admin
      .from("profiles")
      .select("is_super_admin, tenant_id")
      .eq("id", user.id)
      .single();
    const isSuper = profile?.is_super_admin === true;

    if (!canEdit && !isSuper) {
      await obs.log({
        event_type: "gantt.task.update.denied",
        status: "denied",
        severity: "warning",
        obra_id: current.obra_id,
        payload: { reason: "insufficient_role", task_id: body.task_id },
      });
      return new Response(JSON.stringify({ error: "Permissão insuficiente" }), { status: 403, headers: baseHeaders });
    }

    if (profile?.tenant_id !== current.tenant_id && !isSuper) {
      return new Response(JSON.stringify({ error: "Cross-tenant bloqueado" }), { status: 403, headers: baseHeaders });
    }

    // 3) Compor novos valores
    const newStart = body.data_inicio ?? current.data_inicio;
    const newEnd = body.data_fim ?? current.data_fim;
    if (newEnd < newStart) {
      return new Response(JSON.stringify({ error: "data_fim deve ser >= data_inicio" }), { status: 400, headers: baseHeaders });
    }

    // 4) Período fechado bloqueia (no mês de term. antigo OU novo)
    const months = Array.from(new Set([monthKey(current.data_fim), monthKey(newEnd)])).map((m) => `${m}-01`);
    const { data: closed } = await admin
      .from("periodos_fechados")
      .select("mes")
      .eq("obra_id", current.obra_id)
      .is("reaberto_em", null)
      .in("mes", months);
    if ((closed ?? []).length > 0 && !isSuper) {
      await obs.log({
        event_type: "gantt.task.update.denied",
        status: "denied",
        severity: "warning",
        obra_id: current.obra_id,
        payload: { reason: "periodo_fechado", task_id: body.task_id, months },
      });
      return new Response(
        JSON.stringify({ error: "Tarefa bloqueada: mês fechado", code: "periodo_fechado" }),
        { status: 409, headers: baseHeaders },
      );
    }

    // 5) Aplicar update — modo "block" (Fase 1) — sem validação de dep ainda
    const patch: Record<string, unknown> = { updated_by: user.id };
    if (body.data_inicio) patch.data_inicio = body.data_inicio;
    if (body.data_fim) patch.data_fim = body.data_fim;
    if (typeof body.nome === "string" && body.nome.trim()) patch.nome = body.nome.trim();
    if (typeof body.progresso === "number") {
      patch.progresso = Math.max(0, Math.min(100, body.progresso));
    }

    const { data: updated, error: uErr } = await admin
      .from("atividades")
      .update(patch)
      .eq("id", body.task_id)
      .select()
      .single();

    if (uErr) {
      await obs.log({
        event_type: "gantt.task.update.failed",
        status: "failure",
        severity: "error",
        obra_id: current.obra_id,
        error_message: uErr.message,
        payload: { task_id: body.task_id, patch },
      });
      return new Response(JSON.stringify({ error: uErr.message }), { status: 400, headers: baseHeaders });
    }

    await obs.log({
      event_type: "gantt.task.update",
      obra_id: current.obra_id,
      payload: {
        task_id: body.task_id,
        old: {
          nome: current.nome,
          data_inicio: current.data_inicio,
          data_fim: current.data_fim,
          progresso: current.progresso,
        },
        new: {
          nome: updated.nome,
          data_inicio: updated.data_inicio,
          data_fim: updated.data_fim,
          progresso: updated.progresso,
        },
        reason: body.reason ?? null,
      },
    });

    return new Response(JSON.stringify({ ok: true, task: updated }), { status: 200, headers: baseHeaders });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: baseHeaders },
    );
  }
});
