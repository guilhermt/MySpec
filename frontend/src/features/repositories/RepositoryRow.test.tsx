import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RepositoryRow } from "@/features/repositories/RepositoryRow";
import { api, type Repository } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeBoard, makeRepository, makeState } from "@/test/wails-mock";

function row(overrides: Partial<Repository> = {}, state = {}, inNeedsAClone = false) {
  const repository = makeRepository(overrides);
  const onRemoved = vi.fn();
  const rendered = renderWithStore(
    <ul>
      <RepositoryRow repository={repository} inNeedsAClone={inNeedsAClone} onRemoved={onRemoved} />
    </ul>,
    { state: makeState({ repositories: [repository], ...state }) },
  );
  return { ...rendered, onRemoved };
}

const UNCLONED = { cloned: false, path: "" };

async function choose(user: ReturnType<typeof row>["user"], item: string | RegExp) {
  await user.click(screen.getByRole("button", { name: "More for dev/web" }));
  await user.click(await screen.findByRole("menuitem", { name: item }));
}

describe("RepositoryRow", () => {
  it("is named by the repository, its clone and what it holds", () => {
    row({ activeTasks: 4, archivedTasks: 7, activeReviews: 1 });

    expect(screen.getByRole("listitem")).toHaveAccessibleName(
      "dev/web, ~/projects/web, 4 active tasks, 7 archived tasks, 1 review",
    );
  });

  it("writes the clone in mono, with the counts and the review instructions", () => {
    row({ activeTasks: 4, archivedTasks: 7, reviewInstructions: "Look at the tests." });

    expect(screen.getByText("~/projects/web")).toHaveClass("font-mono");
    expect(screen.getByText(/· Review instructions set$/)).toBeInTheDocument();
    expect(screen.getAllByText("4 active · 7 archived")).toHaveLength(2);
  });

  it("names the board before the clone in the group that needs a clone", () => {
    row({ ...UNCLONED, boardId: "board-1" }, { boards: [makeBoard()] }, true);

    expect(screen.getByText("Roadmap · Not cloned")).toBeInTheDocument();
  });

  it("has no line under a clone that is there", () => {
    row();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clone" })).not.toBeInTheDocument();
  });

  it("offers Clone to a repository without a clone", async () => {
    const { user } = row(UNCLONED);

    expect(screen.getByText("Its cards can't start a task until it's cloned.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clone" }));

    expect(api.cloneRepository).toHaveBeenCalledWith("repo-1");
  });

  it("shows where the clone goes while it runs, and holds Clone", () => {
    row({ ...UNCLONED, name: "android", cloning: true }, { cloneFolder: "/home/dev/code" });

    expect(screen.getByText("Cloning into ~/code/android…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clone" })).not.toBeInTheDocument();
  });

  it("shows why the clone failed, with Try again, without alerting a page that opens with it", async () => {
    const { user } = row({ ...UNCLONED, cloneError: "gh: repository not found" });

    expect(screen.getByText("gh: repository not found")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(api.cloneRepository).toHaveBeenCalledWith("repo-1");
  });

  it("alerts the failure of a clone that ran while the page was open", () => {
    const repository = makeRepository({ ...UNCLONED, cloning: true });
    const state = makeState({ repositories: [repository] });
    const onRemoved = vi.fn();
    const { rerender } = renderWithStore(
      <ul>
        <RepositoryRow repository={repository} inNeedsAClone={false} onRemoved={onRemoved} />
      </ul>,
      { state },
    );
    const failed = { ...repository, cloning: false, cloneError: "gh: repository not found" };
    rerender(
      <ul>
        <RepositoryRow repository={failed} inNeedsAClone={false} onRemoved={onRemoved} />
      </ul>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("gh: repository not found");
  });

  it("offers Change path… to a clone that is gone", async () => {
    const { user } = row({ missing: true });

    expect(
      screen.getByText(
        "The clone is missing. Its tasks can't start a step or close until it has one.",
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Change path…" }));

    expect(api.changeRepositoryPath).toHaveBeenCalledWith("repo-1");
  });

  it("shows a refusal under the row, with the paths from home", async () => {
    vi.mocked(api.changeRepositoryPath).mockRejectedValueOnce(
      new Error("/home/dev/infra-old is a clone of acme/terraform, not of dev/web."),
    );
    const { user } = row();

    await choose(user, "Change path…");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "~/infra-old is a clone of acme/terraform, not of dev/web.",
    );
  });

  it("opens the review instructions under the row and gives the focus back to the ⋯", async () => {
    const { user } = row({ reviewInstructions: "Look at the tests." });

    await choose(user, /^Review instructions…/);
    const field = screen.getByRole("textbox", { name: "Review instructions" });
    expect(field).toHaveValue("Look at the tests.");
    expect(field).toHaveFocus();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("textbox", { name: "Review instructions" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More for dev/web" })).toHaveFocus();
  });

  it("saves the instructions and closes the block", async () => {
    const { user } = row();

    await choose(user, /^Review instructions…/);
    await user.type(screen.getByRole("textbox", { name: "Review instructions" }), "Be strict.");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(api.setReviewInstructions).toHaveBeenCalledWith("repo-1", "Be strict.");
    expect(screen.queryByRole("textbox", { name: "Review instructions" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More for dev/web" })).toHaveFocus();
  });

  it("removes the repository through the dialog, and tells the page", async () => {
    const { user, onRemoved } = row();

    await choose(user, "Remove…");
    const dialog = await screen.findByRole("alertdialog", { name: "Remove dev/web?" });
    await user.click(within(dialog).getByRole("button", { name: "Remove repository" }));

    expect(api.removeRepository).toHaveBeenCalledWith("repo-1");
    await vi.waitFor(() => expect(onRemoved).toHaveBeenCalledOnce());
  });
});
