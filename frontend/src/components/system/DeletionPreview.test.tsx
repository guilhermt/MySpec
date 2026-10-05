import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { type DeletionLine, DeletionPreview } from "./DeletionPreview";
import { ICONS } from "./icons";

const LINES: DeletionLine[] = [
  { icon: "run", text: "The reviewer's answer in progress is interrupted" },
  {
    icon: ICONS.folder,
    text: "The worktree is removed",
    tag: "3 uncommitted files",
    detail: "~/code/api-wt",
    detailMono: true,
  },
  {
    icon: "blocked",
    text: "Couldn't read the worktree",
    detail: "boom. Deleting still removes it.",
  },
  { icon: ICONS.branch, text: "The branch", mono: "rate-limit" },
  {
    icon: ICONS.pullRequest,
    text: "PR #1284 stays open on GitHub",
    detail: "Close it there if you don't need it.",
    link: { label: "Open #1284", href: "https://github.com/acme/api/pull/1284" },
  },
];

describe("DeletionPreview", () => {
  it("says it is reading and shows three bars", () => {
    const { container } = render(<DeletionPreview state={{ kind: "reading" }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Reading the worktree and the branch…");
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(3);
  });

  it("lists the lines under the name of what will be destroyed", () => {
    render(<DeletionPreview state={{ kind: "lines", lines: LINES }} />);
    const list = screen.getByRole("list", { name: "What will be destroyed" });
    expect(list.querySelectorAll("li")).toHaveLength(5);
  });

  it("writes the tag, the mono, the detail and the link", () => {
    render(<DeletionPreview state={{ kind: "lines", lines: LINES }} />);
    expect(screen.getByText("3 uncommitted files")).toHaveAttribute("data-variant", "edited");
    expect(screen.getByText("rate-limit").className).toContain("font-mono");
    expect(screen.getByText("~/code/api-wt").className).toContain("font-mono");
    expect(screen.getByRole("link", { name: /Open #1284/ })).toHaveAttribute(
      "href",
      "https://github.com/acme/api/pull/1284",
    );
  });

  it("draws the spinner for run and the diamond for blocked", () => {
    const { container } = render(<DeletionPreview state={{ kind: "lines", lines: LINES }} />);
    expect(container.querySelector(".spin-glyph")).not.toBeNull();
    expect(container.querySelector('[data-state="blocked"]')).not.toBeNull();
  });

  it("draws nothing without lines", () => {
    render(<DeletionPreview state={{ kind: "lines", lines: [] }} />);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
