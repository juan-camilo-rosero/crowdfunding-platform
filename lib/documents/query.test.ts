import { describe, expect, it } from "vitest";
import { es } from "@/i18n";
import {
  fetchDocumentFilterOptions,
  fetchInvestorDocuments,
  type DocumentsClient,
} from "./query";
import { DOCUMENT_PARAMS, parseDocumentFilters } from "./params";
import { NO_PROJECT } from "./types";

type Call = { method: string; args: unknown[] };

/** Records every chained call and resolves with the rows it was given. */
function mockClient(rows: unknown[], error: unknown = null) {
  const calls: Call[] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is", "order"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  builder.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve({ data: rows, error }).then(resolve);

  return {
    client: { from: () => builder } as unknown as DocumentsClient,
    calls,
  };
}

const ROWS = [
  { id: "d1", name: "Escritura", doc_type: "deed", date: "2026-06-30", project_id: "p1", projects: { id: "p1", name: "Villa Rotonda 118" } },
  { id: "d2", name: "Survey", doc_type: "survey", date: "2026-04-22", project_id: "p2", projects: { id: "p2", name: "North Port Lote 7" } },
  { id: "d3", name: "Certificado", doc_type: "certificado de aporte", date: "2026-01-05", project_id: null, projects: null },
];

const findCall = (calls: Call[], method: string, column: string) =>
  calls.find((c) => c.method === method && c.args[0] === column);

describe("fetchInvestorDocuments — scoping", () => {
  it("adds NO scope clause of its own: RLS is the single definition", async () => {
    const { client, calls } = mockClient(ROWS);
    await fetchInvestorDocuments(client);

    // No investor_id / visibility filter is re-implemented here. Re-stating the
    // policy in a WHERE clause would create a second rule to keep in sync.
    expect(findCall(calls, "eq", "investor_id")).toBeUndefined();
    expect(findCall(calls, "eq", "visibility")).toBeUndefined();
  });

  it("a forged project id only narrows: it cannot add rows", async () => {
    const { client, calls } = mockClient([]);
    const result = await fetchInvestorDocuments(client, {
      projectId: "project-of-another-investor",
    });

    expect(findCall(calls, "eq", "project_id")!.args[1]).toBe(
      "project-of-another-investor"
    );
    // Whatever RLS returned is all there is; here, nothing.
    expect(result.documents).toEqual([]);
  });

  it("orders by date, newest first", async () => {
    const { client, calls } = mockClient(ROWS);
    await fetchInvestorDocuments(client);

    expect(findCall(calls, "order", "date")!.args[1]).toEqual({
      ascending: false,
    });
  });
});

describe("fetchInvestorDocuments — filtering", () => {
  it("filters by project id", async () => {
    const { client, calls } = mockClient([ROWS[0]]);
    const result = await fetchInvestorDocuments(client, { projectId: "p1" });

    expect(findCall(calls, "eq", "project_id")!.args[1]).toBe("p1");
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].projectName).toBe("Villa Rotonda 118");
  });

  it("the 'General' option selects rows with NO project", async () => {
    const { client, calls } = mockClient([ROWS[2]]);
    const result = await fetchInvestorDocuments(client, {
      projectId: NO_PROJECT,
    });

    // IS NULL, not = 'general'.
    expect(findCall(calls, "is", "project_id")!.args[1]).toBeNull();
    expect(findCall(calls, "eq", "project_id")).toBeUndefined();
    expect(result.documents[0].projectName).toBe(es.documents.noProject);
  });

  it("applies no filter when none is chosen", async () => {
    const { client, calls } = mockClient(ROWS);
    const result = await fetchInvestorDocuments(client, { projectId: null });

    expect(findCall(calls, "eq", "project_id")).toBeUndefined();
    expect(findCall(calls, "is", "project_id")).toBeUndefined();
    expect(result.documents).toHaveLength(3);
  });

  it("a combination with no matches returns an empty list, not a failure", async () => {
    const { client } = mockClient([]);
    const result = await fetchInvestorDocuments(client, { projectId: "p9" });

    expect(result.documents).toEqual([]);
    expect(result.failed).toBe(false);
  });
});

describe("fetchInvestorDocuments — mapping", () => {
  it("labels a document with no project as 'General', never blank or an id", async () => {
    const { client } = mockClient(ROWS);
    const { documents } = await fetchInvestorDocuments(client);

    expect(documents[2].projectName).toBe("General");
    expect(documents[2].projectName).not.toBe("");
    expect(documents[2].projectId).toBeNull();
  });

  it("joins the project name instead of exposing the raw id", async () => {
    const { client } = mockClient(ROWS);
    const { documents } = await fetchInvestorDocuments(client);

    expect(documents[0].projectName).toBe("Villa Rotonda 118");
  });

  it("accepts an embedded project delivered as an array", async () => {
    const { client } = mockClient([
      { ...ROWS[0], projects: [{ id: "p1", name: "Villa Rotonda 118" }] },
    ]);
    const { documents } = await fetchInvestorDocuments(client);

    expect(documents[0].projectName).toBe("Villa Rotonda 118");
  });

  it("reports failure instead of pretending there are no documents", async () => {
    const { client } = mockClient([], { message: "network down" });
    const result = await fetchInvestorDocuments(client);

    expect(result.failed).toBe(true);
    expect(result.documents).toEqual([]);
  });
});

describe("fetchDocumentFilterOptions", () => {
  it("offers only projects present in the caller's own documents", async () => {
    const { client } = mockClient(ROWS);
    const { projectOptions } = await fetchDocumentFilterOptions(client);

    expect(projectOptions).toEqual([
      { id: "p2", name: "North Port Lote 7" },
      { id: "p1", name: "Villa Rotonda 118" },
    ]);
  });

  it("flags that a 'General' option is worth offering", async () => {
    const { client } = mockClient(ROWS);
    expect((await fetchDocumentFilterOptions(client)).hasUnassigned).toBe(true);
  });

  it("does not offer 'General' when every document has a project", async () => {
    const { client } = mockClient([ROWS[0], ROWS[1]]);
    expect((await fetchDocumentFilterOptions(client)).hasUnassigned).toBe(false);
  });

  it("reports the total, which is what tells an empty screen from an empty filter", async () => {
    const { client } = mockClient(ROWS);
    expect((await fetchDocumentFilterOptions(client)).total).toBe(3);

    const { client: none } = mockClient([]);
    expect((await fetchDocumentFilterOptions(none)).total).toBe(0);
  });
});

describe("parseDocumentFilters", () => {
  it("reads the project from the URL", () => {
    expect(
      parseDocumentFilters({ [DOCUMENT_PARAMS.project]: "p1" })
    ).toEqual({ projectId: "p1" });
  });

  it("keeps the 'General' sentinel", () => {
    expect(
      parseDocumentFilters({ [DOCUMENT_PARAMS.project]: NO_PROJECT }).projectId
    ).toBe(NO_PROJECT);
  });

  it("treats an absent or blank param as no filter", () => {
    expect(parseDocumentFilters({}).projectId).toBeNull();
    expect(
      parseDocumentFilters({ [DOCUMENT_PARAMS.project]: "  " }).projectId
    ).toBeNull();
  });

  it("takes the first value when the param is repeated", () => {
    expect(
      parseDocumentFilters({ [DOCUMENT_PARAMS.project]: ["p1", "p2"] }).projectId
    ).toBe("p1");
  });
});
