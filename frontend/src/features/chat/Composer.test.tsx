import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Composer } from "@/features/chat/Composer";
import { api } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeState, makeTask } from "@/test/wails-mock";

const DRAFT = { "task-1|prd": "ship it" };

describe("Composer", () => {
  it("sends the draft on Enter and empties the field", async () => {
    const { user } = renderWithStore(
      <Composer stage="prd" taskId="task-1" session={makeTask()} />,
      {
        ui: { drafts: DRAFT },
      },
    );

    await user.click(screen.getByRole("textbox"));
    await user.keyboard("{Enter}");

    expect(api.sendMessage).toHaveBeenCalledWith("task-1", "prd", "ship it");
    expect(useAppStore.getState().drafts["task-1|prd"]).toBe("");
  });

  it("sends nothing when there is nothing but blanks to send", async () => {
    const { user } = renderWithStore(
      <Composer stage="prd" taskId="task-1" session={makeTask()} />,
      {
        ui: { drafts: { "task-1|prd": "   " } },
      },
    );

    await user.click(screen.getByRole("textbox"));
    await user.keyboard("{Enter}");

    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it("keeps Shift+Enter for a new line", async () => {
    const { user } = renderWithStore(
      <Composer stage="prd" taskId="task-1" session={makeTask()} />,
      {
        ui: { drafts: DRAFT },
      },
    );

    await user.click(screen.getByRole("textbox"));
    await user.keyboard("{Shift>}{Enter}{/Shift}");

    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it("types into the draft of its own task", async () => {
    const { user } = renderWithStore(<Composer stage="prd" taskId="task-1" session={makeTask()} />);

    await user.type(screen.getByRole("textbox"), "hi");

    expect(useAppStore.getState().drafts["task-1|prd"]).toBe("hi");
  });

  it("keeps the draft of the stage it was given, not one per task", async () => {
    const { user } = renderWithStore(
      <Composer stage="step:1" taskId="task-1" session={makeTask()} />,
      {
        ui: { drafts: DRAFT },
      },
    );

    // The draft of the PRD is not this composer's to show.
    expect(screen.getByRole("textbox")).toHaveValue("");

    await user.type(screen.getByRole("textbox"), "hi");
    await user.keyboard("{Enter}");

    expect(api.sendMessage).toHaveBeenCalledWith("task-1", "step:1", "hi");
    expect(useAppStore.getState().drafts["task-1|prd"]).toBe("ship it");
  });

  it("stops the response with the button and with Esc", async () => {
    const task = makeTask({ sessionStatus: "working", turnRunning: true, processRunning: true });
    const { user } = renderWithStore(<Composer stage="prd" taskId="task-1" session={task} />);

    await user.click(screen.getByRole("button", { name: "Stop the response" }));
    await user.click(screen.getByRole("textbox"));
    await user.keyboard("{Escape}");

    expect(api.interrupt).toHaveBeenCalledTimes(2);
    expect(api.interrupt).toHaveBeenCalledWith("task-1", "prd");
    expect(screen.getByText(/Esc to stop/)).toBeInTheDocument();
  });

  it("leaves the response alone when there is none to stop", async () => {
    const { user } = renderWithStore(<Composer stage="prd" taskId="task-1" session={makeTask()} />);

    await user.click(screen.getByRole("textbox"));
    await user.keyboard("{Escape}");

    expect(api.interrupt).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Stop the response" })).not.toBeInTheDocument();
  });

  it("queues a message while the agent is answering", async () => {
    const task = makeTask({ sessionStatus: "working", turnRunning: true, processRunning: true });
    const { user } = renderWithStore(<Composer stage="prd" taskId="task-1" session={task} />, {
      ui: { drafts: DRAFT },
    });

    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(api.sendMessage).toHaveBeenCalledWith("task-1", "prd", "ship it");
  });

  it("offers to resume instead of a field while the task is paused", async () => {
    const task = makeTask({ sessionStatus: "paused" });
    const { user } = renderWithStore(<Composer stage="prd" taskId="task-1" session={task} />);

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText("Paused. Resume to keep talking.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Resume" }));

    expect(api.resume).toHaveBeenCalledWith("task-1", "prd");
  });

  it("shows what the session runs with under the field", () => {
    renderWithStore(<Composer stage="prd" taskId="task-1" session={makeTask()} />, {
      state: makeState(),
    });

    expect(
      screen.getByRole("button", { name: "Session model: Fable 5.1 · high" }),
    ).toHaveTextContent("Fable 5.1 · high");
  });

  it("changes the model of the session it writes to", async () => {
    const { user } = renderWithStore(
      <Composer stage="step:2" taskId="task-1" session={makeTask()} />,
      {
        state: makeState(),
      },
    );

    await user.click(screen.getByRole("button", { name: "Session model: Fable 5.1 · high" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Opus 5.5 (1M)" }));

    expect(api.setSessionModel).toHaveBeenCalledWith(
      "task-1",
      "step:2",
      "claude-opus-5-5[1m]",
      "high",
    );
  });

  it("offers the model while the session is paused", () => {
    const task = makeTask({ sessionStatus: "paused" });
    renderWithStore(<Composer stage="prd" taskId="task-1" session={task} />, {
      state: makeState(),
    });

    expect(
      screen.getByRole("button", { name: "Session model: Fable 5.1 · high" }),
    ).toBeInTheDocument();
  });

  it("has no model to show without a session", () => {
    const task = makeTask({ sessionModel: "", sessionEffort: "" });
    renderWithStore(<Composer stage="prd" taskId="task-1" session={task} />);

    expect(screen.queryByRole("button", { name: /Session model:/ })).not.toBeInTheDocument();
  });

  it("never gives way to the conversation above it", () => {
    const { unmount } = renderWithStore(
      <Composer stage="prd" taskId="task-1" session={makeTask()} />,
    );
    const composer = screen.getByRole("textbox").closest("div.shrink-0");
    if (composer === null) {
      throw new Error("the field sits in no composer");
    }
    expect(composer).toHaveClass("pt-(--space-2)", "pb-(--space-4)");
    unmount();

    const task = makeTask({ sessionStatus: "paused" });
    renderWithStore(<Composer stage="prd" taskId="task-1" session={task} />);
    const paused = screen.getByRole("button", { name: "Resume" }).closest("div.shrink-0");
    if (paused === null) {
      throw new Error("the resume button sits in no composer");
    }
    expect(paused).toHaveClass("pt-(--space-2)", "pb-(--space-4)");
  });
});
