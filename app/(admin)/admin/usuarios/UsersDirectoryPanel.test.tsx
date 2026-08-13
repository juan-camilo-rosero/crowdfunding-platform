import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { es } from "@/i18n";
import type { UserDirectoryEntry } from "@/lib/users/convertible";

const convertVisitorToInvestor = vi.fn();
const sendContractForSignature = vi.fn();
const refresh = vi.fn();

vi.mock("./actions", () => ({
  convertVisitorToInvestor: (input: unknown) => convertVisitorToInvestor(input),
}));
vi.mock("./contract-actions", () => ({
  sendContractForSignature: (input: unknown) => sendContractForSignature(input),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
  usePathname: () => "/admin/usuarios",
}));

const { UsersDirectoryPanel } = await import("./UsersDirectoryPanel");

const entry = (over: Partial<UserDirectoryEntry>): UserDirectoryEntry => ({
  id: "u0",
  fullName: "Sin definir",
  email: "sin@ejemplo.com",
  phone: null,
  createdAt: "2026-01-05",
  isAdmin: false,
  isInvestor: false,
  onboardingCompleted: true,
  hasMatchingProspect: false,
  canConvert: true,
  ...over,
});

/** One row per case the screen has to tell apart. */
const VISITOR_WITH_PROSPECT = entry({
  id: "u1",
  fullName: "Ana Pérez",
  email: "ana@ejemplo.com",
  phone: "+573001112233",
  createdAt: "2026-03-27",
  hasMatchingProspect: true,
});
const VISITOR = entry({ id: "u2", fullName: "Beto Ruiz", email: "beto@ejemplo.com" });
const INVESTOR = entry({
  id: "u3",
  fullName: "Dana Sol",
  email: "dana@ejemplo.com",
  isInvestor: true,
  canConvert: false,
});
/** The owner: admin AND investor at once. */
const OWNER = entry({
  id: "u4",
  fullName: "Caro Gil",
  email: "caro@ejemplo.com",
  isAdmin: true,
  isInvestor: true,
  canConvert: false,
});
const PENDING_ONBOARDING = entry({
  id: "u5",
  fullName: "Eva Mora",
  email: "eva@ejemplo.com",
  onboardingCompleted: false,
  canConvert: false,
});

/** Admin with no link: the only row whose reason is the admin one. */
const ADMIN_ONLY = entry({
  id: "u6",
  fullName: "Feli Ríos",
  email: "feli@ejemplo.com",
  isAdmin: true,
  canConvert: false,
});
const USERS = [
  VISITOR_WITH_PROSPECT,
  VISITOR,
  INVESTOR,
  OWNER,
  ADMIN_ONLY,
  PENDING_ONBOARDING,
];

const renderPanel = (users = USERS) => render(<UsersDirectoryPanel users={users} />);

const rowFor = (name: string) => screen.getByText(name).closest("tr")!;

/** Opens the confirmation dialog for one row. */
async function openFor(
  user: ReturnType<typeof userEvent.setup>,
  name: string
) {
  await user.click(
    within(rowFor(name)).getByRole("button", {
      name: new RegExp(es.adminUsers.convert),
    })
  );
  return screen.getByRole("dialog");
}

/** Picks an option from the shared FilterDropdown (it renders in a portal). */
async function chooseFilter(
  user: ReturnType<typeof userEvent.setup>,
  label: string
) {
  await user.click(screen.getByRole("button", { name: es.adminUsers.filter.label }));
  await user.click(await screen.findByRole("menuitem", { name: label }));
}

beforeEach(() => {
  vi.clearAllMocks();
  convertVisitorToInvestor.mockResolvedValue({ ok: true, outcome: "created" });
  sendContractForSignature.mockResolvedValue({ ok: true, signingUrl: "https://esign/x" });
});

describe("the directory", () => {
  it("renders the columns in order", () => {
    renderPanel();

    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Nombre",
      "Correo",
      "Estado",
      "Registrado",
      "Acción",
    ]);
  });

  it("lists everyone, not only the people pending conversion", () => {
    renderPanel();

    for (const name of [
      "Ana Pérez",
      "Beto Ruiz",
      "Dana Sol",
      "Caro Gil",
      "Feli Ríos",
      "Eva Mora",
    ]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    expect(
      screen.getByText(es.adminUsers.resultsCount.replace("{n}", "6"))
    ).toBeInTheDocument();
  });

  it("formats the registration date with the project helper", () => {
    renderPanel();

    expect(screen.getByText("27 mar 2026")).toBeInTheDocument();
    expect(screen.getAllByText("5 ene 2026").length).toBeGreaterThan(0);
  });

  it("labels a user with no name instead of leaving a blank cell", () => {
    renderPanel([entry({ id: "u9", fullName: null })]);

    expect(screen.getByText(es.adminUsers.noName)).toBeInTheDocument();
  });
});

describe("state badges", () => {
  it("marks a plain visitor as such", () => {
    renderPanel();

    const row = within(rowFor("Beto Ruiz"));
    expect(row.getByText(es.adminUsers.state.visitor)).toBeInTheDocument();
    expect(row.queryByText(es.adminUsers.state.investor)).not.toBeInTheDocument();
  });

  it("marks a linked user as an investor", () => {
    renderPanel();

    const row = within(rowFor("Dana Sol"));
    expect(row.getByText(es.adminUsers.state.investor)).toBeInTheDocument();
    expect(row.queryByText(es.adminUsers.state.visitor)).not.toBeInTheDocument();
  });

  it("shows BOTH badges for an admin who also invests", () => {
    renderPanel();

    // The capability model is two independent axes; collapsing them into one
    // label would erase the owner's real case.
    const row = within(rowFor("Caro Gil"));
    expect(row.getByText(es.adminUsers.state.admin)).toBeInTheDocument();
    expect(row.getByText(es.adminUsers.state.investor)).toBeInTheDocument();
    expect(row.queryByText(es.adminUsers.state.visitor)).not.toBeInTheDocument();
  });

  it("flags only the user who has a prospect waiting to be connected", () => {
    renderPanel();

    const badges = screen.getAllByText(es.adminUsers.hasProspect);
    expect(badges).toHaveLength(1);
    expect(badges[0].closest("tr")).toContainElement(screen.getByText("Ana Pérez"));
  });
});

describe("the action column", () => {
  it("offers the button only for someone who can actually be converted", () => {
    renderPanel();

    const buttons = screen.getAllByRole("button", {
      name: new RegExp(es.adminUsers.convert),
    });
    expect(buttons).toHaveLength(2);
    for (const name of ["Ana Pérez", "Beto Ruiz"]) {
      expect(
        within(rowFor(name)).getByRole("button", {
          name: new RegExp(es.adminUsers.convert),
        })
      ).toBeInTheDocument();
    }
  });

  it("gives a reason instead of a dead button", () => {
    renderPanel();

    // Each reason mirrors a condition the Server Action enforces, so the UI
    // never offers something the server will refuse.
    expect(
      within(rowFor("Feli Ríos")).getByText(es.adminUsers.cannotConvert["is-admin"])
    ).toBeInTheDocument();
    expect(
      within(rowFor("Eva Mora")).getByText(es.adminUsers.cannotConvert["onboarding-pending"])
    ).toBeInTheDocument();
  });

  it("offers the CONTRACT to someone who is already an investor", () => {
    renderPanel();

    // Converting them again is meaningless; sending the contract they have to
    // sign is the action an admin actually comes here for.
    for (const name of ["Dana Sol", "Caro Gil"]) {
      expect(
        within(rowFor(name)).getByRole("button", { name: new RegExp(es.adminContract.send) })
      ).toBeInTheDocument();
    }
  });

  it("does not offer the contract to a non-investor", () => {
    renderPanel();

    for (const name of ["Beto Ruiz", "Feli Ríos", "Eva Mora"]) {
      expect(
        within(rowFor(name)).queryByRole("button", {
          name: new RegExp(es.adminContract.send),
        })
      ).not.toBeInTheDocument();
    }
  });
});

describe("sending the contract", () => {
  it("asks for a PDF and posts the user id from the row", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(
      within(rowFor("Dana Sol")).getByRole("button", {
        name: new RegExp(es.adminContract.send),
      })
    );

    const dialog = screen.getByRole("dialog");
    const field = within(dialog).getByLabelText(es.adminContract.fileLabel);
    expect(field).toHaveAttribute("accept", "application/pdf");

    await user.upload(
      field,
      new File(["%PDF-1.4"], "contrato.pdf", { type: "application/pdf" })
    );
    await user.click(
      within(dialog).getByRole("button", { name: es.adminContract.send })
    );

    await waitFor(() => expect(sendContractForSignature).toHaveBeenCalled());
    const payload = sendContractForSignature.mock.calls[0][0] as FormData;
    // The investor is resolved on the server from this id; the panel never
    // names an investor row directly.
    expect(payload.get("userId")).toBe("u3");
    expect((payload.get("contract") as File).name).toBe("contrato.pdf");
  });

  it("will not submit without a file", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(
      within(rowFor("Dana Sol")).getByRole("button", {
        name: new RegExp(es.adminContract.send),
      })
    );

    expect(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: es.adminContract.send,
      })
    ).toBeDisabled();
  });
});

describe("search and filter", () => {
  it("narrows the list by name", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.type(screen.getByLabelText(es.adminUsers.searchPlaceholder), "beto");

    expect(screen.getByText("Beto Ruiz")).toBeInTheDocument();
    expect(screen.queryByText("Ana Pérez")).not.toBeInTheDocument();
  });

  it("filters to visitors only", async () => {
    const user = userEvent.setup();
    renderPanel();

    await chooseFilter(user, es.adminUsers.filter.visitor);

    expect(screen.getByText("Beto Ruiz")).toBeInTheDocument();
    expect(screen.getByText("Eva Mora")).toBeInTheDocument();
    expect(screen.queryByText("Dana Sol")).not.toBeInTheDocument();
    expect(screen.queryByText("Caro Gil")).not.toBeInTheDocument();
    expect(screen.queryByText("Feli Ríos")).not.toBeInTheDocument();
  });

  it("keeps the owner under BOTH the admin and the investor filter", async () => {
    const user = userEvent.setup();
    renderPanel();

    await chooseFilter(user, es.adminUsers.filter.admin);
    expect(screen.getByText("Caro Gil")).toBeInTheDocument();
    expect(screen.getByText("Feli Ríos")).toBeInTheDocument();
    expect(screen.queryByText("Dana Sol")).not.toBeInTheDocument();

    await chooseFilter(user, es.adminUsers.filter.investor);
    expect(screen.getByText("Caro Gil")).toBeInTheDocument();
    expect(screen.getByText("Dana Sol")).toBeInTheDocument();
  });

  it("shows a search-specific empty state, not the 'nobody registered' one", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.type(screen.getByLabelText(es.adminUsers.searchPlaceholder), "nadie");

    expect(screen.getByText(es.adminUsers.emptySearch)).toBeInTheDocument();
    expect(screen.queryByText(es.adminUsers.empty)).not.toBeInTheDocument();
  });

  it("says there is nobody registered when the platform is empty", () => {
    renderPanel([]);

    expect(screen.getByText(es.adminUsers.empty)).toBeInTheDocument();
  });
});

describe("the confirmation dialog", () => {
  it("says the record will be CONNECTED when a prospect matches", async () => {
    const user = userEvent.setup();
    renderPanel();

    const dialog = await openFor(user, "Ana Pérez");

    expect(within(dialog).getByText(es.adminUsers.confirmWithProspect)).toBeInTheDocument();
    expect(
      within(dialog).queryByText(es.adminUsers.confirmWithoutProspect)
    ).not.toBeInTheDocument();
  });

  it("says the record will be CREATED when none matches", async () => {
    const user = userEvent.setup();
    renderPanel();

    const dialog = await openFor(user, "Beto Ruiz");

    expect(within(dialog).getByText(es.adminUsers.confirmWithoutProspect)).toBeInTheDocument();
  });

  it("names the person being converted", async () => {
    const user = userEvent.setup();
    renderPanel();

    const dialog = await openFor(user, "Ana Pérez");

    expect(within(dialog).getByText(/Ana Pérez · ana@ejemplo\.com/)).toBeInTheDocument();
  });

  it("makes clear this is not an investment", async () => {
    const user = userEvent.setup();
    renderPanel();

    const dialog = await openFor(user, "Ana Pérez");

    // The copy names "aporte" on purpose — to DENY it — so the check is that
    // the denial is there, not that the word is absent.
    expect(within(dialog).getByText(es.adminUsers.confirmDescription)).toBeInTheDocument();
    expect(es.adminUsers.confirmDescription).toMatch(/no registra ningún aporte/i);
    expect(dialog.textContent).not.toMatch(/invirtió|ha invertido|ya invirtió/i);
  });
});

describe("converting", () => {
  it("sends only the user id and refreshes on success", async () => {
    const user = userEvent.setup();
    renderPanel();

    const dialog = await openFor(user, "Beto Ruiz");
    await user.click(within(dialog).getByRole("button", { name: es.adminUsers.convert }));

    expect(convertVisitorToInvestor).toHaveBeenCalledWith({ userId: "u2" });
    expect(refresh).toHaveBeenCalled();
  });

  it("reports which of the two things happened", async () => {
    convertVisitorToInvestor.mockResolvedValue({ ok: true, outcome: "connected" });

    const user = userEvent.setup();
    renderPanel();

    const dialog = await openFor(user, "Ana Pérez");
    await user.click(within(dialog).getByRole("button", { name: es.adminUsers.convert }));

    expect(await screen.findByText(es.adminUsers.successConnected)).toBeInTheDocument();
  });

  it("keeps the dialog open with the reason when the server refuses", async () => {
    convertVisitorToInvestor.mockResolvedValue({
      ok: false,
      error: es.adminUsers.errors.alreadyInvestor,
    });

    const user = userEvent.setup();
    renderPanel();

    const dialog = await openFor(user, "Beto Ruiz");
    await user.click(within(dialog).getByRole("button", { name: es.adminUsers.convert }));

    expect(
      within(screen.getByRole("dialog")).getByText(es.adminUsers.errors.alreadyInvestor)
    ).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});
