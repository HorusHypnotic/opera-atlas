import { defineConfig, loadEnv } from "vite";
import { readFileSync } from "node:fs";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  // Public project URL fallback only. Never embed a publishable or secret key.
  const config = readFileSync(path.resolve(__dirname, "supabase/config.toml"), "utf8");
  const projectId = config.match(/^project_id[ \t]*=[ \t]*"([a-z0-9]+)"/m)?.[1];
  const publicUrl = env.VITE_SUPABASE_URL || (projectId ? `https://${projectId}.supabase.co` : "");
  // Diagnostics reveal presence only, never the public key value.
  // Enable temporarily with ATLAS_PREVIEW_DIAGNOSTIC=1 in a controlled build.
  if (process.env.ATLAS_PREVIEW_DIAGNOSTIC === "1") {
    const keyPresent = Boolean(env.VITE_SUPABASE_PUBLISHABLE_KEY);
    const urlPresent = Boolean(publicUrl);
    console.info(`ATLAS_PREVIEW_ENV mode=${mode} url=${urlPresent ? "present" : "missing"} key=${keyPresent ? "present" : "missing"}`);
  }
  // Values are supplied by the build environment; never commit a literal key.
  const publicKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return {
    define: {
      ...(publicUrl ? { "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(publicUrl) } : {}),
      ...(publicKey ? { "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(publicKey) } : {}),
    },
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
