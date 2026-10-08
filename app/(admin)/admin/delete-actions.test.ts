import { beforeEach, describe, expect, it, vi } from "vitest";
import { es } from "@/i18n";

/**
 * Deleting a row of an admin table. The tests that cannot fail: only an admin,
 * only the tables whose rows nothing hangs off, and never a project, an
 * investor or an approved reassignment.
 */

const ID = "11111111-1111-4111-8111-111111111111";

const isAdmin = vi.fn();
const rpc = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ isAdmin: () => isAdmin() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc: (name: string, args: unknown) => rpc(name, args) }),
}));

const { deleteTableRow } = await import("./delete-actions");

beforeEach(() => {
  vi.clearAllMocks();
  isAdmin.mockResolvedValue(true);
  rpc.mockResolvedValue({ data: { deleted: 1 }, error: null });
});

describe("authorisation", () => {
  it("refuses anyone who is not an admin, and calls nothing", async () => {
    isAdmin.mockResolvedValue(false);

    const result = await deleteTableRow("transacciones", ID);

    expect(result).toEqual({ ok: false, error: es.admin.notAuthorized });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("what may be deleted", () => {
  it("deletes a transaction through the dedicated function", async () => {
    const result = await deleteTableRow("transacciones", ID);

    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("admin_delete_table_row", {
      p_table: "transactions",
      p_id: ID,
    });
  });

  it.each([
    ["presupuesto", "budget_items"],
    ["timeline", "tasks"],
    ["reportes", "monthly_reports"],
    ["documentos", "documents"],
    ["interes", "investment_interests"],
    ["capital", "capital_contributions"],
  ])("deletes a row of %s", async (tab, table) => {
    const result = await deleteTableRow(tab, ID);

    expect(result.ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("admin_delete_table_row", {
      p_table: table,
      p_id: ID,
    });
  });

  it.each(["proyectos", "inversionistas"])(
    "refuses %s without asking the database",
    async (tab) => {
      const result = await deleteTableRow(tab, ID);

      expect(result).toEqual({ ok: false, error: es.admin.delete.tableNotAllowed });
      expect(rpc).not.toHaveBeenCalled();
    }
  );

  it("refuses an unknown tab", async () => {
    const result = await deleteTableRow("inventada", ID);

    expect(result.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses an id that is not a uuid", async () => {
    const result = await deleteTableRow("transacciones", "no-soy-uuid");

    expect(result.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("when the database says no", () => {
  it("passes on its reason — an approved request, for instance", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "No se puede eliminar una solicitud aprobada" },
    });

    const result = await deleteTableRow("solicitudes", ID);

    expect(result).toEqual({
      ok: false,
      error: "No se puede eliminar una solicitud aprobada",
    });
  });

  it("says so when the row was already gone", async () => {
    rpc.mockResolvedValue({ data: { deleted: 0 }, error: null });

    const result = await deleteTableRow("transacciones", ID);

    expect(result).toEqual({ ok: false, error: es.admin.delete.failed });
  });
});
