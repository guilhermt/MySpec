import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CloneFolderSection } from "@/features/repositories/CloneFolderSection";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeState } from "@/test/wails-mock";

describe("CloneFolderSection", () => {
  it("says the clone folder is not chosen yet", () => {
    renderWithStore(<CloneFolderSection />, { state: makeState() });

    expect(screen.getByRole("heading", { name: "Clone folder", level: 3 })).toBeInTheDocument();
    expect(
      screen.getByText("Where Clone puts a repository that isn't on this machine"),
    ).toBeInTheDocument();
    expect(screen.getByText("Not chosen · you're asked the first time you clone")).toBeVisible();
  });

  it("shows the folder new clones go to, from home", () => {
    renderWithStore(<CloneFolderSection />, {
      state: makeState({ cloneFolder: "/home/dev/clones" }),
    });

    expect(screen.getByText("~/clones")).toBeInTheDocument();
    expect(screen.queryByText(/Not chosen/)).not.toBeInTheDocument();
  });

  it("asks for another clone folder", async () => {
    const { user } = renderWithStore(<CloneFolderSection />, { state: makeState() });

    await user.click(screen.getByRole("button", { name: "Choose…" }));

    expect(api.chooseCloneFolder).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows under the line a folder that could not be chosen", async () => {
    vi.mocked(api.chooseCloneFolder).mockRejectedValueOnce(
      new Error("Couldn't use /home/dev/clones."),
    );
    const { user } = renderWithStore(<CloneFolderSection />, { state: makeState() });

    await user.click(screen.getByRole("button", { name: "Choose…" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't use ~/clones.");
  });
});
