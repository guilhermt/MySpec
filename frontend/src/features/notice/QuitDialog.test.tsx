import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QuitDialog } from "@/features/notice/QuitDialog";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import {
  makeDiscussion,
  makeQuitRequest,
  makeRunningTask,
  makeState,
  makeTask,
} from "@/test/wails-mock";

function quitting(withRequest = true) {
  return renderWithStore(<QuitDialog />, {
    state: makeState({
      tasks: [makeTask({ id: "task-1", name: "add-login" })],
      discussions: [makeDiscussion({ id: "disc-1", title: "Plan the billing" })],
      quit: withRequest
        ? makeQuitRequest({
            sessions: [
              { itemId: "task-1", stage: "step:1", tasks: [makeRunningTask({ taskId: "a" })] },
              {
                itemId: "task-1",
                stage: "step_review:1",
                tasks: [makeRunningTask({ taskId: "b", name: "Check the tests" })],
              },
              {
                itemId: "disc-1",
                stage: "discussion",
                tasks: [makeRunningTask({ taskId: "c", name: "Read the docs" })],
              },
            ],
          })
        : null,
    }),
  });
}

describe("QuitDialog", () => {
  it("draws nothing without a request", () => {
    quitting(false);

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("warns that quitting loses the work and lists what runs by item and conversation", () => {
    quitting();

    const dialog = screen.getByRole("alertdialog", { name: "Quit MySpec?" });
    expect(
      within(dialog).getByText(
        "Subagents are still running. Quitting stops everything that runs in the background, and its work is lost.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("add-login")).toBeInTheDocument();
    expect(within(dialog).getByText("Plan the billing")).toBeInTheDocument();
    expect(within(dialog).getByText(/Implementer/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Reviewer/)).toBeInTheDocument();
    expect(within(dialog).getByText(/^agent · Check the tests · /)).toBeInTheDocument();
    expect(within(dialog).getByText(/^agent · Read the docs · /)).toBeInTheDocument();
  });

  it("opens on Cancel, which keeps the app open", async () => {
    const { user } = quitting();

    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(api.cancelQuit).toHaveBeenCalled();
    expect(api.quitAnyway).not.toHaveBeenCalled();
  });

  it("keeps the app open on Esc", async () => {
    const { user } = quitting();

    await user.keyboard("{Escape}");

    expect(api.cancelQuit).toHaveBeenCalled();
  });

  it("quits on Quit anyway", async () => {
    const { user } = quitting();

    await user.click(screen.getByRole("button", { name: "Quit anyway" }));

    expect(api.quitAnyway).toHaveBeenCalled();
  });
});
