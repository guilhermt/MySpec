import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MigrationRefused } from "@/features/migration/MigrationRefused";
import { makeMigration } from "@/test/wails-mock";

describe("MigrationRefused", () => {
  it("says nothing was changed and lists every case with its tasks", () => {
    render(
      <MigrationRefused
        migration={makeMigration({
          cases: [
            {
              kind: "no_origin",
              repository: "/home/dev/projects/notes",
              detail: "The clone has no remote named origin.",
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
        })}
      />,
    );

    expect(screen.getByRole("heading", { name: "MySpec couldn't be updated" })).toBeInTheDocument();
    expect(
      screen.getByText(/nothing was changed: your tasks, documents and worktrees are as they were/),
    ).toBeInTheDocument();

    // The tasks at the root come first, whatever the order of the cases.
    const titles = screen.getAllByRole("heading", { level: 2 }).map((node) => node.textContent);
    expect(titles).toEqual([
      "Tasks at the root of a workspace",
      "Repositories without an origin on GitHub",
    ]);

    expect(
      screen.getByText("Close or delete these tasks in the previous version of MySpec."),
    ).toBeInTheDocument();
    expect(screen.getByText("The clone has no remote named origin.")).toBeInTheDocument();
    expect(screen.getByText("/home/dev/projects/notes")).toBeInTheDocument();
    expect(screen.getByText("add-login")).toBeInTheDocument();
    expect(screen.getByText("/home/dev/projects")).toBeInTheDocument();
    expect(screen.getByText("/home/dev/projects · /home/dev/projects/notes")).toBeInTheDocument();
    expect(
      screen.getByText("Once they're resolved, open this version again and the update runs again."),
    ).toBeInTheDocument();
  });
});
