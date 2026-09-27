import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GoneView } from "@/features/navigation/GoneView";
import type { GoneLocation, Location } from "@/lib/locations";
import type { State } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  makeArchivedDiscussion,
  makeArchivedReview,
  makeArchivedTask,
  makeBoard,
  makeRepository,
  makeSituation,
  makeState,
  makeTask,
} from "@/test/wails-mock";

const WAITING = makeTask({
  id: "task-2",
  name: "fix-header",
  situations: [makeSituation({ taskId: "task-2" })],
});

function stateWith(overrides: Partial<State> = {}): State {
  return makeState({
    boards: [makeBoard({ title: "Platform Roadmap" })],
    repositories: [makeRepository({ boardId: "board-1" })],
    tasks: [WAITING],
    ...overrides,
  });
}

function gone(item: GoneLocation["item"], id: string, name: string, boardId = ""): GoneLocation {
  return { kind: "gone", item, id, name, boardId };
}

function page(location: GoneLocation, state: State, back: Location[] = []) {
  return renderWithStore(<GoneView location={location} />, {
    state,
    ui: { location, back },
  });
}

function buttons(): string[] {
  return screen.getAllByRole("button").map((button) => button.textContent ?? "");
}

function actions(): string[] {
  return buttons().filter((label) => label !== "");
}

describe("GoneView", () => {
  it("shows a task that was closed and archived", () => {
    page(
      gone("task", "task-1", "add-login", "board-1"),
      stateWith({ history: [makeArchivedTask({ id: "task-1" })] }),
    );

    expect(screen.getByText("add-login was closed and archived")).toBeInTheDocument();
    expect(actions()).toEqual([
      "Next that needs you",
      "Open in History",
      "Back to Platform Roadmap",
    ]);
    expect(screen.getByRole("button", { name: /Next that needs you/ })).toHaveFocus();
  });

  it("shows a task that was deleted, going back Home without a board", () => {
    page(gone("task", "task-1", "add-login"), stateWith());

    expect(screen.getByText("add-login was deleted")).toBeInTheDocument();
    expect(actions()).toEqual(["Next that needs you", "Back to Home"]);
  });

  it("shows a review that was merged", () => {
    page(
      gone("review", "review-1", "web#12"),
      stateWith({ reviewHistory: [makeArchivedReview({ id: "review-1", outcome: "merged" })] }),
    );

    expect(screen.getByText("web#12 was merged, and its review ended")).toBeInTheDocument();
    expect(actions()).toEqual(["Next that needs you", "Open in History", "Back to Reviews"]);
  });

  it("shows a review that was closed without a merge", () => {
    page(
      gone("review", "review-1", "web#12"),
      stateWith({ reviewHistory: [makeArchivedReview({ id: "review-1", outcome: "closed" })] }),
    );

    expect(screen.getByText("web#12 was closed without a merge")).toBeInTheDocument();
    expect(actions()).toEqual(["Next that needs you", "Open in History", "Back to Reviews"]);
  });

  it("shows a discussion that was archived, opening its board", () => {
    page(
      gone("discussion", "discussion-1", "Invoices", "board-1"),
      stateWith({ discussionHistory: [makeArchivedDiscussion({ id: "discussion-1" })] }),
    );

    expect(screen.getByText("Invoices was archived")).toBeInTheDocument();
    expect(actions()).toEqual(["Next that needs you", "Open in History", "Open Platform Roadmap"]);
  });

  it("shows a discussion that was deleted, going back Home once its board is gone", () => {
    page(gone("discussion", "discussion-1", "Invoices", "board-9"), stateWith());

    expect(screen.getByText("Invoices was deleted")).toBeInTheDocument();
    expect(actions()).toEqual(["Next that needs you", "Back to Home"]);
  });

  it("shows a board that was removed, going back to the place before it", async () => {
    const { user } = page(gone("board", "board-2", "Ops"), stateWith(), [{ kind: "reviews" }]);

    expect(screen.getByText("This board was removed.")).toBeInTheDocument();
    // The header has its own Back to Reviews, named without a text of its own.
    const back = screen.getByText("Back to Reviews", { selector: "button" });
    expect(back).toHaveFocus();

    await user.click(back);

    expect(useAppStore.getState().location).toEqual({ kind: "reviews" });
  });

  it("makes Open in History the primary when nothing else needs the user", () => {
    page(
      gone("task", "task-1", "add-login"),
      stateWith({ tasks: [], history: [makeArchivedTask({ id: "task-1" })] }),
    );

    expect(screen.getByRole("button", { name: /Next that needs you/ })).toHaveAccessibleDescription(
      "Nothing else needs you now.",
    );
    expect(screen.getByRole("button", { name: "Open in History" })).toHaveFocus();
  });

  it("opens the next item that needs the user", async () => {
    const { user } = page(gone("task", "task-1", "add-login"), stateWith());

    await user.click(screen.getByRole("button", { name: /Next that needs you/ }));

    expect(useAppStore.getState().location).toEqual({ kind: "task", id: WAITING.id });
  });

  it("opens the archived item in the History", async () => {
    const { user } = page(
      gone("task", "task-1", "add-login"),
      stateWith({ history: [makeArchivedTask({ id: "task-1" })] }),
    );

    await user.click(screen.getByRole("button", { name: "Open in History" }));

    expect(useAppStore.getState().location).toEqual({ kind: "archived-task", id: "task-1" });
  });
});
