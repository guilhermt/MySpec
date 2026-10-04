import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import { HistoryRow, type HistoryRowProps, type HistoryRowView } from "./ListRow";

const MODEL: HistoryRowView = {
  key: "task:1",
  glyph: "task",
  name: "Idempotency keys for payment intents",
  where: "api#398",
  whereTooltip: "acme/api#398",
  result: "PR #1279 · 6 steps",
  resultStrong: " · dev not updated",
  strongFirst: false,
  time: "15:02",
  label: "Task Idempotency keys for payment intents, archived today at 15:02",
};

function row(model: Partial<HistoryRowView> = {}, props: Partial<HistoryRowProps> = {}) {
  const onActivate = vi.fn();
  const onFocus = vi.fn();
  const rendered = renderWithStore(
    <HistoryRow
      model={{ ...MODEL, ...model }}
      fresh={false}
      tabStop={false}
      onActivate={onActivate}
      onFocus={onFocus}
      {...props}
    />,
  );
  return { ...rendered, onActivate, onFocus, item: screen.getByRole("treeitem") };
}

describe("HistoryRow", () => {
  it("is a treeitem of level 2 with the whole name and its key", () => {
    const { item } = row();
    expect(item).toHaveAttribute("aria-level", "2");
    expect(item).toHaveAccessibleName(MODEL.label);
    expect(item).toHaveAttribute("data-row-key", "task:1");
  });

  it("says aria-selected only while it is fresh", () => {
    expect(row().item).not.toHaveAttribute("aria-selected");
  });

  it("is selected while fresh", () => {
    expect(row({}, { fresh: true }).item).toHaveAttribute("aria-selected", "true");
  });

  it("is the tab stop only when told", () => {
    expect(row().item).toHaveAttribute("tabindex", "-1");
  });

  it("is a tab stop when told", () => {
    expect(row({}, { tabStop: true }).item).toHaveAttribute("tabindex", "0");
  });

  it("writes the columns and puts the strong part after the result", () => {
    const { item } = row();
    expect(item).toHaveTextContent("api#398PR #1279 · 6 steps · dev not updated15:02");
  });

  it("puts the strong part first when it opens the result", () => {
    const { item } = row({ resultStrong: "Closed", result: " · 1 pass", strongFirst: true });
    expect(item).toHaveTextContent("Closed · 1 pass");
  });

  it("leaves out a strong part that is empty", () => {
    const { item } = row({ resultStrong: "" });
    expect(item).toHaveTextContent("PR #1279 · 6 steps15:02");
  });

  it("activates on click and tells its focus", async () => {
    const { user, item, onActivate, onFocus } = row();
    await user.click(item);
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onFocus).toHaveBeenCalled();
  });
});
