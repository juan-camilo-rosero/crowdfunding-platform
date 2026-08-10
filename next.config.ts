import path from "node:path";
import type { NextConfig } from "next";

function getSupabaseImageHostname() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) return "*.supabase.co";

  try {
    return new URL(supabaseUrl).hostname;
  } catch {
    return "*.supabase.co";
  }
}

const nextConfig: NextConfig = {
  /**
   * Pins the workspace root to THIS folder.
   *
   * Turbopack infers the root by walking up until it finds a lockfile. There is
   * a package-lock.json in the user's home directory on this machine, so it was
   * choosing C:\Users\<user> — module ids came out as
   * "[project]/Desktop/programacion/…" and the App Router stopped registering
   * routes: /login and /inicio answered 404 while their page.tsx files sat
   * right there and tsc passed clean.
   *
   * That failure looks exactly like the corrupted Turbopack cache described in
   * CLAUDE.md, but wiping .next does not fix it — it comes back on the next
   * start. Pinning the root does.
   */
  turbopack: {
    root: path.join(__dirname),
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: getSupabaseImageHostname(),
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
};

export default nextConfig;
