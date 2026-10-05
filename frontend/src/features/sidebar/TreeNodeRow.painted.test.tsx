import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TreeNode } from "@/features/sidebar/sidebar-tree";
import { TreeNodeRow } from "@/features/sidebar/TreeNodeRow";
import { focusRing, paintOf, scriptFocused, setTheme, THEMES } from "@/test/painted";
import { renderWithStore } from "@/test/render";
import { makeBoard } from "@/test/wails-mock";

const NODE: TreeNode = {
  kind: "board",
  id: "board:board-1",
  board: makeBoard({ id: "board-1", title: "Product" }),
  notices: [],
  epics: [],
  rows: [],
};

describe.each(THEMES)("TreeNodeRow in the %s theme", (theme) => {
  it("shows the focus ring on a script focus that follows a click", async () => {
    setTheme(theme);
    renderWithStore(
      <TreeNodeRow
        node={NODE}
        level={1}
        expanded
        current={false}
        summary={null}
        flash={null}
        groupId="board:board-1:group"
        tabIndex={0}
      />,
    );
    const node = screen.getByRole("treeitem", { name: "Product" });
    const want = focusRing();
    expect(await scriptFocused(node, () => paintOf(node, want))).toEqual(want);
  });
});
