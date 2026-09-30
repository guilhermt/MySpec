import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NONE, paintOf, setTheme, THEMES, token, visibleShadows } from "@/test/painted";
import { DependencyNotice } from "./DependencyNotice";

const MODEL = {
  title: "Depends on #461",
  issueTitle: "Metering events from the gateway",
  meta: "acme/gateway · Open · Backlog. A warning only: it never blocks.",
};

function draw(outlined: boolean) {
  render(<DependencyNotice model={MODEL} outlined={outlined} />);
  return screen.getByText(MODEL.meta).parentElement as HTMLElement;
}

describe.each(THEMES)("DependencyNotice in the %s theme", (theme) => {
  it("is sunken, with no outline of its own", () => {
    setTheme(theme);
    const notice = draw(false);
    expect(paintOf(notice, { background: token("--surface-0") })).toEqual({
      background: token("--surface-0"),
    });
    expect(visibleShadows(getComputedStyle(notice).boxShadow)).toBe(NONE);
  });

  it("is outlined by the second line when it lies in a sunken panel", () => {
    setTheme(theme);
    const notice = draw(true);
    expect(getComputedStyle(notice).boxShadow).toContain(token("--line-2"));
  });

  it("writes the title at 600 in the first ink and the meta in the second", () => {
    setTheme(theme);
    draw(false);
    const title = screen.getByText("Depends on #461");
    expect(getComputedStyle(title).fontWeight).toBe("600");
    expect(getComputedStyle(title).color).toBe(token("--ink-1"));
    expect(getComputedStyle(screen.getByText(MODEL.meta)).color).toBe(token("--ink-2"));
  });
});
