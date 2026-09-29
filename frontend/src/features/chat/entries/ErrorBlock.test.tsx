import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ErrorBlock } from "@/features/chat/entries/ErrorBlock";
import { clockTime } from "@/lib/when";
import { renderWithStore } from "@/test/render";

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
});
