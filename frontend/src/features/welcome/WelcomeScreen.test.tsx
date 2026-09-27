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

  it("shows a failed action at the top of its column", () => {
    renderWithStore(<WelcomeScreen />, {
      state: makeState({ repositories: [] }),
      ui: { error: { label: "Couldn't change the theme", detail: "disk full. Try again." } },
    });

    const notice = screen.getByRole("alert");
    expect(notice).toHaveTextContent("Couldn't change the theme");
    expect(notice).toHaveTextContent("disk full. Try again.");
    expect(notice.parentElement?.firstElementChild).toBe(notice);
    expect(notice.nextElementSibling).toContainElement(
      screen.getByRole("heading", { name: "MySpec" }),
    );
  });
});
