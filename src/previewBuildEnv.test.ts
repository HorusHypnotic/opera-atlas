import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConfigFromFile, loadEnv } from "vite";

const ORIGINAL_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const ORIGINAL_URL = process.env.VITE_SUPABASE_URL;

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  else process.env.VITE_SUPABASE_PUBLISHABLE_KEY = ORIGINAL_KEY;
  if (ORIGINAL_URL === undefined) delete process.env.VITE_SUPABASE_URL;
  else process.env.VITE_SUPABASE_URL = ORIGINAL_URL;
  vi.restoreAllMocks();
});

describe("Atlas preview build environment", () => {
  it("passes through a supplied publishable test value without hardcoding it", async () => {
    const sentinel = "sb_publishable_preview_test_only";
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = sentinel;
    const loaded = await loadConfigFromFile(
      { command: "build", mode: "development" },
      "vite.config.ts",
      process.cwd(),
      "silent",
    );
    expect(loaded).toBeTruthy();
    expect(loaded?.config.define?.["import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY"]).toBe(
      JSON.stringify(sentinel),
    );
  });

  it("mirrors the key resolved from the build environment, including local env files", async () => {
    delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const resolved = loadEnv("development", process.cwd(), "VITE_");
    const loaded = await loadConfigFromFile(
      { command: "build", mode: "development" },
      "vite.config.ts",
      process.cwd(),
      "silent",
    );
    expect(loaded).toBeTruthy();
    const configured = loaded?.config.define?.["import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY"];
    if (resolved.VITE_SUPABASE_PUBLISHABLE_KEY) {
      expect(configured).toBe(JSON.stringify(resolved.VITE_SUPABASE_PUBLISHABLE_KEY));
    } else {
      expect(configured).toBeUndefined();
    }
  });
});
