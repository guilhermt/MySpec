import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DraftCard } from "@/features/task/DraftCard";
import { api, type PullRequest } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makePullRequest, makeState, makeTask } from "@/test/wails-mock";

const DRAFT = { title: "Add the login form", body: "Closes #12", file: "draft.md" };

function card(overrides: Partial<PullRequest> = {}, prDrafts: Record<string, never> | object = {}) {
  const pr = makePullRequest({ status: "draft_ready", draft: DRAFT, ...overrides });
  const task = makeTask({ stage: "pr", pr });
  return renderWithStore(<DraftCard taskId={task.id} pr={pr} showOpenPR />, {
    state: makeState({ tasks: [task] }),
    ui: { prDrafts: prDrafts as never },
  });
}

describe("DraftCard", () => {
  it("leaves the opening to the request bar when it has one", () => {
    const pr = makePullRequest({ status: "draft_ready", draft: DRAFT });
    const task = makeTask({ stage: "pr", pr });
    renderWithStore(<DraftCard taskId={task.id} pr={pr} showOpenPR={false} />, {
      state: makeState({ tasks: [task] }),
    });

    expect(screen.queryByRole("button", { name: "Open PR" })).not.toBeInTheDocument();
  });

  it("starts from what the agent wrote", () => {
    card();

    expect(screen.getByLabelText("Title")).toHaveValue(DRAFT.title);
    expect(screen.getByLabelText("Description")).toHaveValue(DRAFT.body);
  });

  it("shows the base of the branch without letting it be edited", () => {
    card();

    expect(screen.getByText("origin/dev")).toBeInTheDocument();
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
  });

  it("prefers what the user is editing over the file", () => {
    card({}, { "task-1": { title: "Mine", body: "My body" } });

    expect(screen.getByLabelText("Title")).toHaveValue("Mine");
    expect(screen.getByLabelText("Description")).toHaveValue("My body");
  });

  it("sends the edited draft", async () => {
    const { user } = card();

    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Log in");
    await user.click(screen.getByRole("button", { name: "Open PR" }));

    expect(api.openPR).toHaveBeenCalledWith("task-1", "Log in", DRAFT.body);
  });

  it("opens nothing without a title or a description", async () => {
    card({}, { "task-1": { title: "  ", body: "why" } });

    expect(screen.getByRole("button", { name: "Open PR" })).toBeDisabled();
  });

  it("waits while the agent is still working", () => {
    card({ turnRunning: true });

    expect(screen.getByRole("button", { name: "Open PR" })).toBeDisabled();
  });

  // Asking the agent for a new title is the one update the local edit loses to.
  it("shows the draft again when the agent rewrites it", () => {
    const pr = makePullRequest({ status: "draft_ready", draft: DRAFT });
    const task = makeTask({ stage: "pr", pr });
    const { rerender } = renderWithStore(<DraftCard taskId={task.id} pr={pr} showOpenPR />, {
      state: makeState({ tasks: [task] }),
      ui: { prDrafts: { "task-1": { title: "Mine", body: "My body" } } },
    });
    expect(screen.getByLabelText("Title")).toHaveValue("Mine");

    const rewritten = { ...pr, draft: { ...DRAFT, title: "Teste" } };
    rerender(<DraftCard taskId={task.id} pr={rewritten} showOpenPR={false} />);

    expect(screen.getByLabelText("Title")).toHaveValue("Teste");
  });

  it("keeps what the user is typing while the draft on disk stands still", () => {
    const pr = makePullRequest({ status: "draft_ready", draft: DRAFT });
    const task = makeTask({ stage: "pr", pr });
    const { rerender } = renderWithStore(<DraftCard taskId={task.id} pr={pr} showOpenPR />, {
      state: makeState({ tasks: [task] }),
      ui: { prDrafts: { "task-1": { title: "Mine", body: "My body" } } },
    });

    // Anything else about the pull request moving on leaves the edit alone.
    rerender(<DraftCard taskId={task.id} pr={{ ...pr, turnRunning: true }} showOpenPR />);

    expect(screen.getByLabelText("Title")).toHaveValue("Mine");
  });
});
