import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RepositoryRow } from "@/features/repositories/RepositoryRow";
import { api, type Repository } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeRepository, makeState } from "@/test/wails-mock";

function row(overrides: Partial<Repository> = {}) {
  const repository = makeRepository(overrides);
  return renderWithStore(
    <ul>
      <RepositoryRow repository={repository} />
    </ul>,
    { state: makeState({ repositories: [repository] }) },
  );
}

const FIELD = "Review instructions for dev/web";

describe("RepositoryRow", () => {
  it("counts the reviews beside the tasks", () => {
    row({ activeTasks: 2, archivedTasks: 5, activeReviews: 1 });

    expect(screen.getByText("2 active tasks · 5 archived tasks · 1 review")).toBeInTheDocument();
  });

  it("keeps a repository with reviews, and says what to do about it", async () => {
    const { user } = row({ activeReviews: 1, archivedReviews: 2 });

    const remove = screen.getByRole("button", { name: "Remove" });
    expect(remove).toBeDisabled();

    await user.hover(remove);

    expect(
      await screen.findByText(
        "dev/web has 1 active review and 2 archived reviews. Delete them before removing the repository.",
      ),
    ).toBeInTheDocument();
  });

  it("says whether the repository has review instructions, folded away", () => {
    row({ reviewInstructions: "Never edit a published migration." });

    expect(screen.getByRole("button", { name: /Review instructions/ })).toHaveTextContent("Set");
    expect(screen.queryByRole("textbox", { name: FIELD })).not.toBeInTheDocument();
  });

  it("opens the instructions with what is saved and saves the change", async () => {
    const { user } = row();
    expect(screen.getByRole("button", { name: /Review instructions/ })).toHaveTextContent("None");

    await user.click(screen.getByRole("button", { name: /Review instructions/ }));
    const field = screen.getByRole("textbox", { name: FIELD });
    expect(field).toHaveValue("");
    expect(
      screen.getByText(
        "Added to every pull request review of this repository, including the reviews of task pull requests.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    await user.type(field, "Look at the migrations.");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(api.setReviewInstructions).toHaveBeenCalledWith("repo-1", "Look at the migrations.");
  });

  it("drops the change and folds the instructions away on Cancel", async () => {
    const { user } = row({ reviewInstructions: "Look at the migrations." });

    await user.click(screen.getByRole("button", { name: /Review instructions/ }));
    await user.type(screen.getByRole("textbox", { name: FIELD }), " And the tests.");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("textbox", { name: FIELD })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Review instructions/ }));
    expect(screen.getByRole("textbox", { name: FIELD })).toHaveValue("Look at the migrations.");
    expect(api.setReviewInstructions).not.toHaveBeenCalled();
  });

  it("shows why the instructions were refused and keeps what was typed", async () => {
    vi.mocked(api.setReviewInstructions).mockRejectedValueOnce(new Error("Couldn't save."));
    const { user } = row();

    await user.click(screen.getByRole("button", { name: /Review instructions/ }));
    await user.type(screen.getByRole("textbox", { name: FIELD }), "Look at the migrations.");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't save.");
    expect(screen.getByRole("textbox", { name: FIELD })).toHaveValue("Look at the migrations.");
  });
});
