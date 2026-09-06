import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ErrorCard } from "@/features/chat/entries/ErrorCard";
import { api, type ErrorEntry, type ErrorKind } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeState, makeTask } from "@/test/wails-mock";

function failure(overrides: Partial<ErrorEntry> = {}): ErrorEntry {
  return { kind: "turn_error", message: "the agent stopped", retryable: true, ...overrides };
}

const STOPPED = makeState({ tasks: [makeTask({ id: "task-1", sessionStatus: "error" })] });
const RECOVERED = makeState({ tasks: [makeTask({ id: "task-1", sessionStatus: "waiting" })] });

describe("ErrorCard", () => {
  it.each([
    ["process_exit", "The session stopped unexpectedly"],
    ["start_failed", "Couldn't start Claude Code"],
    ["not_found", "Claude Code not found"],
    ["not_logged_in", "Claude Code isn't logged in"],
    ["turn_error", "The agent couldn't finish"],
  ] as const)("names the %s failure", (kind: ErrorKind, expected) => {
    renderWithStore(<ErrorCard taskId="task-1" error={failure({ kind })} />, { state: STOPPED });

    expect(screen.getByRole("alert")).toHaveTextContent(expected);
    expect(screen.getByText("the agent stopped")).toBeInTheDocument();
  });

  it("retries the turn that failed", async () => {
    const { user } = renderWithStore(<ErrorCard taskId="task-1" error={failure()} />, {
      state: STOPPED,
    });

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(api.retry).toHaveBeenCalledWith("task-1");
  });

  it("offers no retry for a failure nothing can undo", () => {
    renderWithStore(<ErrorCard taskId="task-1" error={failure({ retryable: false })} />, {
      state: STOPPED,
    });

    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("offers no retry once the session has moved on", () => {
    renderWithStore(<ErrorCard taskId="task-1" error={failure()} />, { state: RECOVERED });

    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });
});
