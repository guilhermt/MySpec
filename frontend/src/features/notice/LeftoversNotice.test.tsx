import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LeftoversNotice } from "@/features/notice/LeftoversNotice";
import type { Leftover } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeLeftover } from "@/test/wails-mock";

const PATH = "/home/dev/.local/share/myspec/worktrees/dev/web/add-login";
const LEFTOVER: Leftover = makeLeftover({
  worktree: { path: PATH, kept: true, error: "permission denied" },
  branch: { name: "add-login", kept: true, error: "branch is checked out" },
});

function notice(leftover: Leftover) {
  return renderWithStore(<LeftoversNotice />, { ui: { leftover } });
}

describe("LeftoversNotice", () => {
  it("names the path and the branch git could not remove", () => {
    notice(LEFTOVER);

    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent("Some files stayed on disk");
    expect(banner).toHaveTextContent("The task is gone, but git couldn't remove everything:");
    expect(screen.getByText(PATH)).toBeInTheDocument();
    expect(screen.getByText("add-login")).toBeInTheDocument();
    expect(screen.getByText("permission denied; branch is checked out")).toBeInTheDocument();
  });

  it("names only the part that stayed", () => {
    notice(
      makeLeftover({
        worktree: { path: PATH, kept: false, error: "" },
        branch: { name: "add-login", kept: true, error: "branch is checked out" },
      }),
    );

    expect(screen.queryByText(PATH)).not.toBeInTheDocument();
    expect(screen.getByText("add-login")).toBeInTheDocument();
    expect(screen.getByText("branch is checked out")).toBeInTheDocument();
  });

  it("dismisses into nothing", async () => {
    const { user } = notice(LEFTOVER);

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(useAppStore.getState().leftover).toBeNull();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("says nothing with nothing left behind", () => {
    const { container } = renderWithStore(<LeftoversNotice />);

    expect(container).toBeEmptyDOMElement();
  });
});
