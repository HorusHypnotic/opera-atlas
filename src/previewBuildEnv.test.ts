import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConfigFromFile } from "vite";

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

  it("does not synthesize a missing key", async () => {
    delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const loaded = await loadConfigFromFile(
      { command: "build", mode: "development" },
      "vite.config.ts",
      process.cwd(),
      "silent",
    );
    expect(loaded).toBeTruthy();
    expect(loaded?.config.define?.["import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY"]).toBeUndefined();
  });
});
