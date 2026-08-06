import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * THE test that must never fail: asking for somebody else's document must be
 * denied, and no signed URL may ever be minted for it.
 *
 * RLS is simulated the way it really behaves — a row the caller may not read
 * simply does not come back — so what is under test is our handler's reaction
 * to that, which is the part we own.
 */

const createSignedUrl = vi.fn();
const getUser = vi.fn();
const maybeSingle = vi.fn();
const eqSpy = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => ({
      select: () => ({
        eq: (column: string, value: unknown) => {
          eqSpy(column, value);
          return { maybeSingle };
        },
      }),
    }),
    storage: { from: () => ({ createSignedUrl }) },
  }),
}));

const { GET } = await import("./route");

const call = (id: string) =>
  GET({} as never, { params: Promise.resolve({ id }) });

const SIGNED = "https://abc.supabase.co/storage/v1/object/sign/documents/a.pdf?token=fresh";

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "user-a" } } });
  createSignedUrl.mockResolvedValue({ data: { signedUrl: SIGNED }, error: null });
});

describe("download entitlement", () => {
  it("denies a document RLS does not return, and signs NOTHING", async () => {
    // This is what RLS does to another investor's private document.
    maybeSingle.mockResolvedValue({ data: null, error: null });

    const response = await call("document-of-another-investor");

    expect(response.status).toBe(404);
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("answers a forbidden id exactly like an unknown one", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });

    const forbidden = await call("forbidden-id");
    const unknown = await call("does-not-exist");

    // Same status and same body: the endpoint cannot be used to probe which
    // documents exist.
    expect(forbidden.status).toBe(unknown.status);
    expect(await forbidden.json()).toEqual(await unknown.json());
  });

  it("rejects an unauthenticated caller before touching the table", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const response = await call("any-id");

    expect(response.status).toBe(401);
    expect(maybeSingle).not.toHaveBeenCalled();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("looks the document up BY ID, never by a path from the client", async () => {
    maybeSingle.mockResolvedValue({
      data: { id: "d1", name: "Escritura", file_url: "p/a.pdf" },
      error: null,
    });

    await call("d1");

    expect(eqSpy).toHaveBeenCalledWith("id", "d1");
    // The only thing that reached storage is the path stored on the row.
    expect(createSignedUrl).toHaveBeenCalledWith("p/a.pdf", expect.any(Number));
  });
});

describe("download resolution, once entitled", () => {
  it("signs a short-lived URL for a file in the private bucket", async () => {
    maybeSingle.mockResolvedValue({
      data: { id: "d1", name: "Escritura", file_url: "proyecto-1/a.pdf" },
      error: null,
    });

    const response = await call("d1");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: SIGNED, name: "Escritura" });
    const [, ttl] = createSignedUrl.mock.calls[0];
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(300);
  });

  it("returns an external Drive link as-is, without signing", async () => {
    const url = "https://drive.google.com/file/d/abc/view";
    maybeSingle.mockResolvedValue({
      data: { id: "d2", name: "Contrato", file_url: url },
      error: null,
    });

    const response = await call("d2");

    expect(await response.json()).toEqual({ url, name: "Contrato" });
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("reports a row with no file instead of failing opaquely", async () => {
    maybeSingle.mockResolvedValue({
      data: { id: "d3", name: "Sin archivo", file_url: null },
      error: null,
    });

    const response = await call("d3");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "no-file" });
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("does not leak a URL when signing fails", async () => {
    maybeSingle.mockResolvedValue({
      data: { id: "d4", name: "Planos", file_url: "p/a.pdf" },
      error: null,
    });
    createSignedUrl.mockResolvedValue({ data: null, error: { message: "nope" } });

    const response = await call("d4");

    expect(response.status).toBe(502);
    expect(await response.json()).not.toHaveProperty("url");
  });

  it("surfaces a lookup failure as an error, not as 'not found'", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: "down" } });

    const response = await call("d5");

    expect(response.status).toBe(502);
    expect(createSignedUrl).not.toHaveBeenCalled();
  });
});
