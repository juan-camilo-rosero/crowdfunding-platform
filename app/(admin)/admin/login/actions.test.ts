import { beforeEach, describe, expect, it, vi } from "vitest";
import { es } from "@/i18n";

/**
 * The login carousel is the first thing anyone sees, and its images live in a
 * PUBLIC bucket. The tests that cannot fail: only an admin writes, only urls
 * from our own bucket are stored, and deleting a slide takes its file with it.
 */

const BUCKET = "https://abc.supabase.co/storage/v1/object/public/project-photos";
const ID = "11111111-1111-4111-8111-111111111111";

const getUser = vi.fn();
const insert = vi.fn();
const update = vi.fn();
const remove = vi.fn();
const storageRemove = vi.fn();

let callerRole = "admin";
let slides: Record<string, unknown>[] = [];

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    storage: { from: () => ({ remove: storageRemove }) },
    from: (table: string) => {
      const builder: Record<string, unknown> = {
        insert: (payload: unknown) => {
          insert(table, payload);
          return builder;
        },
        update: (payload: unknown) => {
          update(table, payload);
          return builder;
        },
        delete: () => {
          remove(table);
          return builder;
        },
      };
      for (const method of ["select", "eq", "order", "in", "limit"]) {
        builder[method] = () => builder;
      }
      const answer = () =>
        table === "users"
          ? { data: { role: callerRole }, error: null }
          : { data: slides, error: null };
      builder.single = async () => answer();
      builder.maybeSingle = async () => answer();
      builder.then = (resolve: (value: unknown) => unknown) =>
        Promise.resolve(answer()).then(resolve);
      return builder;
    },
  }),
}));

const { addLoginSlides, deleteLoginSlide, reorderLoginSlides, setLoginSlideCaption } =
  await import("./actions");

beforeEach(() => {
  vi.clearAllMocks();
  callerRole = "admin";
  slides = [];
  getUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
  storageRemove.mockResolvedValue({ error: null });
});

describe("only an admin may touch the carousel", () => {
  it.each([
    ["addLoginSlides", () => addLoginSlides({ urls: [`${BUCKET}/login/a.webp`] })],
    ["setLoginSlideCaption", () => setLoginSlideCaption({ id: ID, caption: "Hola" })],
    ["reorderLoginSlides", () => reorderLoginSlides({ ids: [ID] })],
    ["deleteLoginSlide", () => deleteLoginSlide({ id: ID })],
  ])("%s refuses a visitor", async (_name, run) => {
    callerRole = "visitante";

    const result = await run();

    expect(result).toEqual({ ok: false, error: es.adminLogin.errors.notAdmin });
    expect(insert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
});

describe("adding slides", () => {
  it("stores the urls after the slides already there", async () => {
    slides = [{ id: "s1", position: 0 }, { id: "s2", position: 1 }];

    const result = await addLoginSlides({
      urls: [`${BUCKET}/login/a.webp`, `${BUCKET}/login/b.webp`],
    });

    expect(result.ok).toBe(true);
    expect(insert).toHaveBeenCalledWith("login_slides", [
      { image_url: `${BUCKET}/login/a.webp`, position: 2 },
      { image_url: `${BUCKET}/login/b.webp`, position: 3 },
    ]);
  });

  it("refuses a url that is not in our bucket", async () => {
    const result = await addLoginSlides({ urls: ["https://otro-sitio.com/foto.jpg"] });

    expect(result).toEqual({ ok: false, error: es.adminLogin.errors.badUrl });
    expect(insert).not.toHaveBeenCalled();
  });

  it("refuses an empty list", async () => {
    expect((await addLoginSlides({ urls: [] })).ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("the caption", () => {
  it("saves the text", async () => {
    const result = await setLoginSlideCaption({ id: ID, caption: "  Una frase  " });

    expect(result.ok).toBe(true);
    expect(update).toHaveBeenCalledWith(
      "login_slides",
      expect.objectContaining({ caption: "Una frase" })
    );
  });

  it("clears it when left empty, instead of storing blanks", async () => {
    await setLoginSlideCaption({ id: ID, caption: "   " });

    expect(update).toHaveBeenCalledWith(
      "login_slides",
      expect.objectContaining({ caption: null })
    );
  });

  it("refuses a caption longer than the column allows", async () => {
    const result = await setLoginSlideCaption({ id: ID, caption: "x".repeat(121) });

    expect(result).toEqual({ ok: false, error: es.adminLogin.errors.captionLong });
    expect(update).not.toHaveBeenCalled();
  });
});

describe("reordering", () => {
  it("writes one position per slide, in the order given", async () => {
    const second = "22222222-2222-4222-8222-222222222222";

    const result = await reorderLoginSlides({ ids: [second, ID] });

    expect(result.ok).toBe(true);
    expect(update).toHaveBeenNthCalledWith(
      1,
      "login_slides",
      expect.objectContaining({ position: 0 })
    );
    expect(update).toHaveBeenNthCalledWith(
      2,
      "login_slides",
      expect.objectContaining({ position: 1 })
    );
  });

  it("refuses an id that is not a uuid", async () => {
    expect((await reorderLoginSlides({ ids: ["x"] })).ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});

describe("deleting", () => {
  it("removes the row and its file from the bucket", async () => {
    slides = [{ id: ID, image_url: `${BUCKET}/login/a.webp`, position: 0 }];

    const result = await deleteLoginSlide({ id: ID });

    expect(result.ok).toBe(true);
    expect(remove).toHaveBeenCalledWith("login_slides");
    expect(storageRemove).toHaveBeenCalledWith(["login/a.webp"]);
  });

  it("still deletes the row when the image lives somewhere we do not own", async () => {
    slides = [{ id: ID, image_url: "https://otro-sitio.com/foto.jpg", position: 0 }];

    const result = await deleteLoginSlide({ id: ID });

    expect(result.ok).toBe(true);
    expect(remove).toHaveBeenCalled();
    expect(storageRemove).not.toHaveBeenCalled();
  });
});
