import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  type EpicNode,
  nodeSummary,
  type TreeNode,
  taskRow,
} from "@/features/sidebar/sidebar-tree";
import { TreeNodeRow, type TreeNodeRowProps } from "@/features/sidebar/TreeNodeRow";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeBoard, makeSituation, makeState, makeTask } from "@/test/wails-mock";

const NOW = Date.parse("2026-09-05T12:00:00Z");

function boardNode(overrides: Partial<Parameters<typeof makeBoard>[0]> = {}): TreeNode {
  const board = makeBoard({ id: "board-1", title: "Product", ...overrides });
  return { kind: "board", id: "board:board-1", board, notices: [], epics: [], rows: [] };
}

function reviewsNode(overrides: Partial<Extract<TreeNode, { kind: "reviews" }>> = {}): TreeNode {
  return {
    kind: "reviews",
    id: "reviews",
    rows: [],
    pending: 0,
    reading: false,
    failures: [],
    ...overrides,
  };
}

function renderNode(node: TreeNode | EpicNode, props: Partial<TreeNodeRowProps> = {}) {
  return renderWithStore(
    <TreeNodeRow
      node={node}
      level={1}
      expanded
      current={false}
      summary={null}
      flash={null}
      groupId={`${node.id}:group`}
      tabIndex={0}
      {...props}
    />,
  );
}

describe("TreeNodeRow", () => {
  it("names a board by its title and owns its group", () => {
    renderNode(boardNode());

    const node = screen.getByRole("treeitem", { name: "Product" });
    expect(node).toHaveAttribute("aria-expanded", "true");
    expect(node).toHaveAttribute("aria-owns", "board:board-1:group");
    expect(node).toHaveAttribute("aria-level", "1");
  });

  it("tells a board being read, in its name too", () => {
    renderNode(boardNode({ reading: true }));

    expect(screen.getByRole("treeitem", { name: "Product, reading" })).toHaveTextContent(
      "reading…",
    );
  });

  it("tells a failed reading, with the failure in the tooltip", async () => {
    const { user } = renderNode(
      boardNode({ failure: { reason: "gh_failed", message: "gh is not signed in", failedAt: "" } }),
    );

    await user.hover(screen.getByText("Read failed"));

    expect(await screen.findByRole("tooltip")).toHaveTextContent("gh is not signed in");
  });

  it("names a board whose reading failed with the failure", () => {
    renderNode(
      boardNode({ failure: { reason: "gh_failed", message: "gh is not signed in", failedAt: "" } }),
    );

    expect(
      screen.getByRole("treeitem", { name: "Product, read failed: gh is not signed in" }),
    ).toBeInTheDocument();
  });

  it("says nothing more of a quiet board", () => {
    renderNode(boardNode());

    expect(screen.getByRole("treeitem", { name: "Product" })).toHaveTextContent(/^Product$/);
  });

  it("tells the pull requests pending a review", () => {
    renderNode(reviewsNode({ pending: 3 }));

    expect(screen.getByRole("treeitem", { name: "Reviews, 3 pending" })).toHaveTextContent(
      "3 pending",
    );
  });

  it("tells Reviews reading", () => {
    renderNode(reviewsNode({ reading: true, pending: 3 }));

    expect(screen.getByRole("treeitem", { name: "Reviews, reading" })).toHaveTextContent(
      "reading…",
    );
  });

  it("tells the repositories Reviews failed to read", async () => {
    const { user } = renderNode(
      reviewsNode({ failures: ["dev/web: gh failed", "dev/api: gh failed"] }),
    );

    await user.hover(screen.getByText("Read failed"));

    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "dev/web: gh failed, dev/api: gh failed",
    );
    expect(
      screen.getByRole("treeitem", {
        name: "Reviews, read failed: dev/web: gh failed, dev/api: gh failed",
      }),
    ).toBeInTheDocument();
  });

  it("says nothing more of Reviews without a review", () => {
    renderNode(reviewsNode());

    expect(screen.getByRole("treeitem", { name: "Reviews" })).toHaveTextContent(/^Reviews$/);
  });

  it("sums up a collapsed node in its name, blinking with its rows", () => {
    const rows = [
      taskRow(makeState(), makeTask({ id: "a", situations: [makeSituation({ id: "s1" })] }), NOW),
      taskRow(
        makeState(),
        makeTask({
          id: "b",
          situations: [makeSituation({ id: "s2", kind: "session_error", group: "error" })],
        }),
        NOW,
      ),
    ];
    renderNode(boardNode(), { expanded: false, summary: nodeSummary(rows), flash: "error" });

    const node = screen.getByRole("treeitem", { name: "Product, 1 error, 1 waiting" });
    expect(node).toHaveAttribute("aria-expanded", "false");
    const summary = screen.getByRole("img", { name: "1 error, 1 waiting" });
    expect(summary).toHaveTextContent("1 error1");
    expect(summary).toHaveAttribute("data-flash", "error");
  });

  it("marks the board on screen as the page", () => {
    renderNode(boardNode(), { current: true });

    expect(screen.getByRole("treeitem", { name: "Product" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("collapses the node from its chevron, which takes no Tab stop", async () => {
    const { user } = renderNode(boardNode());

    const chevron = screen.getByRole("button", { name: "Collapse" });
    expect(chevron).toHaveAttribute("tabindex", "-1");
    await user.click(chevron);

    expect(useAppStore.getState().sidebarCollapsed.has("board:board-1")).toBe(true);
  });

  it("opens the board from its title", async () => {
    const { user } = renderNode(boardNode());

    await user.click(screen.getByText("Product"));

    expect(useAppStore.getState().location).toEqual({ kind: "board", id: "board-1" });
  });

  it("opens Reviews from its title", async () => {
    const { user } = renderNode(reviewsNode());

    await user.click(screen.getByText("Reviews"));

    expect(useAppStore.getState().location).toEqual({ kind: "reviews" });
  });

  it("collapses an epic from its title", async () => {
    const epic: EpicNode = { kind: "epic", id: "epic:board-1:login", title: "Login", rows: [] };
    const { user } = renderNode(epic, { level: 2 });

    await user.click(screen.getByText("Login"));

    expect(useAppStore.getState().sidebarCollapsed.has("epic:board-1:login")).toBe(true);
  });
});
