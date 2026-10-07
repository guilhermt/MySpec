import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ErrorBlock } from "@/features/chat/entries/ErrorBlock";
import { clockTime } from "@/lib/when";
import { renderWithStore } from "@/test/render";
import { makeMachine, makeState, withMachineItems } from "@/test/wails-mock";

const AT = "2026-09-05T10:00:00Z";

describe("ErrorBlock", () => {
  it.each([
    ["process_exit", "Claude Code stopped unexpectedly."],
    ["start_failed", "Claude Code couldn't start."],
    [
      "not_found",
      "Claude Code wasn't found on this machine. Install it, or check that claude is on the PATH.",
    ],
    ["not_logged_in", "Claude Code isn't logged in. Run claude in a terminal and log in."],
    ["turn_error", "The agent couldn't finish the turn."],
  ])("explains %s, with the detail and no button", (kind, explanation) => {
    renderWithStore(
      <ErrorBlock error={{ kind, message: "exit status 1", retryable: true }} createdAt={AT} />,
    );

    const block = screen.getByRole("article", {
      name: `Session error, ${clockTime(AT, Date.now())}`,
    });
    expect(block).toHaveTextContent(explanation);
    expect(screen.getByText("exit status 1")).toHaveClass("font-mono", "overflow-x-auto");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("tells why a place could not go on, named by it, outside the walk of the feed", () => {
    renderWithStore(
      <ErrorBlock explanation="The worktree folder already exists." detail="fatal: exists" />,
    );

    const block = screen.getByRole("article", { name: "The worktree folder already exists." });
    expect(block).toHaveTextContent("fatal: exists");
    expect(block).not.toHaveAttribute("data-feed-item");
  });

  describe("the hint of the version", () => {
    const old = makeState({
      machine: withMachineItems(makeMachine({ claudeVersion: "2.0.14" }), {
        claude_version: { result: "missing" },
      }),
    });
    const failure = (kind: string) => (
      <ErrorBlock error={{ kind, message: "exit status 1", retryable: true }} createdAt={AT} />
    );

    it("names the versions and offers claude update when a start fails with an old Claude Code", () => {
      renderWithStore(failure("start_failed"), { state: old });

      expect(screen.getByText(/Claude Code 2\.0\.14 is older than 2\.1\.291/)).toBeInTheDocument();
      expect(screen.getByText("claude update")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Copy claude update" })).toBeInTheDocument();
    });

    it("is absent when the version is right", () => {
      renderWithStore(failure("start_failed"), { state: makeState({ machine: makeMachine() }) });

      expect(screen.queryByText("claude update")).not.toBeInTheDocument();
    });

    it("is absent when the cause is known", () => {
      renderWithStore(failure("not_logged_in"), { state: old });

      expect(screen.queryByText("claude update")).not.toBeInTheDocument();
    });
  });
});
