import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { es } from "@/i18n";
import type { LoginSlide } from "@/lib/site/login-slides";

const addLoginSlides = vi.fn();
const setLoginSlideCaption = vi.fn();
const reorderLoginSlides = vi.fn();
const deleteLoginSlide = vi.fn();
const replaceLoginSlideImage = vi.fn();
const adoptDefaultLoginSlides = vi.fn();
const runPhotoPipeline = vi.fn();
const refresh = vi.fn();

vi.mock("./actions", () => ({
  addLoginSlides: (input: unknown) => addLoginSlides(input),
  setLoginSlideCaption: (input: unknown) => setLoginSlideCaption(input),
  reorderLoginSlides: (input: unknown) => reorderLoginSlides(input),
  deleteLoginSlide: (input: unknown) => deleteLoginSlide(input),
  replaceLoginSlideImage: (input: unknown) => replaceLoginSlideImage(input),
  adoptDefaultLoginSlides: () => adoptDefaultLoginSlides(),
}));
vi.mock("@/lib/projects/photo-pipeline", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/projects/photo-pipeline")>()),
  runPhotoPipeline: (...args: unknown[]) => runPhotoPipeline(...args),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={String(props.src)} alt={String(props.alt ?? "")} />
  ),
}));

const { LoginSlidesPanel } = await import("./LoginSlidesPanel");

const BUCKET = "https://abc.supabase.co/storage/v1/object/public/project-photos";
const SLIDES: LoginSlide[] = [
  { id: "s1", imageUrl: `${BUCKET}/login/a.webp`, caption: "Primera" },
  { id: "s2", imageUrl: `${BUCKET}/login/b.webp`, caption: null },
  { id: "s3", imageUrl: `${BUCKET}/login/c.webp`, caption: "Tercera" },
];

const t = es.adminLogin;

function renderPanel(slides: LoginSlide[] = SLIDES, usingDefaults = false) {
  render(<LoginSlidesPanel slides={slides} usingDefaults={usingDefaults} />);
}

function pickFile(user: ReturnType<typeof userEvent.setup>, name = "fachada.jpg") {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  return user.upload(input!, new File(["x"], name, { type: "image/jpeg" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  addLoginSlides.mockResolvedValue({ ok: true });
  setLoginSlideCaption.mockResolvedValue({ ok: true });
  reorderLoginSlides.mockResolvedValue({ ok: true });
  deleteLoginSlide.mockResolvedValue({ ok: true });
  replaceLoginSlideImage.mockResolvedValue({ ok: true });
  adoptDefaultLoginSlides.mockResolvedValue({ ok: true });
  runPhotoPipeline.mockResolvedValue({
    ok: true,
    photos: [],
    originalBytes: 0,
    finalBytes: 0,
    optimized: 0,
  });
});

describe("what the screen shows", () => {
  it("lists one row per slide, with its image", () => {
    renderPanel();

    expect(document.querySelectorAll("img")).toHaveLength(3);
  });

  it("says when the app's own images are still in use, and why", () => {
    renderPanel(SLIDES, true);

    expect(screen.getByText(t.empty)).toBeInTheDocument();
    expect(screen.getByText(t.emptyHint)).toBeInTheDocument();
  });

  it("shows the bundled ones as a preview, with nothing to edit", () => {
    renderPanel(SLIDES, true);

    expect(screen.queryByLabelText(t.captionLabel.replace("{n}", "1"))).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: t.remove.replace("{n}", "1") })
    ).not.toBeInTheDocument();
  });

  it("offers to keep the bundled four as editable slides", async () => {
    const user = userEvent.setup();
    renderPanel(SLIDES, true);

    await user.click(screen.getByRole("button", { name: t.adopt }));

    await waitFor(() => expect(adoptDefaultLoginSlides).toHaveBeenCalled());
    expect(refresh).toHaveBeenCalled();
  });

  it("says nothing of the sort once there are real slides", () => {
    renderPanel();

    expect(screen.queryByText(t.empty)).not.toBeInTheDocument();
  });
});

describe("uploading", () => {
  it("sends the file through the shared photo pipeline, into the login folder", async () => {
    const user = userEvent.setup();
    renderPanel();

    await pickFile(user);

    await waitFor(() => expect(runPhotoPipeline).toHaveBeenCalled());
    expect(runPhotoPipeline.mock.calls[0][0]).toBe("login");
  });

  it("shows the reason when the upload fails", async () => {
    const user = userEvent.setup();
    runPhotoPipeline.mockResolvedValue({
      ok: false,
      error: "No pudimos subir «fachada.jpg».",
      photos: null,
    });
    renderPanel();

    await pickFile(user);

    expect(await screen.findByRole("alert")).toHaveTextContent("fachada.jpg");
  });

  it("does not freeze if the pipeline throws", async () => {
    const user = userEvent.setup();
    runPhotoPipeline.mockRejectedValue(new Error("boom"));
    renderPanel();

    await pickFile(user);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});

describe("the caption", () => {
  it("saves on blur, trimmed", async () => {
    const user = userEvent.setup();
    renderPanel();

    const field = screen.getByLabelText(new RegExp(t.captionLabel.replace("{n}", "1")));
    await user.clear(field);
    await user.type(field, "Nueva frase");
    await user.tab();

    await waitFor(() =>
      expect(setLoginSlideCaption).toHaveBeenCalledWith({
        id: "s1",
        caption: "Nueva frase",
      })
    );
  });

  it("does not save when nothing changed", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByLabelText(new RegExp(t.captionLabel.replace("{n}", "1"))));
    await user.tab();

    expect(setLoginSlideCaption).not.toHaveBeenCalled();
  });
});

describe("ordering", () => {
  it("moves a slide down and sends the whole new order", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: t.moveDown.replace("{n}", "1") }));

    await waitFor(() =>
      expect(reorderLoginSlides).toHaveBeenCalledWith({ ids: ["s2", "s1", "s3"] })
    );
  });

  it("moves a slide up", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: t.moveUp.replace("{n}", "3") }));

    await waitFor(() =>
      expect(reorderLoginSlides).toHaveBeenCalledWith({ ids: ["s1", "s3", "s2"] })
    );
  });

  it("offers no way to move the first one up, or the last one down", () => {
    renderPanel();

    expect(
      screen.queryByRole("button", { name: t.moveUp.replace("{n}", "1") })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: t.moveDown.replace("{n}", "3") })
    ).not.toBeInTheDocument();
  });

  it("does not reorder the app's bundled images", () => {
    renderPanel(SLIDES, true);

    expect(
      screen.queryByRole("button", { name: t.moveDown.replace("{n}", "1") })
    ).not.toBeInTheDocument();
  });
});

describe("removing", () => {
  it("asks first, then deletes", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: t.remove.replace("{n}", "2") }));

    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: t.remove.replace("{n}", "2") }));

    await waitFor(() => expect(deleteLoginSlide).toHaveBeenCalledWith({ id: "s2" }));
    expect(refresh).toHaveBeenCalled();
  });

  it("does not delete when the admin cancels", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: t.remove.replace("{n}", "2") }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: es.common.cancel }));

    expect(deleteLoginSlide).not.toHaveBeenCalled();
  });

  it("shows the reason when the server refuses", async () => {
    const user = userEvent.setup();
    deleteLoginSlide.mockResolvedValue({ ok: false, error: t.errors.saveFailed });
    renderPanel();

    await user.click(screen.getByRole("button", { name: t.remove.replace("{n}", "2") }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: t.remove.replace("{n}", "2") }));

    expect(await screen.findByRole("alert")).toHaveTextContent(t.errors.saveFailed);
  });
});

describe("changing the image of a slide", () => {
  it("offers it on every row, by button and on the thumbnail", () => {
    renderPanel();

    expect(
      screen.getAllByRole("button", { name: t.replaceShort })
    ).toHaveLength(SLIDES.length);
    expect(
      screen.getByRole("button", { name: t.replace.replace("{n}", "1") })
    ).toBeInTheDocument();
  });

  it("replaces that slide's image instead of adding a new one", async () => {
    const user = userEvent.setup();
    runPhotoPipeline.mockImplementation(async (_folder, _files, deps) => {
      await deps.attach({ projectId: "login", urls: ["https://x/login/nueva.webp"] });
      return { ok: true, photos: [], originalBytes: 0, finalBytes: 0, optimized: 0 };
    });
    renderPanel();

    await user.click(screen.getByRole("button", { name: t.replace.replace("{n}", "2") }));
    await pickFile(user);

    await waitFor(() =>
      expect(replaceLoginSlideImage).toHaveBeenCalledWith({
        id: "s2",
        url: "https://x/login/nueva.webp",
      })
    );
    expect(addLoginSlides).not.toHaveBeenCalled();
  });

  it("adds instead of replacing when the main button was used", async () => {
    const user = userEvent.setup();
    runPhotoPipeline.mockImplementation(async (_folder, _files, deps) => {
      await deps.attach({ projectId: "login", urls: ["https://x/login/nueva.webp"] });
      return { ok: true, photos: [], originalBytes: 0, finalBytes: 0, optimized: 0 };
    });
    renderPanel();

    await user.click(screen.getByRole("button", { name: t.add }));
    await pickFile(user);

    await waitFor(() => expect(addLoginSlides).toHaveBeenCalled());
    expect(replaceLoginSlideImage).not.toHaveBeenCalled();
  });
});

describe("there is always at least one image", () => {
  it("offers no way to remove the only slide, and says why", () => {
    renderPanel([SLIDES[0]]);

    expect(
      screen.queryByRole("button", { name: t.remove.replace("{n}", "1") })
    ).not.toBeInTheDocument();
    expect(screen.getByText(t.lastSlideHint)).toBeInTheDocument();
  });

  it("offers it again as soon as there are two", () => {
    renderPanel(SLIDES.slice(0, 2));

    expect(
      screen.getByRole("button", { name: t.remove.replace("{n}", "1") })
    ).toBeInTheDocument();
  });
});

describe("editing a caption", () => {
  it("confirms that it saved", async () => {
    const user = userEvent.setup();
    renderPanel();

    const field = screen.getByLabelText(new RegExp(t.captionLabel.replace("{n}", "1")));
    await user.clear(field);
    await user.type(field, "Otra frase");
    await user.tab();

    expect(await screen.findByText(t.captionSaved)).toBeInTheDocument();
  });

  it("saves with Enter, without leaving the field by hand", async () => {
    const user = userEvent.setup();
    renderPanel();

    const field = screen.getByLabelText(new RegExp(t.captionLabel.replace("{n}", "1")));
    await user.clear(field);
    await user.type(field, "Con Enter{Enter}");

    await waitFor(() =>
      expect(setLoginSlideCaption).toHaveBeenCalledWith({ id: "s1", caption: "Con Enter" })
    );
  });

  it("shows the reason when the caption cannot be saved", async () => {
    const user = userEvent.setup();
    setLoginSlideCaption.mockResolvedValue({ ok: false, error: t.errors.captionLong });
    renderPanel();

    const field = screen.getByLabelText(new RegExp(t.captionLabel.replace("{n}", "1")));
    await user.clear(field);
    await user.type(field, "Otra frase");
    await user.tab();

    expect(await screen.findByRole("alert")).toHaveTextContent(t.errors.captionLong);
  });
});
