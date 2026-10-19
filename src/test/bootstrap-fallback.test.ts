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
    expect(source).toContain("showBootstrapFailure()");
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

  it("defers route page modules so they do not block the initial App import", () => {
    const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
    expect(appSource).toContain('import { lazy, Suspense } from "react"');
    expect(appSource).toContain('const DashboardOverview = lazy(() => import("./pages/DashboardOverview"))');
    expect(appSource).toContain('const LoginPage = lazy(() => import("./pages/LoginPage"))');
    expect(appSource).toContain("<Suspense fallback=");
    expect(appSource).not.toMatch(/^import \\w+ from "\\.\\/pages\\//m);
  });

});
