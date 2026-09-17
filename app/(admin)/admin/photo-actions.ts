"use server";

import { revalidatePath } from "next/cache";
import { es } from "@/i18n";
import { createClient } from "@/lib/supabase/server";
import {
  MAX_PHOTO_BYTES,
  PROJECT_PHOTOS_BUCKET,
  buildPhotoPath,
  isAcceptedImage,
  photoPathFromUrl,
  type ProjectPhotosResult,
} from "@/lib/projects/photos";

const ADMIN_ROUTE = "/admin";
const CATALOG_ROUTE = "/portafolio";

/**
 * Adding and removing the photos of a project.
 *
 * These do NOT go through the batch save of the admin grid. That pipeline moves
 * scalar strings through a validating SQL function; a file upload and a text[]
 * are a different shape entirely, and forcing them in would have meant loosening
 * the validation every other column depends on.
 *
 * Every write runs on the SESSION-BOUND client, so two policies apply on top of
 * the explicit admin check here: projects_admin_write for the row and
 * project_photos_admin_* for the object. SUPABASE_SERVICE_ROLE_KEY appears in
 * neither function — it would bypass both.
 *
 * THE FILE ITSELF no longer travels through here by default: the browser puts
 * it in Storage directly (lib/projects/photo-upload.ts) and `attachProjectPhotos`
 * only writes the row. `uploadProjectPhotos` stays as the fallback for when that
 * direct call is refused, and is capped well under the serverless body limit.
 */

/** Refuses anyone who is not an admin. Returns their client when they are. */
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

/** Current photos of a project, so the caller edits from a fresh list. */
async function readPhotos(
  supabase: NonNullable<Awaited<ReturnType<typeof requireAdmin>>>,
  projectId: string
): Promise<string[] | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("main_photos")
    .eq("id", projectId)
    .maybeSingle();

  if (error || !data) return null;
  return data.main_photos ?? [];
}

/**
 * Every screen that shows a project photo, so a change is visible wherever it
 * is looked at rather than only in the panel it was made from.
 */
function revalidateProject(projectId: string) {
  revalidatePath(ADMIN_ROUTE);
  revalidatePath(CATALOG_ROUTE);
  revalidatePath(`/proyecto/${projectId}`);
}

/**
 * Attaches photos ALREADY IN STORAGE to a project.
 *
 * The urls are checked against our own bucket before being written: this action
 * takes strings from the browser, and a url pointing anywhere else would turn
 * the gallery into a way of rendering a third party's content from our pages.
 */
export async function attachProjectPhotos(input: {
  projectId: string;
  urls: string[];
}): Promise<ProjectPhotosResult> {
  const supabase = await requireAdmin();
  if (!supabase) {
    return { ok: false, error: es.admin.photos.errors.notAdmin };
  }

  const { projectId, urls } = input;

  if (!projectId || urls.length === 0) {
    return { ok: false, error: es.admin.photos.errors.noFile };
  }
  if (urls.some((url) => photoPathFromUrl(url) === null)) {
    return { ok: false, error: es.admin.photos.errors.saveFailed };
  }

  const current = await readPhotos(supabase, projectId);
  if (current === null) {
    return { ok: false, error: es.admin.photos.errors.projectNotFound };
  }

  // A url already on the list means the same photo was attached twice; keeping
  // one copy is what the gallery expects.
  const photos = [...current, ...urls.filter((url) => !current.includes(url))];

  const { error } = await supabase
    .from("projects")
    .update({ main_photos: photos, updated_at: new Date().toISOString() })
    .eq("id", projectId);

  if (error) {
    return { ok: false, error: es.admin.photos.errors.saveFailed };
  }

  revalidateProject(projectId);
  return { ok: true, photos };
}

/**
 * FALLBACK upload: the file travels inside the action's request body.
 *
 * Only used when the browser could not reach Storage directly, and only for
 * files under the serverless body limit — over it the platform cuts the request
 * off before this code ever runs.
 */
export async function uploadProjectPhotos(
  formData: FormData
): Promise<ProjectPhotosResult> {
  const supabase = await requireAdmin();
  if (!supabase) {
    return { ok: false, error: es.admin.photos.errors.notAdmin };
  }

  const projectId = formData.get("projectId")?.toString() ?? "";
  const files = formData.getAll("files");

  if (
    !projectId ||
    files.length === 0 ||
    files.some((file) => !(file instanceof File) || file.size === 0)
  ) {
    return { ok: false, error: es.admin.photos.errors.noFile };
  }
  if (files.some((file) => file instanceof File && !isAcceptedImage(file.type))) {
    return { ok: false, error: es.admin.photos.errors.badType };
  }
  if (files.some((file) => file instanceof File && file.size > MAX_PHOTO_BYTES)) {
    return { ok: false, error: es.admin.photos.errors.tooLarge };
  }

  // Read the row FIRST: it proves the project exists and is visible, and gives
  // the list to append to.
  const current = await readPhotos(supabase, projectId);
  if (current === null) {
    return { ok: false, error: es.admin.photos.errors.projectNotFound };
  }

  const uploaded: { path: string; publicUrl: string }[] = [];

  for (const file of files) {
    if (!(file instanceof File)) continue;

    const path = buildPhotoPath(projectId, file.name);

    const { error: uploadError } = await supabase.storage
      .from(PROJECT_PHOTOS_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      await supabase.storage
        .from(PROJECT_PHOTOS_BUCKET)
        .remove(uploaded.map((photo) => photo.path));
      return { ok: false, error: es.admin.photos.errors.uploadFailed };
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(PROJECT_PHOTOS_BUCKET).getPublicUrl(path);

    uploaded.push({ path, publicUrl });
  }

  const photos = [...current, ...uploaded.map((photo) => photo.publicUrl)];

  const { error: updateError } = await supabase
    .from("projects")
    .update({ main_photos: photos, updated_at: new Date().toISOString() })
    .eq("id", projectId);

  if (updateError) {
    // The row is the source of truth, so an orphaned object is worse than no
    // photo: undo the uploads rather than leave files nothing points at.
    await supabase.storage
      .from(PROJECT_PHOTOS_BUCKET)
      .remove(uploaded.map((photo) => photo.path));
    return { ok: false, error: es.admin.photos.errors.saveFailed };
  }

  revalidateProject(projectId);
  return { ok: true, photos };
}

/** Removes one photo from the project, and its object when we own it. */
export async function removeProjectPhoto(input: {
  projectId: string;
  url: string;
}): Promise<ProjectPhotosResult> {
  const supabase = await requireAdmin();
  if (!supabase) {
    return { ok: false, error: es.admin.photos.errors.notAdmin };
  }

  const { projectId, url } = input;
  const current = await readPhotos(supabase, projectId);
  if (current === null) {
    return { ok: false, error: es.admin.photos.errors.projectNotFound };
  }

  const photos = current.filter((photo) => photo !== url);

  const { error } = await supabase
    .from("projects")
    .update({ main_photos: photos, updated_at: new Date().toISOString() })
    .eq("id", projectId);

  if (error) {
    return { ok: false, error: es.admin.photos.errors.saveFailed };
  }

  // Only objects of our own bucket are deleted; an external URL is simply
  // unlinked, since we did not put it there and may not own it.
  const path = photoPathFromUrl(url);
  if (path) {
    await supabase.storage.from(PROJECT_PHOTOS_BUCKET).remove([path]);
  }

  revalidateProject(projectId);
  return { ok: true, photos };
}

/**
 * Makes one photo the cover, by moving it to the front of the list.
 *
 * The catalogue and the gallery both read main_photos[0], so the cover IS the
 * order. Before this the only way to change it was to delete every photo ahead
 * of the one you wanted — with seven photos, seven deletions and seven
 * re-uploads. Nothing is uploaded or removed here; only the order changes.
 */
export async function setProjectCoverPhoto(input: {
  projectId: string;
  url: string;
}): Promise<ProjectPhotosResult> {
  const supabase = await requireAdmin();
  if (!supabase) {
    return { ok: false, error: es.admin.photos.errors.notAdmin };
  }

  const { projectId, url } = input;
  const current = await readPhotos(supabase, projectId);
  if (current === null) {
    return { ok: false, error: es.admin.photos.errors.projectNotFound };
  }

  // A url that is not on the list would silently reorder nothing; say so.
  if (!current.includes(url)) {
    return { ok: false, error: es.admin.photos.errors.photoNotFound };
  }

  const photos = [url, ...current.filter((photo) => photo !== url)];

  const { error } = await supabase
    .from("projects")
    .update({ main_photos: photos, updated_at: new Date().toISOString() })
    .eq("id", projectId);

  if (error) {
    return { ok: false, error: es.admin.photos.errors.saveFailed };
  }

  revalidateProject(projectId);
  return { ok: true, photos };
}
