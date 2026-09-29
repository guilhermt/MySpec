import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DraftCard } from "@/features/task/DraftCard";
import type { PullRequest } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makePullRequest, makeState, makeTask } from "@/test/wails-mock";

const DRAFT = { title: "Add the login form", body: "Closes #12", file: "draft.md" };

function card(overrides: Partial<PullRequest> = {}, prDrafts: Record<string, never> | object = {}) {
  const pr = makePullRequest({ status: "draft_ready", draft: DRAFT, ...overrides });
  const task = makeTask({ stage: "pr", pr });
  return renderWithStore(<DraftCard taskId={task.id} pr={pr} />, {
    state: makeState({ tasks: [task] }),
    ui: { prDrafts: prDrafts as never },
  });
}

describe("DraftCard", () => {
  it("leaves the opening to Approve draft on the request bar", () => {
    const pr = makePullRequest({ status: "draft_ready", draft: DRAFT });
    const task = makeTask({ stage: "pr", pr });
    renderWithStore(<DraftCard taskId={task.id} pr={pr} />, {
      state: makeState({ tasks: [task] }),
    });

    expect(screen.queryByRole("button", { name: "Open PR" })).not.toBeInTheDocument();
  });

  it("starts from what the agent wrote", () => {
    card();

    expect(screen.getByLabelText("Title")).toHaveValue(DRAFT.title);
    expect(screen.getByLabelText("Description")).toHaveValue(DRAFT.body);
  });

  it("says the branch it goes into without letting it be edited", () => {
    card();

    expect(screen.getByText("into dev")).toBeInTheDocument();
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
  });

  it("is one entry of the feed the arrows walk, with the description in mono", () => {
    card();

    const draft = screen.getByRole("article", { name: "Pull request draft" });
    expect(draft).toHaveAttribute("data-feed-item");
    expect(draft).not.toHaveAttribute("data-feed-keys");
    expect(screen.getByLabelText("Description")).toHaveClass("font-mono", "resize-y");
  });

  it("keeps the edit of the user in the store", async () => {
    const { user } = card();

    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Mine");

    expect(useAppStore.getState().prDrafts["task-1"]).toEqual({ title: "Mine", body: DRAFT.body });
  });

  it("prefers what the user is editing over the file", () => {
    card({}, { "task-1": { title: "Mine", body: "My body" } });

    expect(screen.getByLabelText("Title")).toHaveValue("Mine");
    expect(screen.getByLabelText("Description")).toHaveValue("My body");
  });

  // Asking the agent for a new title is the one update the local edit loses to.
  it("shows the draft again when the agent rewrites it", () => {
    const pr = makePullRequest({ status: "draft_ready", draft: DRAFT });
    const task = makeTask({ stage: "pr", pr });
    const { rerender } = renderWithStore(<DraftCard taskId={task.id} pr={pr} />, {
      state: makeState({ tasks: [task] }),
      ui: { prDrafts: { "task-1": { title: "Mine", body: "My body" } } },
    });
    expect(screen.getByLabelText("Title")).toHaveValue("Mine");

    const rewritten = { ...pr, draft: { ...DRAFT, title: "Teste" } };
    rerender(<DraftCard taskId={task.id} pr={rewritten} />);

    expect(screen.getByLabelText("Title")).toHaveValue("Teste");
  });

  it("keeps what the user is typing while the draft on disk stands still", () => {
    const pr = makePullRequest({ status: "draft_ready", draft: DRAFT });
    const task = makeTask({ stage: "pr", pr });
    const { rerender } = renderWithStore(<DraftCard taskId={task.id} pr={pr} />, {
      state: makeState({ tasks: [task] }),
      ui: { prDrafts: { "task-1": { title: "Mine", body: "My body" } } },
    });

    // Anything else about the pull request moving on leaves the edit alone.
    rerender(<DraftCard taskId={task.id} pr={{ ...pr, turnRunning: true }} />);

    expect(screen.getByLabelText("Title")).toHaveValue("Mine");
  });
});
