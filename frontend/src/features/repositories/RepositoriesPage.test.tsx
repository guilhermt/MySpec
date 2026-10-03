import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RepositoriesPage } from "@/features/repositories/RepositoriesPage";
import { api } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeBoard, makeRepository, makeState } from "@/test/wails-mock";

function page(repositories = [makeRepository()], overrides = {}) {
  return renderWithStore(<RepositoriesPage />, {
    state: makeState({ repositories, ...overrides }),
  });
}

const UNCLONED = makeRepository({
  id: "repo-3",
  name: "infra",
  fullName: "dev/infra",
  cloned: false,
  path: "",
});

describe("RepositoriesPage", () => {
  it("has the title, its sentence and Add repository", () => {
    page();

    expect(screen.getByRole("heading", { name: "Repositories", level: 2 })).toBeInTheDocument();
    expect(
      screen.getByText("The repositories your tasks belong to, each tied to its local clone."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add repository" })).toBeInTheDocument();
  });

  it("groups the repositories: those that need a clone first, then a group per board, then No board", () => {
    page(
      [
        makeRepository({ boardId: "board-1" }),
        makeRepository({ id: "repo-2", name: "api", fullName: "dev/api" }),
        { ...UNCLONED, boardId: "board-1" },
      ],
      { boards: [makeBoard()] },
    );

    const titles = screen
      .getAllByRole("heading", { level: 4 })
      .map((heading) => heading.textContent);
    expect(titles).toEqual(["Needs a clone", "Roadmap", "No board"]);
    const needs = screen.getByRole("region", { name: "Needs a clone" });
    expect(
      within(needs).getByText("Their cards can't start a task until they have one"),
    ).toBeInTheDocument();
    expect(within(needs).getByRole("listitem")).toHaveAccessibleName(
      "dev/infra, not cloned, no tasks or reviews",
    );
    expect(
      within(screen.getByRole("region", { name: "No board" })).getAllByRole("listitem"),
    ).toHaveLength(1);
  });

  it("leaves out a group with nothing in it", () => {
    page();

    expect(
      screen.getAllByRole("heading", { level: 4 }).map((heading) => heading.textContent),
    ).toEqual(["No board"]);
  });

  it("opens the dialog that registers another repository", async () => {
    const { user } = page();

    await user.click(screen.getByRole("button", { name: "Add repository" }));

    expect(await screen.findByRole("dialog", { name: "Add repository" })).toBeInTheDocument();
    expect(api.scanRepositories).toHaveBeenCalledOnce();
  });

  it("ends with the clone folder", () => {
    page([makeRepository()], { cloneFolder: "/home/dev/clones" });

    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings.at(-1)).toHaveTextContent("Clone folder");
    expect(screen.getByText("~/clones")).toBeInTheDocument();
  });

  it("says there are no repositories, with the two ways out", async () => {
    const { user } = page([]);

    expect(screen.getByText("No repositories yet")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Add a clone from this machine, or add a board: the repositories of its issues come with it.",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Add repository" })).toHaveLength(2);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Go to Boards" }));

    const { location, pendingFocus } = useAppStore.getState();
    expect(location).toEqual({ kind: "settings", section: "boards" });
    expect(pendingFocus).toBe("nav");
  });

  it("takes the focus to the title once a repository is removed", async () => {
    const { user } = page();

    await user.click(screen.getByRole("button", { name: "More for dev/web" }));
    await user.click(await screen.findByRole("menuitem", { name: "Remove…" }));
    await user.click(await screen.findByRole("button", { name: "Remove repository" }));

    expect(api.removeRepository).toHaveBeenCalledWith("repo-1");
    await vi.waitFor(() =>
      expect(screen.getByRole("heading", { name: "Repositories", level: 2 })).toHaveFocus(),
    );
  });
});
