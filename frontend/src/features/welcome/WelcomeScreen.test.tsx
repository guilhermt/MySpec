import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WelcomeScreen } from "@/features/welcome/WelcomeScreen";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeState } from "@/test/wails-mock";

function welcome() {
  return renderWithStore(<WelcomeScreen />, { state: makeState({ repositories: [] }) });
}

describe("WelcomeScreen", () => {
  it("says what to do, and offers a board or a repository", () => {
    welcome();

    expect(screen.getByRole("heading", { name: "MySpec" })).toBeInTheDocument();
    expect(
      screen.getByText("Register a board or a repository to start creating tasks."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Add board/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Add repository/ })).toBeInTheDocument();
  });

  it("opens the dialog that registers a board", async () => {
    const { user } = welcome();

    await user.click(screen.getByRole("button", { name: /^Add board/ }));

    expect(await screen.findByRole("dialog", { name: "Add board" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Board URL" })).toBeInTheDocument();
  });

  it("opens the dialog that registers a repository", async () => {
    const { user } = welcome();

    await user.click(screen.getByRole("button", { name: /^Add repository/ }));

    expect(await screen.findByRole("dialog", { name: "Add repository" })).toBeInTheDocument();
    expect(api.scanRepositories).toHaveBeenCalledOnce();
  });
});
