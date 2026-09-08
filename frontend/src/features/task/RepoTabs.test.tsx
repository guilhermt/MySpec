import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RepoTabs } from "@/features/task/RepoTabs";
import { api, type RepoPR } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeRepoPR, makeState, makeTask } from "@/test/wails-mock";

const API = { repository: "api", repoPath: "/home/dev/projects/api", slug: "api" };

function tabs(repos: RepoPR[]) {
  const task = makeTask({ stage: "pr", repos });
  return renderWithStore(<RepoTabs task={task} />, { state: makeState({ tasks: [task] }) });
}

describe("RepoTabs", () => {
  it("shows one tab per repository, with its state read out", () => {
    tabs([makeRepoPR({ status: "drafting" }), makeRepoPR({ ...API, status: "draft_ready" })]);

    const [web, api] = screen.getAllByRole("tab");
    expect(web).toHaveTextContent("web");
    expect(web).toHaveTextContent("Preparing the draft");
    expect(api).toHaveTextContent("api");
    expect(api).toHaveTextContent("Draft waiting for your OK");
  });

  it("stays there with a single repository, where the link lives", () => {
    tabs([makeRepoPR({ prNumber: 12, prUrl: "https://github.com/o/r/pull/12" })]);

    expect(screen.getAllByRole("tab")).toHaveLength(1);
    expect(screen.getByRole("tab")).toHaveTextContent("#12");
  });

  it("selects the repository waiting for the user by default", () => {
    tabs([makeRepoPR({ status: "drafting" }), makeRepoPR({ ...API, status: "draft_ready" })]);

    const [web, api] = screen.getAllByRole("tab");
    expect(web).toHaveAttribute("aria-selected", "false");
    expect(api).toHaveAttribute("aria-selected", "true");
  });

  it("moves the selection when a tab is picked", async () => {
    const { user } = tabs([makeRepoPR({ status: "drafting" }), makeRepoPR(API)]);

    await user.click(screen.getAllByRole("tab")[1] as HTMLElement);

    expect(useAppStore.getState().openRepo["task-1"]).toBe(API.repoPath);
  });

  it("opens the pull request in the browser of the desktop", async () => {
    const { user } = tabs([makeRepoPR({ prNumber: 12, prUrl: "https://github.com/o/r/pull/12" })]);

    await user.click(screen.getByRole("button", { name: "Open pull request #12 on GitHub" }));

    expect(api.openExternal).toHaveBeenCalledWith("https://github.com/o/r/pull/12");
  });

  it("has no link before the pull request exists", () => {
    tabs([makeRepoPR({ status: "drafting" })]);

    expect(screen.queryByRole("button", { name: /Open pull request/ })).not.toBeInTheDocument();
  });

  it("shows nothing before the repositories are known", () => {
    const { container } = tabs([]);

    expect(container).toBeEmptyDOMElement();
  });
});
