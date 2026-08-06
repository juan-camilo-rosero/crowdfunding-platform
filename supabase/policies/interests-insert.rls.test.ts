import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * RLS regression test for "interests_insert_own" (migration 20260806215537).
 *
 * The Server Action always forces status = 'nuevo', and its unit tests pass
 * either way — the hole was in the direct path to PostgREST. So the assertions
 * run through the SDK as an ORDINARY AUTHENTICATED USER with their own JWT.
 * The service role appears only to create and remove the throwaway account;
 * using it for the insert under test would bypass the very policy being
 * checked.
 */

const ROOT = path.resolve(__dirname, "../..");

function readEnv(): Record<string, string> {
  const file = path.join(ROOT, ".env.local");
  if (!fs.existsSync(file)) return {};
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (match) env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
  return env;
}

const env = { ...readEnv(), ...process.env };
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const CONFIGURED = !!(URL_ && ANON && SERVICE);

const EMAIL = "rls-interest-guard@ejemplo.com";
const PASSWORD = "Prueba-2026-Aa!";

let admin: SupabaseClient;
let self: SupabaseClient;
let userId = "";
let projectId = "";

async function removeTestUser() {
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const user of data?.users ?? []) {
    if (user.email !== EMAIL) continue;
    await admin.from("investment_interests").delete().eq("user_id", user.id);
    await admin.auth.admin.deleteUser(user.id);
  }
}

describe.skipIf(!CONFIGURED)("RLS: investment_interests INSERT", () => {
  beforeAll(async () => {
    admin = createClient(URL_!, SERVICE!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    await removeTestUser();

    const { data: created } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    });
    userId = created!.user!.id;

    await admin
      .from("users")
      .update({ onboarding_completed: true, status: "activo" })
      .eq("id", userId);

    const { data: projects } = await admin.from("projects").select("id").limit(1);
    projectId = projects![0].id;

    self = createClient(URL_!, ANON!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await self.auth.signInWithPassword({
      email: EMAIL,
      password: PASSWORD,
    });
    expect(error).toBeNull();
  }, 60_000);

  afterAll(async () => {
    if (!CONFIGURED) return;
    await removeTestUser();
  }, 60_000);

  const interest = (overrides: Record<string, unknown> = {}) => ({
    user_id: userId,
    project_id: projectId,
    amount: 50000,
    investment_type_pref: "equity",
    comments: "[rls-test]",
    status: "nuevo",
    ...overrides,
  });

  it("REJECTS an interest created as already contacted", async () => {
    const { data, error } = await self
      .from("investment_interests")
      .insert(interest({ status: "contactado" }))
      .select();

    expect(error).not.toBeNull();
    expect(error?.message ?? "").toMatch(/row-level security/i);
    expect(data).toBeNull();
  }, 30_000);

  it("REJECTS an interest created as already closed", async () => {
    const { error } = await self
      .from("investment_interests")
      .insert(interest({ status: "cerrado" }))
      .select();

    // Used to return 201, letting someone hide their own request from the
    // admin's follow-up queue.
    expect(error).not.toBeNull();
    expect(error?.message ?? "").toMatch(/row-level security/i);
  }, 30_000);

  it("REJECTS an interest with no status at all", async () => {
    const payload = interest();
    delete (payload as Record<string, unknown>).status;

    const { error } = await self
      .from("investment_interests")
      .insert(payload)
      .select();

    // status has no default, so a NULL would slip past a loose check.
    expect(error).not.toBeNull();
  }, 30_000);

  it("STILL ACCEPTS a new interest — the legitimate path is intact", async () => {
    const { data, error } = await self
      .from("investment_interests")
      .insert(interest())
      .select();

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].status).toBe("nuevo");

    await admin.from("investment_interests").delete().eq("id", data![0].id);
  }, 30_000);

  it("STILL REJECTS an interest registered for somebody else", async () => {
    const { error } = await self
      .from("investment_interests")
      .insert(interest({ user_id: "00000000-0000-4000-8000-000000000000" }))
      .select();

    // The ownership half of the policy must survive the change.
    expect(error).not.toBeNull();
  }, 30_000);
});
