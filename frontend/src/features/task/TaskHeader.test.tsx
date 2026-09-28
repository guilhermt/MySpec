import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TaskHeader } from "@/features/task/TaskHeader";
import { api, type TaskSummary } from "@/lib/wails";
import { type StepTab, stepTabKey, useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  makePullRequest,
  makeSituation,
  makeState,
  makeStep,
  makeStepReviewer,
  makeTask,
  makeTaskCard,
} from "@/test/wails-mock";

function header(overrides: Partial<TaskSummary> = {}, tab?: StepTab) {
  const task = makeTask(overrides);
  return renderWithStore(<TaskHeader task={task} />, {
    state: makeState({ tasks: [task] }),
    ui: {
      location: { kind: "task", id: task.id },
      ...(tab !== undefined
        ? { openStepTab: { [stepTabKey(task.id, task.currentStep)]: tab } }
        : {}),
    },
  });
}

/** inPass is a task whose step 1 is under a pass of its reviewer. */
function inPass(reviewer: Parameters<typeof makeStepReviewer>[0], task: Partial<TaskSummary> = {}) {
  return {
    stage: "implementation",
    currentStep: 1,
    steps: [
      makeStep({
        status: "agent_review",
        reviewMode: "agent",
        reviewPass: 1,
        reviewer: makeStepReviewer(reviewer),
      }),
    ],
    ...task,
  };
}

const stepper = () => screen.getByRole("list", { name: /^Progress/ });
const meter = () => screen.getByRole("meter", { name: "Context" });

// clock writes a time the way the header does for today: 14:52.
function clock(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

describe("TaskHeader", () => {
  it("names the place after the task", () => {
    header();

    expect(screen.getByRole("heading", { level: 1, name: "add-login" })).toBeInTheDocument();
  });

  it("leaves the repository, the card number and the One-Shot label to the tree", () => {
    header({ mode: "one_shot", stage: "one_shot", card: makeTaskCard() });

    expect(screen.queryByText("dev/web")).not.toBeInTheDocument();
    expect(screen.queryByText("#12")).not.toBeInTheDocument();
    expect(screen.queryByText("One-Shot")).not.toBeInTheDocument();
  });

  it("holds the stepper after the title and its controls on the right in their order", () => {
    header({ sessionStatus: "working", card: makeTaskCard() });

    expect(stepper()).toBeInTheDocument();
    const names = screen
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label") ?? button.textContent);
    expect(names).toEqual([
      "Back",
      "Show the hidden levels: No board",
      "Pause",
      "Open card #12 on GitHub · In progress",
      "Artifacts",
      "More actions",
    ]);
  });

  it("says the state of the task once, in the stepper, with no badge, no review mode and no models", () => {
    header({ sessionStatus: "working" });

    expect(stepper()).toHaveAccessibleName("Progress · PRD · PRD agent working");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Review:/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Models" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete task" })).not.toBeInTheDocument();
  });

  it("names in the stepper what the most urgent situation asks, and how many others there are", () => {
    header({
      situations: [makeSituation(), makeSituation({ id: "s-2", kind: "question" })],
    });

    expect(stepper()).toHaveAccessibleName(
      "Progress · PRD · waiting for you: waiting for reply in PRD, and 1 more",
    );
  });

  describe("before the first snapshot", () => {
    function loading() {
      return renderWithStore(<TaskHeader task={null} />, {
        state: makeState(),
        ui: { location: { kind: "task", id: "task-1" } },
      });
    }

    it("has an empty title and the stages of a Structured task glowing, with no pill", () => {
      loading();

      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("");
      const list = screen.getByRole("list", { name: "Progress" });
      expect(list).toHaveAttribute("aria-busy", "true");
      expect(within(list).getAllByRole("listitem")).toHaveLength(7);
      expect(within(list).queryByRole("listitem", { current: "step" })).not.toBeInTheDocument();
      expect(within(list).getByText("PRD")).toHaveClass("shimmer-text");
    });

    it("has nothing on the right", () => {
      loading();

      expect(screen.queryByRole("meter")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "More actions" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Artifacts" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Pause" })).not.toBeInTheDocument();
    });
  });

  describe("the context meter", () => {
    it("measures the conversation on screen, with who it is in the tooltip", async () => {
      const { user } = header({ contextPercent: 44 });

      expect(meter()).toHaveTextContent("44%");
      await user.hover(meter());
      expect(await screen.findByRole("tooltip")).toHaveTextContent(
        "Context used by the PRD agent: 44%",
      );
    });

    it("measures the tab chosen in a step with two conversations", () => {
      const task = inPass({ contextPercent: 72 }, { contextPercent: 10 });

      header(task, "reviewer");
      expect(meter()).toHaveTextContent("72%");
    });

    it("measures the implementer while its tab is chosen", () => {
      header(inPass({ contextPercent: 72 }, { contextPercent: 10 }), "implementer");

      expect(meter()).toHaveTextContent("10%");
    });

    it("says it has no reading yet with …", () => {
      header({ contextPercent: 0 });

      expect(meter()).toHaveTextContent("…");
      expect(meter()).toHaveAttribute("aria-valuetext", "not read yet");
    });

    it("shows — while the session on screen is paused", () => {
      header({ sessionStatus: "paused", contextPercent: 44 });

      expect(meter()).toHaveTextContent("—");
    });

    it("is not there without a session on screen", () => {
      header({
        stage: "implementation",
        steps: [makeStep({ status: "preparing" })],
        currentStep: 1,
      });

      expect(screen.queryByRole("meter")).not.toBeInTheDocument();
    });

    it("is not there while the pull request is done", () => {
      header({ stage: "pr", pr: makePullRequest({ status: "done", prNumber: 12 }) });

      expect(screen.queryByRole("meter")).not.toBeInTheDocument();
    });
  });

  describe("Pause", () => {
    it("pauses a running session with no dialog, saying what it does in its tooltip", async () => {
      const { user } = header({ sessionStatus: "working" });
      const button = screen.getByRole("button", { name: "Pause" });

      expect(button).toHaveAccessibleDescription("Pause the task · the session that works stops");
      await user.click(button);

      expect(api.pause).toHaveBeenCalledWith("task-1", "prd");
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });

    it("says Pausing… with the spinner until the call comes back", async () => {
      let answer: () => void = () => {};
      vi.mocked(api.pause).mockReturnValueOnce(
        new Promise<void>((settle) => {
          answer = settle;
        }),
      );
      const { user } = header({ sessionStatus: "working" });

      await user.click(screen.getByRole("button", { name: "Pause" }));

      const button = screen.getByRole("button", { name: "Pausing…" });
      expect(button).toHaveAttribute("aria-busy", "true");
      answer();
      expect(await screen.findByRole("button", { name: "Pause" })).not.toHaveAttribute("aria-busy");
    });

    it("resumes a paused session, saying since when", async () => {
      const at = new Date();
      const { user } = header({ sessionStatus: "paused", pausedAt: at.toISOString() });
      const button = screen.getByRole("button", { name: "Resume" });

      expect(button).toHaveAccessibleDescription(`Resume the task · paused since ${clock(at)}`);
      await user.click(button);

      expect(api.resume).toHaveBeenCalledWith("task-1", "prd");
    });

    it("says only what it does when the time of the pause is unknown", () => {
      header({ sessionStatus: "paused", pausedAt: "" });

      expect(screen.getByRole("button", { name: "Resume" })).toHaveAccessibleDescription(
        "Resume the task",
      );
    });

    it.each([
      [
        "a planning stage",
        { sessionStatus: "error" },
        "Nothing is running to pause: the PRD agent's session stopped with an error. Retry it, or discard and restart the PRD.",
      ],
      [
        "One-Shot planning",
        { mode: "one_shot", stage: "one_shot", sessionStatus: "error" },
        "Nothing is running to pause: the planning agent's session stopped with an error. Retry it, or discard and restart planning.",
      ],
      [
        "a step",
        inPass({ sessionStatus: "error" }),
        "Nothing is running to pause: the reviewer's session stopped with an error. Retry it, or discard the step.",
      ],
    ])("has nothing to pause on a session that stopped on an error in %s", (_, task, reason) => {
      header(task);

      const button = screen.getByRole("button", { name: "Pause" });
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button).toHaveAccessibleDescription(reason);
    });

    it("has nothing to pause while the step has no session yet", () => {
      header({
        stage: "implementation",
        steps: [makeStep({ status: "preparing" })],
        currentStep: 1,
      });

      expect(screen.queryByRole("button", { name: "Pause" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Resume" })).not.toBeInTheDocument();
    });

    it("leaves the session of the pull request to its bar", () => {
      header({
        stage: "pr",
        pr: makePullRequest({ status: "drafting", sessionStatus: "working" }),
      });

      expect(screen.queryByRole("button", { name: "Pause" })).not.toBeInTheDocument();
    });

    it("pauses the session of the step being implemented", async () => {
      const { user } = header({
        stage: "implementation",
        steps: [makeStep({ status: "implementing" })],
        currentStep: 1,
      });

      await user.click(screen.getByRole("button", { name: "Pause" }));

      expect(api.pause).toHaveBeenCalledWith("task-1", "step:1");
    });

    it("pauses the reviewer during a pass, whichever tab is chosen", async () => {
      const { user } = header(
        inPass({ sessionStatus: "working" }, { sessionStatus: "waiting" }),
        "implementer",
      );

      await user.click(screen.getByRole("button", { name: "Pause" }));

      expect(api.pause).toHaveBeenCalledWith("task-1", "step_review:1");
    });

    it("resumes the reviewer paused during a pass", async () => {
      const { user } = header(inPass({ sessionStatus: "paused" }));

      await user.click(screen.getByRole("button", { name: "Resume" }));

      expect(api.resume).toHaveBeenCalledWith("task-1", "step_review:1");
    });

    it("pauses the implementer while it addresses a report", async () => {
      const { user } = header({
        stage: "implementation",
        sessionStatus: "working",
        steps: [
          makeStep({
            status: "addressing_review",
            reviewMode: "agent",
            reviewRound: 1,
            reviewer: makeStepReviewer({ sessionStatus: "paused" }),
          }),
        ],
        currentStep: 1,
      });

      await user.click(screen.getByRole("button", { name: "Pause" }));

      expect(api.pause).toHaveBeenCalledWith("task-1", "step:1");
    });
  });

  it("opens the card the task was created from on GitHub", async () => {
    const { user } = header({ card: makeTaskCard() });

    await user.click(screen.getByRole("button", { name: "Open card #12 on GitHub · In progress" }));

    expect(api.openExternal).toHaveBeenCalledWith("https://github.com/dev/web/issues/12");
  });

  it("names the card by its number alone when the board gives it no status", () => {
    header({ card: makeTaskCard({ status: "" }) });

    expect(screen.getByRole("button", { name: "Open card #12 on GitHub" })).toBeInTheDocument();
  });

  it("has no card link for a task without one", () => {
    header();

    expect(screen.queryByRole("button", { name: /^Open card/ })).not.toBeInTheDocument();
  });

  it("toggles the artifacts panel, named in its tooltip", async () => {
    const { user } = header();
    const artifacts = () => screen.getByRole("button", { name: "Artifacts" });

    await user.hover(artifacts());
    expect(await screen.findByText("PRD, tech spec, steps and reports")).toBeInTheDocument();

    await user.click(artifacts());
    expect(useAppStore.getState().panel).toBe("artifacts");
    expect(artifacts()).toHaveAttribute("aria-pressed", "true");

    await user.click(artifacts());
    expect(useAppStore.getState().panel).toBeNull();
    expect(artifacts()).toHaveAttribute("aria-pressed", "false");
  });
});
