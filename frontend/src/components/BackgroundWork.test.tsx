import { act, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BackgroundWork } from "@/components/BackgroundWork";
import type { RunningTask } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { api, makeRunningTask } from "@/test/wails-mock";

const agent = makeRunningTask({ taskId: "a1", toolUseId: "toolu_a1" });
const command = makeRunningTask({
  taskId: "c1",
  kind: "command",
  name: "Run the dev server",
  toolUseId: "toolu_c1",
  actions: 0,
  actionLabel: "",
  actionTarget: "",
});
const monitor = makeRunningTask({
  taskId: "m1",
  kind: "monitor",
  name: "Watch the logs",
  toolUseId: "toolu_m1",
});

function work(tasks: RunningTask[]) {
  return <BackgroundWork itemId="task-1" stage="step:3" tasks={tasks} />;
}

function render(tasks: RunningTask[]) {
  const view = renderWithStore(work(tasks));
  return { ...view, update: (next: RunningTask[]) => view.rerender(work(next)) };
}

describe("BackgroundWork", () => {
  it("draws nothing without tasks, but keeps its announcements mounted", () => {
    render([]);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("is a line that says what runs, and opens and closes the list", async () => {
    const { user } = render([agent, makeRunningTask({ taskId: "a2" }), command]);
    const line = screen.getByRole("button", {
      name: "Background work: 2 agents, 1 command. Show the list",
    });

    expect(line).toHaveAttribute("aria-expanded", "false");
    expect(line).toHaveTextContent("Background");
    expect(line).toHaveTextContent("· 2 agents · 1 command");
    expect(screen.queryByRole("list", { name: "Background work" })).not.toBeInTheDocument();

    await user.click(line);
    expect(
      screen.getByRole("button", { name: "Background work: 2 agents, 1 command. Hide the list" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      within(screen.getByRole("list", { name: "Background work" })).getAllByRole("listitem"),
    ).toHaveLength(3);

    await user.keyboard("{Enter}");
    expect(screen.queryByRole("list", { name: "Background work" })).not.toBeInTheDocument();
  });

  it("lists each task with its kind, its name and the progress of an agent", async () => {
    const { user } = render([agent, command, monitor]);
    await user.click(screen.getByRole("button", { name: /^Background work/ }));

    const items = within(screen.getByRole("list", { name: "Background work" })).getAllByRole(
      "listitem",
    );
    expect(items[0]).toHaveTextContent("agent");
    expect(items[0]).toHaveTextContent("Survey the repository");
    expect(items[0]).toHaveTextContent("3 actions · Reading …/service.go");
    expect(items[1]).toHaveTextContent("command");
    expect(items[1]).toHaveTextContent("Run the dev server");
    expect(items[2]).toHaveTextContent("monitor");
  });

  it("says Thinking… for an agent without an action", async () => {
    const { user } = render([makeRunningTask({ actions: 0, actionLabel: "", actionTarget: "" })]);
    await user.click(screen.getByRole("button", { name: /^Background work/ }));

    expect(screen.getByText("Thinking…")).toBeInTheDocument();
  });

  it("stops one task by its own Stop", async () => {
    const { user } = render([agent, command]);
    await user.click(screen.getByRole("button", { name: /^Background work/ }));

    await user.click(screen.getByRole("button", { name: 'Stop command "Run the dev server"' }));

    expect(api.stopTasks).toHaveBeenCalledWith("task-1", "step:3", ["c1"]);
  });

  it("says Stopping… while the stop is on its way, from the request or from the state", async () => {
    let settle: () => void = () => {};
    api.stopTasks.mockReturnValueOnce(
      new Promise<void>((done) => {
        settle = done;
      }),
    );
    const { user, update } = render([agent, command]);
    await user.click(screen.getByRole("button", { name: /^Background work/ }));

    await user.click(screen.getByRole("button", { name: 'Stop agent "Survey the repository"' }));
    expect(
      screen.getByRole("button", { name: 'Stop agent "Survey the repository"' }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByRole("button", { name: 'Stop agent "Survey the repository"' }),
    ).toHaveTextContent("Stopping…");
    await act(async () => settle());

    update([agent, { ...command, stopping: true }]);
    expect(
      screen.getByRole("button", { name: 'Stop command "Run the dev server"' }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("shows why a stop was refused under its task", async () => {
    const { user } = render([agent, { ...command, stopError: "No task found with ID: c1" }]);
    await user.click(screen.getByRole("button", { name: /^Background work/ }));

    expect(screen.getByText("Couldn't stop it · No task found with ID: c1")).toBeInTheDocument();
  });

  it("tells why the call to stop failed, under the item or at the foot of the list", async () => {
    api.stopTasks.mockRejectedValueOnce(new Error("the backend is gone"));
    const { user } = render([agent, command]);
    await user.click(screen.getByRole("button", { name: /^Background work/ }));

    await user.click(screen.getByRole("button", { name: 'Stop command "Run the dev server"' }));
    expect(await screen.findByText(/Couldn't stop it · .*the backend is gone/)).toBeInTheDocument();

    api.stopTasks.mockRejectedValueOnce(new Error("still gone"));
    await user.click(screen.getByRole("button", { name: "Stop all" }));
    expect(await screen.findByText(/Couldn't stop it · .*still gone/)).toBeInTheDocument();
    expect(screen.queryByText(/the backend is gone/)).not.toBeInTheDocument();
  });

  it("does not repeat at the foot the reasons its items already show", async () => {
    api.stopTasks.mockRejectedValueOnce(new Error("Task cannot be stopped."));
    const { user, update } = render([agent, command]);
    await user.click(screen.getByRole("button", { name: /^Background work/ }));

    await user.click(screen.getByRole("button", { name: "Stop all" }));
    update([
      { ...agent, stopError: "Task cannot be stopped" },
      { ...command, stopError: "Task cannot be stopped" },
    ]);

    expect(await screen.findAllByText("Couldn't stop it · Task cannot be stopped")).toHaveLength(2);
    expect(screen.queryByText(/Task cannot be stopped\./)).not.toBeInTheDocument();
  });

  it("stops all of them at the foot of the list", async () => {
    const { user } = render([agent, command, monitor]);
    await user.click(screen.getByRole("button", { name: /^Background work/ }));

    await user.click(screen.getByRole("button", { name: "Stop all" }));

    expect(api.stopTasks).toHaveBeenCalledWith("task-1", "step:3", ["a1", "c1", "m1"]);
  });

  it("opens the conversation of an agent from its item", async () => {
    const { user } = render([agent]);
    await user.click(screen.getByRole("button", { name: /^Background work/ }));

    await user.click(
      screen.getByRole("button", { name: "Open the conversation of Survey the repository" }),
    );

    expect(useAppStore.getState().subagentConversation).toEqual({
      itemId: "task-1",
      stage: "step:3",
      toolUseId: "toolu_a1",
      offset: null,
    });
  });

  it("opens and folds the live output of a command under its item", async () => {
    const { user } = render([command]);
    await user.click(screen.getByRole("button", { name: /^Background work/ }));
    const item = screen.getByRole("button", { name: 'Output of command "Run the dev server"' });

    await user.click(item);
    expect(item).toHaveAttribute("aria-expanded", "true");
    expect(api.getTaskOutput).toHaveBeenCalledWith("task-1", "step:3", "c1");

    await user.click(item);
    expect(item).toHaveAttribute("aria-expanded", "false");
  });

  it("takes the focus to the composer when the last task leaves with the focus inside", async () => {
    const view = renderWithStore(
      <>
        <div data-slot="composer">
          <textarea aria-label="Message" />
        </div>
        {work([agent])}
      </>,
    );
    const rebuild = (tasks: RunningTask[]) =>
      view.rerender(
        <>
          <div data-slot="composer">
            <textarea aria-label="Message" />
          </div>
          {work(tasks)}
        </>,
      );
    await view.user.click(screen.getByRole("button", { name: /^Background work/ }));

    rebuild([]);

    expect(screen.getByRole("textbox", { name: "Message" })).toHaveFocus();
  });

  it("leaves the focus alone when it was elsewhere", async () => {
    const view = renderWithStore(
      <>
        <textarea aria-label="Elsewhere" />
        {work([agent])}
      </>,
    );
    await view.user.click(screen.getByRole("textbox", { name: "Elsewhere" }));

    view.rerender(
      <>
        <textarea aria-label="Elsewhere" />
        {work([])}
      </>,
    );

    expect(screen.getByRole("textbox", { name: "Elsewhere" })).toHaveFocus();
  });

  it("announces what started and what ended, never the duration", () => {
    const { update } = render([agent]);

    update([agent, command]);
    expect(screen.getByRole("status")).toHaveTextContent(
      'Command "Run the dev server" started in the background.',
    );

    update([command]);
    expect(screen.getByRole("status")).toHaveTextContent('Agent "Survey the repository" ended.');
    expect(screen.getByRole("status").textContent).not.toMatch(/\d+\s?[ms]\b/);
  });
});
