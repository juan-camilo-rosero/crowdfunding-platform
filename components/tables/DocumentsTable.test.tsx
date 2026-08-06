import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { es } from "@/i18n";
import { formatDate } from "@/lib/format";
import { DOCUMENT_TYPES } from "@/lib/documents/types";
import type { TableColumn, TableRow } from "@/lib/table/types";
import { ReadOnlyDataTable } from "./ReadOnlyDataTable";

/**
 * The documents table is ReadOnlyDataTable with the screen's columns and cell
 * renderers. These tests exercise that combination — the mapping and the action
 * column — without booting the Server Component.
 */

const COLUMNS: TableColumn[] = [
  { key: "docType", label: es.documents.columns.docType, type: "select" },
  { key: "projectName", label: es.documents.columns.project, type: "text" },
  { key: "date", label: es.documents.columns.date, type: "date" },
  { key: "download", label: es.documents.columns.download, type: "action" },
];

const ROWS: TableRow[] = [
  { id: "d1", docType: "deed", projectName: "Villa Rotonda 118", date: "2026-06-30", name: "Escritura" },
  { id: "d2", docType: "operating agreement", projectName: es.documents.noProject, date: "2026-01-05", name: "Acuerdo" },
];

/** Mirrors the page's renderCell, minus the client-only button. */
const renderCell = (row: TableRow, column: TableColumn) => {
  if (column.key === "docType") {
    const type = row.docType ? String(row.docType) : null;
    return type ? (es.documents.type[type] ?? type) : "";
  }
  if (column.key === "date") {
    return row.date ? formatDate(String(row.date)) : "";
  }
  if (column.key === "download") {
    return <button type="button">{es.documents.download}</button>;
  }
  return undefined;
};

const renderTable = (rows = ROWS) =>
  render(
    <ReadOnlyDataTable
      caption={es.documents.tableCaption}
      columns={COLUMNS}
      rows={rows}
      renderCell={renderCell}
      emptyState={<p>{es.documents.empty}</p>}
    />
  );

describe("documents table — headers and mapping", () => {
  it("renders the four headers in order", () => {
    renderTable();

    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Tipo de documento",
      "Nombre del proyecto",
      "Fecha",
      "Descargar",
    ]);
  });

  it("maps doc_type to a Spanish label, never the raw stored value", () => {
    renderTable();

    expect(screen.getByText("Escritura")).toBeInTheDocument();
    expect(screen.queryByText("deed")).not.toBeInTheDocument();
    expect(screen.getByText("Acuerdo operativo")).toBeInTheDocument();
    expect(screen.queryByText("operating agreement")).not.toBeInTheDocument();
  });

  it("has a Spanish label for EVERY value the schema allows", () => {
    for (const type of DOCUMENT_TYPES) {
      expect(es.documents.type[type], `missing label for "${type}"`).toBeTruthy();
    }
  });

  it("shows 'General' for a document with no project", () => {
    renderTable();
    expect(screen.getByText("General")).toBeInTheDocument();
  });

  it("formats the date with the project helper", () => {
    renderTable();
    expect(screen.getByText("30 jun 2026")).toBeInTheDocument();
    expect(screen.getByText("5 ene 2026")).toBeInTheDocument();
  });

  it("never renders a raw id", () => {
    const { container } = renderTable();
    expect(container.textContent).not.toContain("d1");
  });
});

describe("documents table — action column", () => {
  it("renders a control in the download column, one per row", () => {
    renderTable();

    const buttons = screen.getAllByRole("button", { name: es.documents.download });
    expect(buttons).toHaveLength(ROWS.length);
  });

  it("the action column is the only one with a control", () => {
    renderTable();

    // No editing controls leaked in from the editable grid.
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(document.querySelectorAll("input, select, textarea")).toHaveLength(0);
  });

  it("has no insert row: rows match the data exactly", () => {
    renderTable();

    expect(screen.getAllByRole("row").slice(1)).toHaveLength(ROWS.length);
    expect(screen.queryByText("+")).not.toBeInTheDocument();
  });
});

describe("documents table — empty state", () => {
  it("shows the exact copy from views.md when there is nothing", () => {
    renderTable([]);

    expect(
      screen.getByText("Aún no tienes documentos disponibles")
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
