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
 * Uploads one image and appends its public URL to the project.
 *
 * The file is taken from FormData rather than a JSON body because that is the
 * only way a File survives the trip to a Server Action.
 */
export async function uploadProjectPhoto(
  formData: FormData
): Promise<ProjectPhotosResult> {
  const batchFormData = new FormData();
  const projectId = formData.get("projectId")?.toString() ?? "";
  const file = formData.get("file");

  batchFormData.append("projectId", projectId);
  if (file) batchFormData.append("files", file);

  return uploadProjectPhotos(batchFormData);
}

/**
 * Uploads one or more images and appends their public URLs to the project.
 *
 * The project row is updated once, after all object uploads succeed, so a
 * multi-photo selection cannot overwrite itself with competing writes.
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

  revalidatePath(ADMIN_ROUTE);
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

  revalidatePath(ADMIN_ROUTE);
  return { ok: true, photos };
}
