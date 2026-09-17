import { beforeEach, describe, expect, it, vi } from "vitest";
import { es } from "@/i18n";

/**
 * The test that cannot fail here: editing a project from its PUBLIC page is an
 * admin action. The page is open to every onboarded user, so the control being
 * hidden proves nothing — only this check does.
 */

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

const isAdmin = vi.fn();
const rpc = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ isAdmin: () => isAdmin() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    rpc: (name: string, args: unknown) => rpc(name, args),
  }),
}));

const { updateProjectFromDetail } = await import("./actions");

beforeEach(() => {
  vi.clearAllMocks();
  isAdmin.mockResolvedValue(true);
  rpc.mockResolvedValue({ data: { updated: 1 }, error: null });
});

describe("updateProjectFromDetail", () => {
  it("refuses anyone who is not an admin, and writes nothing", async () => {
    isAdmin.mockResolvedValue(false);

    const result = await updateProjectFromDetail(PROJECT_ID, {
      name: "Villa Norte",
    });

    expect(result).toEqual({ ok: false, error: es.admin.notAuthorized });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("writes through the same whitelisted function the panel uses", async () => {
    const result = await updateProjectFromDetail(PROJECT_ID, {
      name: "Villa Norte",
    });

    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("admin_save_table_changes", {
      p_table: "projects",
      p_updates: [{ id: PROJECT_ID, values: { name: "Villa Norte" } }],
      p_inserts: [],
    });
  });

  it("validates before writing: a bad value never reaches the database", async () => {
    const result = await updateProjectFromDetail(PROJECT_ID, {
      progress: "1000",
    });

    expect(result.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses a column that is not part of the projects table", async () => {
    const result = await updateProjectFromDetail(PROJECT_ID, {
      // Not a column of `projects`; the grid would never send it, a crafted
      // call would.
      role: "admin",
    });

    expect(result.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("turns a cleared field into NULL rather than an empty string", async () => {
    await updateProjectFromDetail(PROJECT_ID, { next_step: "" });

    expect(rpc).toHaveBeenCalledWith("admin_save_table_changes", {
      p_table: "projects",
      p_updates: [{ id: PROJECT_ID, values: { next_step: null } }],
      p_inserts: [],
    });
  });

  it("says so when there is nothing to save", async () => {
    const result = await updateProjectFromDetail(PROJECT_ID, {});

    expect(result).toEqual({ ok: false, error: es.validation.emptyBatch });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("surfaces a database refusal instead of reporting success", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "No autorizado: se requiere rol de administrador" },
    });

    const result = await updateProjectFromDetail(PROJECT_ID, { name: "X" });

    expect(result).toEqual({
      ok: false,
      error: "No autorizado: se requiere rol de administrador",
    });
  });
});
