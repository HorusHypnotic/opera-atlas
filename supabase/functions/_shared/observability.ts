/**
 * Observabilidade Causal — edge functions (Deno).
 * Espelho do `src/lib/observability.ts`. Mesmo contrato.
 *
 * Uso:
 *   const obs = createEdgeObservability(req, "edge.generate-reset-link");
 *   await obs.log({ event_type: "reset.requested", payload: { email } });
 */

// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";

const CORRELATION_HEADER = "x-correlation-id";
const CAUSATION_HEADER = "x-causation-id";

export type EventStatus = "success" | "failure" | "warning" | "info" | "denied";
export type EventSeverity = "debug" | "info" | "warning" | "error" | "critical";

export interface EdgeLogInput {
  event_type: string;
  status?: EventStatus;
  severity?: EventSeverity;
  payload?: Record<string, unknown>;
  error_message?: string;
  duration_ms?: number;
  obra_id?: string;
  causation_id?: string;
  // Override do correlation_id quando a função processa múltiplas operações
  correlation_id?: string;
}

export interface EdgeObservability {
  correlationId: string;
  source: string;
  /** Cliente Supabase com service_role para chamar log_system_event mesmo sem JWT. */
  client: ReturnType<typeof createClient>;
  /** Cliente Supabase autenticado com o JWT do request (se houver). Use para ações em nome do usuário. */
  userClient: ReturnType<typeof createClient> | null;
  log: (input: EdgeLogInput) => Promise<string | null>;
  /** Medi duração e loga sucesso/falha. */
  traced: <T>(input: Omit<EdgeLogInput, "status" | "duration_ms" | "error_message">, fn: () => Promise<T>) => Promise<T>;
}

function uuid(): string {
  return crypto.randomUUID();
}

export function createEdgeObservability(req: Request, source: string): EdgeObservability {
  const incomingCorr = req.headers.get(CORRELATION_HEADER);
  const incomingCaus = req.headers.get(CAUSATION_HEADER);
  const correlationId = incomingCorr && /^[0-9a-f-]{36}$/i.test(incomingCorr)
    ? incomingCorr
    : uuid();

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  const client = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const authHeader = req.headers.get("Authorization");
  const userClient = authHeader
    ? createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

  const log = async (input: EdgeLogInput): Promise<string | null> => {
    const corr = input.correlation_id ?? correlationId;
    const causation = input.causation_id ?? incomingCaus ?? null;

    // Console mirror — Supabase recolhe stdout das edge functions.
    try {
      console.log(JSON.stringify({
        ts: new Date().toISOString(),
        correlation_id: corr,
        causation_id: causation,
        source,
        event_type: input.event_type,
        status: input.status ?? "success",
        severity: input.severity ?? "info",
        duration_ms: input.duration_ms ?? null,
        error_message: input.error_message ?? null,
        payload: input.payload ?? {},
      }));
    } catch {
      // ignore JSON serialization issues
    }

    try {
      const { data, error } = await client.rpc("log_system_event", {
        _correlation_id: corr,
        _event_type: input.event_type,
        _source: source,
        _causation_id: causation,
        _obra_id: input.obra_id ?? null,
        _status: input.status ?? "success",
        _severity: input.severity ?? "info",
        _payload: input.payload ?? {},
        _error_message: input.error_message ?? null,
        _duration_ms: input.duration_ms ?? null,
      } as any);
      if (error) {
        console.warn("[obs] log_system_event error:", error.message);
        return null;
      }
      return (data as unknown as string) ?? null;
    } catch (err) {
      console.warn("[obs] log_system_event exception:", err);
      return null;
    }
  };

  const traced = async <T>(
    base: Omit<EdgeLogInput, "status" | "duration_ms" | "error_message">,
    fn: () => Promise<T>,
  ): Promise<T> => {
    const start = performance.now();
    try {
      const result = await fn();
      void log({ ...base, status: "success", duration_ms: Math.round(performance.now() - start) });
      return result;
    } catch (err) {
      void log({
        ...base,
        status: "failure",
        severity: "error",
        duration_ms: Math.round(performance.now() - start),
        error_message: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  };

  return { correlationId, source, client, userClient, log, traced };
}

/** Headers padrão de resposta para devolver o correlation_id ao cliente. */
export function correlationResponseHeaders(obs: EdgeObservability): Record<string, string> {
  return { [CORRELATION_HEADER]: obs.correlationId };
}
