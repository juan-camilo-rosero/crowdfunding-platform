import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { es } from "@/i18n";
import { MAX_PHOTO_BYTES, MAX_SERVER_UPLOAD_BYTES } from "@/lib/projects/photos";

/**
 * The failure this screen exists to avoid: an upload that never answers used to
 * leave the dialog on "Subiendo…" with no way out but reloading the page, which
 * took every unsaved edit in the panel behind it.
 */

const uploadPhotosToStorage = vi.fn();
const removeUploadedObjects = vi.fn();
const attachProjectPhotos = vi.fn();
const uploadProjectPhotos = vi.fn();
const removeProjectPhoto = vi.fn();
const setProjectCoverPhoto = vi.fn();

vi.mock("@/lib/projects/photo-upload", () => ({
  uploadPhotosToStorage: (...args: unknown[]) => uploadPhotosToStorage(...args),
  removeUploadedObjects: (...args: unknown[]) => removeUploadedObjects(...args),
}));

vi.mock("@/app/(admin)/admin/photo-actions", () => ({
  attachProjectPhotos: (...args: unknown[]) => attachProjectPhotos(...args),
  uploadProjectPhotos: (...args: unknown[]) => uploadProjectPhotos(...args),
  removeProjectPhoto: (...args: unknown[]) => removeProjectPhoto(...args),
  setProjectCoverPhoto: (...args: unknown[]) => setProjectCoverPhoto(...args),
}));

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={String(props.src)} alt={String(props.alt ?? "")} />
  ),
}));

const { ProjectPhotosDialog } = await import("./ProjectPhotosDialog");

const BUCKET_URL =
  "https://abc.supabase.co/storage/v1/object/public/project-photos";

function file(name: string, { size = 1024, type = "image/jpeg" } = {}) {
  const item = new File(["x"], name, { type });
  Object.defineProperty(item, "size", { value: size });
  return item;
}

function renderDialog(props: Record<string, unknown> = {}) {
  const onOpenChange = vi.fn();
  render(
    <ProjectPhotosDialog
      projectId="p-1"
      projectName="Villa Rotonda"
      initialPhotos={[]}
      open
      onOpenChange={onOpenChange}
      {...props}
    />
  );
  return { onOpenChange };
}

/** Picks files through the hidden input, as the button does. */
async function pick(user: ReturnType<typeof userEvent.setup>, files: File[]) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  await user.upload(input!, files);
}

/**
 * A user whose picker did NOT filter by type.
 *
 * The `accept` attribute is a convenience, not a guarantee — several platforms
 * let the user switch the picker to "all files", and a file can always be
 * dropped in — so the component has to refuse the file itself.
 */
const unfilteredUser = () => userEvent.setup({ applyAccept: false });

beforeEach(() => {
  vi.clearAllMocks();
  uploadPhotosToStorage.mockResolvedValue({
    ok: true,
    uploaded: [{ path: "p-1/a.jpg", publicUrl: `${BUCKET_URL}/p-1/a.jpg` }],
  });
  attachProjectPhotos.mockResolvedValue({
    ok: true,
    photos: [`${BUCKET_URL}/p-1/a.jpg`],
  });
  removeUploadedObjects.mockResolvedValue(undefined);
});

describe("files the browser refuses before uploading anything", () => {
  it("names the file that is too heavy", async () => {
    const user = userEvent.setup();
    renderDialog();

    await pick(user, [file("fachada.jpg", { size: MAX_PHOTO_BYTES + 1 })]);

    expect(await screen.findByRole("alert")).toHaveTextContent("fachada.jpg");
    expect(uploadPhotosToStorage).not.toHaveBeenCalled();
  });

  it("names the file of the wrong type", async () => {
    const user = unfilteredUser();
    renderDialog();

    await pick(user, [file("planos.pdf", { type: "application/pdf" })]);

    expect(await screen.findByRole("alert")).toHaveTextContent("planos.pdf");
    expect(uploadPhotosToStorage).not.toHaveBeenCalled();
  });

  it("refuses the whole selection when one file is invalid", async () => {
    const user = unfilteredUser();
    renderDialog();

    await pick(user, [
      file("buena.jpg"),
      file("mala.gif", { type: "image/gif" }),
    ]);

    expect(await screen.findByRole("alert")).toHaveTextContent("mala.gif");
    expect(uploadPhotosToStorage).not.toHaveBeenCalled();
  });
});

describe("when the direct upload does not work", () => {
  it("falls back to the Server Action for a small file", async () => {
    const user = userEvent.setup();
    uploadPhotosToStorage.mockResolvedValue({
      ok: false,
      uploaded: [],
      failedFile: "fachada.jpg",
    });
    uploadProjectPhotos.mockResolvedValue({
      ok: true,
      photos: [`${BUCKET_URL}/p-1/a.jpg`],
    });

    renderDialog();
    await pick(user, [file("fachada.jpg", { size: 1024 })]);

    await waitFor(() => expect(uploadProjectPhotos).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does NOT retry a file too big for a Server Action body, and says which", async () => {
    const user = userEvent.setup();
    uploadPhotosToStorage.mockResolvedValue({
      ok: false,
      uploaded: [],
      failedFile: "enorme.jpg",
    });

    renderDialog();
    await pick(user, [file("enorme.jpg", { size: MAX_SERVER_UPLOAD_BYTES + 1 })]);

    expect(await screen.findByRole("alert")).toHaveTextContent("enorme.jpg");
    // Sending it would only fail again, after uploading the whole thing.
    expect(uploadProjectPhotos).not.toHaveBeenCalled();
  });

  it("cleans up objects whose project row was never updated", async () => {
    const user = userEvent.setup();
    attachProjectPhotos.mockResolvedValue({
      ok: false,
      error: es.admin.photos.errors.saveFailed,
    });

    renderDialog();
    await pick(user, [file("fachada.jpg")]);

    await waitFor(() => expect(removeUploadedObjects).toHaveBeenCalledWith(["p-1/a.jpg"]));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      es.admin.photos.errors.saveFailed
    );
  });

  it("turns a thrown upload into a message instead of a frozen dialog", async () => {
    const user = userEvent.setup();
    uploadPhotosToStorage.mockRejectedValue(new Error("boom"));

    renderDialog();
    await pick(user, [file("fachada.jpg")]);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      es.admin.photos.errors.unexpected
    );
    // And the upload button is usable again, not stuck on its loading label.
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: new RegExp(es.admin.photos.addLabel) })
      ).toBeEnabled()
    );
  });
});

describe("the dialog can always be left", () => {
  it("closes even while an upload is in flight", async () => {
    const user = userEvent.setup();
    // Never resolves: the worst case this screen was built around.
    uploadPhotosToStorage.mockImplementation(() => new Promise(() => {}));

    const { onOpenChange } = renderDialog();
    await pick(user, [file("fachada.jpg")]);

    await user.click(
      screen.getByRole("button", { name: es.admin.photos.close })
    );

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("photos already on the project", () => {
  it("marks the first one as the cover and offers to promote the others", async () => {
    const user = userEvent.setup();
    setProjectCoverPhoto.mockResolvedValue({
      ok: true,
      photos: [`${BUCKET_URL}/b.jpg`, `${BUCKET_URL}/a.jpg`],
    });

    renderDialog({
      initialPhotos: [`${BUCKET_URL}/a.jpg`, `${BUCKET_URL}/b.jpg`],
    });

    expect(screen.getByText(es.admin.photos.coverBadge)).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: es.admin.photos.makeCoverLabel })
    );

    await waitFor(() =>
      expect(setProjectCoverPhoto).toHaveBeenCalledWith({
        projectId: "p-1",
        url: `${BUCKET_URL}/b.jpg`,
      })
    );
  });

  it("reports a removal the server refused, and keeps the photo listed", async () => {
    const user = userEvent.setup();
    removeProjectPhoto.mockResolvedValue({
      ok: false,
      error: es.admin.photos.errors.notAdmin,
    });

    renderDialog({ initialPhotos: [`${BUCKET_URL}/a.jpg`] });

    await user.click(
      screen.getByRole("button", { name: es.admin.photos.removeLabel })
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      es.admin.photos.errors.notAdmin
    );
    // A decorative photo carries an empty alt, so it is queried by tag.
    expect(document.querySelectorAll("img")).toHaveLength(1);
  });
});
