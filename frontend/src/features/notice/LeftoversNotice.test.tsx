import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LeftoversNotice } from "@/features/notice/LeftoversNotice";
import type { Leftover } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";

const LEFTOVER: Leftover = {
  repository: "web",
  repoPath: "/home/dev/projects/web",
  path: "/home/dev/.local/share/myspec/worktrees/add-login-web",
  branch: "add-login",
  error: "permission denied",
};

function notice(leftovers: Leftover[]) {
  return renderWithStore(<LeftoversNotice />, { ui: { leftovers } });
}

describe("LeftoversNotice", () => {
  it("names every path and branch git could not remove", () => {
    notice([LEFTOVER]);

    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent("Some files stayed on disk");
    expect(banner).toHaveTextContent("The task is gone, but git couldn't remove everything:");
    expect(screen.getByText("web")).toBeInTheDocument();
    expect(screen.getByText(LEFTOVER.path)).toBeInTheDocument();
    expect(screen.getByText("add-login")).toBeInTheDocument();
    expect(screen.getByText("permission denied")).toBeInTheDocument();
  });

  it("dismisses into nothing", async () => {
    const { user } = notice([LEFTOVER]);

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(useAppStore.getState().leftovers).toBeNull();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("says nothing with nothing left behind", () => {
    const { container } = renderWithStore(<LeftoversNotice />);

    expect(container).toBeEmptyDOMElement();
  });
});
