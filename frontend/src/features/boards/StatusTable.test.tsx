import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StatusTable, type StatusTableProps } from "@/features/boards/StatusTable";
import { renderWithStore } from "@/test/render";

const STATUSES = [
  { id: "todo", name: "Todo", final: false },
  { id: "qa", name: "QA", final: false },
  { id: "done", name: "Done", final: true },
];

function table(props: Partial<StatusTableProps> = {}) {
  const onFinal = vi.fn();
  const onNewCard = vi.fn();
  const rendered = renderWithStore(
    <StatusTable
      statuses={STATUSES}
      finals={new Set(["done"])}
      newCardStatus="todo"
      newIds={new Set()}
      onFinal={onFinal}
      onNewCard={onNewCard}
      {...props}
    />,
  );
  return { ...rendered, onFinal, onNewCard };
}

describe("StatusTable", () => {
  it("heads the three columns and has a row per status and the one without status", () => {
    table();
    expect(screen.getAllByRole("columnheader").map((head) => head.textContent)).toEqual([
      "Status",
      "Ends the work",
      "New cards",
    ]);
    expect(screen.getAllByRole("row")).toHaveLength(1 + STATUSES.length + 1);
    expect(screen.getByRole("rowheader", { name: "No status" })).toBeInTheDocument();
  });

  it("names each box and radio, and checks the finals and the status of new cards", () => {
    table();
    expect(screen.getByRole("checkbox", { name: "Done ends the work" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Todo ends the work" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "New cards start in Todo" })).toBeChecked();
    expect(
      screen.getByRole("radio", { name: "New cards start without a status" }),
    ).not.toBeChecked();
    // The last row has the radio and no box.
    const last = screen.getByRole("rowheader", { name: "No status" }).closest("tr");
    expect(within(last as HTMLElement).queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("makes the radios the group Status of new cards, which is the table body", () => {
    table();
    const group = screen.getByRole("radiogroup", { name: "Status of new cards" });
    expect(group.tagName).toBe("TBODY");
    expect(within(group).getAllByRole("radio")).toHaveLength(STATUSES.length + 1);
  });

  it("reports the box and the radio the user changes", async () => {
    const { user, onFinal, onNewCard } = table();
    await user.click(screen.getByRole("checkbox", { name: "QA ends the work" }));
    expect(onFinal).toHaveBeenCalledWith("qa", true);
    await user.click(screen.getByRole("checkbox", { name: "Done ends the work" }));
    expect(onFinal).toHaveBeenCalledWith("done", false);
    await user.click(screen.getByRole("radio", { name: "New cards start in QA" }));
    expect(onNewCard).toHaveBeenCalledWith("qa");
    await user.click(screen.getByRole("radio", { name: "New cards start without a status" }));
    expect(onNewCard).toHaveBeenCalledWith("");
  });

  it("labels a status that is new", () => {
    table({ newIds: new Set(["qa"]) });
    expect(
      within(screen.getByRole("rowheader", { name: /QA/ })).getByText("new"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("new")).toHaveLength(1);
  });

  it("keeps the boxes in the tab order next to the radio group", async () => {
    const { user } = table();
    await user.tab();
    expect(screen.getByRole("checkbox", { name: "Todo ends the work" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("radio", { name: "New cards start in Todo" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("checkbox", { name: "QA ends the work" })).toHaveFocus();
  });
});
