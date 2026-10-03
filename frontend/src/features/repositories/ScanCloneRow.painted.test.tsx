import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScanCloneRow, type ScanCloneRowProps } from "@/features/repositories/ScanCloneRow";
import { resolve, setTheme, THEMES, token } from "@/test/painted";
import { makeRepositoryCandidate } from "@/test/wails-mock";

function row(props: Partial<ScanCloneRowProps> = {}) {
  return render(
    <ul>
      <ScanCloneRow
        candidate={makeRepositoryCandidate()}
        checked={false}
        disabled={false}
        adding={false}
        refusal=""
        linksAClone={false}
        registered={false}
        onCheckedChange={() => {}}
        {...props}
      />
    </ul>,
  );
}

describe.each(THEMES)("ScanCloneRow in the %s theme", (theme) => {
  it("writes the name in the first ink and the path in mono, in the third", () => {
    setTheme(theme);
    row();
    expect(getComputedStyle(screen.getByText("dev/web")).color).toBe(token("--ink-1"));
    expect(getComputedStyle(screen.getByText("dev/web")).fontWeight).toBe("500");
    const path = getComputedStyle(screen.getByText("~/projects/web"));
    expect(path.color).toBe(token("--ink-3"));
    expect(path.fontFamily).toBe(resolve("var(--font-mono)", "font-family"));
  });

  it("writes the link line in the second ink and the refusal in the error color, both in the meta size", () => {
    setTheme(theme);
    row({ linksAClone: true, refusal: "dev/web is already registered at ~/web." });
    const link = getComputedStyle(
      screen.getByText("Registered without a clone: this links the clone to it."),
    );
    expect(link.color).toBe(token("--ink-2"));
    expect(link.fontSize).toBe(resolve("var(--text-meta)", "font-size"));
    const refusal = getComputedStyle(screen.getByRole("alert"));
    expect(refusal.color).toBe(token("--state-error"));
    expect(refusal.fontSize).toBe(resolve("var(--text-meta)", "font-size"));
  });

  it("dashes the box of a registered clone and writes it in the fourth ink", () => {
    setTheme(theme);
    row({ disabled: true });
    const box = screen.getByRole("checkbox").querySelector("[aria-hidden]");
    expect(box).not.toBeNull();
    expect(getComputedStyle(box as Element).borderStyle).toBe("dashed");
    expect(getComputedStyle(screen.getByRole("checkbox")).color).toBe(token("--ink-4"));
  });
});
