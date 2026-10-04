import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CloseResult, type CloseResultLine } from "./CloseResult";

const LINES: CloseResultLine[] = [
  { outcome: "done", text: "Worktree removed" },
  {
    outcome: "skipped",
    text: "The branch",
    mono: "idempotency-keys",
    after: "Delete it with git branch -D once you don't need it.",
  },
  { outcome: "failed", text: "dev not updated", detail: "fatal: not a fast-forward" },
];

describe("CloseResult", () => {
  it("is a group named by its label, with the legend and the time", () => {
    render(
      <CloseResult legend="Closing" time="15:02" label="What the closing did" lines={LINES} />,
    );
    const group = screen.getByRole("group", { name: "What the closing did" });
    expect(within(group).getByText("Closing")).toBeInTheDocument();
    expect(within(group).getByText("15:02")).toBeInTheDocument();
  });

  it("lists one item per line, with the mono, the after and the detail", () => {
    render(<CloseResult legend="Closing" label="What the closing did" lines={LINES} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("idempotency-keys").className).toContain("font-mono");
    expect(screen.getByText(/git branch -D/)).toBeInTheDocument();
    expect(screen.getByText("fatal: not a fast-forward").className).toContain("font-mono");
  });

  it("marks each outcome apart and hides the marks from the reader", () => {
    const { container } = render(
      <CloseResult legend="Closing" label="What the closing did" lines={LINES} />,
    );
    expect(container.querySelector("li svg")).not.toBeNull();
    expect(screen.getByText("–")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector('[data-state="error"]')).not.toBeNull();
  });

  it("omits the time it doesn't have", () => {
    render(<CloseResult legend="Closing" label="What the closing did" lines={LINES} />);
    expect(screen.queryByText("15:02")).toBeNull();
  });
});
