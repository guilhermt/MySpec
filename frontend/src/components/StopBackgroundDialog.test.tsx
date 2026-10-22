import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StopBackgroundDialog } from "@/components/StopBackgroundDialog";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeRunningTask, makeState, makeTask } from "@/test/wails-mock";

const SESSIONS = [
  { stage: "step:1", tasks: [makeRunningTask({ taskId: "a" })] },
  {
    stage: "step_review:1",
    tasks: [makeRunningTask({ taskId: "c", kind: "command", name: "Run the dev server" })],
  },
];

function open(onConfirm = vi.fn(() => Promise.resolve())) {
  const onOpenChange = vi.fn();
  const task = makeTask();
  return {
    onOpenChange,
    onConfirm,
    ...renderWithStore(
      <StopBackgroundDialog
        open
        onOpenChange={onOpenChange}
        verb="pause"
        itemId={task.id}
        sessions={SESSIONS}
        onConfirm={onConfirm}
      />,
      { state: makeState({ tasks: [task] }) },
    ),
  };
}

describe("StopBackgroundDialog", () => {
  it("says what the gesture does to what runs and lists it by conversation", () => {
    open();

    const dialog = screen.getByRole("alertdialog", { name: "Stop the work in the background?" });
    expect(
      within(dialog).getByText("Pausing stops what runs in the background. It won't resume."),
    ).toBeInTheDocument();
    const list = within(dialog).getByRole("list", { name: "What runs" });
    expect(within(list).getByText(/Implementer/)).toBeInTheDocument();
    expect(within(list).getByText(/^agent · Survey the repository · /)).toBeInTheDocument();
    expect(within(list).getByText(/^command · Run the dev server · /)).toBeInTheDocument();
  });

  it("opens on Cancel, which closes it without stopping anything", async () => {
    const { user, onOpenChange } = open();

    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(api.stopTasks).not.toHaveBeenCalled();
  });

  it("stops every conversation, then does the gesture, and closes", async () => {
    const order: string[] = [];
    vi.mocked(api.stopTasks).mockImplementation(() => {
      order.push("stop");
      return Promise.resolve();
    });
    const onConfirm = vi.fn(() => {
      order.push("gesture");
      return Promise.resolve();
    });
    const { user, onOpenChange } = open(onConfirm);

    await user.click(screen.getByRole("button", { name: "Stop and pause" }));

    expect(api.stopTasks).toHaveBeenCalledWith("task-1", "step:1", ["a"]);
    expect(api.stopTasks).toHaveBeenCalledWith("task-1", "step_review:1", ["c"]);
    expect(order).toEqual(["stop", "stop", "gesture"]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("says Stopping… until the gesture is done, and stays open", async () => {
    let finish: () => void = () => {};
    const { user, onOpenChange } = open(
      vi.fn(
        () =>
          new Promise<void>((settle) => {
            finish = settle;
          }),
      ),
    );

    await user.click(screen.getByRole("button", { name: "Stop and pause" }));

    expect(await screen.findByRole("button", { name: "Stopping…" })).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
    finish();
    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("does the gesture even when a stop fails: what does not stop is lost with the process", async () => {
    vi.mocked(api.stopTasks).mockRejectedValue(new Error("No task found"));
    const { user, onConfirm } = open();

    await user.click(screen.getByRole("button", { name: "Stop and pause" }));

    await vi.waitFor(() => expect(onConfirm).toHaveBeenCalled());
  });
});
