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
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
