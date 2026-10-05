import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import {
  dashedDisabled,
  focusRing,
  paintOf,
  pressed,
  setTheme,
  THEMES,
  token,
} from "@/test/painted";
import { OptionGroup, type OptionView } from "./OptionGroup";

const OPTIONS: OptionView[] = [
  { value: "comment", key: "1", title: "Comment", note: "Leave the findings only." },
  { value: "request", key: "2", title: "Request changes", note: "Ask for changes." },
  { value: "approve", key: "3", title: "Approve", note: "", disabledReason: "It's yours." },
];

function subject(value: string | null = "request") {
  render(<OptionGroup label="Verdict" value={value} options={OPTIONS} onChange={() => {}} />);
}

function radio(name: RegExp): HTMLElement {
  return screen.getByRole("radio", { name });
}

describe.each(THEMES)("OptionGroup in the %s theme", (theme) => {
  it("draws an option on the card surface with the second line", () => {
    setTheme(theme);
    subject();
    const want = { background: token("--surface-2"), border: token("--line-2") };
    expect(paintOf(radio(/Comment/), want)).toEqual(want);
  });

  it("draws the chosen option and its key in the brand", () => {
    setTheme(theme);
    subject();
    const want = { background: token("--brand-tint"), border: token("--brand-ring") };
    expect(paintOf(radio(/Request changes/), want)).toEqual(want);
    const key = screen.getByText("2");
    const keyWant = { border: token("--brand-ring"), color: token("--brand-ink") };
    expect(paintOf(key, keyWant)).toEqual(keyWant);
  });

  it("presses an option in the veil, and leaves a disabled one dashed", async () => {
    setTheme(theme);
    subject();
    const option = radio(/Comment/);
    expect(await pressed(option, () => paintOf(option, { background: "" }))).toEqual({
      background: token("--veil-press"),
    });
    const disabled = radio(/Approve/);
    const want = dashedDisabled();
    expect(await pressed(disabled, () => paintOf(disabled, want))).toEqual(want);
  });

  it("dashes a disabled option", async () => {
    setTheme(theme);
    subject();
    await userEvent.hover(radio(/Approve/));
    const want = dashedDisabled();
    expect(paintOf(radio(/Approve/), want)).toEqual(want);
  });

  it("rings the focused option", async () => {
    setTheme(theme);
    subject(null);
    await userEvent.tab();
    const want = focusRing();
    expect(paintOf(radio(/Comment/), want)).toEqual(want);
  });
});
