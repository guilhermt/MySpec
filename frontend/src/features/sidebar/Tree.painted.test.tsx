import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tree } from "@/features/sidebar/Tree";
import { resolve, setTheme, THEMES } from "@/test/painted";
import { renderWithStore } from "@/test/render";
import {
  makeBoard,
  makeRepository,
  makeReviewSummary,
  makeState,
  makeTask,
  makeTaskCard,
} from "@/test/wails-mock";

const EPIC = {
  key: "e1",
  repository: "dev/web",
  number: 9,
  title: "Login",
  url: "",
  state: "open",
};

// tree draws Reviews with a review, a board with a task in an epic, open, and a task outside it,
// and No board with a task, in a sidebar as wide as the narrowest one.
function tree() {
  renderWithStore(
    <div style={{ width: "288px" }}>
      <Tree />
    </div>,
    {
      state: makeState({
        repositories: [
          makeRepository({ id: "repo-1", boardId: "board-1" }),
          makeRepository({ id: "repo-2", boardId: "" }),
        ],
        boards: [makeBoard({ id: "board-1", title: "Product", repositoryIds: ["repo-1"] })],
        reviews: [makeReviewSummary({ id: "review-1", title: "Rate limit" })],
        tasks: [
          makeTask({
            id: "task-1",
            name: "add-login",
            repositoryId: "repo-1",
            card: makeTaskCard({ number: 1, epic: EPIC }),
          }),
          makeTask({ id: "task-2", name: "fix-header", repositoryId: "repo-1" }),
          makeTask({ id: "task-3", name: "bump-deps", repositoryId: "repo-2" }),
        ],
      }),
      ui: { location: { kind: "task", id: "task-1" } },
    },
  );
  return within(screen.getByRole("tree", { name: "Active items" })).getAllByRole("treeitem");
}

// px is a length token in pixels.
function px(name: `--${string}`): number {
  return Number.parseFloat(resolve(`var(${name})`, "width"));
}

describe.each(THEMES)("Tree in the %s theme", (theme) => {
  it("sets the top nodes apart by the section gap", () => {
    setTheme(theme);
    const lines = tree();

    const tops = lines.filter((line) => line.getAttribute("aria-level") === "1");
    expect(tops.map((top) => top.textContent)).toEqual(["Reviews", "Product", "No board"]);
    for (const top of tops.slice(1)) {
      // The line above a top node is the last line of the section before it.
      const above = lines[lines.indexOf(top) - 1];
      if (above === undefined) throw new Error("a section above");
      const gap = top.getBoundingClientRect().top - above.getBoundingClientRect().bottom;
      expect(gap).toBe(px("--section-gap"));
    }
  });

  it("steps the row of an epic in as a box, after the guide, which stays in sight", () => {
    setTheme(theme);
    const lines = tree();

    const board = lines.find((line) => line.textContent === "Product");
    const row = screen.getByRole("treeitem", { name: /^task add-login\./ });
    const group = row.parentElement;
    if (board === undefined || group === null) throw new Error("the board and the epic's group");
    const guide = getComputedStyle(group, "::before");
    const guideRight =
      group.getBoundingClientRect().left +
      Number.parseFloat(guide.left) +
      Number.parseFloat(guide.width);

    expect(row.getBoundingClientRect().left - board.getBoundingClientRect().left).toBe(
      px("--epic-indent"),
    );
    expect(guideRight).toBeLessThanOrEqual(row.getBoundingClientRect().left);
    expect(guideRight).toBeGreaterThan(board.getBoundingClientRect().left);
  });
});
