"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { es } from "@/i18n";
import { PROJECT_PHOTOS_BUCKET, photoPathFromUrl } from "@/lib/projects/photos";
import { createClient } from "@/lib/supabase/server";

/**
 * Writes to the login carousel.
 *
 * Every write runs on the SESSION-BOUND client, so `login_slides_admin_write`
 * re-checks public.is_admin() inside the database — the explicit check here is
 * the first of the two barriers, not the only one. The service role key is
 * deliberately absent.
 *
 * The images are stored in the `project-photos` bucket under `login/`, which
 * already carries admin-only write policies; a url pointing anywhere else is
 * refused, because these end up rendered on a page anyone can open.
 */

const LOGIN_ROUTE = "/login";
const ADMIN_LOGIN_ROUTE = "/admin/login";

/** Matches the CHECK on the column. */
const MAX_CAPTION = 120;

export type LoginSlidesResult = { ok: true } | { ok: false; error: string };

const idSchema = z.uuid();

/** Refuses anyone who is not an admin; returns their client when they are. */
async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  return profile?.role === "admin" ? supabase : null;
}

function revalidate() {
  revalidatePath(ADMIN_LOGIN_ROUTE);
  // The carousel is rendered by the auth screens.
  revalidatePath(LOGIN_ROUTE);
  revalidatePath("/registro");
  revalidatePath("/onboarding");
}

/** Appends uploaded images to the end of the carousel. */
export async function addLoginSlides(input: {
  urls: string[];
}): Promise<LoginSlidesResult> {
  const supabase = await requireAdmin();
  if (!supabase) return { ok: false, error: es.adminLogin.errors.notAdmin };

  const urls = input.urls ?? [];
  if (urls.length === 0) return { ok: false, error: es.adminLogin.errors.noFile };

  // Only our own bucket: these urls are rendered on a public page.
  if (urls.some((url) => photoPathFromUrl(url) === null)) {
    return { ok: false, error: es.adminLogin.errors.badUrl };
  }

  // The highest position in use, computed from the rows rather than trusted
  // from an ORDER BY: positions can be rewritten by a reorder running at the
  // same time, and appending after the wrong one would interleave the slides.
  const { data: existing } = await supabase.from("login_slides").select("position");

  const last = (existing ?? []).reduce(
    (highest, row) => Math.max(highest, row.position ?? -1),
    -1
  );

  const { error } = await supabase.from("login_slides").insert(
    urls.map((url, index) => ({ image_url: url, position: last + 1 + index }))
  );

  if (error) {
    console.error("[login-slides] no se pudieron agregar", error);
    return { ok: false, error: es.adminLogin.errors.saveFailed };
  }

  revalidate();
  return { ok: true };
}

export async function setLoginSlideCaption(input: {
  id: string;
  caption: string;
}): Promise<LoginSlidesResult> {
  const supabase = await requireAdmin();
  if (!supabase) return { ok: false, error: es.adminLogin.errors.notAdmin };

  if (!idSchema.safeParse(input.id).success) {
    return { ok: false, error: es.adminLogin.errors.saveFailed };
  }

  const caption = (input.caption ?? "").trim();
  if (caption.length > MAX_CAPTION) {
    return { ok: false, error: es.adminLogin.errors.captionLong };
  }

  const { error } = await supabase
    .from("login_slides")
    // Blank means "no caption": the slide shows the image alone.
    .update({ caption: caption || null, updated_at: new Date().toISOString() })
    .eq("id", input.id);

  if (error) {
    console.error("[login-slides] no se pudo guardar la frase", error);
    return { ok: false, error: es.adminLogin.errors.saveFailed };
  }

  revalidate();
  return { ok: true };
}

/**
 * Rewrites the order. The caller sends the FULL list of ids in the order it
 * wants; positions are assigned 0..n-1, so no two slides can end up tied and
 * a half-applied reorder still leaves a total order.
 */
export async function reorderLoginSlides(input: {
  ids: string[];
}): Promise<LoginSlidesResult> {
  const supabase = await requireAdmin();
  if (!supabase) return { ok: false, error: es.adminLogin.errors.notAdmin };

  const ids = input.ids ?? [];
  if (ids.length === 0 || ids.some((id) => !idSchema.safeParse(id).success)) {
    return { ok: false, error: es.adminLogin.errors.saveFailed };
  }

  for (const [position, id] of ids.entries()) {
    const { error } = await supabase
      .from("login_slides")
      .update({ position, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      console.error("[login-slides] no se pudo reordenar", error);
      return { ok: false, error: es.adminLogin.errors.saveFailed };
    }
  }

  revalidate();
  return { ok: true };
}

export async function deleteLoginSlide(input: {
  id: string;
}): Promise<LoginSlidesResult> {
  const supabase = await requireAdmin();
  if (!supabase) return { ok: false, error: es.adminLogin.errors.notAdmin };

  if (!idSchema.safeParse(input.id).success) {
    return { ok: false, error: es.adminLogin.errors.saveFailed };
  }

  // Read the row first: the file can only be removed while the url is known.
  const { data: rows } = await supabase
    .from("login_slides")
    .select("image_url")
    .eq("id", input.id);

  const { error } = await supabase.from("login_slides").delete().eq("id", input.id);
  if (error) {
    console.error("[login-slides] no se pudo eliminar", error);
    return { ok: false, error: es.adminLogin.errors.saveFailed };
  }

  // The row is the source of truth; an object nothing points at is rubbish.
  // Only files of our own bucket are removed.
  const path = photoPathFromUrl((rows ?? [])[0]?.image_url ?? "");
  if (path) {
    await supabase.storage.from(PROJECT_PHOTOS_BUCKET).remove([path]);
  }

  revalidate();
  return { ok: true };
}
