// Edge Function: export-csv
// Exporta dados do tenant em CSV (zip), respeitando RLS, registrando em system_events.
// Escopos: tenant_full | obra | periodo
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";
import { createEdgeObservability, correlationResponseHeaders } from "../_shared/observability.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-correlation-id, x-causation-id",
  "Access-Control-Expose-Headers": "x-correlation-id",
};

// Allowlist de tabelas + colunas a omitir por LGPD/segurança.
// Cada tabela é lida via userClient → RLS aplicada (I1/I5).
type TableSpec = {
  name: string;
  // colunas a remover (tokens, hashes sensíveis, etc.)
  omit?: string[];
  // filtro adicional além do RLS (ex.: obra_id)
  scopeBy?: "tenant" | "obra" | "global";
  // Ordenação determinística (E7)
  orderBy?: string;
};

const TABLES: TableSpec[] = [
  { name: "tenants", scopeBy: "global", orderBy: "id" },
  { name: "obras", scopeBy: "tenant", orderBy: "id" },
  { name: "profiles", scopeBy: "tenant", orderBy: "id" },
  { name: "user_roles", scopeBy: "global", orderBy: "id" },
  { name: "obra_membros", scopeBy: "global", orderBy: "id" },
  { name: "colaboradores", scopeBy: "tenant", orderBy: "id" },
  { name: "colaborador_obras", scopeBy: "tenant", orderBy: "id" },
  { name: "registro_presencas", scopeBy: "obra", orderBy: "data,id" },
  { name: "apontamento_diarias", scopeBy: "obra", orderBy: "periodo_inicio,id" },
  { name: "registros_diarios", scopeBy: "obra", orderBy: "data_registro,id" },
  { name: "lancamentos_financeiros", scopeBy: "obra", orderBy: "data,id" },
  { name: "consumo_materiais", scopeBy: "obra", orderBy: "data_registro,id" },
  { name: "lote_materiais", scopeBy: "obra", orderBy: "id" },
  { name: "lotes_consumo", scopeBy: "obra", orderBy: "id" },
  { name: "retrabalhos", scopeBy: "obra", orderBy: "data_registro,id" },
  { name: "incidentes_seguranca", scopeBy: "obra", orderBy: "data,id" },
  { name: "checklist_semanal", scopeBy: "obra", orderBy: "semana,id" },
  { name: "acoes_corretivas", scopeBy: "obra", orderBy: "id" },
  { name: "riscos", scopeBy: "obra", orderBy: "id" },
  { name: "ativos", scopeBy: "obra", orderBy: "id" },
  { name: "compras_emergenciais", scopeBy: "obra", orderBy: "id" },
  { name: "logistica_interna", scopeBy: "obra", orderBy: "id" },
  { name: "ciclos_tarefa", scopeBy: "obra", orderBy: "id" },
  { name: "sequenciamento_equipes", scopeBy: "obra", orderBy: "id" },
  { name: "aditivos_contratuais", scopeBy: "obra", orderBy: "id" },
  { name: "atividades", scopeBy: "obra", orderBy: "ordem,id" },
  { name: "atividade_dependencias", scopeBy: "obra", orderBy: "id" },
  { name: "cronograma_baseline", scopeBy: "obra", orderBy: "id" },
  { name: "periodos_fechados", scopeBy: "obra", orderBy: "mes,versao" },
  { name: "periodos_reaberturas", scopeBy: "obra", orderBy: "mes,reaberto_em" },
  { name: "audit_logs", scopeBy: "tenant", orderBy: "created_at,id" },
  { name: "audit_logs_db", scopeBy: "tenant", orderBy: "created_at,id" },
  { name: "system_events", scopeBy: "tenant", orderBy: "created_at,id" },
  { name: "invites", scopeBy: "tenant", orderBy: "created_at,id", omit: ["token"] },
  { name: "session_transfers", scopeBy: "global", orderBy: "created_at,id", omit: ["token"] },
];

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s: string;
  if (typeof v === "object") s = JSON.stringify(v);
  else s = String(v);
  if (/[",\r\n]/.test(s)) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function toCSV(rows: Record<string, unknown>[], extras: Record<string, string>): string {
  if (rows.length === 0) {
    const cols = Object.keys(extras);
    return "\uFEFF" + cols.join(",") + "\r\n";
  }
  const baseCols = Object.keys(rows[0]);
  const extraCols = Object.keys(extras);
  const cols = [...baseCols, ...extraCols];
  const lines: string[] = [cols.join(",")];
  for (const r of rows) {
    const vals = baseCols.map((c) => csvEscape(r[c])).concat(extraCols.map((c) => csvEscape(extras[c])));
    lines.push(vals.join(","));
  }
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

interface Scope {
  type: "tenant_full" | "obra" | "periodo";
  obra_id?: string;
  mes?: string; // YYYY-MM-01
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const obs = createEdgeObservability(req, "edge.export-csv");
  const baseHeaders = { ...corsHeaders, ...correlationResponseHeaders(obs), "Content-Type": "application/json" };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: baseHeaders });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const admin = createClient(SUPABASE_URL, SERVICE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: baseHeaders });
    }

    // Verifica role admin
    const { data: roleRow } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!roleRow) {
      await obs.log({ event_type: "exportacao_csv.denied", status: "denied", severity: "warning",
        payload: { reason: "not_admin", user_id: user.id } });
      return new Response(JSON.stringify({ error: "Apenas administradores podem exportar dados" }),
        { status: 403, headers: baseHeaders });
    }

    const { data: tenantId } = await admin.rpc("get_user_tenant_id", { _user_id: user.id });
    if (!tenantId) {
      return new Response(JSON.stringify({ error: "Tenant não encontrado" }), { status: 400, headers: baseHeaders });
    }

    const body = await req.json().catch(() => ({})) as Scope;
    const scope: Scope = {
      type: body.type ?? "tenant_full",
      obra_id: body.obra_id,
      mes: body.mes,
    };

    if ((scope.type === "obra" || scope.type === "periodo") && !scope.obra_id) {
      return new Response(JSON.stringify({ error: "obra_id obrigatório para este escopo" }),
        { status: 400, headers: baseHeaders });
    }
    if (scope.type === "periodo" && !scope.mes) {
      return new Response(JSON.stringify({ error: "mes obrigatório para escopo periodo" }),
        { status: 400, headers: baseHeaders });
    }

    await obs.log({ event_type: "exportacao_csv.started", payload: { scope, tenant_id: tenantId } });

    const exportadoEm = new Date().toISOString();
    const extras = { exportado_em: exportadoEm, exportado_por: user.id };

    const zip = new JSZip();
    const manifest: { table: string; rows: number; bytes: number }[] = [];
    let totalRows = 0;

    // Determina obras visíveis quando filtro por obra/periodo
    let obrasFilter: string[] | null = null;
    if (scope.type === "obra" || scope.type === "periodo") {
      obrasFilter = [scope.obra_id!];
    }

    // Período → range de datas para filtro adicional
    let periodoStart: string | null = null;
    let periodoEnd: string | null = null;
    if (scope.type === "periodo" && scope.mes) {
      const d = new Date(scope.mes + "T00:00:00Z");
      const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
      const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
      periodoStart = start.toISOString().slice(0, 10);
      periodoEnd = end.toISOString().slice(0, 10);
    }

    const PAGE = 5000;

    for (const spec of TABLES) {
      const allRows: Record<string, unknown>[] = [];
      let from = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        let q = userClient.from(spec.name).select("*");
        if (spec.scopeBy === "obra" && obrasFilter) {
          q = q.in("obra_id", obrasFilter);
        }
        // Filtro adicional por período (best-effort em colunas conhecidas)
        if (scope.type === "periodo" && periodoStart && periodoEnd) {
          const dateCol =
            spec.name === "registro_presencas" ? "data" :
            spec.name === "apontamento_diarias" ? "periodo_inicio" :
            spec.name === "registros_diarios" ? "data_registro" :
            spec.name === "lancamentos_financeiros" ? "data" :
            spec.name === "consumo_materiais" ? "data_registro" :
            spec.name === "retrabalhos" ? "data_registro" :
            spec.name === "incidentes_seguranca" ? "data" :
            spec.name === "checklist_semanal" ? "semana" :
            spec.name === "periodos_fechados" ? "mes" :
            spec.name === "periodos_reaberturas" ? "mes" :
            spec.name === "audit_logs" || spec.name === "audit_logs_db" || spec.name === "system_events"
              ? "created_at" : null;
          if (dateCol) {
            q = q.gte(dateCol, periodoStart).lte(dateCol, dateCol === "created_at" ? periodoEnd + "T23:59:59Z" : periodoEnd);
          }
        }
        if (spec.orderBy) {
          for (const col of spec.orderBy.split(",")) {
            q = q.order(col.trim(), { ascending: true });
          }
        }
        const { data, error } = await q.range(from, from + PAGE - 1);
        if (error) {
          // tabela invisível para o usuário (RLS) → ignora
          break;
        }
        if (!data || data.length === 0) break;
        for (const row of data) {
          if (spec.omit) for (const o of spec.omit) delete (row as Record<string, unknown>)[o];
          allRows.push(row as Record<string, unknown>);
        }
        if (data.length < PAGE) break;
        from += PAGE;
      }
      const csv = toCSV(allRows, extras);
      const fileName = `public_${spec.name}.csv`;
      zip.file(fileName, csv);
      const bytes = new TextEncoder().encode(csv).length;
      manifest.push({ table: spec.name, rows: allRows.length, bytes });
      totalRows += allRows.length;
    }

    // Manifest JSON
    const manifestJson = JSON.stringify({
      scope, tenant_id: tenantId, exportado_em: exportadoEm,
      exportado_por: user.id, correlation_id: obs.correlationId,
      rule_version: "csv-export-v1", tables: manifest, total_rows: totalRows,
    }, null, 2);
    zip.file("_manifest.json", manifestJson);

    const zipBuf = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });

    const ts = exportadoEm.replace(/[:.]/g, "-");
    const path = `${tenantId}/${ts}-${scope.type}.zip`;

    const { error: upErr } = await admin.storage.from("exports").upload(path, zipBuf, {
      contentType: "application/zip", upsert: false,
    });
    if (upErr) {
      await obs.log({ event_type: "exportacao_csv.failed", status: "failure", severity: "error",
        error_message: upErr.message, payload: { stage: "upload" } });
      return new Response(JSON.stringify({ error: upErr.message }), { status: 500, headers: baseHeaders });
    }

    const { data: signed, error: sErr } = await admin.storage.from("exports").createSignedUrl(path, 60 * 15);
    if (sErr || !signed) {
      await obs.log({ event_type: "exportacao_csv.failed", status: "failure", severity: "error",
        error_message: sErr?.message ?? "no signed url", payload: { stage: "sign" } });
      return new Response(JSON.stringify({ error: "Falha ao gerar URL" }), { status: 500, headers: baseHeaders });
    }

    await obs.log({
      event_type: "exportacao_csv.completed",
      payload: { scope, tables: manifest.length, rows_total: totalRows, file_bytes: zipBuf.length, path },
    });

    return new Response(JSON.stringify({
      url: signed.signedUrl,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      manifest, total_rows: totalRows, file_bytes: zipBuf.length,
      correlation_id: obs.correlationId,
    }), { status: 200, headers: baseHeaders });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await obs.log({ event_type: "exportacao_csv.failed", status: "failure", severity: "error", error_message: msg });
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: baseHeaders });
  }
});
