import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RepoTabs } from "@/features/task/RepoTabs";
import { api, type RepoPR, type Situation } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore, type StoreOptions } from "@/test/render";
import { makeRepoPR, makeSituation, makeState, makeTask } from "@/test/wails-mock";

const API = { repository: "api", repoPath: "/home/dev/projects/api", slug: "api" };
const WEB_PATH = "/home/dev/projects/web";

const API_BLOCKED = makeSituation({
  id: "api-blocked",
  kind: "pr_blocked",
  group: "error",
  place: { kind: "repo", stage: "", step: 0, repoPath: API.repoPath, repository: "api" },
  startedAt: "2026-09-05T11:00:00Z",
});
const WEB_FINDINGS = makeSituation({
  id: "web-findings",
  kind: "findings",
  place: { kind: "repo", stage: "", step: 0, repoPath: WEB_PATH, repository: "web" },
  startedAt: "2026-09-05T10:00:00Z",
});

function tabs(
  repos: RepoPR[],
  situations: Situation[] = [],
  ui: NonNullable<StoreOptions["ui"]> = {},
) {
  const task = makeTask({ stage: "pr", repos, situations });
  return renderWithStore(<RepoTabs task={task} />, { state: makeState({ tasks: [task] }), ui });
}

// The dot has no role of its own: it is the hidden element that carries the tone.
function dotOf(tab: HTMLElement): Element | null {
  return tab.querySelector('[aria-hidden="true"]');
}

describe("RepoTabs", () => {
  it("shows one tab per repository, reading out the state of one that waits for nothing", () => {
    tabs([makeRepoPR({ status: "drafting" }), makeRepoPR({ ...API, status: "draft_ready" })]);

    const web = screen.getByRole("tab", { name: "web Preparing the draft" });
    expect(within(web).getByText("Preparing the draft")).toHaveClass("sr-only");
    expect(dotOf(web)).toHaveClass("bg-[var(--status-working)]");
    const api = screen.getByRole("tab", { name: "api Draft waiting for your OK" });
    expect(dotOf(api)).toHaveClass("bg-muted-foreground");
  });

  it("shows the situation of a repository next to its name, in its tone", () => {
    tabs(
      [
        makeRepoPR({ status: "pr_closed", prNumber: 12, prState: "closed" }),
        makeRepoPR({ ...API, status: "draft_ready" }),
      ],
      [
        makeSituation({
          id: "web-closed",
          kind: "pr_closed",
          group: "error",
          place: { kind: "repo", stage: "", step: 0, repoPath: WEB_PATH, repository: "web" },
        }),
        makeSituation({
          id: "api-draft",
          kind: "draft",
          place: { kind: "repo", stage: "", step: 0, repoPath: API.repoPath, repository: "api" },
        }),
      ],
    );

    const api = screen.getByRole("tab", { name: "api Draft to approve" });
    expect(within(api).getByText("Draft to approve")).not.toHaveClass("sr-only");
    expect(dotOf(api)).toHaveClass("bg-[var(--status-attention)]");
    const web = screen.getByRole("tab", { name: "web PR closed unmerged #12" });
    expect(dotOf(web)).toHaveClass("bg-destructive");
  });

  it("stays there with a single repository, where the link lives", () => {
    tabs([makeRepoPR({ prNumber: 12, prUrl: "https://github.com/o/r/pull/12" })]);

    expect(screen.getAllByRole("tab")).toHaveLength(1);
    expect(screen.getByRole("tab")).toHaveTextContent("#12");
  });

  it("opens on the tab of the most urgent situation", () => {
    tabs(
      [
        makeRepoPR({ status: "awaiting_decision", prNumber: 12 }),
        makeRepoPR({ ...API, status: "blocked" }),
      ],
      // The situations come most urgent first: the block before the older findings.
      [API_BLOCKED, WEB_FINDINGS],
    );

    const [web, api] = screen.getAllByRole("tab");
    expect(web).toHaveAttribute("aria-selected", "false");
    expect(api).toHaveAttribute("aria-selected", "true");
  });

  it("highlights a tab the user is not on when its situation starts, in its tone", () => {
    tabs(
      [
        makeRepoPR({ status: "awaiting_decision", prNumber: 12 }),
        makeRepoPR({ ...API, status: "blocked" }),
      ],
      [API_BLOCKED, WEB_FINDINGS],
      { flashing: new Set([API_BLOCKED.id]), openRepo: { "task-1": WEB_PATH } },
    );

    const [web, api] = screen.getAllByRole("tab");
    expect(api).toHaveClass("attention-flash");
    expect(api).toHaveAttribute("data-tone", "error");
    expect(web).not.toHaveClass("attention-flash");
  });

  it("does not highlight the tab the user is on", () => {
    tabs(
      [
        makeRepoPR({ status: "awaiting_decision", prNumber: 12 }),
        makeRepoPR({ ...API, status: "blocked" }),
      ],
      [API_BLOCKED, WEB_FINDINGS],
      { flashing: new Set([API_BLOCKED.id, WEB_FINDINGS.id]) },
    );

    const [web, api] = screen.getAllByRole("tab");
    expect(api).toHaveAttribute("aria-selected", "true");
    expect(api).not.toHaveClass("attention-flash");
    expect(api).not.toHaveAttribute("data-tone");
    expect(web).toHaveClass("attention-flash");
    expect(web).toHaveAttribute("data-tone", "attention");
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
