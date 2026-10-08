import { describe, expect, it, vi } from "vitest";
import { es } from "@/i18n";
import {
  DEFAULT_LOGIN_SLIDES,
  LOGIN_SLIDES_FOLDER,
  fetchLoginSlides,
  resolveLoginSlides,
  type LoginSlidesClient,
} from "./login-slides";

const row = (over: Record<string, unknown> = {}) => ({
  id: "s1",
  image_url: "https://abc.supabase.co/storage/v1/object/public/project-photos/login/a.webp",
  caption: "Una frase",
  ...over,
});

/** A client that answers with whatever the test sets. */
function fakeClient(answer: { data?: unknown; error?: unknown }): LoginSlidesClient {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "order"]) builder[method] = () => builder;
  builder.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve({ data: answer.data ?? null, error: answer.error ?? null }).then(resolve);
  return { from: vi.fn(() => builder) } as unknown as LoginSlidesClient;
}

describe("resolveLoginSlides", () => {
  it("uses the configured slides", () => {
    expect(resolveLoginSlides([row(), row({ id: "s2", caption: null })])).toEqual([
      { id: "s1", imageUrl: row().image_url, caption: "Una frase" },
      { id: "s2", imageUrl: row().image_url, caption: null },
    ]);
  });

  it("falls back to the images shipped with the app when there are none", () => {
    expect(resolveLoginSlides([])).toEqual(DEFAULT_LOGIN_SLIDES);
    expect(resolveLoginSlides(null)).toEqual(DEFAULT_LOGIN_SLIDES);
  });

  it("ships four slides by default, with their captions", () => {
    expect(DEFAULT_LOGIN_SLIDES).toHaveLength(es.login.carouselSlides.length);
    expect(DEFAULT_LOGIN_SLIDES[0].caption).toBe(es.login.carouselSlides[0]);
    expect(DEFAULT_LOGIN_SLIDES.every((slide) => slide.imageUrl.startsWith("/"))).toBe(true);
  });

  it("drops a row with no usable image instead of rendering a broken one", () => {
    expect(resolveLoginSlides([row({ image_url: "" }), row({ id: "s2" })])).toEqual([
      { id: "s2", imageUrl: row().image_url, caption: "Una frase" },
    ]);
  });

  it("falls back when every row is unusable", () => {
    expect(resolveLoginSlides([row({ image_url: "   " })])).toEqual(DEFAULT_LOGIN_SLIDES);
  });

  it("trims captions and treats an empty one as none", () => {
    expect(resolveLoginSlides([row({ caption: "  Hola  " })])[0].caption).toBe("Hola");
    expect(resolveLoginSlides([row({ caption: "   " })])[0].caption).toBeNull();
  });
});

describe("fetchLoginSlides", () => {
  it("reads the table ordered and maps it", async () => {
    const client = fakeClient({ data: [row()] });

    const slides = await fetchLoginSlides(client);

    expect(client.from).toHaveBeenCalledWith("login_slides");
    expect(slides[0].id).toBe("s1");
  });

  it("NEVER breaks the login screen: a failed read falls back", async () => {
    const slides = await fetchLoginSlides(fakeClient({ error: { message: "no existe" } }));

    expect(slides).toEqual(DEFAULT_LOGIN_SLIDES);
  });

  it("falls back when the client itself throws", async () => {
    const broken = {
      from: () => {
        throw new Error("sin conexión");
      },
    } as unknown as LoginSlidesClient;

    expect(await fetchLoginSlides(broken)).toEqual(DEFAULT_LOGIN_SLIDES);
  });
});

describe("the storage folder", () => {
  it("keeps login images apart from project photos in the same bucket", () => {
    expect(LOGIN_SLIDES_FOLDER).toBe("login");
  });
});
