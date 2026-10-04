import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import {
  CardRow,
  type CardRowProps,
  type CardRowView,
  PullRequestRow,
  type PullRequestRowProps,
  type PullRequestRowView,
} from "./ListRow";

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
      level={2}
      setSize={12}
      posInSet={3}
      index={7}
      onActivate={onActivate}
      onFocus={onFocus}
      {...props}
    />,
  );
  return { ...rendered, onActivate, onFocus };
}

const item = () => screen.getByRole("treeitem");

describe("CardRow", () => {
  it("is a treeitem named by the label of its model, placed among its siblings", () => {
    row();
    expect(item()).toHaveAccessibleName(PLAIN.label);
    expect(item()).toHaveAttribute("aria-level", "2");
    expect(item()).toHaveAttribute("aria-setsize", "12");
    expect(item()).toHaveAttribute("aria-posinset", "3");
    expect(item()).toHaveAttribute("data-index", "7");
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
    expect(onActivate).toHaveBeenCalledExactlyOnceWith(PLAIN.key);
    expect(onFocus).toHaveBeenCalledWith(PLAIN.key);
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

const PR: PullRequestRowView = {
  key: "acme/web#2291",
  reference: "web#2291",
  referenceTooltip: "acme/web#2291",
  title: "Move the billing page to the new layout",
  tags: [
    { text: "Draft", tooltip: null },
    { text: "Fork", tooltip: "From jdoe/web" },
  ],
  folded: { text: "+2", tooltip: "Draft\nFork" },
  author: "dependabot",
  state: { kind: "text", text: "Not reviewed", tone: "ink-3", tooltip: null },
  keys: "review",
  dashed: false,
  label: "web#2291 Move the billing page to the new layout. dependabot. Not reviewed",
};

function prRow(model: Partial<PullRequestRowView> = {}, props: Partial<PullRequestRowProps> = {}) {
  const onActivate = vi.fn();
  const onFocus = vi.fn();
  const rendered = renderWithStore(
    <PullRequestRow
      model={{ ...PR, ...model }}
      open={false}
      tabStop={false}
      flash={false}
      onActivate={onActivate}
      onFocus={onFocus}
      {...props}
    />,
  );
  return { ...rendered, onActivate, onFocus };
}

describe("PullRequestRow", () => {
  it("is a treeitem of level 2 named by the label of its model", () => {
    prRow();
    expect(item()).toHaveAccessibleName(PR.label);
    expect(item()).toHaveAttribute("aria-level", "2");
    expect(item()).toHaveAttribute("data-row-key", "acme/web#2291");
  });

  it("draws the reference, the title, the tags and the author", () => {
    prRow();
    for (const text of ["web#2291", PR.title, "Draft", "Fork", "dependabot"]) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });

  it.each([
    [false, "false"],
    [true, "true"],
  ])("is aria-selected=%s when open is %s", (open, selected) => {
    prRow({}, { open });
    expect(item()).toHaveAttribute("aria-selected", selected);
  });

  it("holds the tab stop only when it is the stop", () => {
    prRow({}, { tabStop: true });
    expect(item()).toHaveAttribute("tabindex", "0");
  });

  it("activates on a click and reports the focus", async () => {
    const { user, onActivate, onFocus } = prRow();
    await user.click(item());
    expect(onActivate).toHaveBeenCalledOnce();
    expect(onFocus).toHaveBeenCalled();
  });

  it("says the tooltip of a tag that has one", async () => {
    const { user } = prRow();
    await user.hover(screen.getByText("Fork"));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("From jdoe/web");
  });

  describe("state", () => {
    it("says a text state", () => {
      prRow({
        state: { kind: "text", text: "Checks failing", tone: "ink-2", tooltip: "2 failed" },
      });
      expect(screen.getByText("Checks failing")).toBeInTheDocument();
    });

    it("says the long form of a review while it fits", () => {
      prRow({
        state: {
          kind: "review",
          glyph: "wait",
          long: "Decide findings · pass 1 · 1/3",
          short: "Decide findings",
          strong: true,
          tooltip: "The review waits for you",
        },
      });
      expect(screen.getAllByText("Decide findings · pass 1 · 1/3")).toHaveLength(2);
      expect(screen.queryByText("Decide findings")).not.toBeInTheDocument();
    });

    it("says the task that holds the pull request", () => {
      prRow({ state: { kind: "task", text: "Step 3/7", tooltip: "add-login: Step 3/7" } });
      expect(screen.getByText("Step 3/7")).toBeInTheDocument();
    });

    it("says the clone that runs", () => {
      prRow({ state: { kind: "cloning", text: "Cloning acme/web…" } });
      expect(screen.getByText("Cloning acme/web…")).toBeInTheDocument();
    });

    it("says the clone that failed, on the error rail", () => {
      prRow({ state: { kind: "clone-failed" } });
      expect(screen.getByText("Clone failed")).toBeInTheDocument();
      expect(item()).toHaveClass("error-rail-bar");
    });
  });

  describe("keys", () => {
    it.each(["review", "open", "open task"] as const)("says R %s", (keys) => {
      prRow({ keys });
      expect(screen.getByText("R")).toBeInTheDocument();
      expect(screen.getByText(keys)).toBeInTheDocument();
      expect(screen.getByText(keys).closest('[aria-hidden="true"]')).not.toBeNull();
    });

    it("is empty where R does nothing", () => {
      prRow({ keys: null });
      expect(screen.queryByText("R")).not.toBeInTheDocument();
    });
  });

  it("stays on the path, and acts, when dashed", async () => {
    const { user, onActivate } = prRow({ dashed: true }, { tabStop: true });
    expect(item()).not.toHaveAttribute("aria-disabled");
    await user.click(item());
    expect(onActivate).toHaveBeenCalledOnce();
  });

  it("blinks when a reading brought it", () => {
    prRow({}, { flash: true });
    expect(item()).toHaveClass("row-flash");
  });
});
