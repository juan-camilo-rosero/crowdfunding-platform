import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SigningSubject } from "./types";

type Op = { table: string; method: string; payload?: unknown; filters: [string, unknown][] };

const ops: Op[] = [];
/** What the existing-contract lookup finds. */
let existing: { id: string } | null = null;
let insertError: { message: string } | null = null;

const createAdminClient = vi.fn(() => ({
  from: (table: string) => {
    const filters: [string, unknown][] = [];

    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        filters.push([column, value]);
        return builder;
      },
      limit: () => builder,
      maybeSingle: () => {
        ops.push({ table, method: "select", filters });
        return Promise.resolve({ data: existing, error: null });
      },
      single: () => {
        ops.push({ table, method: "insert-return", filters });
        return Promise.resolve({
          data: insertError ? null : { id: "doc-new" },
          error: insertError,
        });
      },
      insert: (payload: unknown) => {
        ops.push({ table, method: "insert", payload, filters });
        return builder;
      },
    };
    return builder;
  },
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => createAdminClient() }));

const createSigningRequest = vi.fn();
vi.mock("./provider", () => ({
  getEsignProvider: () => ({ name: "mock", createSigningRequest }),
}));

const { recordSignedContract, requestContractSignature, CONTRACT_DOC_TYPE } =
  await import("./contract");

const SUBJECT: SigningSubject = {
  userId: "user-1",
  investorId: "inv-1",
  documentName: "Contrato de inversión",
  signerEmail: "ana@ejemplo.com",
  signerName: "Ana Pérez",
};

const insertedDocument = () =>
  ops.find((op) => op.table === "documents" && op.method === "insert")?.payload as
    | Record<string, unknown>
    | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  ops.length = 0;
  existing = null;
  insertError = null;
  createSigningRequest.mockResolvedValue({
    status: "signed",
    envelopeId: "mock-1",
    fileUrl: "data:text/plain,contrato",
    signedAt: "2026-08-10T12:00:00.000Z",
  });
});

describe("the contract that gets filed", () => {
  it("belongs to the investor it was signed for, and only to them", async () => {
    await requestContractSignature(SUBJECT);

    expect(insertedDocument()).toMatchObject({
      investor_id: "inv-1",
      doc_type: CONTRACT_DOC_TYPE,
      visibility: "privado",
    });
  });

  it("is private, so no other investor can read it", async () => {
    await requestContractSignature(SUBJECT);
    // 'proyecto' or 'público' would expose it; the documents_select policy
    // grants a `privado` row only to its own investor.
    expect(insertedDocument()!.visibility).toBe("privado");
  });

  it("is typed 'contrato', which is what the progress derivation looks for", async () => {
    await requestContractSignature(SUBJECT);
    expect(insertedDocument()!.doc_type).toBe("contrato");
  });

  it("stores the signing date as a date, not a timestamp", async () => {
    await requestContractSignature(SUBJECT);
    // documents.date is a `date` column.
    expect(insertedDocument()!.date).toBe("2026-08-10");
  });

  it("carries the file the provider produced", async () => {
    await requestContractSignature(SUBJECT);
    expect(insertedDocument()!.file_url).toBe("data:text/plain,contrato");
  });
});

describe("signing twice", () => {
  it("does not create a second contract", async () => {
    existing = { id: "doc-old" };

    const result = await requestContractSignature(SUBJECT);

    expect(result).toEqual({ ok: true, kind: "already-signed", documentId: "doc-old" });
    expect(insertedDocument()).toBeUndefined();
    // The provider is not even asked: no envelope, no cost.
    expect(createSigningRequest).not.toHaveBeenCalled();
  });

  it("is idempotent at the recording step too, for a repeated webhook", async () => {
    existing = { id: "doc-old" };

    const result = await recordSignedContract({
      subject: SUBJECT,
      fileUrl: "data:text/plain,otro",
      signedAt: "2026-08-10T12:00:00.000Z",
    });

    expect(result).toEqual({ ok: true, kind: "already-signed", documentId: "doc-old" });
  });

  it("looks for the existing one by investor AND type", async () => {
    existing = { id: "doc-old" };
    await requestContractSignature(SUBJECT);

    const lookup = ops.find((op) => op.method === "select");
    expect(lookup!.filters).toEqual([
      ["investor_id", "inv-1"],
      ["doc_type", "contrato"],
    ]);
  });
});

describe("a real provider", () => {
  it("gets the signer details, and no document is filed yet", async () => {
    createSigningRequest.mockResolvedValue({
      status: "pending",
      envelopeId: "env-1",
      signingUrl: "https://esign.example/sign/env-1",
    });

    const result = await requestContractSignature(SUBJECT);

    expect(createSigningRequest).toHaveBeenCalledWith(SUBJECT);
    expect(result).toEqual({
      ok: true,
      kind: "pending",
      signingUrl: "https://esign.example/sign/env-1",
    });
    // Nothing is signed until the webhook says so.
    expect(insertedDocument()).toBeUndefined();
  });
});

describe("failures never escape as throws", () => {
  it("reports a provider failure", async () => {
    createSigningRequest.mockResolvedValue({ status: "failed", reason: "vendor down" });

    expect(await requestContractSignature(SUBJECT)).toEqual({
      ok: false,
      reason: "vendor down",
    });
  });

  it("reports a failed insert instead of claiming success", async () => {
    insertError = { message: "insert down" };

    const result = await requestContractSignature(SUBJECT);
    expect(result.ok).toBe(false);
  });
});
