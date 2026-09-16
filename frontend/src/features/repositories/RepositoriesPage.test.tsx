import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RepositoriesPage } from "@/features/repositories/RepositoriesPage";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeRepository, makeState } from "@/test/wails-mock";

function page(repositories = [makeRepository()]) {
  return renderWithStore(<RepositoriesPage />, { state: makeState({ repositories }) });
}

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
});
