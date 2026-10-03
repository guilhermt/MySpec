import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BoardRepositoryRow } from "@/features/boards/BoardRepositoryRow";
import { resolve, setTheme, THEMES, token } from "@/test/painted";
import { makeBoardRepositoryOption, makeRepository } from "@/test/wails-mock";

const TEXT = "Moves to No board: it has a clone. Nothing on disk changes.";

function row(unchecked: boolean) {
  return render(
    <ul>
      <BoardRepositoryRow
        option={makeBoardRepositoryOption({ checked: !unchecked, release: "no_board" })}
        repository={makeRepository()}
        chosenClone=""
        disabled={false}
        consequence={unchecked ? TEXT : ""}
        onCheckedChange={() => {}}
        onCloneChange={() => {}}
      />
    </ul>,
  );
}

describe.each(THEMES)("BoardRepositoryRow in the %s theme", (theme) => {
  it("writes the name in the first ink and the cards and the link in the third", () => {
    setTheme(theme);
    row(false);
    expect(getComputedStyle(screen.getByText("dev/web")).color).toBe(token("--ink-1"));
    expect(getComputedStyle(screen.getByText("4 cards")).color).toBe(token("--ink-3"));
    const link = getComputedStyle(screen.getByText("Registered · ~/projects/web"));
    expect(link.color).toBe(token("--ink-3"));
    expect(link.fontSize).toBe(resolve("var(--text-meta)", "font-size"));
  });

  it("keeps a checked row on the plane", () => {
    setTheme(theme);
    row(false);
    expect(getComputedStyle(screen.getByRole("listitem")).backgroundColor).not.toBe(
      token("--surface-0"),
    );
  });

  it("sinks an unchecked row, with the consequence in the meta size and the second ink", () => {
    setTheme(theme);
    row(true);
    expect(getComputedStyle(screen.getByRole("listitem")).backgroundColor).toBe(
      token("--surface-0"),
    );
    const consequence = getComputedStyle(screen.getByText(`→ ${TEXT}`));
    expect(consequence.color).toBe(token("--ink-2"));
    expect(consequence.fontSize).toBe(resolve("var(--text-meta)", "font-size"));
  });
});
