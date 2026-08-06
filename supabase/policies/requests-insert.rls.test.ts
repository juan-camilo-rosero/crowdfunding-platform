import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * RLS regression test for "requests_insert_own".
 *
 * WHY THIS FILE EXISTS AND WHY IT HITS THE REAL DATABASE: the bug it guards
 * lived BELOW the application. The Server Action always forced
 * status = 'pendiente', and its unit tests passed the whole time — an investor
 * simply skipped the action and posted straight to PostgREST with their own
 * token. A mock cannot catch that, because the thing being tested is the
 * database's policy, not our code.
 *
 * The assertions therefore run through the SDK as an ORDINARY AUTHENTICATED
 * INVESTOR, with their own JWT. The service role appears only to create and
 * remove the throwaway user — never on the insert under test, since it bypasses
 * RLS and would make every assertion here vacuous.
 *
 * Skips itself when the Supabase credentials are absent, so a checkout without
 * .env.local still runs the rest of the suite.
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

const EMAIL = "rls-insert-guard@ejemplo.com";
const PASSWORD = "Prueba-2026-Aa!";

/** Admin client. Setup and teardown ONLY — never the insert under test. */
let admin: SupabaseClient;
/** The investor's own session. This is what RLS judges. */
let investor: SupabaseClient;

let investorId = "";
let fromProjectId = "";
let toProjectId = "";
let userId = "";

async function removeTestUser() {
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const user of data?.users ?? []) {
    if (user.email !== EMAIL) continue;
    const { data: rows } = await admin
      .from("investors")
      .select("id")
      .eq("user_id", user.id);
    for (const row of rows ?? []) {
      await admin.from("reassignment_requests").delete().eq("investor_id", row.id);
    }
    await admin.from("investors").delete().eq("user_id", user.id);
    await admin.auth.admin.deleteUser(user.id);
  }
}

describe.skipIf(!CONFIGURED)("RLS: reassignment_requests INSERT", () => {
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

    const { data: investorRow } = await admin
      .from("investors")
      .insert({ full_name: "RLS guard", user_id: userId, notes: "[rls-test]" })
      .select("id")
      .single();
    investorId = investorRow!.id;

    const { data: projects } = await admin
      .from("projects")
      .select("id")
      .limit(2);
    fromProjectId = projects![0].id;
    toProjectId = projects![1].id;

    // From here on, everything runs as the investor themselves.
    investor = createClient(URL_!, ANON!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await investor.auth.signInWithPassword({
      email: EMAIL,
      password: PASSWORD,
    });
    expect(error).toBeNull();
  }, 60_000);

  afterAll(async () => {
    if (!CONFIGURED) return;
    await removeTestUser();
  }, 60_000);

  const request = (overrides: Record<string, unknown> = {}) => ({
    investor_id: investorId,
    from_project_id: fromProjectId,
    to_project_id: toProjectId,
    amount: 100,
    status: "pendiente",
    ...overrides,
  });

  it("REJECTS a self-approved request (the reported exploit)", async () => {
    const { data, error } = await investor
      .from("reassignment_requests")
      .insert(request({ status: "aprobada" }))
      .select();

    // Used to return 201. A row here would mean an investor can move their own
    // capital in investor_project_position without any admin approval.
    expect(error).not.toBeNull();
    expect(error?.message ?? "").toMatch(/row-level security/i);
    expect(data).toBeNull();
  }, 30_000);

  it("REJECTS a request created as rejected", async () => {
    const { error } = await investor
      .from("reassignment_requests")
      .insert(request({ status: "rechazada" }))
      .select();

    expect(error).not.toBeNull();
    expect(error?.message ?? "").toMatch(/row-level security/i);
  }, 30_000);

  it("REJECTS a request with no status at all", async () => {
    const payload = request();
    delete (payload as Record<string, unknown>).status;

    const { error } = await investor
      .from("reassignment_requests")
      .insert(payload)
      .select();

    // status has no default, so NULL would slip past a status = 'pendiente'
    // check if the policy were written loosely.
    expect(error).not.toBeNull();
  }, 30_000);

  it("STILL ACCEPTS a pending request — the legitimate path is intact", async () => {
    const { data, error } = await investor
      .from("reassignment_requests")
      .insert(request())
      .select();

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].status).toBe("pendiente");

    await admin.from("reassignment_requests").delete().eq("id", data![0].id);
  }, 30_000);

  it("STILL REJECTS a request owned by somebody else", async () => {
    const { error } = await investor
      .from("reassignment_requests")
      .insert(request({ investor_id: "00000000-0000-4000-8000-000000000000" }))
      .select();

    // The ownership half of the policy must survive the change.
    expect(error).not.toBeNull();
    expect(error?.message ?? "").toMatch(/row-level security/i);
  }, 30_000);
});
