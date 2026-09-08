import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OrphanPRs } from "@/features/task/OrphanPRs";
import { api, type RepoPR } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeRepoPR, makeState, makeTask } from "@/test/wails-mock";

const API = { repository: "api", repoPath: "/home/dev/projects/api", slug: "api" };

function warning(repos: RepoPR[]) {
  const task = makeTask({ stage: "pr", repos });
  return renderWithStore(<OrphanPRs task={task} />, { state: makeState({ tasks: [task] }) });
}

describe("OrphanPRs", () => {
  it("lists every pull request that stays behind, with its repository", () => {
    warning([
      makeRepoPR({ prNumber: 12, prUrl: "https://github.com/o/r/pull/12" }),
      makeRepoPR({ ...API, prNumber: 13, prUrl: "https://github.com/o/a/pull/13" }),
    ]);

    expect(screen.getByText("These pull requests stay open on GitHub:")).toBeInTheDocument();
    expect(screen.getByText("#12")).toBeInTheDocument();
    expect(screen.getByText("web")).toBeInTheDocument();
    expect(screen.getByText("#13")).toBeInTheDocument();
    expect(screen.getByText("api")).toBeInTheDocument();
  });

  it("says closing them is up to the user", () => {
    warning([makeRepoPR({ prNumber: 12 })]);

    expect(screen.getByText("This pull request stays open on GitHub:")).toBeInTheDocument();
    expect(screen.getByText("Closing them on GitHub is up to you.")).toBeInTheDocument();
  });

  it("opens one in the browser of the desktop", async () => {
    const { user } = warning([
      makeRepoPR({ prNumber: 12, prUrl: "https://github.com/o/r/pull/12" }),
    ]);

    await user.click(screen.getByText("#12"));

    expect(api.openExternal).toHaveBeenCalledWith("https://github.com/o/r/pull/12");
  });

  it("says nothing without a pull request to leave behind", () => {
    const { container } = warning([makeRepoPR({ status: "drafting" })]);

    expect(container).toBeEmptyDOMElement();
  });

  it("says nothing outside the PR stage", () => {
    const task = makeTask();
    const { container } = renderWithStore(<OrphanPRs task={task} />, {
      state: makeState({ tasks: [task] }),
    });

    expect(container).toBeEmptyDOMElement();
  });
});
