import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OrphanPRs } from "@/features/task/OrphanPRs";
import { api, type PRPreview } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeState } from "@/test/wails-mock";

const WEB: PRPreview = {
  repository: "web",
  repoPath: "/home/dev/projects/web",
  number: 12,
  url: "https://github.com/o/r/pull/12",
  state: "open",
};

const API_REPO: PRPreview = {
  repository: "api",
  repoPath: "/home/dev/projects/api",
  number: 13,
  url: "https://github.com/o/a/pull/13",
  state: "open",
};

function warning(prs: PRPreview[]) {
  return renderWithStore(<OrphanPRs prs={prs} />, { state: makeState() });
}

describe("OrphanPRs", () => {
  it("lists every pull request that stays behind, with its repository", () => {
    warning([WEB, API_REPO]);

    expect(screen.getByText("These pull requests stay open on GitHub:")).toBeInTheDocument();
    expect(screen.getByText("#12")).toBeInTheDocument();
    expect(screen.getByText("web")).toBeInTheDocument();
    expect(screen.getByText("#13")).toBeInTheDocument();
    expect(screen.getByText("api")).toBeInTheDocument();
  });

  it("says closing them is up to the user", () => {
    warning([WEB]);

    expect(screen.getByText("This pull request stays open on GitHub:")).toBeInTheDocument();
    expect(screen.getByText("Closing them on GitHub is up to you.")).toBeInTheDocument();
  });

  it("opens one in the browser of the desktop", async () => {
    const { user } = warning([WEB]);

    await user.click(screen.getByText("#12"));

    expect(api.openExternal).toHaveBeenCalledWith("https://github.com/o/r/pull/12");
  });

  it("says nothing without a pull request to leave behind", () => {
    const { container } = warning([]);

    expect(container).toBeEmptyDOMElement();
  });

  it("names the workspace itself for the repository of a root task", () => {
    warning([{ ...WEB, repository: "." }]);

    expect(screen.getByText("projects")).toBeInTheDocument();
  });
});
