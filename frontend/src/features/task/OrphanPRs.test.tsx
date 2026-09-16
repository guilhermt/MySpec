import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OrphanPR, openPROf } from "@/features/task/OrphanPRs";
import { api, type PRPreview } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makePullRequest, makeState, makeTask } from "@/test/wails-mock";

const PR: PRPreview = { number: 12, url: "https://github.com/o/r/pull/12", state: "open" };

function warning(pr: PRPreview | null) {
  return renderWithStore(<OrphanPR pr={pr} />, { state: makeState() });
}

describe("openPROf", () => {
  it("is the pull request a task opened", () => {
    const task = makeTask({
      stage: "pr",
      pr: makePullRequest({ prNumber: 12, prUrl: PR.url, prState: "open" }),
    });

    expect(openPROf(task)).toEqual(PR);
  });

  it("is null without a pull request on GitHub", () => {
    expect(openPROf(makeTask({ stage: "pr", pr: makePullRequest() }))).toBeNull();
    expect(openPROf(makeTask())).toBeNull();
  });
});

describe("OrphanPR", () => {
  it("names the pull request that stays behind, and says closing it is up to the user", () => {
    warning(PR);

    expect(screen.getByText("This pull request stays open on GitHub:")).toBeInTheDocument();
    expect(screen.getByText("#12")).toBeInTheDocument();
    expect(screen.getByText("Closing it on GitHub is up to you.")).toBeInTheDocument();
  });

  it("opens it in the browser of the desktop", async () => {
    const { user } = warning(PR);

    await user.click(screen.getByText("#12"));

    expect(api.openExternal).toHaveBeenCalledWith("https://github.com/o/r/pull/12");
  });

  it("says nothing without a pull request to leave behind", () => {
    const { container } = warning(null);

    expect(container).toBeEmptyDOMElement();
  });
});
