import { act, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeployPanel } from "@/features/deploys/DeployPanel";
import { api, type DeployEnvironment, type DeployRepository, type DeployRun } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeDeployEnvironment, makeDeployRepository } from "@/test/wails-mock";

const NOW = Date.parse("2026-09-16T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const run = (overrides: Partial<DeployRun> = {}): DeployRun => ({
  id: 1,
  status: "succeeded",
  conclusion: "success",
  url: "https://github.com/dev/api/actions/runs/1",
  startedAt: ago(3 * HOUR),
  endedAt: ago(3 * HOUR - 192_000),
  ...overrides,
});

const promotion = (overrides: Partial<NonNullable<DeployEnvironment["promotion"]>> = {}) => ({
  commits: 3,
  partial: false,
  ahead: 3,
  pendingSince: ago(2 * DAY),
  pullRequests: [
    { number: 12, title: "Fix login", url: "https://github.com/dev/api/pull/12", author: "ana" },
  ],
  deployPr: null,
  otherDeployPrs: 0,
  ...overrides,
});

const deployPr = (overrides = {}) => ({
  number: 88,
  title: "Deploy to Staging",
  url: "https://github.com/dev/api/pull/88",
  draft: false,
  createdAt: ago(HOUR),
  ...overrides,
});

const staging = (overrides: Partial<DeployEnvironment> = {}) =>
  makeDeployEnvironment({
    position: 1,
    name: "Staging",
    branch: "staging",
    previousName: "Development",
    previousBranch: "dev",
    state: "pending",
    pending: true,
    available: "deploy",
    workflowUrl: "https://github.com/dev/api/actions/workflows/deploy.yml",
    compareUrl: "https://github.com/dev/api/compare/staging...dev",
    promotion: promotion(),
    ...overrides,
  });

function panel(env: DeployEnvironment, repo: Partial<DeployRepository> = {}) {
  const onClose = vi.fn();
  const result = renderWithStore(
    <DeployPanel
      repo={makeDeployRepository({ id: "api", name: "api", fullName: "dev/api", ...repo })}
      env={env}
      now={NOW}
      onClose={onClose}
    />,
  );
  return { ...result, onClose };
}

describe("DeployPanel", () => {
  it("is the aside of the environment, with its promotion, Open on GitHub and Close", async () => {
    const { user, onClose } = panel(staging());

    const aside = screen.getByRole("complementary", { name: "Deploy api to Staging" });
    expect(within(aside).getByText("Development → Staging")).toBeInTheDocument();
    expect(within(aside).getByText(/dev\/api/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open Development → Staging on GitHub" }));
    expect(api.openExternal).toHaveBeenCalledExactlyOnceWith(
      "https://github.com/dev/api/compare/staging...dev",
    );
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("tells the changes, the pull requests of the deploy and the run", async () => {
    const { user } = panel(staging({ lastRun: run() }));

    expect(screen.getByRole("heading", { name: "Deploy to Staging" })).toBeInTheDocument();
    const changes = screen.getByRole("region", { name: "Changes" });
    expect(changes).toHaveTextContent("3 commits · waiting for 2 days");
    const pulls = screen.getByRole("region", { name: "Pull requests" });
    await user.click(within(pulls).getByRole("button", { name: /#12 Fix login/ }));
    expect(api.openExternal).toHaveBeenCalledWith("https://github.com/dev/api/pull/12");
    expect(within(pulls).getByText("ana")).toBeInTheDocument();
    const runs = screen.getByRole("region", { name: "Deploy run" });
    expect(runs).toHaveTextContent("Succeeded");
    expect(runs).toHaveTextContent("3m 12s");
    await user.click(within(runs).getByRole("link", { name: "Deploy" }));
    expect(api.openExternal).toHaveBeenCalledWith(
      "https://github.com/dev/api/actions/workflows/deploy.yml",
    );
  });

  it("says when the reading is partial and when nothing waits", () => {
    const { unmount } = panel(
      staging({ promotion: promotion({ commits: 100, ahead: 240, partial: true }) }),
    );
    expect(
      screen.getByText("Showing the pull requests of the first 100 of 240 commits."),
    ).toBeInTheDocument();
    unmount();

    panel(
      staging({
        pending: false,
        available: "",
        promotion: promotion({ commits: 0, pullRequests: [] }),
      }),
    );
    expect(screen.getByText("Nothing to deploy.")).toBeInTheDocument();
    expect(screen.getByText("No pull requests in this deploy.")).toBeInTheDocument();
    expect(screen.getByText("No deploy run yet.")).toBeInTheDocument();
  });

  it("tells the deploy pull request, its draft badge and the other ones", () => {
    panel(
      staging({
        state: "pr_ready",
        prReady: true,
        available: "merge",
        promotion: promotion({ deployPr: deployPr({ draft: true }), otherDeployPrs: 2 }),
      }),
    );

    const section = screen.getByRole("region", { name: "Deploy pull request" });
    expect(section).toHaveTextContent("#88 Deploy to Staging");
    expect(within(section).getByText("Draft")).toBeInTheDocument();
    expect(section).toHaveTextContent("2 more deploy pull requests are open.");
    expect(
      screen.getByText("This pull request is a draft. GitHub may refuse to merge it."),
    ).toBeInTheDocument();
  });

  it("lists the destinations on GitHub", async () => {
    const { user } = panel(
      staging({ lastRun: run(), promotion: promotion({ deployPr: deployPr() }) }),
    );

    const github = screen.getByRole("region", { name: "On GitHub" });
    await user.click(within(github).getByRole("button", { name: "Compare staging...dev" }));
    expect(api.openExternal).toHaveBeenCalledWith(
      "https://github.com/dev/api/compare/staging...dev",
    );
    expect(
      within(github).getByRole("button", { name: "Open the deploy pull request" }),
    ).toBeInTheDocument();
    expect(within(github).getByRole("button", { name: "Open the run" })).toBeInTheDocument();
  });

  it("has Deploy to Staging as the primary action, and does it", async () => {
    const { user } = panel(staging());

    const button = screen.getByRole("button", { name: /Deploy to Staging/ });
    expect(button).toHaveTextContent("D");
    await user.click(button);

    expect(api.deploy).toHaveBeenCalledExactlyOnceWith("api", 1);
  });

  it("merges when the deploy pull request is ready", async () => {
    const { user } = panel(
      staging({
        prReady: true,
        available: "merge",
        promotion: promotion({ deployPr: deployPr() }),
      }),
    );

    await user.click(screen.getByRole("button", { name: /^Merge/ }));

    expect(api.merge).toHaveBeenCalledExactlyOnceWith("api", 1);
    expect(api.deploy).not.toHaveBeenCalled();
  });

  it("shows the refusal of the call under the action", async () => {
    vi.mocked(api.deploy).mockRejectedValueOnce(new Error("Already deploying"));
    const { user } = panel(staging());

    await user.click(screen.getByRole("button", { name: /Deploy to Staging/ }));

    expect(await screen.findByText("Already deploying")).toHaveClass("text-state-error");
  });

  it("is dashed, with the reason before it, when there is nothing to do", async () => {
    const { user } = panel(staging({ available: "", pending: false, state: "up_to_date" }));

    const button = screen.getByRole("button", { name: /Deploy to Staging/ });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Nothing to deploy to Staging.")).toBeInTheDocument();
    await user.click(button);
    expect(api.deploy).not.toHaveBeenCalled();
  });

  it.each([
    ["creating", "Creating the pull request…"],
    ["merging", "Merging…"],
  ])("shows %s as a loading primary", (phase, label) => {
    panel(
      staging({ busy: true, available: "", action: { kind: "deploy", phase, failure: "", pr: 0 } }),
    );

    const button = screen.getByRole("button", { name: label });
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("shows the failure of the action as an alert when it arrives while open", () => {
    const { rerender } = panel(staging());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    act(() => {
      rerender(
        <DeployPanel
          repo={makeDeployRepository({ id: "api", name: "api", fullName: "dev/api" })}
          env={staging({
            action: { kind: "merge", phase: "failed", failure: "Base branch was modified", pr: 88 },
          })}
          now={NOW}
          onClose={vi.fn()}
        />,
      );
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Base branch was modified");
  });

  it("warns about the environment before, in a line of its own", () => {
    panel(staging({ previous: "failed" }));

    expect(screen.getByText("Development's last deploy failed")).toBeInTheDocument();
  });

  it("shows the problem, with the way to the configuration", async () => {
    const { user } = panel(
      staging({ state: "problem", problem: "branch_missing", available: "", promotion: null }),
    );

    expect(screen.getByText("Branch staging doesn't exist on GitHub.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit the deploys in Settings…" }));

    expect(useAppStore.getState().location).toEqual({ kind: "settings", section: "boards" });
  });

  it("shows the failure of the reading of the repository", () => {
    panel(staging(), {
      failure: { reason: "failed", message: "rate limited", failedAt: ago(4 * MINUTE) },
    });

    expect(screen.getByText("Couldn't read api · 4m ago")).toBeInTheDocument();
    expect(screen.getByText(/rate limited/)).toBeInTheDocument();
  });

  it("has only the title, the run and GitHub for the first environment, with no action", () => {
    panel(makeDeployEnvironment({ lastRun: run() }));

    expect(screen.getByRole("complementary", { name: "api · Development" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Development" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Deploy to|Merge/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Changes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Pull requests" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Deploy run" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open the run" })).toBeInTheDocument();
  });
});
