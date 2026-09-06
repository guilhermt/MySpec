import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WelcomeScreen } from "@/features/welcome/WelcomeScreen";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeState } from "@/test/wails-mock";

const WITHOUT_WORKSPACE = { workspace: null } as const;

describe("WelcomeScreen", () => {
  it("offers only the folder action when nothing was opened before", () => {
    renderWithStore(<WelcomeScreen />, {
      state: makeState({ ...WITHOUT_WORKSPACE, recents: [] }),
    });

    expect(screen.getByRole("button", { name: /^Open folder/ })).toBeInTheDocument();
    expect(screen.queryByText("Recent")).not.toBeInTheDocument();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("lists the name and the path of every recent workspace", () => {
    renderWithStore(<WelcomeScreen />, { state: makeState(WITHOUT_WORKSPACE) });

    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("labs")).toBeInTheDocument();
    expect(screen.getByText("~/labs")).toBeInTheDocument();
  });

  it("opens the recent workspace that is picked", async () => {
    const { user } = renderWithStore(<WelcomeScreen />, { state: makeState(WITHOUT_WORKSPACE) });

    await user.click(screen.getByRole("button", { name: "labs ~/labs" }));

    expect(api.openPath).toHaveBeenCalledWith("/home/dev/labs");
  });

  it("removes a recent workspace without opening it", async () => {
    const { user } = renderWithStore(<WelcomeScreen />, { state: makeState(WITHOUT_WORKSPACE) });

    await user.click(screen.getByRole("button", { name: "Remove labs from recent workspaces" }));

    expect(api.removeRecent).toHaveBeenCalledWith("/home/dev/labs");
    expect(api.openPath).not.toHaveBeenCalled();
  });

  it("opens the folder dialog from the primary action", async () => {
    const { user } = renderWithStore(<WelcomeScreen />, { state: makeState(WITHOUT_WORKSPACE) });

    await user.click(screen.getByRole("button", { name: /^Open folder/ }));

    expect(api.openFolderDialog).toHaveBeenCalledOnce();
  });

  it("explains a last workspace that is gone", async () => {
    const { user } = renderWithStore(<WelcomeScreen />, {
      state: makeState({
        ...WITHOUT_WORKSPACE,
        notice: { path: "/home/dev/labs", reason: "last_recent_missing" },
      }),
    });

    expect(screen.getByRole("status")).toHaveTextContent(
      "Your last workspace, /home/dev/labs, is no longer on disk.",
    );

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(api.dismissNotice).toHaveBeenCalledOnce();
  });
});
