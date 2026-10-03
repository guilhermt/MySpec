import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { resolve, setTheme, THEMES, token } from "@/test/painted";
import { MachineChecks, type MachineItemView } from "./MachineChecks";

const ITEMS: MachineItemView[] = [
  {
    id: "gh",
    title: "GitHub CLI isn't signed in",
    text: "Sign in to read pull requests.",
    command: "gh auth login",
  },
];

describe.each(THEMES)("MachineChecks in the %s theme", (theme) => {
  it("writes the title at 500 in the first ink and the text in the third", () => {
    setTheme(theme);
    render(<MachineChecks items={ITEMS} />);
    const title = getComputedStyle(screen.getByText("GitHub CLI isn't signed in"));
    expect(title.fontWeight).toBe("500");
    expect(title.color).toBe(token("--ink-1"));
    const text = getComputedStyle(screen.getByText("Sign in to read pull requests."));
    expect(text.color).toBe(token("--ink-3"));
    expect(text.fontSize).toBe(resolve("var(--text-meta)", "font-size"));
  });

  it("writes the command as a mono tag", () => {
    setTheme(theme);
    render(<MachineChecks items={ITEMS} />);
    const command = getComputedStyle(screen.getByText("gh auth login"));
    expect(command.fontFamily).toBe(resolve("var(--font-mono)", "font-family"));
    expect(command.backgroundColor).toBe(token("--surface-0"));
  });

  it("draws the blocked diamond", () => {
    setTheme(theme);
    const { container } = render(<MachineChecks items={ITEMS} />);
    const glyph = container.querySelector("[data-state='blocked']") as Element;
    expect(getComputedStyle(glyph).borderTopColor).toBe(token("--state-notice"));
  });
});
