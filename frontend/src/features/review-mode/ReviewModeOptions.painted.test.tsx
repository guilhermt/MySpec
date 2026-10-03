import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import {
  dashedDisabled,
  mainArea,
  paintOf,
  resolve,
  setTheme,
  THEMES,
  token,
} from "@/test/painted";
import { renderWithStore } from "@/test/render";
import { ReviewModeOptions, type ReviewModeOptionsProps } from "./ReviewModeOptions";

function options(props: Partial<ReviewModeOptionsProps> = {}, width = 1000) {
  renderWithStore(
    <div style={mainArea(width)}>
      <ReviewModeOptions
        label="Review mode of a new task"
        value="manual"
        saving={null}
        layout="row"
        onChoose={() => {}}
        {...props}
      />
    </div>,
  );
}

const option = (name: RegExp) => screen.getByRole("radio", { name });
const columns = () =>
  getComputedStyle(screen.getByRole("radiogroup")).gridTemplateColumns.split(" ").length;

describe.each(THEMES)("ReviewModeOptions in the %s theme", (theme) => {
  it("outlines each option by the second line, the chosen one tinted with the brand ring", () => {
    setTheme(theme);
    options();

    const chosen = {
      background: token("--brand-tint"),
      shadow: resolve("inset 0 0 0 var(--border) var(--brand-ring)", "box-shadow"),
    };
    expect(paintOf(option(/^Manual/), chosen)).toEqual(chosen);
    expect(paintOf(option(/^Agent/), { border: "" })).toEqual({ border: token("--line-2") });
    const check = option(/^Manual/).querySelectorAll("svg")[1] as SVGElement;
    expect(paintOf(check, { color: "" })).toEqual({ color: token("--brand-ink") });
    expect(getComputedStyle(check).visibility).toBe("visible");
  });

  it("veils the other option under the pointer", async () => {
    setTheme(theme);
    options();

    await userEvent.hover(option(/^Agent/));

    expect(paintOf(option(/^Agent/), { background: "" })).toEqual({
      background: token("--veil-hover"),
    });
  });

  it("sets the two options side by side from 820px of main area, and one under the other below", () => {
    setTheme(theme);
    options({}, 1000);
    expect(columns()).toBe(2);
  });

  it("stacks the options in the narrowest main area", () => {
    setTheme(theme);
    options({}, 812);
    expect(columns()).toBe(1);
  });

  it("puts the spinner in the place of the check of the option that saves", () => {
    setTheme(theme);
    options({ saving: "agent" });

    const saving = option(/^Agent/);
    expect(saving).toHaveTextContent("Agent · saving…");
    expect(saving.querySelector("svg.lucide-check")).toBeNull();
  });

  it("dashes both options when they can't change", () => {
    setTheme(theme);
    options({ disabled: true });

    const want = dashedDisabled();
    expect(paintOf(option(/^Agent/), want)).toEqual(want);
    expect(paintOf(option(/^Manual/), want)).toEqual(want);
  });
});
