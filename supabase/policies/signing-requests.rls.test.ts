import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * signing_requests: read your own, write nothing.
 *
 * Nivel 2 of .claude/skills/verificar-seguridad, at the angle a hidden button
 * cannot help with — calling the backend directly. The escalation this closes:
 * an investor who could insert or update a row here would declare their own
 * contract signed, which is exactly what the Documenso webhook exists to be the
 * sole authority on.
 *
 * The assertions run as ordinary investors with real JWTs; the service role
 * only builds and tears down fixtures.
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

const TAG = "rls-signreq";
const PASSWORD = "Prueba-2026-Aa!";

let admin: SupabaseClient;
let alice: SupabaseClient;
let bob: SupabaseClient;
let aliceInvestorId = "";
let bobInvestorId = "";
let aliceRequestId = "";
let bobRequestId = "";

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
    .insert({ full_name: `Sign ${key}`, user_id: userId, notes: `[${TAG}]` })
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
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const user of data?.users ?? []) {
    if (!user.email?.startsWith(TAG)) continue;
    const { data: rows } = await admin.from("investors").select("id").eq("user_id", user.id);
    for (const row of rows ?? []) {
      await admin.from("signing_requests").delete().eq("investor_id", row.id);
    }
    await admin.from("investors").delete().eq("user_id", user.id);
    await admin.auth.admin.deleteUser(user.id);
  }
}

/** The row's status as the database currently holds it. */
async function statusOf(id: string): Promise<string | null> {
  const { data } = await admin
    .from("signing_requests")
    .select("status")
    .eq("id", id)
    .single();
  return data?.status ?? null;
}

describe.skipIf(!CONFIGURED)("signing_requests is read-only for investors", () => {
  beforeAll(async () => {
    admin = createClient(URL_!, SERVICE!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await cleanup();

    const a = await makeInvestor("alice");
    const b = await makeInvestor("bob");
    alice = a.client;
    aliceInvestorId = a.investorId;
    bob = b.client;
    bobInvestorId = b.investorId;

    const { data } = await admin
      .from("signing_requests")
      .insert([
        {
          investor_id: aliceInvestorId,
          external_document_id: `${TAG}-envelope-alice`,
          status: "enviado",
        },
        {
          investor_id: bobInvestorId,
          external_document_id: `${TAG}-envelope-bob`,
          status: "enviado",
        },
      ])
      .select("id, investor_id");

    for (const row of data ?? []) {
      if (row.investor_id === aliceInvestorId) aliceRequestId = row.id;
      else bobRequestId = row.id;
    }
  }, 120_000);

  afterAll(async () => {
    if (!CONFIGURED) return;
    await cleanup();
  }, 120_000);

  describe("declaring your own contract signed", () => {
    it("REFUSES an update of your own row", async () => {
      await alice
        .from("signing_requests")
        .update({ status: "completado" })
        .eq("id", aliceRequestId);

      // Only the webhook may move this.
      expect(await statusOf(aliceRequestId)).toBe("enviado");
    }, 30_000);

    it("REFUSES inserting a row that claims to be completed", async () => {
      const { error } = await alice.from("signing_requests").insert({
        investor_id: aliceInvestorId,
        external_document_id: `${TAG}-forjado`,
        status: "completado",
      });

      expect(error).not.toBeNull();
    }, 30_000);

    it("REFUSES touching ANOTHER investor's request", async () => {
      await alice
        .from("signing_requests")
        .update({ status: "anulado" })
        .eq("id", bobRequestId);

      expect(await statusOf(bobRequestId)).toBe("enviado");
    }, 30_000);

    it("REFUSES deleting the record of a rejection", async () => {
      await alice.from("signing_requests").delete().eq("id", aliceRequestId);

      expect(await statusOf(aliceRequestId)).toBe("enviado");
    }, 30_000);
  });

  describe("reading", () => {
    it("lets an investor see their own request", async () => {
      const { data } = await alice
        .from("signing_requests")
        .select("id")
        .eq("id", aliceRequestId);

      // The stepper needs this read; only the write is privileged.
      expect(data ?? []).toHaveLength(1);
    }, 30_000);

    it("REFUSES another investor's request", async () => {
      const { data } = await alice
        .from("signing_requests")
        .select("id")
        .eq("id", bobRequestId);

      expect(data ?? []).toHaveLength(0);
    }, 30_000);

    it("is symmetric", async () => {
      const { data: own } = await bob
        .from("signing_requests")
        .select("id")
        .eq("id", bobRequestId);
      const { data: other } = await bob
        .from("signing_requests")
        .select("id")
        .eq("id", aliceRequestId);

      expect(own ?? []).toHaveLength(1);
      expect(other ?? []).toHaveLength(0);
    }, 30_000);

    it("an unscoped select returns only their own row", async () => {
      const { data } = await alice
        .from("signing_requests")
        .select("id")
        .like("external_document_id", `${TAG}-%`);

      expect((data ?? []).map((row) => row.id)).toEqual([aliceRequestId]);
    }, 30_000);
  });
});
