import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { focusRing, paintOf, resolve, setTheme, THEMES, token } from "@/test/painted";
import { Finding, type FindingView } from "./Finding";

function view(overrides: Partial<FindingView> = {}): FindingView {
  return {
    id: "2",
    number: 2,
    name: "Finding 2 of 3: The form never saves. GeneralForm.tsx, line 84. Not decided.",
    title: "The form never saves",
    locationAsTitle: false,
    location: {
      kind: "anchored",
      text: "web/src/settings/GeneralForm.tsx:84",
      url: "https://github.com/dev/web/pull/7/files#diff-abR84",
      line: 84,
      fileName: "GeneralForm.tsx",
    },
    text: "The submit handler drops the value.",
    decision: "",
    disabled: null,
    ...overrides,
  };
}

function draw(model: Partial<FindingView> = {}, current = true, error: "decision" | null = null) {
  render(
    <Finding
      model={view(model)}
      current={current}
      error={error}
      editNote="Saved as you type."
      onDecide={() => {}}
      onOpenLine={() => {}}
      renderText={(text) => <p>{text}</p>}
    />,
  );
  return screen.getByRole("group");
}

describe.each(THEMES)("Finding in the %s theme", (theme) => {
  it("draws the ring in the first line and the medium radius", () => {
    setTheme(theme);
    const finding = draw({}, false);
    expect(getComputedStyle(finding).boxShadow).toContain(token("--line-1"));
    expect(getComputedStyle(finding).borderTopLeftRadius).toBe(
      resolve("var(--radius-md)", "width"),
    );
  });

  it("draws the ring of the error in the error ink", () => {
    setTheme(theme);
    const finding = draw({}, false, "decision");
    expect(getComputedStyle(finding).boxShadow).toContain(token("--state-error"));
  });

  it("writes the title at 600 in the first ink, and in the second when discarded", () => {
    setTheme(theme);
    draw();
    const title = screen.getByText("The form never saves");
    expect(getComputedStyle(title).fontWeight).toBe("600");
    expect(getComputedStyle(title).color).toBe(token("--ink-1"));
  });

  it("writes a discarded title in the second ink", () => {
    setTheme(theme);
    draw({ decision: "discarded" });
    expect(getComputedStyle(screen.getByText("The form never saves")).color).toBe(token("--ink-2"));
  });

  it("paints the approved button in the brand tint", () => {
    setTheme(theme);
    draw({ decision: "approved" });
    const want = { background: token("--brand-tint"), color: token("--brand-ink") };
    expect(paintOf(screen.getByRole("button", { name: "Approve" }), want)).toEqual(want);
  });

  it("shows the focus ring when the finding takes the focus from the keyboard", async () => {
    setTheme(theme);
    const finding = draw();
    await userEvent.tab();
    expect(finding).toHaveFocus();
    const want = focusRing();
    expect(paintOf(finding, want)).toEqual(want);
  });
});
