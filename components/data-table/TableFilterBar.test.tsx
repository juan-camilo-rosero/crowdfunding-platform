import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { es } from "@/i18n";
import type { TableColumn } from "@/lib/table/types";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/admin",
}));

const { TableFilterBar } = await import("./TableFilterBar");

const COLUMNS: TableColumn[] = [
  { key: "name", label: "Nombre", type: "text" },
  { key: "status", label: "Estado", type: "select", options: ["activo", "pausado"] },
  { key: "city", label: "Ciudad", type: "select", options: ["Rotonda", "Otra"] },
];

function renderBar(props: Record<string, unknown> = {}) {
  render(
    <TableFilterBar
      columns={COLUMNS}
      filters={{}}
      preservedParams={{ tabla: "proyectos" }}
      countLabel="2 registros"
      {...props}
    />
  );
}

/** Picks an option from one of the dropdowns, by its accessible name. */
async function choose(
  user: ReturnType<typeof userEvent.setup>,
  triggerName: string,
  optionText: string
) {
  await user.click(screen.getByRole("button", { name: triggerName }));
  await user.click(await screen.findByRole("menuitem", { name: optionText }));
}

beforeEach(() => push.mockClear());

describe("TableFilterBar", () => {
  it("offers one filter per select column and none for the rest", () => {
    renderBar();

    expect(
      screen.getByRole("button", {
        name: es.admin.filters.by.replace("{campo}", "Estado"),
      })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: es.admin.filters.by.replace("{campo}", "Nombre"),
      })
    ).not.toBeInTheDocument();
  });

  it("puts the selection in the URL, keeping the active table", async () => {
    const user = userEvent.setup();
    renderBar();

    await choose(
      user,
      es.admin.filters.by.replace("{campo}", "Estado"),
      "activo"
    );

    expect(push).toHaveBeenCalledWith("/admin?tabla=proyectos&f_status=activo");
  });

  it("keeps the filters already applied when another one is added", async () => {
    const user = userEvent.setup();
    renderBar({ filters: { status: "activo" } });

    await choose(
      user,
      es.admin.filters.by.replace("{campo}", "Ciudad"),
      "Rotonda"
    );

    expect(push).toHaveBeenCalledWith(
      "/admin?tabla=proyectos&f_status=activo&f_city=Rotonda"
    );
  });

  it("clears every filter but stays on the same table", async () => {
    const user = userEvent.setup();
    renderBar({ filters: { status: "activo", city: "Rotonda" } });

    await user.click(
      screen.getByRole("button", { name: es.admin.filters.clear })
    );

    expect(push).toHaveBeenCalledWith("/admin?tabla=proyectos");
  });

  it("offers nothing to clear while no filter is on", () => {
    renderBar();

    expect(
      screen.queryByRole("button", { name: es.admin.filters.clear })
    ).not.toBeInTheDocument();
  });

  it("saves pending edits BEFORE navigating", async () => {
    const user = userEvent.setup();
    const order: string[] = [];
    const beforeNavigate = vi.fn(async () => {
      order.push("flush");
    });
    push.mockImplementation(() => order.push("navigate"));

    renderBar({ beforeNavigate });

    await choose(
      user,
      es.admin.filters.by.replace("{campo}", "Estado"),
      "activo"
    );

    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(order).toEqual(["flush", "navigate"]);
  });
});
