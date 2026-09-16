import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PRBlocked } from "@/features/task/PRBlocked";
import { api, type PRBlock } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makePullRequest, makeState, makeTask } from "@/test/wails-mock";

function blocked(block: Partial<PRBlock> = {}) {
  const pr = makePullRequest({
    status: "blocked",
    block: { reason: "gh_unauthenticated", detail: "", ...block },
  });
  const task = makeTask({ stage: "pr", pr });
  return renderWithStore(<PRBlocked taskId={task.id} pr={pr} />, {
    state: makeState({ tasks: [task] }),
  });
}

describe("PRBlocked", () => {
  it("says what is wrong and what to do about it", () => {
    blocked();

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("GitHub CLI isn't authenticated");
    expect(alert).toHaveTextContent("gh auth login");
  });

  it("names every other reason the stage is blocked", () => {
    blocked({ reason: "gh_missing" });

    expect(screen.getByRole("alert")).toHaveTextContent("GitHub CLI was not found");
  });

  it("shows what gh said, as gh said it", () => {
    blocked({ reason: "gh_failed", detail: "gh: could not resolve to a Repository" });

    expect(screen.getByText("gh: could not resolve to a Repository").tagName).toBe("PRE");
  });

  it("starts the stage over", async () => {
    const { user } = blocked();

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(api.retryPR).toHaveBeenCalledWith("task-1");
  });
});
