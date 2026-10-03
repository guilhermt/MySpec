import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusTable } from "@/features/boards/StatusTable";
import { offWholePixels, resolve, setTheme, THEMES, token } from "@/test/painted";

function table() {
  return render(
    <StatusTable
      statuses={[
        { id: "todo", name: "Todo", final: false },
        { id: "qa", name: "QA", final: false },
      ]}
      finals={new Set(["qa"])}
      newCardStatus="todo"
      newIds={new Set(["qa"])}
      onFinal={() => {}}
      onNewCard={() => {}}
    />,
  );
}

describe.each(THEMES)("StatusTable in the %s theme", (theme) => {
  it("outlines the table with the first line and heads the columns in caps, in the third ink", () => {
    setTheme(theme);
    const { container } = table();
    const frame = getComputedStyle(container.firstElementChild as Element);
    expect(frame.borderTopColor).toBe(token("--line-1"));
    expect(frame.borderTopLeftRadius).toBe(resolve("var(--radius-md)", "border-top-left-radius"));
    const head = getComputedStyle(screen.getByRole("columnheader", { name: "Ends the work" }));
    expect(head.color).toBe(token("--ink-3"));
    expect(head.fontSize).toBe(resolve("var(--text-caps)", "font-size"));
    expect(head.textTransform).toBe("uppercase");
  });

  it("writes the status in the first ink and the one that is not a status in the third", () => {
    setTheme(theme);
    table();
    expect(getComputedStyle(screen.getByRole("rowheader", { name: "Todo" })).color).toBe(
      token("--ink-1"),
    );
    expect(getComputedStyle(screen.getByRole("rowheader", { name: "No status" })).color).toBe(
      token("--ink-3"),
    );
  });

  it("draws the box of a final status and the radio of new cards in the brand", () => {
    setTheme(theme);
    table();
    const box = screen.getByRole("checkbox", { name: "QA ends the work" }).querySelector("span");
    expect(getComputedStyle(box as Element).backgroundColor).toBe(token("--brand"));
    const ring = screen.getByRole("radio", { name: "New cards start in Todo" });
    expect(getComputedStyle(ring).borderTopColor).toBe(token("--brand"));
    const other = screen.getByRole("radio", { name: "New cards start in QA" });
    expect(getComputedStyle(other).borderTopColor).toBe(token("--line-3"));
  });

  it("puts each box and radio under the head of its column, every row on whole pixels", () => {
    setTheme(theme);
    table();
    const textStart = (head: HTMLElement) =>
      head.getBoundingClientRect().left + Number.parseFloat(getComputedStyle(head).paddingLeft);
    const ends = textStart(screen.getByRole("columnheader", { name: "Ends the work" }));
    const fresh = textStart(screen.getByRole("columnheader", { name: "New cards" }));
    for (const name of ["Todo", "QA"]) {
      const box = screen.getByRole("checkbox", { name: `${name} ends the work` });
      const sign = box.querySelector("span") as Element;
      expect(sign.getBoundingClientRect().left).toBe(ends);
      const radio = screen.getByRole("radio", { name: `New cards start in ${name}` });
      expect(radio.getBoundingClientRect().left).toBe(fresh);
    }
    const none = screen.getByRole("radio", { name: "New cards start without a status" });
    expect(none.getBoundingClientRect().left).toBe(fresh);
    expect(offWholePixels(screen.getAllByRole("row"))).toEqual([]);
  });

  it("makes the cell the target of its box and of its radio", () => {
    setTheme(theme);
    table();
    const inner = (cell: Element) => {
      const style = getComputedStyle(cell);
      return (
        cell.getBoundingClientRect().width -
        Number.parseFloat(style.paddingLeft) -
        Number.parseFloat(style.paddingRight)
      );
    };
    for (const name of ["Todo", "QA"]) {
      const box = screen.getByRole("checkbox", { name: `${name} ends the work` });
      expect(box.getBoundingClientRect().width).toBe(inner(box.closest("td") as Element));
      const radio = screen.getByRole("radio", { name: `New cards start in ${name}` });
      const target = radio.closest("label") as Element;
      expect(target.getBoundingClientRect().width).toBe(inner(radio.closest("td") as Element));
    }
  });
});
