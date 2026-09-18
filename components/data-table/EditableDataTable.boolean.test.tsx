import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TableColumn, TableRow } from "@/lib/table/types";
import { EditableDataTable } from "./EditableDataTable";

/**
 * Boolean columns ("En captación") in the editable grid.
 *
 * They used to be a text cell reading "Sí"/"No" that, on a double click, turned
 * into a bare checkbox committing only on blur — and once switched off, the
 * local value was the STRING "false", which the cell read as truthy and kept
 * showing "Sí". Now they are a switch: always visible, one click, committed at
 * once, and reading both shapes of the value correctly.
 */

const COLUMNS: TableColumn[] = [
  { key: "name", label: "Nombre", type: "text" },
  { key: "in_fundraising", label: "En captación", type: "boolean" },
];

function renderGrid(rows: TableRow[], columns: TableColumn[] = COLUMNS) {
  const onCellCommit = vi.fn();
  render(
    <EditableDataTable columns={columns} rows={rows} onCellCommit={onCellCommit} />
  );
  return { onCellCommit };
}

const switchFor = () => screen.getByRole("switch", { name: /En captación/ });

describe("boolean cells render as a switch", () => {
  it("is ON for true and OFF for false", () => {
    renderGrid([
      { id: "a", name: "A", in_fundraising: true },
      { id: "b", name: "B", in_fundraising: false },
    ]);

    const [on, off] = screen.getAllByRole("switch");
    expect(on).toHaveAttribute("aria-checked", "true");
    expect(off).toHaveAttribute("aria-checked", "false");
  });

  it("is OFF for an unset value", () => {
    renderGrid([{ id: "a", name: "A", in_fundraising: null }]);

    expect(switchFor()).toHaveAttribute("aria-checked", "false");
  });

  it("reads the string 'false' as OFF (the regression)", () => {
    renderGrid([{ id: "a", name: "A", in_fundraising: "false" }]);

    expect(switchFor()).toHaveAttribute("aria-checked", "false");
  });

  it("names the switch after its column and record, for assistive tech", () => {
    renderGrid([{ id: "a", name: "A", in_fundraising: true }]);

    expect(switchFor()).toBeInTheDocument();
  });

  it("says its state in words next to the control, not by colour alone", () => {
    renderGrid([
      { id: "a", name: "A", in_fundraising: true },
      { id: "b", name: "B", in_fundraising: false },
    ]);

    expect(screen.getByText("Sí")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
  });
});

describe("toggling", () => {
  it("commits with ONE click, no double click and no blur needed", async () => {
    const user = userEvent.setup();
    const { onCellCommit } = renderGrid([{ id: "a", name: "A", in_fundraising: false }]);

    await user.click(switchFor());

    expect(onCellCommit).toHaveBeenCalledTimes(1);
    expect(onCellCommit).toHaveBeenCalledWith("a", "in_fundraising", "true");
    expect(switchFor()).toHaveAttribute("aria-checked", "true");
  });

  it("can be switched OFF and stays off on screen", async () => {
    const user = userEvent.setup();
    const { onCellCommit } = renderGrid([{ id: "a", name: "A", in_fundraising: true }]);

    await user.click(switchFor());

    expect(onCellCommit).toHaveBeenCalledWith("a", "in_fundraising", "false");
    expect(switchFor()).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("No")).toBeInTheDocument();
  });

  it("goes back and forth", async () => {
    const user = userEvent.setup();
    const { onCellCommit } = renderGrid([{ id: "a", name: "A", in_fundraising: false }]);

    await user.click(switchFor());
    await user.click(switchFor());
    await user.click(switchFor());

    expect(onCellCommit.mock.calls.map((call) => call[2])).toEqual([
      "true",
      "false",
      "true",
    ]);
    expect(switchFor()).toHaveAttribute("aria-checked", "true");
  });

  it("toggles from the keyboard", async () => {
    const user = userEvent.setup();
    const { onCellCommit } = renderGrid([{ id: "a", name: "A", in_fundraising: false }]);

    switchFor().focus();
    await user.keyboard(" ");

    expect(onCellCommit).toHaveBeenCalledWith("a", "in_fundraising", "true");
  });

  it("turns an unset value ON with the first click", async () => {
    const user = userEvent.setup();
    const { onCellCommit } = renderGrid([{ id: "a", name: "A", in_fundraising: null }]);

    await user.click(switchFor());

    expect(onCellCommit).toHaveBeenCalledWith("a", "in_fundraising", "true");
  });
});

describe("switches that must not move", () => {
  it("is disabled on a read-only column and commits nothing", async () => {
    const user = userEvent.setup();
    const { onCellCommit } = renderGrid(
      [{ id: "a", name: "A", in_fundraising: true }],
      [
        { key: "name", label: "Nombre", type: "text" },
        { key: "in_fundraising", label: "En captación", type: "boolean", readOnly: true },
      ]
    );

    expect(switchFor()).toHaveAttribute("aria-disabled", "true");
    await user.click(switchFor());

    expect(onCellCommit).not.toHaveBeenCalled();
    expect(switchFor()).toHaveAttribute("aria-checked", "true");
  });

  it("does not move on a row with no id, which could not be saved", async () => {
    const user = userEvent.setup();
    const { onCellCommit } = renderGrid([{ name: "A", in_fundraising: false }]);

    await user.click(switchFor());

    expect(onCellCommit).not.toHaveBeenCalled();
    expect(switchFor()).toHaveAttribute("aria-checked", "false");
  });
});
