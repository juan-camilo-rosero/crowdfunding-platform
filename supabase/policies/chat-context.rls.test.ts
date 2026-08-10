import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  buildInvestorContext,
  renderInvestorContext,
  resolveInvestorIds,
  type ChatContextClient,
} from "@/lib/ai/context";

/**
 * The chatbot's isolation, proven against the real database.
 *
 * Nivel 2 of .claude/skills/verificar-seguridad: an investor never sees another
 * investor's data — checked here at the third level, "llamando directo a la
 * consulta", which is the one a hidden menu cannot help with.
 *
 * The reads under test run through the SDK as ORDINARY INVESTORS with their own
 * JWTs. The service role appears only to build and tear down fixtures; using it
 * for the assertions would bypass the very policies being checked.
 *
 * The decisive case is the last block: the context builder is handed ANOTHER
 * investor's id on purpose. Even then it must come back empty — that is what
 * makes the feature safe against a future bug that lets a client-supplied id
 * slip past the schema.
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

const TAG = "rls-chat-context";
const PASSWORD = "Prueba-2026-Aa!";

/** Amounts unique enough that finding one in the wrong prompt is unambiguous. */
const ALICE_CAPITAL = 111_111;
const BOB_CAPITAL = 222_222;

let admin: SupabaseClient;
let alice: SupabaseClient;
let bob: SupabaseClient;
let aliceUserId = "";
let aliceInvestorId = "";
let bobInvestorId = "";
let projectId = "";

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
    .insert({ full_name: `Chat ${key}`, user_id: userId, notes: `[${TAG}]` })
    .select("id")
    .single();

  const client = createClient(URL_!, ANON!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  expect(error).toBeNull();

  return { client, userId, investorId: investor!.id as string };
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
      await admin.from("transactions").delete().eq("investor_id", row.id);
      await admin.from("capital_contributions").delete().eq("investor_id", row.id);
      await admin.from("documents").delete().eq("investor_id", row.id);
    }
    await admin.from("investors").delete().eq("user_id", user.id);
    await admin.auth.admin.deleteUser(user.id);
  }
}

/** The prompt text this client would get for the given scope. */
async function promptFor(client: SupabaseClient, investorIds: string[]) {
  const context = await buildInvestorContext(
    client as unknown as ChatContextClient,
    investorIds
  );
  return { context, text: renderInvestorContext(context) };
}

describe.skipIf(!CONFIGURED)("chatbot: one investor never sees another", () => {
  beforeAll(async () => {
    admin = createClient(URL_!, SERVICE!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await cleanup();

    const { data: projects } = await admin.from("projects").select("id").limit(1);
    projectId = projects![0].id;

    const a = await makeInvestor("alice");
    const b = await makeInvestor("bob");
    alice = a.client;
    aliceUserId = a.userId;
    aliceInvestorId = a.investorId;
    bob = b.client;
    bobInvestorId = b.investorId;

    // Both hold capital in the SAME project: sharing a project must not make
    // either one's figures visible to the other.
    await admin.from("capital_contributions").insert([
      {
        investor_id: aliceInvestorId,
        project_id: projectId,
        amount_received: ALICE_CAPITAL,
        status: "recibido",
        agreed_return: "15% anual",
        comments: `[${TAG}]`,
      },
      {
        investor_id: bobInvestorId,
        project_id: projectId,
        amount_received: BOB_CAPITAL,
        status: "recibido",
        agreed_return: "Participación 8%",
        comments: `[${TAG}]`,
      },
    ]);

    await admin.from("transactions").insert([
      {
        investor_id: aliceInvestorId,
        project_id: projectId,
        type: "aporte",
        amount: ALICE_CAPITAL,
        date: "2026-03-27",
      },
      {
        investor_id: bobInvestorId,
        project_id: projectId,
        type: "aporte",
        amount: BOB_CAPITAL,
        date: "2026-03-27",
      },
    ]);

    await admin.from("documents").insert([
      {
        name: `[${TAG}] privado de alice`,
        doc_type: "estados de cuenta",
        visibility: "privado",
        investor_id: aliceInvestorId,
        date: "2026-01-01",
      },
      {
        name: `[${TAG}] privado de bob`,
        doc_type: "estados de cuenta",
        visibility: "privado",
        investor_id: bobInvestorId,
        date: "2026-01-01",
      },
    ]);
  }, 120_000);

  afterAll(async () => {
    if (!CONFIGURED) return;
    await cleanup();
  }, 120_000);

  it("resolves the investor scope from the user id, and only that user's", async () => {
    const ids = await resolveInvestorIds(
      alice as unknown as ChatContextClient,
      aliceUserId
    );
    expect(ids).toEqual([aliceInvestorId]);
  }, 30_000);

  it("puts Alice's own figures in Alice's prompt", async () => {
    const { text } = await promptFor(alice, [aliceInvestorId]);

    expect(text).toContain("$111,111");
    expect(text).toContain("15% anual");
  }, 30_000);

  it("NEVER puts Bob's figures in Alice's prompt", async () => {
    const { text } = await promptFor(alice, [aliceInvestorId]);

    // The one assertion this whole feature exists to protect.
    expect(text).not.toContain("$222,222");
    expect(text).not.toContain("Participación 8%");
  }, 30_000);

  it("NEVER puts Bob's private document in Alice's prompt", async () => {
    const { text } = await promptFor(alice, [aliceInvestorId]);

    expect(text).toContain("privado de alice");
    expect(text).not.toContain("privado de bob");
  }, 30_000);

  it("is symmetric: Bob sees his own and none of Alice's", async () => {
    const { text } = await promptFor(bob, [bobInvestorId]);

    expect(text).toContain("$222,222");
    expect(text).not.toContain("$111,111");
    expect(text).not.toContain("privado de alice");
  }, 30_000);

  it("returns NOTHING when Alice's session is scoped to Bob's investor id", async () => {
    // The scope is derived on the server, so this cannot happen today. It is
    // asserted anyway: RLS must be the second barrier, so that a future bug
    // letting a client-supplied id through still leaks nothing.
    const { context, text } = await promptFor(alice, [bobInvestorId]);

    expect(context.positions).toEqual([]);
    expect(context.transactions).toEqual([]);
    expect(text).not.toContain("$222,222");
  }, 30_000);

  it("returns NOTHING when scoped to both ids at once", async () => {
    const { text } = await promptFor(alice, [aliceInvestorId, bobInvestorId]);

    // Widening the scope must not widen the answer.
    expect(text).toContain("$111,111");
    expect(text).not.toContain("$222,222");
  }, 30_000);

  it("still shows the PUBLIC catalogue to both", async () => {
    const { context } = await promptFor(alice, [aliceInvestorId]);
    expect(context.catalog.length).toBeGreaterThan(0);
  }, 30_000);
});
