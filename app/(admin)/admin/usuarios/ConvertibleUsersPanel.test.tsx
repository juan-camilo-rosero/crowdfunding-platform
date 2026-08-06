import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { es } from "@/i18n";
import type { ConvertibleUser } from "@/lib/users/convertible";

const convertVisitorToInvestor = vi.fn();
const refresh = vi.fn();

vi.mock("./actions", () => ({
  convertVisitorToInvestor: (input: unknown) => convertVisitorToInvestor(input),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
  usePathname: () => "/admin/usuarios",
}));

const { ConvertibleUsersPanel } = await import("./ConvertibleUsersPanel");

const USERS: ConvertibleUser[] = [
  {
    id: "u1",
    fullName: "Ana Pérez",
    email: "ana@ejemplo.com",
    phone: "+573001112233",
    createdAt: "2026-03-27",
    hasMatchingProspect: true,
  },
  {
    id: "u2",
    fullName: "Beto Ruiz",
    email: "beto@ejemplo.com",
    phone: null,
    createdAt: "2026-01-05",
    hasMatchingProspect: false,
  },
];

const renderPanel = (users = USERS) =>
  render(<ConvertibleUsersPanel users={users} />);

/** Opens the confirmation dialog for one row. */
async function openFor(
  user: ReturnType<typeof userEvent.setup>,
  name: string | RegExp
) {
  const row = screen.getByText(name).closest("tr")!;
  await user.click(
    within(row).getByRole("button", { name: new RegExp(es.adminUsers.convert) })
  );
  return screen.getByRole("dialog");
}

beforeEach(() => {
  vi.clearAllMocks();
  convertVisitorToInvestor.mockResolvedValue({ ok: true, outcome: "created" });
});

describe("the list", () => {
  it("renders the columns in order", () => {
    renderPanel();

    expect(
      screen.getAllByRole("columnheader").map((h) => h.textContent)
    ).toEqual(["Nombre", "Correo", "Registrado", "Acción"]);
  });

  it("formats the registration date with the project helper", () => {
    renderPanel();

    expect(screen.getByText("27 mar 2026")).toBeInTheDocument();
    expect(screen.getByText("5 ene 2026")).toBeInTheDocument();
  });

  it("flags only the user who has a prospect waiting", () => {
    renderPanel();

    const badges = screen.getAllByText(es.adminUsers.hasProspect);
    expect(badges).toHaveLength(1);
    expect(badges[0].closest("tr")).toContainElement(
      screen.getByText("Ana Pérez")
    );
  });

  it("labels a user with no name instead of leaving a blank cell", () => {
    renderPanel([{ ...USERS[1], fullName: null }]);

    expect(screen.getByText(es.adminUsers.noName)).toBeInTheDocument();
  });

  it("offers one convert button per row", () => {
    renderPanel();

    expect(
      screen.getAllByRole("button", { name: new RegExp(es.adminUsers.convert) })
    ).toHaveLength(USERS.length);
  });
});

describe("search", () => {
  it("narrows the list by name", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.type(
      screen.getByLabelText(es.adminUsers.searchPlaceholder),
      "beto"
    );

    expect(screen.getByText("Beto Ruiz")).toBeInTheDocument();
    expect(screen.queryByText("Ana Pérez")).not.toBeInTheDocument();
  });

  it("shows a search-specific empty state, not the 'nothing pending' one", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.type(
      screen.getByLabelText(es.adminUsers.searchPlaceholder),
      "nadie"
    );

    expect(screen.getByText(es.adminUsers.emptySearch)).toBeInTheDocument();
    expect(screen.queryByText(es.adminUsers.empty)).not.toBeInTheDocument();
  });
});

describe("empty queue", () => {
  it("says there is nobody pending", () => {
    renderPanel([]);

    expect(screen.getByText(es.adminUsers.empty)).toBeInTheDocument();
  });
});

describe("the confirmation dialog", () => {
  it("says the record will be CONNECTED when a prospect matches", async () => {
    const user = userEvent.setup();
    renderPanel();

    const dialog = await openFor(user, "Ana Pérez");

    expect(
      within(dialog).getByText(es.adminUsers.confirmWithProspect)
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByText(es.adminUsers.confirmWithoutProspect)
    ).not.toBeInTheDocument();
  });

  it("says the record will be CREATED when none matches", async () => {
    const user = userEvent.setup();
    renderPanel();

    const dialog = await openFor(user, "Beto Ruiz");

    expect(
      within(dialog).getByText(es.adminUsers.confirmWithoutProspect)
    ).toBeInTheDocument();
  });

  it("names the person being converted", async () => {
    const user = userEvent.setup();
    renderPanel();

    const dialog = await openFor(user, "Ana Pérez");

    expect(
      within(dialog).getByText(/Ana Pérez · ana@ejemplo\.com/)
    ).toBeInTheDocument();
  });

  it("makes clear this is not an investment", async () => {
    const user = userEvent.setup();
    renderPanel();

    const dialog = await openFor(user, "Ana Pérez");

    // The copy names "aporte" on purpose — to DENY it — so the check is that
    // the denial is there, not that the word is absent.
    expect(
      within(dialog).getByText(es.adminUsers.confirmDescription)
    ).toBeInTheDocument();
    expect(es.adminUsers.confirmDescription).toMatch(/no registra ningún aporte/i);
    // And nothing claims the person has actually invested.
    expect(dialog.textContent).not.toMatch(/invirtió|ha invertido|ya invirtió/i);
  });
});

describe("converting", () => {
  it("sends only the user id and refreshes on success", async () => {
    const user = userEvent.setup();
    renderPanel();

    const dialog = await openFor(user, "Beto Ruiz");
    await user.click(
      within(dialog).getByRole("button", { name: es.adminUsers.convert })
    );

    expect(convertVisitorToInvestor).toHaveBeenCalledWith({ userId: "u2" });
    expect(refresh).toHaveBeenCalled();
  });

  it("reports which of the two things happened", async () => {
    convertVisitorToInvestor.mockResolvedValue({
      ok: true,
      outcome: "connected",
    });

    const user = userEvent.setup();
    renderPanel();

    const dialog = await openFor(user, "Ana Pérez");
    await user.click(
      within(dialog).getByRole("button", { name: es.adminUsers.convert })
    );

    expect(
      await screen.findByText(es.adminUsers.successConnected)
    ).toBeInTheDocument();
  });

  it("keeps the dialog open with the reason when the server refuses", async () => {
    convertVisitorToInvestor.mockResolvedValue({
      ok: false,
      error: es.adminUsers.errors.alreadyInvestor,
    });

    const user = userEvent.setup();
    renderPanel();

    const dialog = await openFor(user, "Beto Ruiz");
    await user.click(
      within(dialog).getByRole("button", { name: es.adminUsers.convert })
    );

    expect(
      within(screen.getByRole("dialog")).getByText(
        es.adminUsers.errors.alreadyInvestor
      )
    ).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});
