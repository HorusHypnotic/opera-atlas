import { createRoot } from "react-dom/client";
import "./index.css";

// Load the app after establishing a bootstrap failure surface. Static imports of
// App evaluate Supabase modules before a React error boundary can mount.
const rootElement = document.getElementById("root");

function showBootstrapFailure(phase: "boundary" | "app" | "render" | "config"): void {
  if (!rootElement) return;
  const wrapper = document.createElement("main");
  wrapper.setAttribute("role", "alert");
  wrapper.style.cssText =
    "min-height:100vh;display:grid;place-content:center;gap:12px;padding:24px;background:#0f172a;color:#f8fafc;font:16px system-ui,sans-serif";
  const heading = document.createElement("h1");
  heading.textContent = "Não foi possível iniciar o OPERA Atlas";
  const detail = document.createElement("p");
  detail.textContent = "O carregamento falhou. Recarregue a página ou contate o suporte.";
  const code = document.createElement("p");
  code.textContent = `Código de diagnóstico: ATLAS-${phase.toUpperCase()}`;
  wrapper.append(heading, detail, code);
  rootElement.replaceChildren(wrapper);
}

async function bootstrap(): Promise<void> {
  if (!rootElement) throw new Error("OPERA_BOOTSTRAP_ROOT_MISSING");
  let phase: "boundary" | "app" | "render" | "config" = "boundary";
  try {
    const { AppErrorBoundary } = await import("./components/AppErrorBoundary");
    // Diagnose missing public configuration without exposing URLs or keys.
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
      phase = "config";
      throw new Error("OPERA_BOOTSTRAP_CONFIG_MISSING");
    }
    phase = "app";
    const { default: App } = await import("./App.tsx");
    phase = "render";
    createRoot(rootElement).render(
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>,
    );
  } catch (error) {
    // Diagnostic code only: never log environment values or credentials.
    console.error("OPERA_BOOTSTRAP_FAILED", phase, error instanceof Error ? error.name : "UnknownError");
    showBootstrapFailure(phase);
  }
}

void bootstrap();
