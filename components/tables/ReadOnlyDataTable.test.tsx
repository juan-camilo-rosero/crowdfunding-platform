import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { es } from "@/i18n";
import type { TableColumn, TableRow } from "@/lib/table/types";
import { ReadOnlyDataTable } from "./ReadOnlyDataTable";

const COLUMNS: TableColumn[] = [
  { key: "date", label: es.transactions.columns.date, type: "date" },
  { key: "projectName", label: es.transactions.columns.project, type: "text" },
  { key: "type", label: es.transactions.columns.type, type: "select" },
  { key: "amount", label: es.transactions.columns.amount, type: "currency" },
];

const ROWS: TableRow[] = [
  { id: "t1", date: "2026-03-27", projectName: "Villa Rotonda 118", type: "aporte", amount: 45926 },
  { id: "t2", date: "2026-01-05", projectName: "North Port Lote 7", type: "rendimiento", amount: 1500 },
];

describe("ReadOnlyDataTable — rendering", () => {
  it("renders the headers in the given order", () => {
    render(<ReadOnlyDataTable caption="Movimientos" columns={COLUMNS} rows={ROWS} />);

    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual(["Fecha", "Proyecto", "Tipo", "Monto"]);
  });

  it("renders one row per record", () => {
    render(<ReadOnlyDataTable caption="Movimientos" columns={COLUMNS} rows={ROWS} />);

    // +1 for the header row.
    expect(screen.getAllByRole("row")).toHaveLength(ROWS.length + 1);
  });

  it("formats currency through the project helper", () => {
    render(<ReadOnlyDataTable caption="Movimientos" columns={COLUMNS} rows={ROWS} />);

    expect(screen.getByText("$45,926")).toBeInTheDocument();
    expect(screen.getByText("$1,500")).toBeInTheDocument();
  });

  it("formats dates through the project helper (es-CO, no day shift)", () => {
    render(<ReadOnlyDataTable caption="Movimientos" columns={COLUMNS} rows={ROWS} />);

    expect(screen.getByText("27 mar 2026")).toBeInTheDocument();
    expect(screen.getByText("5 ene 2026")).toBeInTheDocument();
  });

  it("lets the caller override a cell's content", () => {
    render(
      <ReadOnlyDataTable
        caption="Movimientos"
        columns={COLUMNS}
        rows={ROWS}
        renderCell={(row, column) =>
          column.key === "type" ? <span>{`→ ${row.type}`}</span> : undefined
        }
      />
    );

    expect(screen.getByText("→ aporte")).toBeInTheDocument();
    // Non-overridden columns still use the default formatting.
    expect(screen.getByText("$45,926")).toBeInTheDocument();
  });

  it("exposes an accessible name for the table", () => {
    render(<ReadOnlyDataTable caption="Tus movimientos" columns={COLUMNS} rows={ROWS} />);

    expect(screen.getByRole("table", { name: "Tus movimientos" })).toBeInTheDocument();
  });
});

describe("ReadOnlyDataTable — it is READ ONLY", () => {
  it("renders no editing controls at all", () => {
    render(<ReadOnlyDataTable caption="Movimientos" columns={COLUMNS} rows={ROWS} />);

    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(document.querySelectorAll("input, select, textarea")).toHaveLength(0);
  });

  it("has no insert row: the row count matches the data exactly", () => {
    render(<ReadOnlyDataTable caption="Movimientos" columns={COLUMNS} rows={ROWS} />);

    const bodyRows = screen.getAllByRole("row").slice(1);
    expect(bodyRows).toHaveLength(ROWS.length);
    // The editable grid's "+" affordance must not be here.
    expect(screen.queryByText("+")).not.toBeInTheDocument();
  });

  it("double-clicking a cell does not turn it into an input", async () => {
    const user = userEvent.setup();
    render(<ReadOnlyDataTable caption="Movimientos" columns={COLUMNS} rows={ROWS} />);

    const cell = screen.getByText("Villa Rotonda 118");
    await user.dblClick(cell);

    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.getByText("Villa Rotonda 118")).toBeInTheDocument();
  });
});

describe("ReadOnlyDataTable — empty state", () => {
  it("renders the empty state instead of an empty table", () => {
    render(
      <ReadOnlyDataTable
        caption="Movimientos"
        columns={COLUMNS}
        rows={[]}
        emptyState={<p>{es.transactions.empty}</p>}
      />
    );

    expect(screen.getByText(es.transactions.empty)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("without an empty state it still renders a valid table with no body rows", () => {
    render(<ReadOnlyDataTable caption="Movimientos" columns={COLUMNS} rows={[]} />);

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(1);
  });
});
