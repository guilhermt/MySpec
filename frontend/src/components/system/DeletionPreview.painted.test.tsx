import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { resolve, setTheme, THEMES, token } from "@/test/painted";
import { type DeletionLine, DeletionPreview } from "./DeletionPreview";
import { ICONS } from "./icons";

const LINES: DeletionLine[] = [
  {
    icon: ICONS.folder,
    text: "The worktree is removed",
    tag: "3 uncommitted files",
    detail: "~/code/api-wt",
    detailMono: true,
  },
  { icon: ICONS.branch, text: "The branch is deleted" },
];

describe.each(THEMES)("DeletionPreview in the %s theme", (theme) => {
  it("sinks the list, in the meta size and the first ink", () => {
    setTheme(theme);
    render(<DeletionPreview state={{ kind: "lines", lines: LINES }} />);
    const style = getComputedStyle(screen.getByRole("list"));
    expect(style.backgroundColor).toBe(token("--surface-0"));
    expect(style.borderTopLeftRadius).toBe(resolve("var(--radius-md)", "border-top-left-radius"));
    expect(style.fontSize).toBe(resolve("var(--text-meta)", "font-size"));
    expect(style.color).toBe(token("--ink-1"));
    expect(style.paddingLeft).toBe(resolve("var(--space-3)", "padding-left"));
  });

  it("rules the lines apart with --line-1, --space-2 above and below", () => {
    setTheme(theme);
    render(<DeletionPreview state={{ kind: "lines", lines: LINES }} />);
    const [first, second] = screen.getAllByRole("listitem");
    expect(getComputedStyle(first as Element).borderTopWidth).toBe("0px");
    expect(getComputedStyle(second as Element).borderTopColor).toBe(token("--line-1"));
    expect(getComputedStyle(second as Element).paddingTop).toBe(
      resolve("var(--space-2)", "padding-top"),
    );
  });

  it("writes the tag with the first ink and the --line-3 outline, the detail in the third ink in mono", () => {
    setTheme(theme);
    render(<DeletionPreview state={{ kind: "lines", lines: LINES }} />);
    const tag = getComputedStyle(screen.getByText("3 uncommitted files"));
    expect(tag.color).toBe(token("--ink-1"));
    expect(tag.borderTopColor).toBe(token("--line-3"));
    const detail = getComputedStyle(screen.getByText("~/code/api-wt"));
    expect(detail.color).toBe(token("--ink-3"));
    expect(detail.fontFamily).toBe(resolve("var(--font-mono)", "font-family"));
    expect(detail.fontSize).toBe(resolve("var(--text-micro)", "font-size"));
  });

  it("puts the detail on a line under the text", () => {
    setTheme(theme);
    render(<DeletionPreview state={{ kind: "lines", lines: LINES }} />);
    expect(screen.getByText("~/code/api-wt").getBoundingClientRect().top).toBeGreaterThanOrEqual(
      screen.getByText("The worktree is removed").getBoundingClientRect().bottom,
    );
  });

  it("shimmers the reading line and sinks a block of three bars", () => {
    setTheme(theme);
    const { container } = render(<DeletionPreview state={{ kind: "reading" }} />);
    const line = screen.getByText("Reading the worktree and the branch…");
    expect(getComputedStyle(line).animationName).not.toBe("none");
    const bars = container.querySelectorAll('[data-slot="skeleton"]');
    expect(bars).toHaveLength(3);
    expect(getComputedStyle(bars[0]?.parentElement as Element).backgroundColor).toBe(
      token("--surface-0"),
    );
  });
});
