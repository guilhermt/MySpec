import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NodePanel } from "@/features/node-panel/NodePanel";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeState } from "@/test/wails-mock";

const REPO_NODE = { selectedNodeId: "repo:/home/dev/projects/web" } as const;

describe("NodePanel", () => {
  it("describes the workspace root", () => {
    renderWithStore(<NodePanel />, { state: makeState() });

    expect(screen.getByRole("heading", { name: "projects" })).toBeInTheDocument();
    expect(screen.getByText("/home/dev/projects")).toBeInTheDocument();
    expect(screen.getByText("Root")).toBeInTheDocument();
    expect(screen.getByText("No tasks in this workspace root")).toBeInTheDocument();
    expect(
      screen.getByText("Tasks created here will be the ones that touch more than one repository."),
    ).toBeInTheDocument();
  });

  it("describes the selected repository", () => {
    renderWithStore(<NodePanel />, { state: makeState(), ui: REPO_NODE });

    expect(screen.getByRole("heading", { name: "web" })).toBeInTheDocument();
    expect(screen.getByText("/home/dev/projects/web")).toBeInTheDocument();
    expect(screen.queryByText("Root")).not.toBeInTheDocument();
    expect(screen.getByText("No tasks in web")).toBeInTheDocument();
    expect(
      screen.getByText("Tasks created here will be the ones that touch only this repository."),
    ).toBeInTheDocument();
  });

  it("copies the full path of the node", async () => {
    const { user } = renderWithStore(<NodePanel />, { state: makeState(), ui: REPO_NODE });

    await user.click(screen.getByRole("button", { name: "Copy path" }));

    await expect(navigator.clipboard.readText()).resolves.toBe("/home/dev/projects/web");
  });

  it("carries the notice above the header", async () => {
    const { user } = renderWithStore(<NodePanel />, {
      state: makeState({ notice: { path: "/home/dev/gone", reason: "not_found" } }),
    });

    expect(screen.getByRole("status")).toHaveTextContent("/home/dev/gone doesn't exist.");

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(api.dismissNotice).toHaveBeenCalledOnce();
  });
});
