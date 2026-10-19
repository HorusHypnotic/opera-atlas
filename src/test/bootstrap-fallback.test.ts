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
  });
});
