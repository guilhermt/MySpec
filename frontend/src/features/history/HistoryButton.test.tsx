import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HistoryButton } from "@/features/history/HistoryButton";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeArchivedTask, makeState } from "@/test/wails-mock";

describe("HistoryButton", () => {
  it("counts the archived tasks", () => {
    renderWithStore(<HistoryButton />, {
      state: makeState({
        history: [makeArchivedTask(), makeArchivedTask({ id: "task-2", name: "fix-header" })],
      }),
    });

    const button = screen.getByRole("button", { name: /History/ });
    expect(button).toHaveTextContent("2");
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("counts nothing with an empty history", () => {
    renderWithStore(<HistoryButton />, { state: makeState() });

    expect(screen.getByRole("button", { name: "History" })).toBeInTheDocument();
  });

  it("opens the history and reads as pressed", async () => {
    const { user } = renderWithStore(<HistoryButton />, { state: makeState() });

    await user.click(screen.getByRole("button", { name: "History" }));

    expect(useAppStore.getState().historyOpen).toBe(true);
    expect(screen.getByRole("button", { name: "History" })).toHaveAttribute("aria-pressed", "true");
  });
});
