import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CloneFolderField } from "@/features/repositories/CloneFolderField";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeState } from "@/test/wails-mock";

describe("CloneFolderField", () => {
  it("says the clone folder is not chosen yet", () => {
    renderWithStore(<CloneFolderField />, { state: makeState() });

    expect(screen.getByText("Clone folder")).toBeInTheDocument();
    expect(screen.getByText("Not chosen")).toBeInTheDocument();
  });

  it("shows the folder new clones go to", () => {
    renderWithStore(<CloneFolderField />, {
      state: makeState({ cloneFolder: "/home/dev/clones" }),
    });

    expect(screen.getByText("/home/dev/clones")).toBeInTheDocument();
    expect(screen.queryByText("Not chosen")).not.toBeInTheDocument();
  });

  it("asks for another clone folder", async () => {
    const { user } = renderWithStore(<CloneFolderField />, { state: makeState() });

    await user.click(screen.getByRole("button", { name: "Choose…" }));

    expect(api.chooseCloneFolder).toHaveBeenCalledOnce();
  });
});
