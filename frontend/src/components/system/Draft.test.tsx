import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { DraftStateView, GestureLineView } from "@/components/system/draft-views";
import { spoken } from "@/test/live";
import { renderWithStore } from "@/test/render";
import { Draft, type DraftProps } from "./Draft";

const NAME =
  "Draft 3 of 5: New card. Overage on the monthly invoice. acme/billing, Billing. Not decided.";

const UNDECIDED: DraftStateView = {
  open: null,
  folded: "Not decided",
  glyph: null,
  strong: false,
  link: null,
  time: "",
  wayBack: "",
  created: null,
};

const GESTURE: GestureLineView = {
  icon: "hourglass",
  segments: [
    { text: "Approve", strong: true },
    { text: " publishes this card to GitHub now.", strong: false },
  ],
  text: "Approve publishes this card to GitHub now.",
};

function draw(overrides: Partial<DraftProps> = {}) {
  const handlers = {
    onDecide: vi.fn(),
    onEdit: vi.fn(),
    onRetry: vi.fn(),
    onOpenDependency: vi.fn(),
    onOpenLink: vi.fn(),
  };
  renderWithStore(
    <Draft
      id="d3"
      number={3}
      name={NAME}
      current
      requestTarget={null}
      kind="New card"
      cardLink={null}
      revised={false}
      title="Overage on the monthly invoice"
      untitled={false}
      epic={false}
      discarded={false}
      fields="acme/billing · Billing"
      dependencies={[]}
      onGitHub=""
      warnings={[]}
      refreshing={false}
      body={<p>Charge past the plan.</p>}
      changes={null}
      gesture={GESTURE}
      state={UNDECIDED}
      decision={{
        shown: true,
        approveReason: null,
        discardReason: null,
        editReason: null,
        value: "",
      }}
      retry={null}
      editor={null}
      {...handlers}
      {...overrides}
    />,
  );
  return { ...handlers, group: screen.getByRole("group", { name: NAME }) };
}

const button = (name: string) => screen.getByRole("button", { name });

describe("Draft", () => {
  it("is an open group named for the reader, keyed for the card, with the tab stop when current", () => {
    const { group } = draw();

    expect(group).toHaveAttribute("aria-expanded", "true");
    expect(group).toHaveAttribute("data-card-item", "d3");
    expect(group).toHaveAttribute("data-current");
    expect(group).toHaveAttribute("tabindex", "0");
  });

  it("holds no tab stop when it isn't the current one", () => {
    const { group } = draw({ current: false });

    expect(group).not.toHaveAttribute("data-current");
    expect(group).toHaveAttribute("tabindex", "-1");
  });

  it("draws the kind, the title, the fields and the body", () => {
    draw();

    expect(screen.getByText("New card")).toBeInTheDocument();
    expect(screen.getByText("Overage on the monthly invoice")).toBeInTheDocument();
    expect(screen.getByText("acme/billing · Billing")).toBeInTheDocument();
    expect(screen.getByText("Charge past the plan.")).toBeInTheDocument();
  });

  it("approves and discards with a click, A and D written out of the names", async () => {
    const user = userEvent.setup();
    const { onDecide } = draw();

    expect(button("Approve")).toHaveTextContent(/^ApproveA$/);
    expect(button("Discard")).toHaveTextContent(/^DiscardD$/);
    await user.click(button("Approve"));
    await user.click(button("Discard"));

    expect(onDecide.mock.calls).toEqual([["approve"], ["discard"]]);
  });

  it("describes Approve with the line of what the gesture publishes", () => {
    draw();

    expect(button("Approve")).toHaveAccessibleDescription(GESTURE.text);
    expect(screen.getByText("Approve", { selector: "strong" })).toBeInTheDocument();
  });

  it("presses the decision it holds and says how to undo it", () => {
    draw({
      gesture: null,
      state: { ...UNDECIDED, open: "Approved · publishing next", folded: "" },
      decision: {
        shown: true,
        approveReason: null,
        discardReason: null,
        editReason: null,
        value: "approved",
      },
    });

    expect(button("Approve")).toHaveAttribute("aria-pressed", "true");
    expect(button("Discard")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Approved · publishing next")).toBeInTheDocument();
    expect(screen.getByText("· click again to undo")).toBeInTheDocument();
  });

  it("puts the reason of a disabled decision in place of the state", () => {
    const reason = "A publication is running · the decision waits for it";
    draw({
      gesture: null,
      state: { ...UNDECIDED, open: "Discarded", folded: "Discarded" },
      decision: {
        shown: true,
        approveReason: reason,
        discardReason: reason,
        editReason: "A publication is running",
        value: "discarded",
      },
    });

    expect(button("Approve")).toHaveAttribute("aria-disabled", "true");
    expect(button("Approve")).toHaveAccessibleDescription(reason);
    expect(button("Discard")).toHaveAccessibleDescription(reason);
    expect(screen.queryByText("Discarded")).not.toBeInTheDocument();
    expect(screen.queryByText(/click again to undo/)).not.toBeInTheDocument();
    expect(button("Edit")).toHaveAccessibleDescription("A publication is running");
  });

  it("keeps the gesture line as the one reason of a blocked draft", () => {
    const blocked: GestureLineView = {
      icon: "blocked",
      segments: [
        { text: "Can't publish: choose a repository of the board in Edit.", strong: false },
      ],
      text: "Can't publish: choose a repository of the board in Edit.",
    };
    draw({
      gesture: blocked,
      decision: {
        shown: true,
        approveReason: blocked.text,
        discardReason: null,
        editReason: null,
        value: "",
      },
    });

    expect(button("Approve")).toHaveAttribute("aria-disabled", "true");
    expect(button("Approve")).toHaveAccessibleDescription(blocked.text);
    expect(screen.getAllByText(blocked.text)).toHaveLength(1);
    expect(button("Discard")).not.toHaveAttribute("aria-disabled", "true");
  });

  it("says Publishing… as a live status", () => {
    draw({
      gesture: null,
      state: { ...UNDECIDED, open: "Publishing…", folded: "Publishing…", glyph: "spinner" },
    });

    expect(screen.getByRole("status")).toHaveTextContent("Publishing…");
  });

  it("keeps only the state, the link and the way back once on GitHub", async () => {
    const user = userEvent.setup();
    const { onOpenLink } = draw({
      gesture: null,
      state: {
        ...UNDECIDED,
        open: "Created billing#479 · 15:10",
        folded: "Created billing#479 · 15:10",
        glyph: "check",
        link: { label: "billing#479", url: "https://github.com/acme/billing/issues/479" },
        time: "15:10",
        wayBack: "To take it back, close billing#479 on GitHub.",
      },
      decision: {
        shown: false,
        approveReason: null,
        discardReason: null,
        editReason: null,
        value: "approved",
      },
    });

    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.getByText("To take it back, close billing#479 on GitHub.")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "billing#479" }));

    expect(onOpenLink).toHaveBeenCalledWith("https://github.com/acme/billing/issues/479");
  });

  describe("after a failure", () => {
    const failed = (overrides: Partial<DraftProps> = {}) =>
      draw({
        gesture: null,
        state: {
          ...UNDECIDED,
          open: "GitHub refused the label billing.",
          folded: "Couldn't write to GitHub · open it to Retry",
          glyph: "error",
        },
        decision: {
          shown: true,
          approveReason: null,
          discardReason: null,
          editReason: null,
          value: "approved",
        },
        retry: { disabledReason: null, running: false },
        ...overrides,
      });

    it("says how to undo the approval after Retry, never between the reason and it", () => {
      failed();

      const undo = screen.getByText("· click again to undo");
      const order = button("Retry").compareDocumentPosition(undo);
      expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(screen.getByText("GitHub refused the label billing.")).not.toContainElement(undo);
    });

    it("says why and retries", async () => {
      const user = userEvent.setup();
      const { onRetry, group } = failed();

      expect(screen.getByText("GitHub refused the label billing.")).toBeInTheDocument();
      expect(group.querySelector('[data-state="error"]')).toBeInTheDocument();
      expect(button("Retry")).toHaveAttribute("data-retry");
      await user.click(button("Retry"));

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it("says Retrying… while it runs", () => {
      failed({ retry: { disabledReason: null, running: true } });

      expect(button("Retrying…")).toHaveAttribute("aria-busy", "true");
    });

    it("keeps its state and dashes Retry during a publication", () => {
      const reason = "A publication is running · the decision waits for it";
      failed({
        decision: {
          shown: true,
          approveReason: reason,
          discardReason: reason,
          editReason: "A publication is running",
          value: "approved",
        },
        retry: { disabledReason: "A publication is running", running: false },
      });

      expect(screen.getByText("GitHub refused the label billing.")).toBeInTheDocument();
      expect(button("Retry")).toHaveAttribute("aria-disabled", "true");
      expect(button("Retry")).toHaveAccessibleDescription("A publication is running");
      expect(button("Approve")).toHaveAccessibleDescription(reason);
    });

    it("says above it what it created before failing", () => {
      failed({
        state: {
          ...UNDECIDED,
          open: "GitHub refused the dependency.",
          folded: "Couldn't write to GitHub · open it to Retry",
          glyph: "error",
          created: { label: "billing#479", url: "https://github.com/acme/billing/issues/479" },
        },
      });

      expect(screen.getByRole("link", { name: "billing#479" }).parentElement).toHaveTextContent(
        "Created billing#479",
      );
    });

    it("marks Retry as what the request bar names", () => {
      const { group } = failed({ requestTarget: "retry" });

      expect(button("Retry")).toHaveAttribute("data-request-target");
      expect(group).not.toHaveAttribute("data-request-target");
    });
  });

  it("marks the draft as what the request bar names", () => {
    const { group } = draw({ requestTarget: "draft" });

    expect(group).toHaveAttribute("data-request-target");
  });

  it("opens the card of an update and says Revised", async () => {
    const user = userEvent.setup();
    const { onOpenLink } = draw({
      kind: "Update",
      revised: true,
      cardLink: { label: "gateway#461", url: "https://github.com/acme/gateway/issues/461" },
    });

    expect(screen.getByText("Revised")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "gateway#461" }));

    expect(onOpenLink).toHaveBeenCalledWith("https://github.com/acme/gateway/issues/461");
  });

  it("opens a dependency and says what the card already depends on", async () => {
    const user = userEvent.setup();
    const tiers = { title: "Tier limits", draft: "d1", url: "", linked: false };
    const meter = {
      title: "Meter the usage",
      draft: null,
      url: "https://github.com/acme/billing/issues/470",
      linked: true,
    };
    const { onOpenDependency } = draw({ dependencies: [tiers, meter], onGitHub: "#455" });

    expect(screen.getByText(/^Depends on/)).toHaveTextContent(
      "Depends on Tier limits, Meter the usage · On GitHub: #455",
    );
    await user.click(screen.getByRole("link", { name: "Tier limits" }));
    await user.click(screen.getByRole("link", { name: "Meter the usage" }));

    expect(onOpenDependency.mock.calls).toEqual([[tiers], [meter]]);
  });

  it("draws one warning a line, and the reading of the card as a live status", () => {
    draw({
      warnings: ["The module Billing is no longer an option of the board.", "Refreshing the card…"],
      refreshing: true,
    });

    expect(
      screen.getByText("The module Billing is no longer an option of the board."),
    ).toBeInTheDocument();
    expect(spoken()).toContain("Refreshing the card…");
  });

  it("reads the body or the changes of an update", async () => {
    const user = userEvent.setup();
    draw({
      changes: {
        lines: [{ kind: "added", text: "Charge past the plan." }],
        count: "+1",
      },
    });
    const control = screen.getByRole("radiogroup", { name: "What to read" });

    expect(within(control).getByRole("radio", { name: "Body" })).toBeChecked();
    await user.click(within(control).getByRole("radio", { name: "Changes +1" }));

    expect(screen.getByRole("group", { name: "Changes to the body" })).toBeInTheDocument();
    expect(screen.queryByText("Charge past the plan.", { selector: "p" })).not.toBeInTheDocument();
  });

  it("edits with a click on Edit", async () => {
    const user = userEvent.setup();
    const { onEdit } = draw();

    expect(button("Edit")).toHaveTextContent(/^EditE$/);
    await user.click(button("Edit"));

    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("gives the title, the fields and the body to the editor, and drops the gesture line", () => {
    draw({
      editor: <textarea aria-label="Body" />,
      decision: {
        shown: true,
        approveReason: "Finish editing to decide",
        discardReason: "Finish editing to decide",
        editReason: null,
        value: "",
      },
    });

    expect(screen.getByRole("textbox", { name: "Body" })).toBeInTheDocument();
    expect(screen.queryByText("Overage on the monthly invoice")).not.toBeInTheDocument();
    expect(screen.queryByText("acme/billing · Billing")).not.toBeInTheDocument();
    expect(screen.queryByText("Charge past the plan.")).not.toBeInTheDocument();
    expect(screen.queryByText(GESTURE.text)).not.toBeInTheDocument();
    expect(button("Approve")).toHaveAccessibleDescription("Finish editing to decide");
    expect(screen.getByText("Finish editing to decide")).toBeInTheDocument();
  });
});
