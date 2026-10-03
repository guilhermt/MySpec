import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import type { DraftStateView } from "@/components/system/draft-views";
import {
  focusRing,
  offWholePixels,
  paintOf,
  resolve,
  setTheme,
  THEMES,
  token,
} from "@/test/painted";
import { Draft, type DraftProps } from "./Draft";

const TITLE = "Overage on the monthly invoice";

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

const FAILED: DraftStateView = {
  ...UNDECIDED,
  open: "GitHub refused the label billing.",
  folded: "Couldn't write to GitHub · open it to Retry",
  glyph: "error",
};

const DECISION: DraftProps["decision"] = {
  shown: true,
  approveReason: null,
  discardReason: null,
  editReason: null,
  value: "",
};

function draw(overrides: Partial<DraftProps> = {}) {
  render(
    <div style={{ width: "720px" }}>
      <Draft
        id="d3"
        number={3}
        name="Draft 3 of 5"
        current={false}
        requestTarget={null}
        kind="New card"
        cardLink={null}
        revised
        title={TITLE}
        untitled={false}
        epic={false}
        discarded={false}
        fields="acme/billing · Billing"
        dependencies={[{ title: "Tier limits", draft: "d1", url: "", linked: false }]}
        onGitHub=""
        warnings={["The module Billing is no longer an option of the board."]}
        refreshing={false}
        body={<p>Charge past the plan.</p>}
        changes={null}
        gesture={{
          icon: "hourglass",
          segments: [
            { text: "Approve", strong: true },
            { text: " publishes this card to GitHub now.", strong: false },
          ],
          text: "Approve publishes this card to GitHub now.",
        }}
        state={UNDECIDED}
        decision={DECISION}
        retry={null}
        editor={null}
        onDecide={() => {}}
        onEdit={() => {}}
        onRetry={() => {}}
        onOpenDependency={() => {}}
        onOpenLink={() => {}}
        {...overrides}
      />
    </div>,
  );
  return screen.getByRole("group", { name: "Draft 3 of 5" });
}

const title = () => getComputedStyle(screen.getByText(TITLE));

/**
 * BOXES are the elements that draw a box: the inside of an icon is a drawing, and a diamond is a
 * square turned, its bounds between pixels.
 */
const BOXES = "*:not(svg *):not([data-state])";

describe.each(THEMES)("Draft in the %s theme", (theme) => {
  it("lies on the card surface in the second line ring, with the medium radius", () => {
    setTheme(theme);
    const draft = draw();
    const want = { background: token("--surface-2") };
    expect(paintOf(draft, want)).toEqual(want);
    expect(getComputedStyle(draft).boxShadow).toContain(token("--line-2"));
    expect(getComputedStyle(draft).borderTopLeftRadius).toBe(resolve("var(--radius-md)", "width"));
  });

  it("rings the current draft in the brand ring", () => {
    setTheme(theme);
    const draft = draw({ current: true });
    expect(getComputedStyle(draft).boxShadow).toContain(token("--brand-ring"));
  });

  it("shows the focus ring when it takes the focus from the keyboard", async () => {
    setTheme(theme);
    const draft = draw({ current: true });
    await userEvent.tab();
    expect(draft).toHaveFocus();
    const want = focusRing();
    expect(paintOf(draft, want)).toEqual(want);
  });

  it("writes the title at 600 in the first ink, at the ui size", () => {
    setTheme(theme);
    draw();
    expect(title().fontWeight).toBe("600");
    expect(title().color).toBe(token("--ink-1"));
    expect(title().fontSize).toBe(resolve("var(--text-ui)", "font-size"));
  });

  it("writes the title of an epic at the body size", () => {
    setTheme(theme);
    draw({ epic: true });
    expect(title().fontSize).toBe(resolve("var(--text-body)", "font-size"));
  });

  it("writes a discarded title in the second ink", () => {
    setTheme(theme);
    draw({ discarded: true });
    expect(title().color).toBe(token("--ink-2"));
  });

  it("writes Untitled epic in the third ink", () => {
    setTheme(theme);
    draw({ epic: true, untitled: true, title: TITLE });
    expect(title().color).toBe(token("--ink-3"));
  });

  it.each([
    ["epic", true],
    ["card", false],
  ])("keeps a discarded %s in full ink, its number too", (_kind, epic) => {
    setTheme(theme);
    draw({ epic, discarded: true });
    const content = screen.getByText(TITLE).parentElement as Element;
    const number = content.previousElementSibling as Element;
    expect([getComputedStyle(content).opacity, getComputedStyle(number).opacity]).toEqual([
      "1",
      "1",
    ]);
  });

  it("writes the fields in the third ink and a warning in the second", () => {
    setTheme(theme);
    draw();
    expect(getComputedStyle(screen.getByText("acme/billing · Billing")).color).toBe(
      token("--ink-3"),
    );
    const warning = screen.getByText("The module Billing is no longer an option of the board.");
    expect(getComputedStyle(warning).color).toBe(token("--ink-2"));
  });

  it("paints the approved button in the brand tint", () => {
    setTheme(theme);
    draw({
      gesture: null,
      state: { ...UNDECIDED, open: "Approved · publishing next" },
      decision: { ...DECISION, value: "approved" },
    });
    const want = { background: token("--brand-tint"), color: token("--brand-ink") };
    expect(paintOf(screen.getByRole("button", { name: "Approve" }), want)).toEqual(want);
    expect(getComputedStyle(screen.getByText("· click again to undo")).color).toBe(
      token("--ink-3"),
    );
  });

  it("writes a hold the user takes a way out of in the first ink at 500", () => {
    setTheme(theme);
    draw({
      gesture: null,
      state: {
        ...UNDECIDED,
        open: "The epic is discarded · this card won't publish",
        glyph: "hold",
        strong: true,
      },
      decision: { ...DECISION, value: "approved" },
    });
    const state = screen.getByText("The epic is discarded · this card won't publish")
      .parentElement as Element;
    expect(getComputedStyle(state).color).toBe(token("--ink-1"));
    expect(getComputedStyle(state).fontWeight).toBe("500");
  });

  it("draws the rail of a failure, its reason in the error ink, and Retry primary", () => {
    setTheme(theme);
    const draft = draw({
      gesture: null,
      state: FAILED,
      decision: { ...DECISION, value: "approved" },
      retry: { disabledReason: null, running: false },
    });
    expect(getComputedStyle(draft).boxShadow).toContain(token("--state-error"));
    const reason = screen.getByText("GitHub refused the label billing.").parentElement as Element;
    expect(getComputedStyle(reason).color).toBe(token("--state-error"));
    const want = { background: token("--brand") };
    expect(paintOf(screen.getByRole("button", { name: "Retry" }), want)).toEqual(want);
  });

  it("lays every box on a whole pixel", () => {
    setTheme(theme);
    const draft = draw({ current: true });
    expect(offWholePixels([draft, ...draft.querySelectorAll(BOXES)])).toEqual([]);
  });
});
