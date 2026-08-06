import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Column-privilege regression test for public.users.
 *
 * WHY IT HITS THE REAL DATABASE: the hole was below the application. Nothing in
 * our code ever wrote `role`, and every unit test passed while a user could
 * PATCH their own row to role = 'admin' straight through PostgREST. Only the
 * database can be asked whether that is still possible.
 *
 * All assertions run through the SDK as an ORDINARY AUTHENTICATED USER with
 * their own JWT. The service role appears only to create, inspect and remove
 * the throwaway account — never on the write under test, since it bypasses both
 * RLS and column privileges.
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

const EMAIL = "rls-users-column-guard@ejemplo.com";
const PASSWORD = "Prueba-2026-Aa!";

let admin: SupabaseClient;
let self: SupabaseClient;
let userId = "";

/** Reads the row with the service role, to see what actually landed. */
async function storedRow() {
  const { data } = await admin
    .from("users")
    .select("role, status, identity_verified, email, full_name, city")
    .eq("id", userId)
    .single();
  return data!;
}

async function removeTestUser() {
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const user of data?.users ?? []) {
    if (user.email === EMAIL) await admin.auth.admin.deleteUser(user.id);
  }
}

describe.skipIf(!CONFIGURED)("column privileges: public.users", () => {
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
      .update({ role: "visitante", status: "activo", onboarding_completed: false })
      .eq("id", userId);

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

  it("REJECTS self-promotion to admin (the reported exploit)", async () => {
    const { error } = await self
      .from("users")
      .update({ role: "admin" })
      .eq("id", userId);

    expect(error).not.toBeNull();
    // One PATCH used to unlock every other investor's financial data.
    expect((await storedRow()).role).toBe("visitante");
  }, 30_000);

  it("REJECTS lifting one's own suspension", async () => {
    await admin.from("users").update({ status: "suspendido" }).eq("id", userId);

    const { error } = await self
      .from("users")
      .update({ status: "activo" })
      .eq("id", userId);

    expect(error).not.toBeNull();
    expect((await storedRow()).status).toBe("suspendido");

    await admin.from("users").update({ status: "activo" }).eq("id", userId);
  }, 30_000);

  it("REJECTS marking oneself identity-verified", async () => {
    const { error } = await self
      .from("users")
      .update({ identity_verified: true })
      .eq("id", userId);

    expect(error).not.toBeNull();
    // Only the Truora webhook may set this.
    expect((await storedRow()).identity_verified).toBe(false);
  }, 30_000);

  it("REJECTS changing one's own email, the account-linking key", async () => {
    const { error } = await self
      .from("users")
      .update({ email: "otro@ejemplo.com" })
      .eq("id", userId);

    expect(error).not.toBeNull();
    expect((await storedRow()).email).toBe(EMAIL);
  }, 30_000);

  it("REJECTS a forbidden column smuggled alongside allowed ones", async () => {
    const { error } = await self
      .from("users")
      .update({ full_name: "Ana Pérez", role: "admin" })
      .eq("id", userId);

    expect(error).not.toBeNull();
    const row = await storedRow();
    // The whole statement fails: no partial write sneaks the name through.
    expect(row.role).toBe("visitante");
    expect(row.full_name).not.toBe("Ana Pérez");
  }, 30_000);

  it("STILL ACCEPTS the columns the basic onboarding writes", async () => {
    // Exactly the payload of saveBasicOnboarding.
    const { error } = await self
      .from("users")
      .update({
        full_name: "Ana María Pérez",
        document_id: "1020345678",
        phone: "+573001112233",
        phone_country_code: "+57",
        city: "Medellín",
        country: "Colombia",
        city_place_id: "ChIJ_test",
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    expect(error).toBeNull();
    const row = await storedRow();
    expect(row.full_name).toBe("Ana María Pérez");
    expect(row.city).toBe("Medellín");
  }, 30_000);

  it("STILL REJECTS writing somebody else's row", async () => {
    const { data } = await admin
      .from("users")
      .select("id")
      .neq("id", userId)
      .limit(1);
    const otherId = data![0].id;

    await self.from("users").update({ full_name: "Intruso" }).eq("id", otherId);

    // Row ownership is still users_update_own's job, and it still holds.
    const { data: other } = await admin
      .from("users")
      .select("full_name")
      .eq("id", otherId)
      .single();
    expect(other!.full_name).not.toBe("Intruso");
  }, 30_000);
});
