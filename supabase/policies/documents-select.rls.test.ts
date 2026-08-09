import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * RLS regression test for "documents_select".
 *
 * A `proyecto` document used to be readable by every authenticated user. The
 * assertions therefore run through the SDK as ORDINARY INVESTORS with their own
 * JWTs; the service role appears only to set the fixtures up and tear them
 * down, since using it for the reads under test would bypass the policy being
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

const TAG = "rls-doc-visibility";
const PASSWORD = "Prueba-2026-Aa!";

let admin: SupabaseClient;
/** Holds capital in the project. */
let insider: SupabaseClient;
/** An investor, but with nothing in that project. */
let outsider: SupabaseClient;

let projectId = "";
let insiderInvestorId = "";
const docs: Record<string, string> = {};

async function makeInvestor(key: string) {
  const email = `${TAG}-${key}@ejemplo.com`;
  const { data: created } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  const userId = created!.user!.id;

  await admin
    .from("users")
    .update({ onboarding_completed: true, status: "activo" })
    .eq("id", userId);

  const { data: investor } = await admin
    .from("investors")
    .insert({ full_name: `Doc ${key}`, user_id: userId, notes: `[${TAG}]` })
    .select("id")
    .single();

  const client = createClient(URL_!, ANON!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  expect(error).toBeNull();

  return { client, investorId: investor!.id as string };
}

async function cleanup() {
  await admin.from("documents").delete().like("name", `[${TAG}]%`);
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const user of data?.users ?? []) {
    if (!user.email?.startsWith(TAG)) continue;
    const { data: rows } = await admin
      .from("investors")
      .select("id")
      .eq("user_id", user.id);
    for (const row of rows ?? []) {
      await admin.from("capital_contributions").delete().eq("investor_id", row.id);
      await admin.from("documents").delete().eq("investor_id", row.id);
    }
    await admin.from("investors").delete().eq("user_id", user.id);
    await admin.auth.admin.deleteUser(user.id);
  }
}

/** What this client can actually read, by document key. */
async function canRead(client: SupabaseClient, key: string) {
  const { data } = await client
    .from("documents")
    .select("id")
    .eq("id", docs[key]);
  return (data ?? []).length === 1;
}

describe.skipIf(!CONFIGURED)("RLS: documents_select", () => {
  beforeAll(async () => {
    admin = createClient(URL_!, SERVICE!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await cleanup();

    const { data: projects } = await admin.from("projects").select("id").limit(1);
    projectId = projects![0].id;

    const a = await makeInvestor("insider");
    const b = await makeInvestor("outsider");
    insider = a.client;
    insiderInvestorId = a.investorId;
    outsider = b.client;

    // Only the insider has capital in this project.
    await admin.from("capital_contributions").insert({
      investor_id: insiderInvestorId,
      project_id: projectId,
      amount_received: 10000,
      status: "recibido",
      comments: `[${TAG}]`,
    });

    const { data: created } = await admin
      .from("documents")
      .insert([
        { name: `[${TAG}] proyecto`, doc_type: "deed", visibility: "proyecto", project_id: projectId, date: "2026-01-01" },
        { name: `[${TAG}] publico`, doc_type: "property record", visibility: "público", project_id: projectId, date: "2026-01-01" },
        { name: `[${TAG}] privado insider`, doc_type: "estados de cuenta", visibility: "privado", investor_id: insiderInvestorId, date: "2026-01-01" },
      ])
      .select("id, name");

    for (const row of created ?? []) {
      if (row.name.includes("proyecto")) docs.project = row.id;
      if (row.name.includes("publico")) docs.public = row.id;
      if (row.name.includes("privado")) docs.private = row.id;
    }
  }, 90_000);

  afterAll(async () => {
    if (!CONFIGURED) return;
    await cleanup();
  }, 90_000);

  it("REFUSES a project document to someone with no stake (the reported hole)", async () => {
    // Used to return the row: every deed of every project was readable by any
    // account.
    expect(await canRead(outsider, "project")).toBe(false);
  }, 30_000);

  it("allows a project document to an investor who HOLDS a stake", async () => {
    expect(await canRead(insider, "project")).toBe(true);
  }, 30_000);

  it("still shows a público document to any authenticated user", async () => {
    // The escape hatch for anything meant to attract investors.
    expect(await canRead(outsider, "public")).toBe(true);
    expect(await canRead(insider, "public")).toBe(true);
  }, 30_000);

  it("keeps a privado document to its owner alone", async () => {
    expect(await canRead(insider, "private")).toBe(true);
    expect(await canRead(outsider, "private")).toBe(false);
  }, 30_000);

  it("an outsider's whole document list excludes the project's papers", async () => {
    const { data } = await outsider
      .from("documents")
      .select("id, name")
      .like("name", `[${TAG}]%`);

    const names = (data ?? []).map((row) => row.name);
    expect(names).toEqual([`[${TAG}] publico`]);
  }, 30_000);
});
