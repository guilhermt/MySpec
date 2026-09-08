import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Composer } from "@/features/chat/Composer";
import { api } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeTask } from "@/test/wails-mock";

const DRAFT = { "task-1|prd": "ship it" };

describe("Composer", () => {
  it("sends the draft on Enter and empties the field", async () => {
    const { user } = renderWithStore(<Composer stage="prd" task={makeTask()} />, {
      ui: { drafts: DRAFT },
    });

    await user.click(screen.getByRole("textbox"));
    await user.keyboard("{Enter}");

    expect(api.sendMessage).toHaveBeenCalledWith("task-1", "prd", "ship it");
    expect(useAppStore.getState().drafts["task-1|prd"]).toBe("");
  });

  it("sends nothing when there is nothing but blanks to send", async () => {
    const { user } = renderWithStore(<Composer stage="prd" task={makeTask()} />, {
      ui: { drafts: { "task-1|prd": "   " } },
    });

    await user.click(screen.getByRole("textbox"));
    await user.keyboard("{Enter}");

    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it("keeps Shift+Enter for a new line", async () => {
    const { user } = renderWithStore(<Composer stage="prd" task={makeTask()} />, {
      ui: { drafts: DRAFT },
    });

    await user.click(screen.getByRole("textbox"));
    await user.keyboard("{Shift>}{Enter}{/Shift}");

    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it("types into the draft of its own task", async () => {
    const { user } = renderWithStore(<Composer stage="prd" task={makeTask()} />);

    await user.type(screen.getByRole("textbox"), "hi");

    expect(useAppStore.getState().drafts["task-1|prd"]).toBe("hi");
  });

  it("keeps the draft of the stage it was given, not one per task", async () => {
    const { user } = renderWithStore(<Composer stage="step:1" task={makeTask()} />, {
      ui: { drafts: DRAFT },
    });

    // The draft of the PRD is not this composer's to show.
    expect(screen.getByRole("textbox")).toHaveValue("");

    await user.type(screen.getByRole("textbox"), "hi");
    await user.keyboard("{Enter}");

    expect(api.sendMessage).toHaveBeenCalledWith("task-1", "step:1", "hi");
    expect(useAppStore.getState().drafts["task-1|prd"]).toBe("ship it");
  });

  it("stops the response with the button and with Esc", async () => {
    const task = makeTask({ sessionStatus: "working", turnRunning: true, processRunning: true });
    const { user } = renderWithStore(<Composer stage="prd" task={task} />);

    await user.click(screen.getByRole("button", { name: "Stop the response" }));
    await user.click(screen.getByRole("textbox"));
    await user.keyboard("{Escape}");

    expect(api.interrupt).toHaveBeenCalledTimes(2);
    expect(api.interrupt).toHaveBeenCalledWith("task-1", "prd");
    expect(screen.getByText(/Esc to stop/)).toBeInTheDocument();
  });

  it("leaves the response alone when there is none to stop", async () => {
    const { user } = renderWithStore(<Composer stage="prd" task={makeTask()} />);

    await user.click(screen.getByRole("textbox"));
    await user.keyboard("{Escape}");

    expect(api.interrupt).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Stop the response" })).not.toBeInTheDocument();
  });

  it("queues a message while the agent is answering", async () => {
    const task = makeTask({ sessionStatus: "working", turnRunning: true, processRunning: true });
    const { user } = renderWithStore(<Composer stage="prd" task={task} />, {
      ui: { drafts: DRAFT },
    });

    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(api.sendMessage).toHaveBeenCalledWith("task-1", "prd", "ship it");
  });

  it("offers to resume instead of a field while the task is paused", async () => {
    const task = makeTask({ sessionStatus: "paused" });
    const { user } = renderWithStore(<Composer stage="prd" task={task} />);

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText("Paused. Resume to keep talking.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Resume" }));

    expect(api.resume).toHaveBeenCalledWith("task-1", "prd");
  });
});
