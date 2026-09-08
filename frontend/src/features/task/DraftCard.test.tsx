import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DraftCard } from "@/features/task/DraftCard";
import { api, type RepoPR } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeRepoPR, makeState, makeTask } from "@/test/wails-mock";

const DRAFT = { title: "Add the login form", body: "Closes #12", file: "web-draft.md" };

function card(overrides: Partial<RepoPR> = {}, prDrafts: Record<string, never> | object = {}) {
  const repo = makeRepoPR({ status: "draft_ready", draft: DRAFT, ...overrides });
  const task = makeTask({ stage: "pr", repos: [repo] });
  return renderWithStore(<DraftCard taskId={task.id} repo={repo} />, {
    state: makeState({ tasks: [task] }),
    ui: { prDrafts: prDrafts as never },
  });
}

describe("DraftCard", () => {
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
    card({}, { "task-1|/home/dev/projects/web": { title: "Mine", body: "My body" } });

    expect(screen.getByLabelText("Title")).toHaveValue("Mine");
    expect(screen.getByLabelText("Description")).toHaveValue("My body");
  });

  it("sends the edited draft", async () => {
    const { user } = card();

    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Log in");
    await user.click(screen.getByRole("button", { name: "Open PR" }));

    expect(api.openPR).toHaveBeenCalledWith(
      "task-1",
      "/home/dev/projects/web",
      "Log in",
      DRAFT.body,
    );
  });

  it("opens nothing without a title or a description", async () => {
    card({}, { "task-1|/home/dev/projects/web": { title: "  ", body: "why" } });

    expect(screen.getByRole("button", { name: "Open PR" })).toBeDisabled();
  });

  it("waits while the agent is still working", () => {
    card({ turnRunning: true });

    expect(screen.getByRole("button", { name: "Open PR" })).toBeDisabled();
  });
});
