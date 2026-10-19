import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// Regression guard: App must be imported only after bootstrap's try/catch.
describe("pre-React bootstrap fallback", () => {
  const source = readFileSync(new URL("../main.tsx", import.meta.url), "utf8");

  it("loads App dynamically instead of importing it before the error handler", () => {
    expect(source).not.toMatch(/^import\s+App\s+from\s+/m);
    expect(source).toContain('import("./App.tsx")');
  });

  it("shows a safe visible error without exposing configuration values", () => {
    expect(source).toContain('wrapper.setAttribute("role", "alert")');
    expect(source).toContain("OPERA_BOOTSTRAP_FAILED");
    expect(source).not.toContain("console.error(error)");
    expect(source).toContain("showBootstrapFailure(phase)");
  });
  it("wraps App in a render error boundary", () => {
    expect(source).toContain("<AppErrorBoundary>");
    expect(source).toContain("</AppErrorBoundary>");
    expect(source).toContain('import("./components/AppErrorBoundary")');
  });

  it("keeps bootstrap error details out of the UI", () => {
    expect(source).not.toContain("error.message");
    expect(source).not.toContain("error.stack");
    expect(source).toContain("rootElement.replaceChildren(wrapper)");
  });

  it("identifies the failed startup phase without logging exception contents", () => {
    expect(source).toContain('phase = "app"');
    expect(source).toContain('phase = "render"');
    expect(source).toContain('console.error("OPERA_BOOTSTRAP_FAILED", phase, error instanceof Error ? error.name : "UnknownError")');
    expect(source).not.toContain("error.message");
    expect(source).not.toContain("error.stack");
  });

  it("renders a safe phase code on the fallback screen", () => {
    expect(source).toContain('showBootstrapFailure(phase: "boundary" | "app" | "render")');
    expect(source).toContain('Código de diagnóstico: ATLAS-${phase.toUpperCase()}');
    expect(source).toContain("wrapper.append(heading, detail, code)");
  });

  it("keeps phase codes limited to the three startup stages", () => {
    expect(source).toContain('let phase: "boundary" | "app" | "render" = "boundary"');
    expect(source).toContain('Código de diagnóstico: ATLAS-${phase.toUpperCase()}');
    expect(source).not.toContain("JSON.stringify(error)");
  });

  it("defers route page modules so they do not block the initial App import", () => {
    const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
    expect(appSource).toContain('import { lazy, Suspense } from "react"');
    expect(appSource).toContain('const DashboardOverview = lazy(() => import("./pages/DashboardOverview"))');
    expect(appSource).toContain('const LoginPage = lazy(() => import("./pages/LoginPage"))');
    expect(appSource).toContain("<Suspense fallback=");
    expect(appSource.split("\n").filter((line) => line.startsWith("import ") && line.includes('from "./pages/'))).toHaveLength(0);
  });

  it("resolves every lazy route module to a file with a default export", () => {
    const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
    const paths = appSource.split("\n")
      .filter((line) => line.includes(" = lazy(() => import("))
      .map((line) => line.split('import("')[1]?.split('")')[0])
      .filter((path): path is string => Boolean(path));
    expect(paths).toHaveLength(24);
    for (const path of paths) {
      const pageSource = readFileSync(new URL(`..${path.slice(1)}.tsx`, import.meta.url), "utf8");
      expect(pageSource, `Missing default export in ${path}`).toMatch(/\bexport\s+default\b/);
    }
  });

});
