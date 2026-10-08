import { es } from "@/i18n";

/**
 * The images of the login carousel.
 *
 * They used to be four files in /public, so changing them meant editing the
 * repository and deploying. They are rows now, with the image in the
 * `project-photos` bucket under `login/` — the same public bucket, whose
 * write policies are already admin-only, which is why no second bucket (and
 * no second set of policies) had to be created.
 *
 * THE LOGIN SCREEN MUST NEVER DEPEND ON THIS. It is the first thing a person
 * sees and it is rendered without a session; a missing table, a failed read or
 * an empty list all fall back to the four images shipped with the app. That is
 * also what makes the order of deploying and migrating irrelevant.
 */

/** Folder inside the shared bucket. Keeps login images out of a project's. */
export const LOGIN_SLIDES_FOLDER = "login";

export type LoginSlide = {
  id: string;
  /** Public URL, or a path under /public for the bundled ones. */
  imageUrl: string;
  caption: string | null;
};

/** What the app ships with: the original four, with their captions. */
export const DEFAULT_LOGIN_SLIDES: LoginSlide[] = es.login.carouselSlides.map(
  (caption, index) => ({
    id: `default-${index + 1}`,
    imageUrl: `/carousel/login_carousel_${index + 1}.jpg`,
    caption,
  })
);

type LoginSlideRow = {
  id: string;
  image_url: string | null;
  caption: string | null;
};

/** Rows → slides, dropping anything unusable; falls back when nothing is left. */
export function resolveLoginSlides(rows: LoginSlideRow[] | null): LoginSlide[] {
  const slides = (rows ?? [])
    .filter((row) => (row.image_url ?? "").trim() !== "")
    .map((row) => ({
      id: row.id,
      imageUrl: (row.image_url ?? "").trim(),
      caption: row.caption?.trim() ? row.caption.trim() : null,
    }));

  return slides.length > 0 ? slides : DEFAULT_LOGIN_SLIDES;
}

/** The slice of the Supabase client this needs, so it can be faked in tests. */
type LoginSlidesQuery = PromiseLike<{
  data: LoginSlideRow[] | null;
  error: unknown;
}> & {
  // Chainable AND awaitable, like PostgREST's builder: the query orders by
  // two columns before it is awaited.
  order: (column: string, options?: { ascending?: boolean }) => LoginSlidesQuery;
};

export type LoginSlidesClient = {
  from: (table: string) => { select: (columns: string) => LoginSlidesQuery };
};

export async function fetchLoginSlides(
  client: LoginSlidesClient
): Promise<LoginSlide[]> {
  try {
    const { data, error } = await client
      .from("login_slides")
      .select("id, image_url, caption")
      // position first, created_at as the tie-breaker, so the order is total.
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[login] no se pudieron leer las imágenes del carrusel", error);
      return DEFAULT_LOGIN_SLIDES;
    }
    return resolveLoginSlides(data);
  } catch (error) {
    // A missing table, a paused project, no network: the login still renders.
    console.error("[login] fallo al leer las imágenes del carrusel", error);
    return DEFAULT_LOGIN_SLIDES;
  }
}
