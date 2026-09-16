import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WelcomeScreen } from "@/features/welcome/WelcomeScreen";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeState } from "@/test/wails-mock";

function welcome() {
  return renderWithStore(<WelcomeScreen />, { state: makeState({ repositories: [] }) });
}

describe("WelcomeScreen", () => {
  it("says what to do, and offers the only action there is", () => {
    welcome();

    expect(screen.getByRole("heading", { name: "MySpec" })).toBeInTheDocument();
    expect(screen.getByText("Register a repository to start creating tasks.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Add repository/ })).toBeInTheDocument();
  });

  it("registers the repository of the folder that is chosen", async () => {
    const { user } = welcome();

    await user.click(screen.getByRole("button", { name: /^Add repository/ }));

    expect(api.addRepository).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a folder the app refuses, where the user is", async () => {
    vi.mocked(api.addRepository).mockRejectedValueOnce(
      new Error("/home/dev/notes is not the root of a git repository."),
    );
    const { user } = welcome();

    await user.click(screen.getByRole("button", { name: /^Add repository/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "/home/dev/notes is not the root of a git repository.",
    );
  });
});
