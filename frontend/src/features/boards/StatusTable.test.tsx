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

  it("keeps the body a row group and joins the radios by their name, the boxes left out", () => {
    table();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(STATUSES.length + 1);
    const name = radios[0]?.getAttribute("name");
    expect(name).toBeTruthy();
    expect(radios.every((radio) => radio.getAttribute("name") === name)).toBe(true);
    for (const radio of radios) expect(radio.closest("tbody")).not.toBeNull();
    expect(screen.getAllByRole("checkbox").every((box) => !box.hasAttribute("name"))).toBe(true);
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

  it("stops on each box and once on the radios, at the status of new cards", async () => {
    const { user } = table();
    await user.tab();
    expect(screen.getByRole("checkbox", { name: "Todo ends the work" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("radio", { name: "New cards start in Todo" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("checkbox", { name: "QA ends the work" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("checkbox", { name: "Done ends the work" })).toHaveFocus();
  });

  it("never moves the status of new cards with the arrows on a box", async () => {
    const { user, onNewCard, onFinal } = table();
    const box = screen.getByRole("checkbox", { name: "Todo ends the work" });
    box.focus();
    await user.keyboard("{ArrowDown}{ArrowRight}{ArrowUp}{ArrowLeft}");
    expect(box).toHaveFocus();
    expect(onNewCard).not.toHaveBeenCalled();
    expect(onFinal).not.toHaveBeenCalled();
  });

  it("moves the status of new cards with the arrows on a radio", async () => {
    const { user, onNewCard } = table();
    screen.getByRole("radio", { name: "New cards start in Todo" }).focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: "New cards start in QA" })).toHaveFocus();
    expect(onNewCard).toHaveBeenLastCalledWith("qa");
  });
});
