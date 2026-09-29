import { act, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DetailsPanel } from "@/features/task/DetailsPanel";
import { choiceLabel } from "@/lib/models";
import { api, type Repository, type TaskSummary } from "@/lib/wails";
import { clockTime, fullTime, shortTime, startedTime } from "@/lib/when";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  makeModelCatalog,
  makePRCheck,
  makePullRequest,
  makeRepository,
  makeState,
  makeStep,
  makeStepReviewer,
  makeTask,
  makeTaskCard,
  makeTaskConversation,
  makeTranscript,
} from "@/test/wails-mock";

function details(task: TaskSummary, repository: Repository = makeRepository()) {
  return renderWithStore(<DetailsPanel task={task} />, {
    state: makeState({ tasks: [task], repositories: [repository] }),
    ui: { location: { kind: "task", id: task.id }, panel: "details" },
  });
}

const COMMITTED_AT = "2026-09-27T13:48:00Z";

const committed = (number: number) =>
  makeStep({
    number,
    file: `${number}-step.md`,
    title: `Step ${number} title`,
    status: "done",
    commitSha: "c19f02e8a1b2",
    commitSubject: `Commit ${number}`,
    committedAt: COMMITTED_AT,
    reviewMode: "agent",
    reports: [{ pass: 1, file: `${number}-1.md`, clean: false, findings: -1 }],
  });

/** STRUCTURED is a Structured task on its step 3, under a pass of its reviewer. */
const STRUCTURED: TaskSummary = makeTask({
  stage: "implementation",
  reviewMode: "agent",
  currentStep: 3,
  steps: [
    committed(1),
    committed(2),
    makeStep({
      number: 3,
      file: "3-wire.md",
      title: "Wire the API",
      status: "agent_review",
      reviewMode: "agent",
      reviewPass: 2,
      reviewer: makeStepReviewer({ sessionStage: "step_review:3", sessionStatus: "working" }),
      reports: [{ pass: 1, file: "3-1.md", clean: false, findings: -1 }],
    }),
    makeStep({ number: 4, file: "4-limits.md", title: "Add the limits", reviewMode: "agent" }),
  ],
  branch: "rate-limit",
  baseBranch: "origin/dev",
  worktreePath: "/home/dev/.local/share/myspec/worktrees/dev/web/rate-limit",
});

/** ONE_SHOT is a One-Shot task in its implementation, with a report of the agent review. */
const ONE_SHOT: TaskSummary = makeTask({
  mode: "one_shot",
  stage: "implementation",
  reviewMode: "agent",
  currentStep: 1,
  steps: [
    makeStep({
      number: 1,
      file: "1-one-shot.md",
      title: "Rate limit per API key",
      status: "implementing",
      reviewMode: "agent",
      reports: [{ pass: 1, file: "1-1.md", clean: true, findings: 0 }],
    }),
  ],
});

/** inPR is a Structured task whose pull request #1284 is open into dev. */
function inPR(pr: Parameters<typeof makePullRequest>[0] = {}) {
  return makeTask({
    stage: "pr",
    steps: [committed(1)],
    pr: makePullRequest({
      status: "waiting_checks",
      prNumber: 1284,
      prUrl: "https://github.com/dev/web/pull/1284",
      prState: "open",
      prBase: "dev",
      checkedAt: new Date(Date.now() - 2 * 60_000).toISOString(),
      reports: [{ pass: 1, file: "review-1.md", clean: false }],
      checks: [
        makePRCheck({ name: "lint" }),
        makePRCheck({ name: "e2e", state: "running", conclusion: "", completedAt: "" }),
      ],
      ...pr,
    }),
  });
}

const group = (name: string | RegExp) => screen.getByRole("region", { name });

/** facts is the list of keys and values of a group, as the reader goes through it. */
function facts(region: HTMLElement): Record<string, string> {
  const pairs: Record<string, string> = {};
  for (const term of within(region).getAllByRole("term")) {
    pairs[term.textContent ?? ""] = term.nextElementSibling?.textContent ?? "";
  }
  return pairs;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("DetailsPanel, Steps", () => {
  it("lists every step of a Structured task, with how many are committed", () => {
    details(STRUCTURED);

    const commit = `c19f02e · ${clockTime(COMMITTED_AT, Date.now())}`;
    const rows = within(group("Steps · 2 of 4 committed")).getAllByRole("listitem");
    expect(rows.map((row) => row.firstElementChild?.textContent)).toEqual([
      `1 · Step 1 title${commit} · Commit 1 · ${fullTime(COMMITTED_AT)}`,
      "Review 1 · changes",
      `2 · Step 2 title${commit} · Commit 2 · ${fullTime(COMMITTED_AT)}`,
      "Review 1 · changes",
      "3 · Wire the APInow · Agent",
      "Review 1 · changes",
      expect.stringMatching(/^4 · Add the limits/),
    ]);
  });

  it("gives a committed step its SHA and the time of the commit, with the subject in the tooltip", async () => {
    const { user } = details(STRUCTURED);

    const [first] = within(group(/^Steps/)).getAllByText("c19f02e");
    expect(first?.parentElement).toHaveTextContent(
      `c19f02e · ${clockTime(COMMITTED_AT, Date.now())}`,
    );
    await user.hover(first?.parentElement as HTMLElement);

    expect(await screen.findByText("Commit 1")).toBeInTheDocument();
  });

  it("shows only the SHA of a commit whose time is unknown", () => {
    details({ ...STRUCTURED, steps: [{ ...committed(1), committedAt: "" }], currentStep: 0 });

    expect(
      within(group("Steps · 1 committed")).getByText("c19f02e").parentElement,
    ).toHaveTextContent(/^c19f02e · Commit 1$/);
  });

  it("marks the current step with its mode, and a fallback says why in the tooltip", async () => {
    const task: TaskSummary = {
      ...STRUCTURED,
      steps: (STRUCTURED.steps ?? []).map((step) =>
        step.number === 3
          ? {
              ...step,
              status: "awaiting_review",
              reviewMode: "manual",
              reviewFallback: "rounds_exhausted",
              reviewer: null,
            }
          : step,
      ),
    };
    const { user } = details(task);

    const current = within(group(/^Steps/))
      .getAllByRole("listitem")
      .find((row) => row.getAttribute("aria-current") === "step");
    expect(current).toHaveTextContent(/^3 · Wire the APInow · Manual/);
    await user.hover(within(current as HTMLElement).getByText("now · Manual"));

    expect(
      await screen.findByText("The agent review didn't come clean after three rounds"),
    ).toBeInTheDocument();
  });

  it("says where the steps come from before the plan", () => {
    details(makeTask({ stage: "tech_spec" }));

    expect(group("Steps")).toHaveTextContent("Steps come from the plan.");
  });

  it("gives a step not started its review mode and its model to choose", async () => {
    const { user } = details(STRUCTURED);

    await user.click(screen.getByRole("button", { name: "Review mode of step 4: Agent" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Manual" }));
    expect(api.setStepReviewMode).toHaveBeenCalledWith("task-1", 4, "manual");

    const catalog = makeModelCatalog();
    const model = screen.getByRole("button", {
      name: `Step 4 model: ${choiceLabel(catalog, { model: "claude-opus-5-5[1m]", effort: "high" })}`,
    });
    await user.click(model);
    await user.click(await screen.findByRole("menuitemradio", { name: "medium" }));
    expect(api.setStepModel).toHaveBeenCalledWith("task-1", 4, "claude-opus-5-5[1m]", "medium");
  });

  it("says what a step not started follows, and lets its own mode follow the task again", async () => {
    const own = makeStep({
      number: 4,
      title: "Add the limits",
      reviewMode: "manual",
      reviewModeAdjusted: true,
      model: "claude-sonnet-5",
      adjusted: true,
    });
    const { user } = details({ ...STRUCTURED, steps: [own], currentStep: 0 });

    expect(screen.getByText("Its own mode · the task reviews with Agent")).toBeInTheDocument();
    expect(screen.getByText(/^Its own model · Implementation uses Opus/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Review mode of step 4: Manual" }));
    await user.click(await screen.findByRole("menuitem", { name: "Follow the task · Agent" }));
    expect(api.clearStepReviewMode).toHaveBeenCalledWith("task-1", 4);
  });

  it("says a step that follows the task and Implementation follows them", () => {
    details(STRUCTURED);

    expect(screen.getByText("Follows the task")).toBeInTheDocument();
    expect(screen.getByText("Follows Implementation")).toBeInTheDocument();
  });
});

describe("DetailsPanel, Implementation", () => {
  it("puts the single step of a One-Shot task in place of the steps, without a number", () => {
    details(ONE_SHOT);

    expect(screen.queryByRole("region", { name: /^Steps/ })).not.toBeInTheDocument();
    const rows = within(group("Implementation")).getAllByRole("listitem");
    expect(rows.map((row) => row.firstElementChild?.textContent)).toEqual([
      "Implementationnow · Agent",
      "Review 1 · clean",
    ]);
  });

  it("keeps the committed implementation in the pull request stage", () => {
    details({
      ...ONE_SHOT,
      stage: "pr",
      currentStep: 0,
      steps: [{ ...committed(1), reports: [] }],
    });

    expect(within(group("Implementation")).getByRole("listitem")).toHaveTextContent(
      /^Implementationc19f02e/,
    );
  });

  it("has no Implementation nor Steps before the implementation of a One-Shot task", () => {
    details(makeTask({ mode: "one_shot", stage: "one_shot" }));

    expect(screen.queryByRole("region", { name: "Implementation" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /^Steps/ })).not.toBeInTheDocument();
    expect(facts(group("Task")).Mode).toBe("One-Shot");
  });
});

describe("DetailsPanel, reports", () => {
  it("opens a report in place of the list, and comes back to it", async () => {
    vi.mocked(api.readArtifact).mockResolvedValue("# Findings");
    const { user } = details(STRUCTURED);

    const [, , current] = within(group(/^Steps/)).getAllByRole("button", {
      name: "Review 1 · changes",
    });
    await user.click(current as HTMLElement);

    expect(await screen.findByTestId("markdown")).toHaveTextContent("# Findings");
    expect(api.readArtifact).toHaveBeenCalledWith("task-1", "step-reviews/3-1.md");
    expect(
      screen.getByRole("heading", { name: "Step 3 · Review 1 · changes" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /^Steps/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "← Details" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "← Details" }));

    expect(group(/^Steps/)).toBeInTheDocument();
    expect(
      within(group(/^Steps/)).getAllByRole("button", { name: "Review 1 · changes" })[2],
    ).toHaveFocus();
  });

  it("opens at the report a marker of the conversation asked for, and comes back to its row", async () => {
    vi.mocked(api.readArtifact).mockResolvedValue("# Findings");
    const { user } = renderWithStore(<DetailsPanel task={STRUCTURED} />, {
      state: makeState({ tasks: [STRUCTURED], repositories: [makeRepository()] }),
      ui: {
        location: { kind: "task", id: STRUCTURED.id },
        panel: "details",
        panelDocument: "step-reviews/3-1.md",
      },
    });

    expect(
      screen.getByRole("heading", { name: "Step 3 · Review 1 · changes" }),
    ).toBeInTheDocument();
    expect(await screen.findByTestId("markdown")).toHaveTextContent("# Findings");
    expect(useAppStore.getState().panelDocument).toBeNull();

    await user.click(screen.getByRole("button", { name: "← Details" }));

    expect(
      within(group(/^Steps/)).getAllByRole("button", { name: "Review 1 · changes" })[2],
    ).toHaveFocus();
  });

  it("goes to the report a marker asks for with the panel already open", async () => {
    vi.mocked(api.readArtifact).mockResolvedValue("# Findings");
    details(STRUCTURED);

    act(() => {
      useAppStore.getState().openPanelAt("details", "step-reviews/1-1.md");
    });

    expect(
      await screen.findByRole("heading", { name: "Step 1 · Review 1 · changes" }),
    ).toBeInTheDocument();
    expect(api.readArtifact).toHaveBeenCalledWith("task-1", "step-reviews/1-1.md");
  });

  it("says a report couldn't be read, and reads it again on Try again", async () => {
    vi.mocked(api.readArtifact).mockRejectedValueOnce(new Error("no such file"));
    const { user } = details(STRUCTURED);

    await user.click(
      within(group(/^Steps/)).getAllByRole("button", {
        name: "Review 1 · changes",
      })[0] as HTMLElement,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't read step-reviews/1-1.mdno such file",
    );
    vi.mocked(api.readArtifact).mockResolvedValue("# Clean");
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByTestId("markdown")).toHaveTextContent("# Clean");
    expect(api.readArtifact).toHaveBeenCalledTimes(2);
  });

  it("shows three bars while a report is read", async () => {
    vi.mocked(api.readArtifact).mockReturnValue(new Promise(() => {}));
    const { user } = details(ONE_SHOT);

    await user.click(screen.getByRole("button", { name: "Review 1 · clean" }));

    expect(
      screen.getByRole("status", { name: "Reading Implementation · Review 1 · clean" }),
    ).toBeInTheDocument();
  });
});

describe("DetailsPanel, Pull request", () => {
  it("lists the reports of the pull request review and the facts of the open pull request", () => {
    details(inPR());

    const pr = group("Pull request");
    expect(within(pr).getByRole("button", { name: "Review 1 · changes" })).toBeInTheDocument();
    const pairs = facts(pr);
    expect(pairs["Pull request"]).toBe("#1284 · into dev");
    expect(pairs.Checks).toMatch(/^1 of 2 passed · 1 not finished/);
    expect(pairs.Checked).toBe("2m ago");
    expect(within(pr).getByRole("list", { name: "Checks" })).toHaveTextContent(/lintpassed1m 52s/);
  });

  it("opens a report of the pull request review from its pr folder", async () => {
    vi.mocked(api.readArtifact).mockResolvedValue("# Review");
    const { user } = details(inPR());

    await user.click(
      within(group("Pull request")).getByRole("button", { name: "Review 1 · changes" }),
    );

    expect(
      await screen.findByRole("heading", { name: "PR review · Review 1 · changes" }),
    ).toBeInTheDocument();
    expect(api.readArtifact).toHaveBeenCalledWith("task-1", "pr/review-1.md");
  });

  it("says a merged pull request is merged, and opens it in the browser", async () => {
    const { user } = details(inPR({ status: "merged", prState: "merged" }));

    expect(facts(group("Pull request"))["Pull request"]).toBe("#1284 · into dev · merged");
    await user.click(screen.getByRole("link", { name: "#1284" }));

    expect(api.openExternal).toHaveBeenCalledWith("https://github.com/dev/web/pull/1284");
  });

  it("counts the seconds of a check that runs while the list is on view", () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    vi.setSystemTime(new Date("2026-09-27T23:57:00Z"));
    details(inPR());
    const running = () =>
      within(screen.getByRole("list", { name: "Checks" })).getAllByRole("listitem")[1];
    expect(running()).toHaveTextContent(/52s$/);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(running()).toHaveTextContent(/53s$/);
  });

  it("has no group before the pull request has a report or opens", () => {
    details(makeTask({ stage: "pr", pr: makePullRequest({ status: "drafting" }) }));

    expect(screen.queryByRole("region", { name: "Pull request" })).not.toBeInTheDocument();
  });
});

describe("DetailsPanel, Task", () => {
  it("lists every fact of the task", () => {
    details({
      ...STRUCTURED,
      card: makeTaskCard({
        epic: {
          key: "dev/web#3",
          repository: "dev/web",
          number: 3,
          title: "API hardening",
          url: "https://github.com/dev/web/issues/3",
          state: "open",
        },
      }),
    });

    expect(facts(group("Task"))).toEqual({
      Repository: "dev/web · ~/projects/web",
      Card: "dev/web#12 · In progress",
      Epic: "API hardening",
      Mode: "Structured",
      "Review mode": "Agent",
      Models: "Per stage",
      Branch: "rate-limit",
      Base: "dev",
      Worktree: "~/.local/share/myspec/worktrees/dev/web/rate-limit",
      Started: startedTime(STRUCTURED.createdAt, Date.now()),
    });
  });

  it("leaves out the card, the epic and the worktree of a task without them", () => {
    details(makeTask());

    expect(Object.keys(facts(group("Task")))).toEqual([
      "Repository",
      "Mode",
      "Review mode",
      "Models",
      "Started",
    ]);
  });

  it("says the clone is missing, with its path in the tooltip", async () => {
    const { user } = details(makeTask(), makeRepository({ missing: true }));

    expect(facts(group("Task")).Repository).toBe("dev/web · ◇ clone missing · ~/projects/web");
    await user.hover(screen.getByText("clone missing"));

    expect(await screen.findByText("~/projects/web")).toBeInTheDocument();
  });

  it("opens the card and the epic in the browser", async () => {
    const { user } = details(makeTask({ card: makeTaskCard() }));

    await user.click(screen.getByRole("link", { name: "dev/web#12" }));

    expect(api.openExternal).toHaveBeenCalledWith("https://github.com/dev/web/issues/12");
  });

  it("opens the review mode popover on its chip, and gives the focus back to it", async () => {
    const { user } = details(STRUCTURED);
    const chip = screen.getByRole("button", { name: "Review mode of the task: Agent" });

    await user.click(chip);

    expect(await screen.findByRole("dialog", { name: "Review mode" })).toBeInTheDocument();
    expect(chip).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Review mode" })).not.toBeInTheDocument();
    });
    expect(chip).toHaveFocus();
  });

  it("opens the models popover on its chip", async () => {
    const { user } = details(STRUCTURED);

    await user.click(screen.getByRole("button", { name: "Models per stage" }));

    expect(await screen.findByRole("dialog", { name: "Models" })).toBeInTheDocument();
  });
});

describe("DetailsPanel, conversations", () => {
  const STARTED = "2026-09-27T09:14:00Z";

  /** TALKED is STRUCTURED with every conversation it had: its planning and its steps. */
  const TALKED: TaskSummary = {
    ...STRUCTURED,
    conversations: [
      makeTaskConversation({ stage: "prd", startedAt: STARTED }),
      makeTaskConversation({ stage: "tech_spec", startedAt: STARTED }),
      makeTaskConversation({ stage: "plan", startedAt: STARTED }),
      makeTaskConversation({ stage: "step:1", startedAt: STARTED }),
      makeTaskConversation({ stage: "step_review:1", startedAt: STARTED }),
      makeTaskConversation({ stage: "step:2", startedAt: STARTED }),
      makeTaskConversation({ stage: "step:3", startedAt: STARTED }),
      makeTaskConversation({ stage: "step_review:3", startedAt: STARTED }),
    ],
  };

  /**
   * inMainArea renders Details inside a main area of a width, which says whether the panel stands
   * beside the conversation or covers it.
   */
  function inMainArea(task: TaskSummary, width: number) {
    const rendered = renderWithStore(
      <div className="main-area">
        <DetailsPanel task={task} />
      </div>,
      {
        state: makeState({ tasks: [task], repositories: [makeRepository()] }),
        ui: { location: { kind: "task", id: task.id }, panel: "details" },
      },
    );
    const area = rendered.container.querySelector(".main-area");
    Object.defineProperty(area, "clientWidth", { value: width, configurable: true });
    return rendered;
  }

  /** later is a reading of a conversation that answers when the test says. */
  function later() {
    let answer: (stage: string) => void = () => {};
    let refuse: (message: string) => void = () => {};
    vi.mocked(api.getTranscript).mockImplementationOnce(
      (taskId, stage) =>
        new Promise((resolve, reject) => {
          answer = () => resolve(makeTranscript({ taskId, stage }));
          refuse = (message) => reject(new Error(message));
        }),
    );
    return {
      answer: () => act(() => answer("")),
      refuse: (message: string) => act(() => refuse(message)),
    };
  }

  const time = shortTime(STARTED, Date.now());

  it("lists the conversations of a committed step under it, with the time each started", () => {
    details(TALKED);

    const rows = within(group(/^Steps/)).getAllByRole("listitem");
    expect(rows.slice(0, 4).map((row) => row.firstElementChild?.textContent)).toEqual([
      expect.stringMatching(/^1 · Step 1 title/),
      `Implementer${time}`,
      `Reviewer${time}`,
      "Review 1 · changes",
    ]);
    expect(within(rows[1] as HTMLElement).getByRole("button")).toHaveAccessibleName(
      `Implementer · ${time}`,
    );
    expect(within(rows[1] as HTMLElement).getByRole("button")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("lists no conversation under the current step, whose conversations are the tabs", () => {
    details(TALKED);

    const current = within(group(/^Steps/))
      .getAllByRole("listitem")
      .find((row) => row.getAttribute("aria-current") === "step");
    expect(current).toHaveTextContent(/^3 · Wire the APInow · AgentReview 1 · changes$/);
  });

  it("lists the planning conversations, with the one on screen saying now and opening nothing", () => {
    details({ ...TALKED, stage: "tech_spec", steps: [], currentStep: 0 });

    const planning = group("Planning");
    expect(
      within(planning)
        .getAllByRole("listitem")
        .map((row) => row.textContent),
    ).toEqual([`PRD${time}`, "Tech specnow", `Plan${time}`]);
    expect(within(planning).getByRole("button", { name: `PRD · ${time}` })).toBeInTheDocument();
    expect(within(planning).queryByRole("button", { name: /^Tech spec/ })).toBeNull();
  });

  it("has no Planning group without a planning conversation", () => {
    details(STRUCTURED);

    expect(screen.queryByRole("region", { name: "Planning" })).not.toBeInTheDocument();
  });

  it("lists the conversations of the pull request, the one on screen saying now, with the reports under the review", () => {
    details({
      ...inPR(),
      conversations: [
        makeTaskConversation({ stage: "pr", startedAt: STARTED }),
        makeTaskConversation({ stage: "pr_review", startedAt: STARTED }),
      ],
    });

    const rows = within(group("Pull request")).getAllByRole("listitem");
    expect(rows.slice(0, 3).map((row) => row.textContent)).toEqual([
      "Draft and opening · #1284now",
      `PR review${time}`,
      "Review 1 · changes",
    ]);
  });

  it("says now on the conversation of the review once the pull request is merged, the one on screen", () => {
    details({
      ...inPR({ status: "merged", prState: "merged", sessionStage: "" }),
      conversations: [
        makeTaskConversation({ stage: "pr", startedAt: STARTED }),
        makeTaskConversation({ stage: "pr_review", startedAt: STARTED }),
      ],
    });

    const rows = within(group("Pull request")).getAllByRole("listitem");
    expect(rows.slice(0, 2).map((row) => row.textContent)).toEqual([
      `Draft and opening · #1284${time}`,
      "PR reviewnow",
    ]);
    expect(within(group("Pull request")).queryByRole("button", { name: /^PR review/ })).toBeNull();
  });

  it("has a Pull request group with only its conversations before a report or the opening", () => {
    details(
      makeTask({
        stage: "pr",
        pr: makePullRequest({ status: "drafting", sessionStage: "pr" }),
        conversations: [makeTaskConversation({ stage: "pr", startedAt: STARTED })],
      }),
    );

    expect(within(group("Pull request")).getByText("Draft and opening")).toBeInTheDocument();
    expect(within(group("Pull request")).getByText("now")).toBeInTheDocument();
  });

  it("says the conversation is being opened, and leaves the one of the task on screen meanwhile", async () => {
    const reading = later();
    const { user } = inMainArea(TALKED, 1300);

    await user.click(screen.getByRole("button", { name: `PRD · ${time}` }));

    expect(api.getTranscript).toHaveBeenCalledWith("task-1", "prd");
    const row = screen.getByRole("button", { name: "Opening the conversation…" });
    expect(row).toHaveAttribute("aria-busy", "true");
    expect(useAppStore.getState().earlierConversation).toBeNull();

    await reading.answer();

    expect(useAppStore.getState().earlierConversation).toEqual({
      taskId: "task-1",
      stage: "prd",
      from: "panel",
    });
    expect(screen.getByRole("button", { name: `PRD · ${time}` })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("stays open beside the conversation it opens, as a column", async () => {
    const { user } = inMainArea(TALKED, 1120);

    await user.click(screen.getByRole("button", { name: `PRD · ${time}` }));

    await waitFor(() => {
      expect(useAppStore.getState().earlierConversation).not.toBeNull();
    });
    expect(useAppStore.getState().panel).toBe("details");
  });

  it("closes when it covers the conversation it opens, so the way back is on view", async () => {
    const { user } = inMainArea(TALKED, 1119);

    await user.click(screen.getByRole("button", { name: `PRD · ${time}` }));

    await waitFor(() => {
      expect(useAppStore.getState().panel).toBeNull();
    });
    expect(useAppStore.getState().earlierConversation).toEqual({
      taskId: "task-1",
      stage: "prd",
      from: null,
    });
  });

  it("says on the row that the conversation couldn't be opened, and reads it again on a click", async () => {
    const reading = later();
    const { user } = inMainArea(TALKED, 1300);

    await user.click(screen.getByRole("button", { name: `PRD · ${time}` }));
    await reading.refuse("database is locked");

    const row = screen.getByRole("button", { name: "Couldn't open it · Try again" });
    expect(useAppStore.getState().error).toBeNull();
    expect(useAppStore.getState().earlierConversation).toBeNull();

    await user.click(row);

    expect(api.getTranscript).toHaveBeenCalledTimes(2);
    await waitFor(() => {
      expect(useAppStore.getState().earlierConversation?.stage).toBe("prd");
    });
  });

  it("brings back the conversation of the task on a second click, keeping the focus on the row", async () => {
    const { user } = inMainArea(TALKED, 1300);
    act(() => useAppStore.getState().openEarlierConversation("task-1", "step:1", true));
    const [row] = within(group(/^Steps/)).getAllByRole("button", {
      name: `Implementer · ${time}`,
    });
    if (row === undefined) {
      throw new Error("step 1 has no Implementer row");
    }
    expect(row).toHaveAttribute("aria-pressed", "true");
    expect(row).toHaveAttribute("id", "earlier-step:1");

    await user.click(row);

    expect(useAppStore.getState().earlierConversation).toBeNull();
    expect(api.getTranscript).not.toHaveBeenCalled();
    expect(row).toHaveAttribute("aria-pressed", "false");
    expect(row).toHaveFocus();
  });

  it("keeps the focus on the row on a second click, even when it wasn't opened from the panel", async () => {
    const { user } = inMainArea(TALKED, 1300);
    act(() => useAppStore.getState().openEarlierConversation("task-1", "step:1", false));
    const [row] = within(group(/^Steps/)).getAllByRole("button", {
      name: `Implementer · ${time}`,
    });
    if (row === undefined) {
      throw new Error("step 1 has no Implementer row");
    }
    expect(row).toHaveAttribute("aria-pressed", "true");

    await user.click(row);

    expect(useAppStore.getState().earlierConversation).toBeNull();
    expect(row).toHaveFocus();
  });

  it("opens another conversation in place of the earlier one being read", async () => {
    const { user } = inMainArea(TALKED, 1300);
    act(() => useAppStore.getState().openEarlierConversation("task-1", "step:1", true));

    await user.click(within(group(/^Steps/)).getByRole("button", { name: `Reviewer · ${time}` }));

    await waitFor(() => {
      expect(useAppStore.getState().earlierConversation?.stage).toBe("step_review:1");
    });
  });
});
