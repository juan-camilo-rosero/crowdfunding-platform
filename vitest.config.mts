import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Unit and component tests.
 *
 * Vitest rather than Jest: it reads the project's own tsconfig (so the "@/"
 * alias works without a second mapping to keep in sync) and needs no Babel
 * setup for React 19.
 *
 * Scope: OUR logic only — data scoping, filtering, formatting and rendering.
 * Third-party internals (Supabase, Next's router, Recharts) are mocked or left
 * alone; testing them tests somebody else's code.
 */
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      // `server-only` throws unless it is resolved inside a React Server
      // Component, which Vitest is not. Stubbing it here lets server modules be
      // unit-tested; the real guard still applies in the Next build, which is
      // where an accidental client import would actually matter.
      // fileURLToPath, not URL.pathname: on Windows the latter yields
      // "/C:/..." with percent-encoded spaces, which Vite cannot resolve.
      "server-only": fileURLToPath(
        new URL("./test/server-only-stub.ts", import.meta.url)
      ),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
