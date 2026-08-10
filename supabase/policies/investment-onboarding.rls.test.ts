import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * The investment onboarding cannot be self-served. Proven against the real
 * database, with real investor JWTs.
 *
 * Nivel 2 of .claude/skills/verificar-seguridad, checked at the angle a hidden
 * menu cannot help with: calling the backend directly. Two escalations are the
 * subject —
 *
 *   1. marking YOURSELF identity-verified, which would let somebody sign a
 *      contract as a person nobody ever identified;
 *   2. filing your own "signed" contract, which would fabricate the record the
 *      whole flow exists to produce.
 *
 * Both must fail at the DATABASE, not merely in the UI. The reads and writes
 * under test therefore run through the SDK as ordinary investors; the service
 * role appears only to build and tear down fixtures, since using it for the
 * assertions would bypass the very rules being checked.
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

const TAG = "rls-invonb";
const PASSWORD = "Prueba-2026-Aa!";

let admin: SupabaseClient;
let alice: SupabaseClient;
let bob: SupabaseClient;
let aliceUserId = "";
let bobUserId = "";
let aliceInvestorId = "";
let bobInvestorId = "";
let bobContractId = "";

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
    .insert({ full_name: `Onb ${key}`, user_id: userId, notes: `[${TAG}]` })
    .select("id")
    .single();

  const client = createClient(URL_!, ANON!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  expect(error).toBeNull();

  return { client, userId, investorId: investor!.id as string };
}

async function cleanup() {
  await admin.from("documents").delete().like("name", `[${TAG}]%`);
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const user of data?.users ?? []) {
    if (!user.email?.startsWith(TAG)) continue;
    await admin.from("identity_verifications").delete().eq("user_id", user.id);
    const { data: rows } = await admin.from("investors").select("id").eq("user_id", user.id);
    for (const row of rows ?? []) {
      await admin.from("documents").delete().eq("investor_id", row.id);
    }
    await admin.from("investors").delete().eq("user_id", user.id);
    await admin.auth.admin.deleteUser(user.id);
  }
}

/** users.identity_verified as the database currently holds it. */
async function verifiedFlag(userId: string): Promise<boolean> {
  const { data } = await admin
    .from("users")
    .select("identity_verified")
    .eq("id", userId)
    .single();
  return !!data?.identity_verified;
}

describe.skipIf(!CONFIGURED)("investment onboarding cannot be self-served", () => {
  beforeAll(async () => {
    admin = createClient(URL_!, SERVICE!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await cleanup();

    const a = await makeInvestor("alice");
    const b = await makeInvestor("bob");
    alice = a.client;
    aliceUserId = a.userId;
    aliceInvestorId = a.investorId;
    bob = b.client;
    bobUserId = b.userId;
    bobInvestorId = b.investorId;

    // Bob has finished: verified, with a signed contract on file. Alice has not.
    await admin.from("users").update({ identity_verified: true }).eq("id", bobUserId);
    const { data: contract } = await admin
      .from("documents")
      .insert({
        investor_id: bobInvestorId,
        name: `[${TAG}] contrato de bob`,
        doc_type: "contrato",
        visibility: "privado",
        status: "aprobado",
        date: "2026-08-01",
      })
      .select("id")
      .single();
    bobContractId = contract!.id;
  }, 120_000);

  afterAll(async () => {
    if (!CONFIGURED) return;
    await cleanup();
  }, 120_000);

  describe("marking yourself verified", () => {
    it("REFUSES an update of identity_verified on your own row", async () => {
      await alice
        .from("users")
        .update({ identity_verified: true })
        .eq("id", aliceUserId);

      // The column is not in the GRANT for `authenticated` (migration
      // 20260806172657), so the write cannot land whatever the request says.
      expect(await verifiedFlag(aliceUserId)).toBe(false);
    }, 30_000);

    it("REFUSES it even when smuggled beside a column they MAY write", async () => {
      await alice
        .from("users")
        .update({ full_name: "Alice Onb", identity_verified: true })
        .eq("id", aliceUserId);

      expect(await verifiedFlag(aliceUserId)).toBe(false);
    }, 30_000);

    it("REFUSES flipping ANOTHER user's flag", async () => {
      await alice
        .from("users")
        .update({ identity_verified: false })
        .eq("id", bobUserId);

      // Nobody advances — or undoes — somebody else's onboarding.
      expect(await verifiedFlag(bobUserId)).toBe(true);
    }, 30_000);
  });

  describe("writing your own verification record", () => {
    it("REFUSES an insert into identity_verifications", async () => {
      const { error } = await alice.from("identity_verifications").insert({
        user_id: aliceUserId,
        status: "aprobado",
        truora_process_id: "forjado",
      });

      expect(error).not.toBeNull();

      const { data } = await admin
        .from("identity_verifications")
        .select("id")
        .eq("user_id", aliceUserId);
      expect(data ?? []).toHaveLength(0);
    }, 30_000);

    it("REFUSES an insert on behalf of someone else", async () => {
      const { error } = await alice.from("identity_verifications").insert({
        user_id: bobUserId,
        status: "rechazado",
      });

      expect(error).not.toBeNull();
    }, 30_000);
  });

  describe("filing your own signed contract", () => {
    it("REFUSES an insert into documents", async () => {
      const { error } = await alice.from("documents").insert({
        investor_id: aliceInvestorId,
        name: `[${TAG}] contrato forjado`,
        doc_type: "contrato",
        visibility: "privado",
        status: "aprobado",
      });

      // documents has an ADMIN-ONLY write policy; no policy was relaxed for
      // this feature, and none should be.
      expect(error).not.toBeNull();

      const { data } = await admin
        .from("documents")
        .select("id")
        .eq("investor_id", aliceInvestorId);
      expect(data ?? []).toHaveLength(0);
    }, 30_000);

    it("REFUSES filing a contract against ANOTHER investor", async () => {
      const { error } = await alice.from("documents").insert({
        investor_id: bobInvestorId,
        name: `[${TAG}] contrato ajeno`,
        doc_type: "contrato",
        visibility: "privado",
      });

      expect(error).not.toBeNull();
    }, 30_000);
  });

  describe("reading somebody else's contract", () => {
    it("REFUSES it: a privado document belongs to its investor alone", async () => {
      const { data } = await alice
        .from("documents")
        .select("id")
        .eq("id", bobContractId);

      expect(data ?? []).toHaveLength(0);
    }, 30_000);

    it("lets Bob read his own", async () => {
      const { data } = await bob.from("documents").select("id").eq("id", bobContractId);
      expect(data ?? []).toHaveLength(1);
    }, 30_000);
  });

  describe("what an investor CAN see of their own progress", () => {
    it("reads their own identity flag", async () => {
      const { data } = await bob
        .from("users")
        .select("identity_verified")
        .eq("id", bobUserId)
        .single();

      // The derivation needs this read; only the WRITE is privileged.
      expect(data?.identity_verified).toBe(true);
    }, 30_000);

    it("cannot read another user's flag", async () => {
      const { data } = await alice
        .from("users")
        .select("identity_verified")
        .eq("id", bobUserId);

      expect(data ?? []).toHaveLength(0);
    }, 30_000);
  });
});
