import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { focusRing, paintOf, resolve, setTheme, THEMES, token } from "@/test/painted";
import { Continue, type ContinueView } from "./Continue";

const MODEL: ContinueView = {
  row: {
    itemKind: "task",
    name: "Add the audit log",
    tone: "wait",
    line2: { long: "Question · Reviewer · Step 3/7" },
    clock: { kind: "chip", tone: "wait", time: "18m", longTime: "18 minutes" },
  },
  crumbs: "Platform Roadmap / API hardening",
  label: "Continue: Add the audit log. Platform Roadmap / API hardening",
};

function draw() {
  render(<Continue model={MODEL} onOpen={() => {}} />);
  return screen.getByRole("button");
}

describe.each(THEMES)("Continue in the %s theme", (theme) => {
  it("is raised: the second surface, the extra small shadow and the large radius", () => {
    setTheme(theme);
    const button = draw();
    const want = {
      background: token("--surface-2"),
      shadow: resolve("var(--shadow-xs)", "box-shadow"),
    };
    expect(paintOf(button, want)).toEqual(want);
    expect(getComputedStyle(button).borderTopLeftRadius).toBe(resolve("var(--radius-lg)", "width"));
  });

  it("writes the name at 600 in the body size, and the crumbs in the third ink", () => {
    setTheme(theme);
    draw();
    const name = screen.getByText("Add the audit log");
    expect(getComputedStyle(name).fontWeight).toBe("600");
    expect(getComputedStyle(name).fontSize).toBe(resolve("var(--text-body)", "font-size"));
    expect(getComputedStyle(screen.getByText(/^· Platform/)).color).toBe(token("--ink-3"));
  });

  it("steps up on hover and shows the focus ring", async () => {
    setTheme(theme);
    const button = draw();
    await userEvent.hover(button);
    const want = { background: token("--surface-2-hover") };
    expect(paintOf(button, want)).toEqual(want);
    await userEvent.tab();
    expect(paintOf(button, focusRing())).toEqual(focusRing());
  });

  it("is a whole number of pixels tall and truncates a long name", () => {
    setTheme(theme);
    const button = draw();
    expect(Number.isInteger(button.getBoundingClientRect().height)).toBe(true);
    expect(getComputedStyle(screen.getByText("Add the audit log")).textOverflow).toBe("ellipsis");
  });

  it("cuts a long second line inside the button, and says it whole in a tooltip", async () => {
    setTheme(theme);
    const long =
      "Question · Reviewer · Step 3/7 · waiting for you since the refund tests failed twice";
    render(
      <div style={{ width: "var(--size-dialog)" }}>
        <Continue
          model={{ ...MODEL, row: { ...MODEL.row, line2: { long } }, crumbs: "" }}
          onOpen={() => {}}
        />
      </div>,
    );
    const button = screen.getByRole("button");
    const line = screen.getByText(long);
    expect(line.scrollWidth).toBeGreaterThan(line.clientWidth);
    expect(line.getBoundingClientRect().right).toBeLessThanOrEqual(
      button.getBoundingClientRect().right,
    );
    await userEvent.hover(line);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(long);
  });
});
