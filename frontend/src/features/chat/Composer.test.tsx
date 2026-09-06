import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Composer } from "@/features/chat/Composer";
import { api } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeTask } from "@/test/wails-mock";

const DRAFT = { "task-1": "ship it" };

describe("Composer", () => {
  it("sends the draft on Enter and empties the field", async () => {
    const { user } = renderWithStore(<Composer task={makeTask()} />, { ui: { drafts: DRAFT } });

    await user.click(screen.getByRole("textbox"));
    await user.keyboard("{Enter}");

    expect(api.sendMessage).toHaveBeenCalledWith("task-1", "ship it");
    expect(useAppStore.getState().drafts["task-1"]).toBe("");
  });

  it("sends nothing when there is nothing but blanks to send", async () => {
    const { user } = renderWithStore(<Composer task={makeTask()} />, {
      ui: { drafts: { "task-1": "   " } },
    });

    await user.click(screen.getByRole("textbox"));
    await user.keyboard("{Enter}");

    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it("keeps Shift+Enter for a new line", async () => {
    const { user } = renderWithStore(<Composer task={makeTask()} />, { ui: { drafts: DRAFT } });

    await user.click(screen.getByRole("textbox"));
    await user.keyboard("{Shift>}{Enter}{/Shift}");

    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it("types into the draft of its own task", async () => {
    const { user } = renderWithStore(<Composer task={makeTask()} />);

    await user.type(screen.getByRole("textbox"), "hi");

    expect(useAppStore.getState().drafts["task-1"]).toBe("hi");
  });

  it("stops the response with the button and with Esc", async () => {
    const task = makeTask({ sessionStatus: "working", turnRunning: true, processRunning: true });
    const { user } = renderWithStore(<Composer task={task} />);

    await user.click(screen.getByRole("button", { name: "Stop the response" }));
    await user.click(screen.getByRole("textbox"));
    await user.keyboard("{Escape}");

    expect(api.interrupt).toHaveBeenCalledTimes(2);
    expect(api.interrupt).toHaveBeenCalledWith("task-1");
    expect(screen.getByText(/Esc to stop/)).toBeInTheDocument();
  });

  it("leaves the response alone when there is none to stop", async () => {
    const { user } = renderWithStore(<Composer task={makeTask()} />);

    await user.click(screen.getByRole("textbox"));
    await user.keyboard("{Escape}");

    expect(api.interrupt).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Stop the response" })).not.toBeInTheDocument();
  });

  it("queues a message while the agent is answering", async () => {
    const task = makeTask({ sessionStatus: "working", turnRunning: true, processRunning: true });
    const { user } = renderWithStore(<Composer task={task} />, { ui: { drafts: DRAFT } });

    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(api.sendMessage).toHaveBeenCalledWith("task-1", "ship it");
  });

  it("offers to resume instead of a field while the task is paused", async () => {
    const task = makeTask({ sessionStatus: "paused" });
    const { user } = renderWithStore(<Composer task={task} />);

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText("Paused. Resume to keep talking.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Resume" }));

    expect(api.resume).toHaveBeenCalledWith("task-1");
  });
});
