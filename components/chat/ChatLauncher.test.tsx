import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { es } from "@/i18n";
import { ChatLauncher } from "./ChatLauncher";

// jsdom has no layout, so scrolling the newest turn into view is a no-op here.
Element.prototype.scrollIntoView = vi.fn();

const STARTERS = ["¿Cuánto tengo invertido en total?", "¿Cómo va Villa Rotonda?"];

let reply = "Tienes $80,000 invertidos.";
let postStatus = 200;
let postBody: unknown = null;

const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
  if (init?.method === "POST") {
    postBody = JSON.parse(init.body as string);
    return {
      ok: postStatus === 200,
      status: postStatus,
      json: async () =>
        postStatus === 200 ? { reply } : { error: es.chat.errors.rateLimit },
    } as Response;
  }
  return {
    ok: true,
    status: 200,
    json: async () => ({ starters: STARTERS }),
  } as Response;
});

beforeEach(() => {
  vi.clearAllMocks();
  reply = "Tienes $80,000 invertidos.";
  postStatus = 200;
  postBody = null;
  vi.stubGlobal("fetch", fetchMock);
});

const open = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: es.chat.open }));
  return screen.getByRole("dialog");
};

const type = async (
  user: ReturnType<typeof userEvent.setup>,
  text: string
) => {
  await user.type(screen.getByLabelText(es.chat.placeholder), text);
};

describe("the floating button", () => {
  it("shows nothing until it is clicked", () => {
    render(<ChatLauncher />);

    expect(screen.getByRole("button", { name: es.chat.open })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the panel", async () => {
    const user = userEvent.setup();
    render(<ChatLauncher />);

    expect(await open(user)).toBeInTheDocument();
  });

  it("gets out of the way while the panel is open", async () => {
    const user = userEvent.setup();
    render(<ChatLauncher />);
    await open(user);

    // On a phone the panel is full screen; the FAB would sit on the conversation.
    expect(
      screen.queryByRole("button", { name: es.chat.open })
    ).not.toBeInTheDocument();
  });

  it("closes from the panel's own button", async () => {
    const user = userEvent.setup();
    render(<ChatLauncher />);
    await open(user);

    await user.click(screen.getByRole("button", { name: es.chat.close }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: es.chat.open })).toBeInTheDocument();
  });
});

describe("the empty state", () => {
  it("offers the chips the server built", async () => {
    const user = userEvent.setup();
    render(<ChatLauncher />);
    await open(user);

    for (const starter of STARTERS) {
      expect(await screen.findByRole("button", { name: starter })).toBeInTheDocument();
    }
  });

  it("sends a chip's text as a message when tapped", async () => {
    const user = userEvent.setup();
    render(<ChatLauncher />);
    await open(user);

    await user.click(await screen.findByRole("button", { name: STARTERS[0] }));

    await waitFor(() => expect(postBody).not.toBeNull());
    expect(postBody).toMatchObject({ message: STARTERS[0], history: [] });
  });

  it("still lets the user type when the chips fail to load", async () => {
    fetchMock.mockImplementationOnce(async () => {
      throw new Error("offline");
    });

    const user = userEvent.setup();
    render(<ChatLauncher />);
    await open(user);

    expect(screen.getByLabelText(es.chat.placeholder)).toBeEnabled();
  });
});

describe("a conversation", () => {
  it("shows the question and then the answer", async () => {
    const user = userEvent.setup();
    render(<ChatLauncher />);
    const dialog = await open(user);

    await type(user, "¿cuánto tengo?");
    await user.click(screen.getByRole("button", { name: es.chat.send }));

    expect(within(dialog).getByText("¿cuánto tengo?")).toBeInTheDocument();
    expect(
      await within(dialog).findByText("Tienes $80,000 invertidos.")
    ).toBeInTheDocument();
  });

  it("clears the composer after sending", async () => {
    const user = userEvent.setup();
    render(<ChatLauncher />);
    await open(user);

    await type(user, "hola");
    await user.click(screen.getByRole("button", { name: es.chat.send }));

    await waitFor(() =>
      expect(screen.getByLabelText(es.chat.placeholder)).toHaveValue("")
    );
  });

  it("sends with Enter and breaks the line with Shift+Enter", async () => {
    const user = userEvent.setup();
    render(<ChatLauncher />);
    await open(user);

    await type(user, "primera{Shift>}{Enter}{/Shift}segunda");
    expect(screen.getByLabelText(es.chat.placeholder)).toHaveValue(
      "primera\nsegunda"
    );

    await user.keyboard("{Enter}");

    await waitFor(() => expect(postBody).not.toBeNull());
    expect(postBody).toMatchObject({ message: "primera\nsegunda" });
  });

  it("accumulates the history and sends ALL of it each time", async () => {
    const user = userEvent.setup();
    render(<ChatLauncher />);
    await open(user);

    await type(user, "uno");
    await user.click(screen.getByRole("button", { name: es.chat.send }));
    await screen.findByText("Tienes $80,000 invertidos.");

    reply = "Recibiste $7,500 de rendimiento.";
    await type(user, "dos");
    await user.click(screen.getByRole("button", { name: es.chat.send }));

    // Multi-turn without server state: the client carries the whole thread.
    await waitFor(() =>
      expect(postBody).toMatchObject({
        message: "dos",
        history: [
          { role: "user", content: "uno" },
          { role: "assistant", content: "Tienes $80,000 invertidos." },
        ],
      })
    );
  });

  it("shows a typing indicator while the answer is in flight", async () => {
    let release: (() => void) | null = null;
    // Only the POST is held: the chips GET must still resolve, or the panel
    // never finishes rendering its empty state.
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      if (init?.method !== "POST") return fetchMock(url, init);
      return new Promise<Response>((resolve) => {
        release = () =>
          resolve({
            ok: true,
            status: 200,
            json: async () => ({ reply: "listo" }),
          } as Response);
      });
    });

    const user = userEvent.setup();
    render(<ChatLauncher />);
    await open(user);
    await screen.findByRole("button", { name: STARTERS[0] });

    await type(user, "hola");
    await user.click(screen.getByRole("button", { name: es.chat.send }));

    expect(await screen.findByText(es.chat.typing)).toBeInTheDocument();

    release!();
    await waitFor(() =>
      expect(screen.queryByText(es.chat.typing)).not.toBeInTheDocument()
    );
  });
});

describe("the assistant's formatting", () => {
  it("renders Markdown instead of printing the characters", async () => {
    reply = [
      "Estos son tus proyectos:",
      "",
      "*   **Villa Rotonda:** avance 72%.",
      "*   **Lote 9:** avance 45%.",
    ].join("\n");

    const user = userEvent.setup();
    render(<ChatLauncher />);
    const dialog = await open(user);

    await type(user, "¿cuáles son mis proyectos?");
    await user.click(screen.getByRole("button", { name: es.chat.send }));

    const items = await within(dialog).findAllByRole("listitem");
    const bullets = items.filter((item) => item.closest("ul"));
    expect(bullets).toHaveLength(2);

    // The asterisks were the whole complaint: they must not reach the screen.
    expect(bullets[0].textContent).toBe("Villa Rotonda: avance 72%.");
    expect(dialog.textContent).not.toContain("**");
  });

  it("shows the user's own message exactly as typed", async () => {
    const user = userEvent.setup();
    render(<ChatLauncher />);
    const dialog = await open(user);

    // Their text is not Markdown; asterisks they typed are asterisks.
    await type(user, "cuesta 3 * 4 dolares");
    await user.click(screen.getByRole("button", { name: es.chat.send }));

    expect(within(dialog).getByText("cuesta 3 * 4 dolares")).toBeInTheDocument();
  });
});

describe("errors", () => {
  it("shows the server's Spanish message with a retry", async () => {
    postStatus = 429;

    const user = userEvent.setup();
    render(<ChatLauncher />);
    await open(user);

    await type(user, "hola");
    await user.click(screen.getByRole("button", { name: es.chat.send }));

    expect(await screen.findByText(es.chat.errors.rateLimit)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: es.chat.retry })).toBeInTheDocument();
  });

  it("resends the same message on retry, without duplicating it on screen", async () => {
    postStatus = 429;

    const user = userEvent.setup();
    render(<ChatLauncher />);
    const dialog = await open(user);

    await type(user, "hola");
    await user.click(screen.getByRole("button", { name: es.chat.send }));
    await screen.findByRole("button", { name: es.chat.retry });

    postStatus = 200;
    await user.click(screen.getByRole("button", { name: es.chat.retry }));

    expect(
      await within(dialog).findByText("Tienes $80,000 invertidos.")
    ).toBeInTheDocument();
    expect(within(dialog).getAllByText("hola")).toHaveLength(1);
  });
});

describe("nuevo chat", () => {
  it("clears the conversation", async () => {
    const user = userEvent.setup();
    render(<ChatLauncher />);
    const dialog = await open(user);

    await type(user, "hola");
    await user.click(screen.getByRole("button", { name: es.chat.send }));
    await within(dialog).findByText("Tienes $80,000 invertidos.");

    await user.click(screen.getByRole("button", { name: es.chat.newChat }));

    expect(within(dialog).queryByText("hola")).not.toBeInTheDocument();
    expect(screen.getByText(es.chat.emptyTitle)).toBeInTheDocument();
  });

  it("starts the next request with an empty history", async () => {
    const user = userEvent.setup();
    render(<ChatLauncher />);
    await open(user);

    await type(user, "uno");
    await user.click(screen.getByRole("button", { name: es.chat.send }));
    await screen.findByText("Tienes $80,000 invertidos.");

    await user.click(screen.getByRole("button", { name: es.chat.newChat }));

    await type(user, "dos");
    await user.click(screen.getByRole("button", { name: es.chat.send }));

    await waitFor(() =>
      expect(postBody).toMatchObject({ message: "dos", history: [] })
    );
  });
});

describe("the scrim", () => {
  it("covers the page while the panel is open", async () => {
    const user = userEvent.setup();
    render(<ChatLauncher />);
    await open(user);

    expect(
      screen.getByRole("button", { name: es.chat.closeFromOutside })
    ).toBeInTheDocument();
  });

  it("is gone once the panel closes", async () => {
    const user = userEvent.setup();
    render(<ChatLauncher />);
    await open(user);

    await user.click(screen.getByRole("button", { name: es.chat.close }));

    expect(
      screen.queryByRole("button", { name: es.chat.closeFromOutside })
    ).not.toBeInTheDocument();
  });

  it("closes the panel when clicked", async () => {
    const user = userEvent.setup();
    render(<ChatLauncher />);
    await open(user);

    await user.click(
      screen.getByRole("button", { name: es.chat.closeFromOutside })
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does NOT discard the conversation", async () => {
    const user = userEvent.setup();
    render(<ChatLauncher />);
    const dialog = await open(user);

    await type(user, "hola");
    await user.click(screen.getByRole("button", { name: es.chat.send }));
    await within(dialog).findByText("Tienes $80,000 invertidos.");

    await user.click(
      screen.getByRole("button", { name: es.chat.closeFromOutside })
    );
    const reopened = await open(user);

    // Closing puts the thread away; it does not throw it away.
    expect(within(reopened).getByText("hola")).toBeInTheDocument();
    expect(
      within(reopened).getByText("Tienes $80,000 invertidos.")
    ).toBeInTheDocument();
  });
});

describe("the conversation survives the panel", () => {
  it("is still there after closing with the X and reopening", async () => {
    const user = userEvent.setup();
    render(<ChatLauncher />);
    const dialog = await open(user);

    await type(user, "hola");
    await user.click(screen.getByRole("button", { name: es.chat.send }));
    await within(dialog).findByText("Tienes $80,000 invertidos.");

    await user.click(screen.getByRole("button", { name: es.chat.close }));
    const reopened = await open(user);

    expect(within(reopened).getByText("hola")).toBeInTheDocument();
  });

  it("keeps sending the whole thread after a close and reopen", async () => {
    const user = userEvent.setup();
    render(<ChatLauncher />);
    await open(user);

    await type(user, "uno");
    await user.click(screen.getByRole("button", { name: es.chat.send }));
    await screen.findByText("Tienes $80,000 invertidos.");

    await user.click(screen.getByRole("button", { name: es.chat.close }));
    await open(user);

    await type(user, "dos");
    await user.click(screen.getByRole("button", { name: es.chat.send }));

    await waitFor(() =>
      expect(postBody).toMatchObject({
        message: "dos",
        history: [
          { role: "user", content: "uno" },
          { role: "assistant", content: "Tienes $80,000 invertidos." },
        ],
      })
    );
  });

  it("asks the server for chips only once, however often it is reopened", async () => {
    const user = userEvent.setup();
    render(<ChatLauncher />);

    await open(user);
    await screen.findByRole("button", { name: STARTERS[0] });
    await user.click(screen.getByRole("button", { name: es.chat.close }));
    await open(user);

    const gets = fetchMock.mock.calls.filter(([, init]) => init?.method !== "POST");
    expect(gets).toHaveLength(1);
  });
});

describe("nothing is persisted", () => {
  it("uses no browser storage", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    const user = userEvent.setup();
    render(<ChatLauncher />);
    await open(user);

    await type(user, "hola");
    await user.click(screen.getByRole("button", { name: es.chat.send }));
    await screen.findByText("Tienes $80,000 invertidos.");

    // A portfolio conversation must not survive in localStorage.
    expect(setItem).not.toHaveBeenCalled();
  });
});
