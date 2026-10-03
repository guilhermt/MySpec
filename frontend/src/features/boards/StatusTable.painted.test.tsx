import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusTable } from "@/features/boards/StatusTable";
import { resolve, setTheme, THEMES, token } from "@/test/painted";

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
    const ring = screen
      .getByRole("radio", { name: "New cards start in Todo" })
      .querySelector("span");
    expect(getComputedStyle(ring as Element).borderTopColor).toBe(token("--brand"));
    const other = screen
      .getByRole("radio", { name: "New cards start in QA" })
      .querySelector("span");
    expect(getComputedStyle(other as Element).borderTopColor).toBe(token("--line-3"));
  });
});
