import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { PullRequestTree } from "@/features/reviews/PullRequestTree";
import { pullRequestRowModel, reviewRows, reviewSections } from "@/features/reviews/review-list";
import type { PullRequestRow } from "@/lib/wails";
import { makePullRequestRow, makeReviewCenter, makeState } from "@/test/wails-mock";

const FIRST = makePullRequestRow({ key: "dev/web#12", number: 12, title: "Add the login screen" });
const SECOND = makePullRequestRow({
  key: "dev/web#7",
  number: 7,
  title: "Fix the header",
  updatedAt: "2026-09-15T12:00:00Z",
});
const DONE = makePullRequestRow({
  key: "dev/web#3",
  number: 3,
  title: "Old one",
  pending: false,
  reviewed: true,
});

function tree(
  pullRequests: PullRequestRow[],
  props: {
    collapsed?: string[];
    openKey?: string | null;
    newKeys?: string[];
    onActivate?: (row: PullRequestRow) => void;
    onToggleSection?: (id: string) => void;
    withoutModel?: string;
  } = {},
) {
  const app = makeState();
  const rows = reviewRows(
    reviewSections(makeReviewCenter({ pullRequests })),
    new Set(props.collapsed ?? []),
  );
  const models = new Map(
    rows.flatMap((row) =>
      row.kind === "pr" && row.row.key !== props.withoutModel
        ? [[row.row.key, pullRequestRowModel(row.row, { app, now: Date.now() })] as const]
        : [],
    ),
  );
  const user = userEvent.setup();
  render(
    <PullRequestTree
      rows={rows}
      models={models}
      openKey={props.openKey ?? null}
      newKeys={new Set(props.newKeys ?? [])}
      treeRef={createRef<HTMLDivElement>()}
      onToggleSection={props.onToggleSection ?? vi.fn()}
      onActivate={props.onActivate ?? vi.fn()}
    />,
  );
  return { user };
}

describe("PullRequestTree", () => {
  it("is a tree of the sections, each header followed by its rows", () => {
    tree([FIRST, SECOND, DONE]);

    expect(
      screen.getByRole("tree", { name: "Open pull requests, by what they wait for" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("treeitem").map((item) => item.getAttribute("aria-label")?.split(" ")[0]),
    ).toEqual(["Pending,", "web#12", "web#7", "In", "Reviewed,", "web#3", "Yours"]);
  });

  it("hides the rows of a collapsed section, and says so on its header", () => {
    tree([FIRST, DONE], { collapsed: ["reviewed"] });

    expect(screen.getByRole("treeitem", { name: /^Reviewed,/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByText("Old one")).not.toBeInTheDocument();
  });

  it("names each section with its count, and explains it in a tooltip", async () => {
    const { user } = tree([FIRST, SECOND]);

    const header = screen.getByRole("treeitem", { name: "Pending, 2 pull requests" });
    await user.hover(header);

    expect(
      await screen.findByText("Never reviewed by you, or with commits after your last review"),
    ).toBeInTheDocument();
  });

  it("draws an empty section without a chevron or an action", async () => {
    const onToggleSection = vi.fn();
    const { user } = tree([FIRST], { onToggleSection });

    const empty = screen.getByRole("treeitem", { name: "In review, 0 pull requests" });
    await user.click(empty);

    expect(empty).not.toHaveAttribute("aria-expanded");
    expect(onToggleSection).not.toHaveBeenCalled();
  });

  it("toggles a section by its header", async () => {
    const onToggleSection = vi.fn();
    const { user } = tree([FIRST], { onToggleSection });

    await user.click(screen.getByRole("treeitem", { name: /^Pending,/ }));

    expect(onToggleSection).toHaveBeenCalledExactlyOnceWith("pending");
  });

  it("activates a row by a click and by Enter, with its pull request", async () => {
    const onActivate = vi.fn();
    const { user } = tree([FIRST, SECOND], { onActivate });

    await user.click(screen.getByRole("treeitem", { name: /^web#7 / }));
    screen.getByRole("treeitem", { name: /^web#12 / }).focus();
    await user.keyboard("{Enter}");

    expect(onActivate).toHaveBeenNthCalledWith(1, SECOND);
    expect(onActivate).toHaveBeenNthCalledWith(2, FIRST);
  });

  it("marks the open row selected, and the one the tab stop sits on", () => {
    tree([FIRST, SECOND], { openKey: "dev/web#7" });

    expect(screen.getByRole("treeitem", { name: /^web#7 / })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("treeitem", { name: /^web#12 / })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    // The open row holds the tab stop until the focus has been on the list.
    expect(screen.getByRole("treeitem", { name: /^web#7 / })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("treeitem", { name: /^web#12 / })).toHaveAttribute("tabindex", "-1");
  });

  it("flashes the rows a reading brought", () => {
    tree([FIRST, SECOND], { newKeys: ["dev/web#12"] });

    expect(screen.getByRole("treeitem", { name: /^web#12 / })).toHaveClass("row-flash");
    expect(screen.getByRole("treeitem", { name: /^web#7 / })).not.toHaveClass("row-flash");
  });

  it("skips a row it has no model for", () => {
    tree([FIRST, SECOND], { withoutModel: "dev/web#7" });

    expect(screen.queryByRole("treeitem", { name: /^web#7 / })).not.toBeInTheDocument();
    expect(screen.getByRole("treeitem", { name: /^web#12 / })).toBeInTheDocument();
  });
});
