import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RepositoriesPage } from "@/features/repositories/RepositoriesPage";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeBoard, makeRepository, makeState } from "@/test/wails-mock";

function page(repositories = [makeRepository()], overrides = {}) {
  return renderWithStore(<RepositoriesPage />, {
    state: makeState({ repositories, ...overrides }),
  });
}

const UNCLONED = makeRepository({ cloned: false, path: "" });

describe("RepositoriesPage", () => {
  it("lists every repository with its clone and what it holds", () => {
    page([
      makeRepository({ activeTasks: 1, archivedTasks: 3 }),
      makeRepository({
        id: "repo-2",
        name: "api",
        fullName: "dev/api",
        path: "/home/dev/projects/api",
        missing: true,
      }),
    ]);

    expect(screen.getByRole("heading", { name: "Repositories" })).toBeInTheDocument();
    expect(
      screen.getByText("The repositories your tasks belong to, each tied to its local clone."),
    ).toBeInTheDocument();
    expect(screen.getByText("dev/web")).toBeInTheDocument();
    expect(screen.getByText("/home/dev/projects/web")).toBeInTheDocument();
    expect(screen.getByText("1 active task · 3 archived tasks")).toBeInTheDocument();
    expect(screen.getByText("0 active tasks · 0 archived tasks")).toBeInTheDocument();
    expect(screen.getByText("The clone at /home/dev/projects/api is missing.")).toBeInTheDocument();
  });

  it("opens the dialog that registers another repository", async () => {
    const { user } = page();

    await user.click(screen.getByRole("button", { name: /^Add repository/ }));

    expect(await screen.findByRole("dialog", { name: "Add repository" })).toBeInTheDocument();
    expect(api.scanRepositories).toHaveBeenCalledOnce();
  });

  it("points a repository at another clone", async () => {
    const { user } = page();

    await user.click(screen.getByRole("button", { name: "Change path" }));

    expect(api.changeRepositoryPath).toHaveBeenCalledWith("repo-1");
  });

  it("shows a clone the app refuses on the row that asked", async () => {
    vi.mocked(api.changeRepositoryPath).mockRejectedValueOnce(
      new Error("/home/dev/other is a clone of dev/other."),
    );
    const { user } = page();

    await user.click(screen.getByRole("button", { name: "Change path" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "/home/dev/other is a clone of dev/other.",
    );
  });

  it("keeps a repository with tasks, and says what to do about it", async () => {
    const { user } = page([makeRepository({ activeTasks: 2, archivedTasks: 1 })]);

    const remove = screen.getByRole("button", { name: "Remove" });
    expect(remove).toBeDisabled();

    await user.hover(remove);

    // The tooltip has no role of its own: the reason is written in it.
    expect(
      await screen.findByText(
        "dev/web has 2 active tasks and 1 archived task. Delete them before removing the repository.",
      ),
    ).toBeInTheDocument();
  });

  it("asks before removing a repository with nothing in it", async () => {
    const { user } = page();

    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(await screen.findByText("Remove dev/web?")).toBeInTheDocument();

    const dialog = screen.getByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Remove" }));

    expect(api.removeRepository).toHaveBeenCalledWith("repo-1");
  });

  it("shows the folder new clones go to above the list", () => {
    page([makeRepository()], { cloneFolder: "/home/dev/clones" });

    expect(screen.getByText("Clone folder")).toBeInTheDocument();
    expect(screen.getByText("/home/dev/clones")).toBeInTheDocument();
  });

  it("names the board that manages a repository", () => {
    page(
      [
        makeRepository({ boardId: "board-1" }),
        makeRepository({ id: "repo-2", name: "api", fullName: "dev/api" }),
      ],
      { boards: [makeBoard()] },
    );

    expect(screen.getAllByText(/^Board:/)).toHaveLength(1);
    expect(screen.getByText("Board: Roadmap")).toBeInTheDocument();
  });

  it("offers to clone a repository registered without a clone", async () => {
    const { user } = page([UNCLONED]);

    expect(screen.getByText("Not cloned")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change path" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clone" }));

    expect(api.cloneRepository).toHaveBeenCalledWith("repo-1");
  });

  it("offers no clone for a repository that has one", () => {
    page();

    expect(screen.queryByRole("button", { name: "Clone" })).not.toBeInTheDocument();
    expect(screen.queryByText("Not cloned")).not.toBeInTheDocument();
  });

  it("shows a clone that runs, and holds the button meanwhile", () => {
    page([{ ...UNCLONED, cloning: true }]);

    expect(screen.getByRole("status")).toHaveTextContent("Cloning…");
    expect(screen.getByRole("button", { name: "Clone" })).toBeDisabled();
  });

  it("shows why the last clone failed", () => {
    page([{ ...UNCLONED, cloneError: "gh: repository not found" }]);

    expect(screen.getByRole("alert")).toHaveTextContent("gh: repository not found");
  });

  it("shows a clone the app refuses to start on the row that asked", async () => {
    vi.mocked(api.cloneRepository).mockRejectedValueOnce(new Error("Choose a clone folder first."));
    const { user } = page([UNCLONED]);

    await user.click(screen.getByRole("button", { name: "Clone" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Choose a clone folder first.");
  });
});
