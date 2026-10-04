import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArchivedTask } from "@/features/history/ArchivedTask";
import { olderKey } from "@/lib/history";
import { type ArchivedTask as ArchivedTaskItem, api } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  makeArchivedTask,
  makeCloseResult,
  makeRepository,
  makeState,
  makeTaskCard,
} from "@/test/wails-mock";

const STEP = {
  number: 1,
  file: "1-add-the-login-form.md",
  title: "Add the login form",
  reports: [],
  commitSha: "c19f02e8a4b7d0",
};

const DOCUMENTS: Record<string, string> = {
  "PRD.md": "# The PRD",
  "tech-spec.md": "# The spec",
  "steps/1-add-the-login-form.md": "---\ntitle: Add the login form\n---\n# Step one body",
  "step-reviews/1-review-1.md": "# Nothing to change",
  "pr/draft.md": "---\ntitle: Add idempotency keys\n---\n## Summary\nThe body",
  "pr/review-1.md": "# PR review",
  "one-shot.md": "# The one-shot document",
};

function readDocuments() {
  vi.mocked(api.readArtifact).mockImplementation((_, name) => {
    const text = DOCUMENTS[name];
    return text === undefined ? Promise.reject(new Error("no such file")) : Promise.resolve(text);
  });
}

const REPOSITORIES = [makeRepository({ id: "repo-1", path: "/home/dev/code/api" })];

function view(
  overrides: Partial<ArchivedTaskItem> = {},
  ui: Parameters<typeof renderWithStore>[1] = {},
) {
  const task = makeArchivedTask({ steps: [STEP], ...overrides });
  return {
    task,
    ...renderWithStore(<ArchivedTask taskId={task.id} />, {
      state: makeState({
        history: [task],
        repositories: REPOSITORIES,
      }),
      ...ui,
      ui: { location: { kind: "archived-task", id: task.id }, ...ui.ui },
    }),
  };
}

beforeEach(readDocuments);

describe("ArchivedTask", () => {
  it("names the task, says it is archived and opens its pull request on GitHub", async () => {
    const { user } = view();

    expect(screen.getByRole("heading", { level: 1, name: "add-login" })).toBeInTheDocument();
    expect(screen.getByText("Archived", { selector: "span" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "PR #12" }));

    expect(api.openExternal).toHaveBeenCalledWith("https://github.com/dev/web/pull/12");
  });

  it("puts the focus on the title on arrival", async () => {
    view({}, { ui: { pendingFocus: "title" } });

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1, name: "add-login" })).toHaveFocus(),
    );
  });

  it("says the facts, the card and the pull request as links", async () => {
    const { user } = view({ card: makeTaskCard({ repository: "dev/web", number: 40 }) });

    const facts = screen.getByText("Repository", { selector: "dt" }).closest("dl");
    expect(facts).toHaveTextContent("dev/web · card web#40 · In progress");
    expect(facts).toHaveTextContent("#12 merged into main");
    await user.click(within(facts as HTMLElement).getByRole("link", { name: "web#40" }));

    expect(api.openExternal).toHaveBeenCalledWith(makeTaskCard().url);
  });

  it("shows what the closing did, with the clone of the repository", () => {
    view({
      close: makeCloseResult({
        branchName: "add-login",
        branch: { outcome: "skipped", reason: "not_merged", detail: "" },
      }),
    });

    const closing = screen.getByRole("group", { name: "What the closing did" });
    expect(within(closing).getByText("Worktree removed")).toBeInTheDocument();
    expect(
      within(closing).getByText(
        "Delete it in ~/code/api with git branch -D add-login once you don't need it.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Archived", { selector: "dt" })).not.toBeInTheDocument();
  });

  it("says Archived in the facts of a task whose closing wasn't recorded", () => {
    view();

    expect(screen.queryByRole("group", { name: "What the closing did" })).not.toBeInTheDocument();
    expect(screen.getByText("Archived", { selector: "dt" })).toBeInTheDocument();
  });

  it("opens on the PRD and moves between the tabs with the arrows", async () => {
    const { user } = view();

    expect(await screen.findByTestId("markdown")).toHaveTextContent("# The PRD");
    expect(api.readArtifact).toHaveBeenCalledWith("task-1", "PRD.md");
    screen.getByRole("tab", { name: "PRD" }).focus();
    await user.keyboard("{ArrowRight}");

    expect(await screen.findByTestId("markdown")).toHaveTextContent("# The spec");
    expect(screen.getByRole("tab", { name: "Tech spec" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Tech spec" })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Steps · 1" })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "PRD" })).toHaveAttribute("aria-selected", "true");
  });

  it("says Nothing was written. where the task has no document", () => {
    view({ hasPrd: false });

    expect(screen.getByText("Nothing was written.")).toBeInTheDocument();
    expect(api.readArtifact).not.toHaveBeenCalled();
  });

  it("reads a failed document again with Try again", async () => {
    vi.mocked(api.readArtifact).mockRejectedValue(new Error("read failed"));
    const { user } = view();

    const strip = await screen.findByRole("alert");
    expect(strip).toHaveTextContent("Couldn't read PRD.md");
    expect(strip).toHaveTextContent("read failed");
    readDocuments();
    await user.click(within(strip).getByRole("button", { name: "Try again" }));

    expect(await screen.findByTestId("markdown")).toHaveTextContent("# The PRD");
  });

  it("lists the steps, each opening its file in place without the way to a panel", async () => {
    const { user } = view();
    await user.click(screen.getByRole("tab", { name: "Steps · 1" }));

    const step = screen.getByRole("button", { name: "1 Add the login form, c19f02e" });
    expect(step).toHaveAttribute("aria-expanded", "false");
    await user.click(step);

    const body = await screen.findByTestId("markdown");
    expect(body).toHaveTextContent("# Step one body");
    expect(body).not.toHaveTextContent("title: Add the login form");
    expect(api.readArtifact).toHaveBeenCalledWith("task-1", "steps/1-add-the-login-form.md");
    expect(screen.queryByRole("button", { name: "Open in Artifacts" })).not.toBeInTheDocument();
  });

  it("lists the reports of the review of a step under it", async () => {
    const { user } = view({
      steps: [
        {
          ...STEP,
          reports: [{ pass: 1, file: "1-review-1.md", clean: false, findings: 2 }],
        },
      ],
    });
    await user.click(screen.getByRole("tab", { name: "Steps · 1" }));

    await user.click(screen.getByRole("button", { name: "Review 1 · changes · 2 findings" }));

    expect(await screen.findByTestId("markdown")).toHaveTextContent("# Nothing to change");
    expect(api.readArtifact).toHaveBeenCalledWith("task-1", "step-reviews/1-review-1.md");
  });

  it("shows the draft of the pull request with its title, and its review", async () => {
    const { user } = view({
      hasPrDraft: true,
      prReports: [{ pass: 1, file: "review-1.md", clean: true, structured: true, findings: 0 }],
    });
    await user.click(screen.getByRole("tab", { name: "Pull request" }));

    expect(await screen.findByText("Pull request draft")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Add idempotency keys" })).toBeInTheDocument();
    expect(screen.getByTestId("markdown")).toHaveTextContent("The body");
    expect(api.readArtifact).toHaveBeenCalledWith("task-1", "pr/draft.md");
    expect(
      screen.getByRole("heading", { level: 2, name: "Review of the pull request" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Review 1 · clean" }));
    await waitFor(() => expect(screen.getAllByTestId("markdown")).toHaveLength(2));
    expect(screen.getAllByTestId("markdown")[1]).toHaveTextContent("# PR review");
    expect(api.readArtifact).toHaveBeenCalledWith("task-1", "pr/review-1.md");
  });

  it("says when no draft was kept and the pull request had no review", async () => {
    const { user } = view();
    await user.click(screen.getByRole("tab", { name: "Pull request" }));

    expect(screen.getByText("No pull request draft was kept.")).toBeInTheDocument();
    expect(screen.getByText("The pull request had no review pass.")).toBeInTheDocument();
  });

  it("gives a One-Shot task its document, the tag, and the Implementation section", async () => {
    const { user } = view({
      mode: "one_shot",
      hasOneShot: true,
      steps: [
        {
          number: 1,
          file: "one-shot.md",
          title: "Add the login form",
          reports: [{ pass: 1, file: "1-review-1.md", clean: true, findings: 0 }],
          commitSha: "c19f02e8a4b7d0",
        },
      ],
    });

    expect(screen.getByText("One-Shot", { selector: "span" })).toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "One-Shot document",
      "Pull request",
    ]);
    expect(await screen.findByTestId("markdown")).toHaveTextContent("# The one-shot document");
    expect(screen.getByRole("heading", { level: 2, name: "Implementation" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add the login form, c19f02e" }));
    expect(api.readArtifact).toHaveBeenCalledWith("task-1", "steps/one-shot.md");
    expect(screen.getByRole("button", { name: "Review 1 · clean" })).toBeInTheDocument();
  });

  it("shows the skeleton of a task that isn't there yet", () => {
    renderWithStore(<ArchivedTask taskId="task-9" />, {
      state: makeState(),
      ui: {
        location: { kind: "archived-task", id: "task-9" },
        archivedLookups: { "task-9": "loading" },
      },
    });

    expect(screen.getByRole("status", { name: "Reading the task" })).toBeInTheDocument();
  });
});

describe("ArchivedTask, Delete…", () => {
  async function openDialog(overrides: Partial<ArchivedTaskItem> = {}, ui = {}) {
    const rendered = view(overrides, { ui });
    await rendered.user.click(screen.getByRole("button", { name: "More actions" }));
    await rendered.user.click(await screen.findByRole("menuitem", { name: "Delete…" }));
    return rendered;
  }

  it("opens a confirmation on Cancel, the focus kept in the dialog, and gives the focus back to the ⋯", async () => {
    const { user } = await openDialog({ name: "Idempotency keys" });

    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByRole("heading", { name: "Delete “Idempotency keys”?" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "This removes the archived task and its documents from History. It can't be undone.",
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("Nothing changes on GitHub: PR #12 stays."),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus(),
    );
    await user.tab();
    await user.tab();
    await user.tab();
    await expect.poll(() => dialog.contains(document.activeElement)).toBe(true);

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "More actions" })).toHaveFocus());
    expect(api.deleteTask).not.toHaveBeenCalled();
  });

  it("keeps the refusal in the footer, the dialog open", async () => {
    vi.mocked(api.deleteTask).mockRejectedValueOnce(new Error("the database is locked"));
    const { user } = await openDialog();

    await user.click(await screen.findByRole("button", { name: "Delete task" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't delete it: the database is locked",
    );
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete task" })).toBeInTheDocument();
  });

  it("deletes the task and goes back to History with the focus on the row that took its place", async () => {
    const newer = makeArchivedTask({ id: "task-1", archivedAt: "2026-09-09T10:00:00Z" });
    const older = makeArchivedTask({
      id: "task-2",
      name: "fix-header",
      archivedAt: "2026-09-08T10:00:00Z",
    });
    const { user } = view(
      {},
      {
        state: makeState({ history: [], repositories: REPOSITORIES }),
        ui: {
          olderArchived: {
            tasks: { "task-1": newer, "task-2": older },
            reviews: {},
            discussions: {},
          },
          olderLists: {
            [olderKey("", "")]: {
              ids: ["task-1", "task-2"],
              next: null,
              matched: 2,
              status: "idle",
              error: "",
            },
          },
        },
      },
    );
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete…" }));

    await user.click(await screen.findByRole("button", { name: "Delete task" }));

    await waitFor(() => expect(useAppStore.getState().location).toEqual({ kind: "history" }));
    expect(api.deleteTask).toHaveBeenCalledWith("task-1");
    const state = useAppStore.getState();
    expect(state.historyFocus).toBe("task-2");
    expect(state.olderArchived.tasks).not.toHaveProperty("task-1");
    expect(state.olderLists[olderKey("", "")]?.ids).toEqual(["task-2"]);
  });

  it("asks for the focus on the search when the task was the only entry", async () => {
    const only = makeArchivedTask({ id: "task-1" });
    const { user } = view(
      {},
      {
        state: makeState({ history: [], repositories: REPOSITORIES }),
        ui: {
          olderArchived: { tasks: { "task-1": only }, reviews: {}, discussions: {} },
        },
      },
    );
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete…" }));

    await user.click(await screen.findByRole("button", { name: "Delete task" }));

    await waitFor(() => expect(useAppStore.getState().historyFocus).toBe("search"));
  });
});
