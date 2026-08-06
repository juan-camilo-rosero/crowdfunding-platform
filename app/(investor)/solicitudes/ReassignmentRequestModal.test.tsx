import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { es } from "@/i18n";

const createReassignmentRequest = vi.fn();
const refresh = vi.fn();

vi.mock("./actions", () => ({
  createReassignmentRequest: (input: unknown) =>
    createReassignmentRequest(input),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
  usePathname: () => "/solicitudes",
}));

const { ReassignmentRequestModal } = await import("./ReassignmentRequestModal");

// Real uuids: the schema requires them, so short ids would fail validation
// for reasons that have nothing to do with what each test is checking.
const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";
const P3 = "33333333-3333-4333-8333-333333333333";

const SOURCES = [
  { projectId: P1, name: "Villa Rotonda 118", availableAmount: 6000 },
  { projectId: P2, name: "North Port Lote 7", availableAmount: 2500 },
];
const DESTINATIONS = [
  { projectId: P1, name: "Villa Rotonda 118" },
  { projectId: P2, name: "North Port Lote 7" },
  { projectId: P3, name: "Punta Gorda Lote 9" },
];

const renderModal = (props = {}) =>
  render(
    <ReassignmentRequestModal
      sources={SOURCES}
      destinations={DESTINATIONS}
      {...props}
    />
  );

/** Opens the modal and returns the dialog element. */
async function openModal(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: es.requests.create.open }));
  return screen.getByRole("dialog");
}

/** Picks an option from one of the dropdowns, by its accessible name. */
async function choose(
  user: ReturnType<typeof userEvent.setup>,
  triggerName: string,
  optionText: string | RegExp
) {
  await user.click(screen.getByRole("button", { name: triggerName }));
  const option = await screen.findByRole("menuitem", { name: optionText });
  await user.click(option);
}

beforeEach(() => {
  vi.clearAllMocks();
  createReassignmentRequest.mockResolvedValue({ ok: true });
});

describe("opening", () => {
  it("the trigger opens the modal", async () => {
    const user = userEvent.setup();
    renderModal();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const dialog = await openModal(user);

    expect(within(dialog).getByText(es.requests.create.title)).toBeInTheDocument();
  });

  it("frames it as a REQUEST, never as an immediate transfer", async () => {
    const user = userEvent.setup();
    renderModal();
    const dialog = await openModal(user);

    expect(within(dialog).getByText(es.requests.create.footnote)).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: es.requests.create.submit })
    ).toBeInTheDocument();
    // Nothing that suggests the capital moves now.
    expect(dialog.textContent).not.toMatch(/reasignar ahora|transferir/i);
  });
});

describe("options", () => {
  it("offers each source with its available amount", async () => {
    const user = userEvent.setup();
    renderModal();
    await openModal(user);

    await user.click(
      screen.getByRole("button", { name: es.requests.create.fromLabel })
    );

    expect(
      await screen.findByRole("menuitem", { name: /Villa Rotonda 118 · \$6,000/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /North Port Lote 7 · \$2,500/ })
    ).toBeInTheDocument();
  });

  it("shows the available amount once a source is chosen", async () => {
    const user = userEvent.setup();
    renderModal();
    await openModal(user);

    await choose(user, es.requests.create.fromLabel, /Villa Rotonda 118/);

    expect(
      screen.getByText(
        es.requests.create.available.replace("{amount}", "$6,000"),
        { exact: false }
      )
    ).toBeInTheDocument();
  });

  it("excludes the chosen origin from the destination list", async () => {
    const user = userEvent.setup();
    renderModal();
    await openModal(user);

    await choose(user, es.requests.create.fromLabel, /Villa Rotonda 118/);
    await user.click(
      screen.getByRole("button", { name: es.requests.create.toLabel })
    );

    expect(
      await screen.findByRole("menuitem", { name: "Punta Gorda Lote 9" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "Villa Rotonda 118" })
    ).not.toBeInTheDocument();
  });
});

describe("amount validation", () => {
  it("blocks submission until the form is complete", async () => {
    const user = userEvent.setup();
    renderModal();
    const dialog = await openModal(user);

    expect(
      within(dialog).getByRole("button", { name: es.requests.create.submit })
    ).toBeDisabled();
  });

  it("rejects an amount above the available capital, in place", async () => {
    const user = userEvent.setup();
    renderModal();
    const dialog = await openModal(user);

    await choose(user, es.requests.create.fromLabel, /Villa Rotonda 118/);
    await choose(user, es.requests.create.toLabel, "Punta Gorda Lote 9");
    await user.type(screen.getByLabelText(es.requests.create.amountLabel), "6001");

    expect(
      within(dialog).getByText(/supera tu capital disponible/i)
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: es.requests.create.submit })
    ).toBeDisabled();
  });

  it("accepts exactly the available capital", async () => {
    const user = userEvent.setup();
    renderModal();
    const dialog = await openModal(user);

    await choose(user, es.requests.create.fromLabel, /Villa Rotonda 118/);
    await choose(user, es.requests.create.toLabel, "Punta Gorda Lote 9");
    await user.type(screen.getByLabelText(es.requests.create.amountLabel), "6000");

    expect(
      within(dialog).queryByText(/supera tu capital disponible/i)
    ).not.toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: es.requests.create.submit })
    ).toBeEnabled();
  });

  it("strips letters and commas as they are typed", async () => {
    const user = userEvent.setup();
    renderModal();
    await openModal(user);

    const input = screen.getByLabelText(es.requests.create.amountLabel);
    await user.type(input, "1,2a3");

    expect(input).toHaveValue("123");
  });
});

describe("no capital", () => {
  it("explains the situation and blocks submission", async () => {
    const user = userEvent.setup();
    renderModal({ sources: [] });
    const dialog = await openModal(user);

    expect(
      within(dialog).getByText(es.requests.create.noCapital)
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: es.requests.create.submit })
    ).toBeDisabled();
  });
});

describe("submitting", () => {
  it("sends the payload and refreshes on success", async () => {
    const user = userEvent.setup();
    renderModal();
    await openModal(user);

    await choose(user, es.requests.create.fromLabel, /Villa Rotonda 118/);
    await choose(user, es.requests.create.toLabel, "Punta Gorda Lote 9");
    await user.type(screen.getByLabelText(es.requests.create.amountLabel), "1500");
    await user.click(screen.getByRole("button", { name: es.requests.create.submit }));

    expect(createReassignmentRequest).toHaveBeenCalledWith({
      fromProjectId: P1,
      toProjectId: P3,
      amount: 1500,
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("never sends an investor_id or a status", async () => {
    const user = userEvent.setup();
    renderModal();
    await openModal(user);

    await choose(user, es.requests.create.fromLabel, /Villa Rotonda 118/);
    await choose(user, es.requests.create.toLabel, "Punta Gorda Lote 9");
    await user.type(screen.getByLabelText(es.requests.create.amountLabel), "100");
    await user.click(screen.getByRole("button", { name: es.requests.create.submit }));

    const payload = createReassignmentRequest.mock.calls[0][0];
    expect(payload).not.toHaveProperty("investor_id");
    expect(payload).not.toHaveProperty("status");
  });

  it("shows the server's error and keeps the modal open", async () => {
    createReassignmentRequest.mockResolvedValue({
      ok: false,
      error: es.requests.errors.invalidSource,
    });

    const user = userEvent.setup();
    renderModal();
    await openModal(user);

    await choose(user, es.requests.create.fromLabel, /Villa Rotonda 118/);
    await choose(user, es.requests.create.toLabel, "Punta Gorda Lote 9");
    await user.type(screen.getByLabelText(es.requests.create.amountLabel), "100");
    await user.click(screen.getByRole("button", { name: es.requests.create.submit }));

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText(es.requests.errors.invalidSource)
    ).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});
