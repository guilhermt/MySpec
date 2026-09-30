import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import { CardRow, type CardRowProps, type CardRowView } from "./ListRow";

const PLAIN: CardRowView = {
  key: "acme/api#474",
  number: "#474",
  title: "Usage alerts at 80% of the plan",
  isEpic: false,
  dimmed: false,
  epic: null,
  dependency: null,
  task: null,
  canStart: true,
  canDiscuss: true,
  label: "#474 Usage alerts at 80% of the plan. acme/api. Backlog",
};

function row(model: Partial<CardRowView> = {}, props: Partial<CardRowProps> = {}) {
  const onActivate = vi.fn();
  const onFocus = vi.fn();
  const rendered = renderWithStore(
    <CardRow
      model={{ ...PLAIN, ...model }}
      open={false}
      selection={null}
      tabStop={false}
      flash={false}
      onActivate={onActivate}
      onFocus={onFocus}
      {...props}
    />,
  );
  return { ...rendered, onActivate, onFocus };
}

const item = () => screen.getByRole("treeitem");

describe("CardRow", () => {
  it("is a treeitem of level 2 named by the label of its model", () => {
    row();
    expect(item()).toHaveAccessibleName(PLAIN.label);
    expect(item()).toHaveAttribute("aria-level", "2");
    expect(item()).toHaveAttribute("data-row-key", "acme/api#474");
  });

  it("draws the number and the title", () => {
    row();
    expect(screen.getByText("#474")).toBeInTheDocument();
    expect(screen.getByText("Usage alerts at 80% of the plan")).toBeInTheDocument();
  });

  it.each([
    [false, "false"],
    [true, "true"],
  ])("is aria-selected=%s outside the select mode when open is %s", (open, selected) => {
    row({}, { open });
    expect(item()).toHaveAttribute("aria-selected", selected);
  });

  it("holds the tab stop only when it is the stop", () => {
    row({}, { tabStop: true });
    expect(item()).toHaveAttribute("tabindex", "0");
  });

  it("activates on a click and reports the focus", async () => {
    const { user, onActivate, onFocus } = row();
    await user.click(item());
    expect(onActivate).toHaveBeenCalledOnce();
    expect(onFocus).toHaveBeenCalled();
  });

  it("puts the epic icon on the row of an epic", () => {
    const { container } = row({ isEpic: true });
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("puts the epic, the dependency and the task in the meta, task first in the document", () => {
    row({
      epic: { text: "API hardening", tooltip: "API hardening" },
      dependency: { text: "#461 +1", tooltip: ["Depends on #461"] },
      task: {
        kind: "task",
        glyph: "wait",
        text: "Question · Step 3/7",
        strong: true,
        more: 2,
        tooltip: "412-rate-limit: Question",
      },
    });
    const order = ["Question · Step 3/7", "#461 +1", "API hardening"].map((text) =>
      screen.getByText(text),
    );
    expect(order[0]?.compareDocumentPosition(order[1] as Node)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(order[1]?.compareDocumentPosition(order[2] as Node)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it.each([
    [{ kind: "discussion", tooltip: "In the discussion A" } as const, "In discussion"],
    [{ kind: "cloning", text: "Cloning acme/billing…" } as const, "Cloning acme/billing…"],
    [{ kind: "clone-failed" } as const, "Clone failed"],
  ])("says the %o task cell", (task, text) => {
    row({ task });
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  describe("keys", () => {
    it("says S start and D discuss when they act", () => {
      row();
      expect(screen.getByText("start")).toBeInTheDocument();
      expect(screen.getByText("discuss")).toBeInTheDocument();
    });

    it("leaves out the key that does nothing", () => {
      row({ canStart: false });
      expect(screen.queryByText("start")).not.toBeInTheDocument();
      expect(screen.getByText("discuss")).toBeInTheDocument();
    });

    it("is hidden from assistive technology", () => {
      row();
      expect(screen.getByText("start").parentElement).toHaveAttribute("aria-hidden", "true");
    });
  });

  describe("select mode", () => {
    it.each([
      ["selected", "true", "unselect"],
      ["not selected", "false", "select"],
    ] as const)("%s is aria-checked=%s and says Space %s", (selection, checked, verb) => {
      row({}, { selection });
      expect(item()).toHaveAttribute("aria-checked", checked);
      expect(item()).not.toHaveAttribute("aria-selected");
      expect(item()).toHaveAccessibleName(PLAIN.label);
      expect(screen.getByText(verb)).toBeInTheDocument();
      expect(screen.queryByText("start")).not.toBeInTheDocument();
    });

    it("is aria-disabled, without a Space key, when it can't be selected", () => {
      row({}, { selection: "can't be selected" });
      expect(item()).toHaveAttribute("aria-disabled", "true");
      expect(item()).not.toHaveAttribute("aria-checked");
      expect(screen.queryByText("select")).not.toBeInTheDocument();
    });
  });

  it("blinks when a reading brought it", () => {
    row({}, { flash: true });
    expect(item()).toHaveClass("row-flash");
  });
});
