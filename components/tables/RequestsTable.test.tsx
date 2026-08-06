import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { es } from "@/i18n";
import { formatDate } from "@/lib/format";
import { REQUEST_STATUSES, requestStatusVariant } from "@/lib/requests/types";
import type { TableColumn, TableRow } from "@/lib/table/types";
import { Badge } from "@/components/ui/badge";
import { ReadOnlyDataTable } from "./ReadOnlyDataTable";

/**
 * The requests table is ReadOnlyDataTable with this screen's columns and cell
 * renderers. These tests exercise that combination — the status chip above
 * all — without booting the Server Component.
 */

const COLUMNS: TableColumn[] = [
  { key: "requestedAt", label: es.requests.columns.date, type: "date" },
  { key: "fromProjectName", label: es.requests.columns.from, type: "text" },
  { key: "toProjectName", label: es.requests.columns.to, type: "text" },
  { key: "amount", label: es.requests.columns.amount, type: "currency" },
  { key: "status", label: es.requests.columns.status, type: "select" },
];

const ROWS: TableRow[] = [
  { id: "r1", requestedAt: "2026-06-30", fromProjectName: "Villa Rotonda 118", toProjectName: "North Port Lote 7", amount: 15000, status: "pendiente" },
  { id: "r2", requestedAt: "2026-04-10", fromProjectName: "North Port Lote 7", toProjectName: "Punta Gorda Lote 9", amount: 8000, status: "aprobada" },
  { id: "r3", requestedAt: "2026-01-05", fromProjectName: "Villa Rotonda 118", toProjectName: "North Port Lote 7", amount: 3000, status: "rechazada" },
];

/** Mirrors the page's renderCell. */
const renderCell = (row: TableRow, column: TableColumn) => {
  if (column.key === "requestedAt") {
    return row.requestedAt ? formatDate(String(row.requestedAt)) : "";
  }
  if (column.key === "status") {
    const status = row.status ? String(row.status) : null;
    if (!status) return "";
    return (
      <Badge variant={requestStatusVariant(status)}>
        {es.requests.status[status] ?? status}
      </Badge>
    );
  }
  return undefined;
};

const renderTable = (rows = ROWS) =>
  render(
    <ReadOnlyDataTable
      caption={es.requests.tableCaption}
      columns={COLUMNS}
      rows={rows}
      renderCell={renderCell}
      emptyState={<p>{es.requests.empty}</p>}
    />
  );

describe("requests table — headers and mapping", () => {
  it("renders the five headers in order", () => {
    renderTable();

    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Fecha",
      "Origen",
      "Destino",
      "Monto",
      "Estado",
    ]);
  });

  it("shows project NAMES for both origin and destination, never ids", () => {
    const { container } = renderTable();

    expect(screen.getAllByText("Villa Rotonda 118")).toHaveLength(2);
    expect(screen.getByText("Punta Gorda Lote 9")).toBeInTheDocument();
    expect(container.textContent).not.toContain("p1");
    expect(container.textContent).not.toContain("r1");
  });

  it("formats currency with the project helper", () => {
    renderTable();

    expect(screen.getByText("$15,000")).toBeInTheDocument();
    expect(screen.getByText("$8,000")).toBeInTheDocument();
  });

  it("formats the date with the project helper", () => {
    renderTable();

    expect(screen.getByText("30 jun 2026")).toBeInTheDocument();
    expect(screen.getByText("5 ene 2026")).toBeInTheDocument();
  });
});

describe("requests table — status chip", () => {
  it("renders each status as a Badge with its own variant", () => {
    renderTable();

    const badges = document.querySelectorAll('[data-slot="badge"]');
    expect(badges).toHaveLength(3);
    expect([...badges].map((b) => b.getAttribute("data-variant"))).toEqual([
      "warning", // pendiente
      "success", // aprobada
      "danger", // rechazada
    ]);
  });

  it("shows the Spanish TEXT next to the colour, not colour alone", () => {
    renderTable();

    expect(screen.getByText("Pendiente")).toBeInTheDocument();
    expect(screen.getByText("Aprobada")).toBeInTheDocument();
    expect(screen.getByText("Rechazada")).toBeInTheDocument();
  });

  it("colours come from status tokens, never inline hex or palette classes", () => {
    renderTable();

    for (const badge of document.querySelectorAll('[data-slot="badge"]')) {
      const className = badge.getAttribute("class") ?? "";
      // Token-based utilities only.
      expect(className).toMatch(/bg-status-(success|warning|danger|neutral)/);
      expect(className).toMatch(
        /text-status-(success|warning|danger|neutral)-foreground/
      );
      // Nothing hardcoded.
      expect(badge.getAttribute("style")).toBeNull();
      expect(className).not.toMatch(/#[0-9a-f]{3,6}/i);
      expect(className).not.toMatch(/\b(bg|text)-(red|green|amber|yellow|gray)-\d/);
    }
  });

  it("every schema status maps to a meaningful, distinct variant", () => {
    const variants = REQUEST_STATUSES.map(requestStatusVariant);
    expect(new Set(variants).size).toBe(REQUEST_STATUSES.length);
    expect(variants).not.toContain("neutral");
  });
});

describe("requests table — read only and empty", () => {
  it("renders no editing controls", () => {
    renderTable();

    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(document.querySelectorAll("input, select, textarea")).toHaveLength(0);
    expect(screen.getAllByRole("row").slice(1)).toHaveLength(ROWS.length);
    expect(screen.queryByText("+")).not.toBeInTheDocument();
  });

  it("shows the empty state instead of an empty table", () => {
    renderTable([]);

    expect(screen.getByText(es.requests.empty)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
