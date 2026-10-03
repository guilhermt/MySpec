import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MigrationRefused } from "@/features/migration/MigrationRefused";
import { copyText } from "@/features/migration/migration-text";
import { renderWithStore } from "@/test/render";
import { makeMigration } from "@/test/wails-mock";

const MIGRATION = makeMigration({
  cases: [
    {
      kind: "no_origin",
      repository: "/home/dev/projects/notes",
      detail:
        "The origin remote of /home/dev/projects/notes is not on GitHub: git@gitlab.com:dev/notes.git.",
      tasks: [
        {
          name: "fix-header",
          workspace: "/home/dev/projects",
          path: "/home/dev/projects/notes",
        },
      ],
    },
    {
      kind: "root_task",
      repository: "",
      detail: "",
      tasks: [{ name: "add-login", workspace: "/home/dev/projects", path: "" }],
    },
  ],
});

function refused(migration = MIGRATION) {
  return renderWithStore(<MigrationRefused migration={migration} />);
}

describe("MigrationRefused", () => {
  it("says nothing was changed and lists every case with its tasks", () => {
    refused();

    expect(
      screen.getByRole("heading", { level: 1, name: "MySpec couldn't be updated" }),
    ).toBeInTheDocument();
    expect(screen.getByText("MySpec")).toBeInTheDocument();
    expect(
      screen.getByText(/nothing was changed: your tasks, documents and worktrees are as they were/),
    ).toBeInTheDocument();

    // The tasks at the root come first, whatever the order of the cases.
    const titles = screen.getAllByRole("heading", { level: 2 }).map((node) => node.textContent);
    expect(titles).toEqual([
      "Tasks at the root of a workspace",
      "Repositories without an origin on GitHub",
    ]);

    const origin = screen.getByRole("region", { name: "Repositories without an origin on GitHub" });
    expect(
      within(origin).getByText(
        "Add a GitHub origin to the repository, or delete its tasks, in the previous version of MySpec.",
      ),
    ).toBeInTheDocument();
    expect(within(origin).getByText("~/projects/notes")).toHaveClass("font-mono");
    expect(
      within(origin).getByText(
        "The origin remote of ~/projects/notes is not on GitHub: git@gitlab.com:dev/notes.git.",
      ),
    ).toBeInTheDocument();
    expect(within(origin).getByText("fix-header")).toBeInTheDocument();
    expect(within(origin).getByText("· ~/projects · ~/projects/notes")).toBeInTheDocument();

    const root = screen.getByRole("region", { name: "Tasks at the root of a workspace" });
    expect(within(root).getByText("add-login")).toBeInTheDocument();
    expect(
      screen.getByText("Once they're resolved, open this version again and the update runs again."),
    ).toBeInTheDocument();
  });

  it("has no sidebar", () => {
    refused();

    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("copies the list and says so", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    const { user } = refused();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    await user.click(screen.getByRole("button", { name: "Copy the list" }));

    expect(writeText).toHaveBeenCalledWith(copyText(MIGRATION));
    expect(await screen.findAllByText("Copied")).not.toHaveLength(0);
  });

  it("says the list can't be copied when the clipboard refuses", async () => {
    const writeText = vi.fn(() => Promise.reject(new Error("denied")));
    const { user } = refused();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    await user.click(screen.getByRole("button", { name: "Copy the list" }));

    expect(await screen.findByText("Can't copy · select the text")).toBeInTheDocument();
  });
});
