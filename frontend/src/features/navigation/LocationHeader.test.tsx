import { act, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LocationHeader } from "@/features/navigation/LocationHeader";
import type { Location } from "@/lib/locations";
import { type AppStore, useAppStore, useLocation } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import {
  makeArchivedTask,
  makeBoard,
  makeRepository,
  makeReviewSummary,
  makeState,
  makeTask,
  makeTaskCard,
} from "@/test/wails-mock";

const BOARD: Location = { kind: "board", id: "board-1" };
const TASK: Location = { kind: "task", id: "task-1" };
const LOOSE: Location = { kind: "task", id: "task-2" };
const REVIEW: Location = { kind: "review", id: "review-1" };
const ARCHIVED: Location = { kind: "archived-task", id: "archived-1" };

const EPIC = {
  key: "dev/web#1",
  repository: "dev/web",
  number: 1,
  title: "API hardening",
  url: "https://github.com/dev/web/issues/1",
  state: "",
};

const app = makeState({
  boards: [makeBoard({ title: "Platform Roadmap" })],
  repositories: [
    makeRepository({ boardId: "board-1" }),
    makeRepository({ id: "repo-2", name: "cli", fullName: "dev/cli" }),
  ],
  tasks: [
    makeTask({ card: makeTaskCard({ epic: EPIC }) }),
    makeTask({ id: "task-2", name: "loose", repositoryId: "repo-2" }),
  ],
  reviews: [makeReviewSummary()],
  history: [makeArchivedTask({ id: "archived-1", name: "old-task" })],
});

// Place draws the header again with every place, as the screens of the shell do.
function Place() {
  const location = useLocation();
  return <LocationHeader key={JSON.stringify(location)} />;
}

function header(ui: Partial<Pick<AppStore, "location" | "back" | "forward" | "pendingFocus">>) {
  return renderWithStore(<Place />, { state: app, ui });
}

function breadcrumb() {
  return within(screen.getByRole("navigation", { name: "Breadcrumb" }));
}

describe("LocationHeader", () => {
  it("names the place on screen", () => {
    header({ location: TASK });

    expect(screen.getByRole("heading", { level: 1, name: "add-login" })).toBeInTheDocument();
  });

  it("draws the progress it is given after the title", () => {
    renderWithStore(<LocationHeader progress={<ol aria-label="Progress" />} />, {
      state: app,
      ui: { location: TASK },
    });

    expect(screen.getByRole("list", { name: "Progress" })).toBeInTheDocument();
  });

  it("goes back to the place behind, named in the tooltip with its key", async () => {
    const { user } = header({ location: TASK, back: [BOARD] });

    const back = screen.getByRole("button", { name: "Back to Platform Roadmap" });
    await user.hover(back);
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("Back to Platform Roadmap");
    expect(tooltip).toHaveTextContent("Alt+←");

    await user.click(back);
    expect(useAppStore.getState().location).toEqual(BOARD);
  });

  it("has Forward only with a place ahead", () => {
    header({ location: TASK, back: [BOARD] });
    expect(screen.queryByRole("button", { name: /^Forward/ })).not.toBeInTheDocument();
  });

  it("goes forward to the place ahead", async () => {
    const { user } = header({ location: BOARD, forward: [TASK] });

    await user.click(screen.getByRole("button", { name: "Forward to add-login" }));

    expect(useAppStore.getState().location).toEqual(TASK);
  });

  it("puts a task under its board, as a link, and its epic, as text", () => {
    header({ location: TASK });

    expect(breadcrumb().getByRole("button", { name: "Platform Roadmap" })).toBeInTheDocument();
    expect(breadcrumb().getByText("API hardening")).toBeInTheDocument();
    expect(breadcrumb().queryByRole("button", { name: "API hardening" })).toBeNull();
  });

  it("puts a task of a repository without a board under No board", () => {
    header({ location: LOOSE });

    expect(breadcrumb().getByText("No board")).toBeInTheDocument();
    expect(breadcrumb().queryByRole("button", { name: "No board" })).toBeNull();
  });

  it("puts a review under Reviews", async () => {
    const { user } = header({ location: REVIEW });

    await user.click(breadcrumb().getByRole("button", { name: "Reviews" }));

    expect(useAppStore.getState().location).toEqual({ kind: "reviews" });
  });

  it("puts an archived item under History", async () => {
    const { user } = header({ location: ARCHIVED });

    await user.click(breadcrumb().getByRole("button", { name: "History" }));

    expect(useAppStore.getState().location).toEqual({ kind: "history" });
  });

  it("takes the focus to the title after Alt+←", () => {
    header({ location: BOARD, back: [TASK] });

    act(() => useAppStore.getState().goBack({ focus: "title" }));

    expect(screen.getByRole("heading", { level: 1, name: "add-login" })).toHaveFocus();
    expect(useAppStore.getState().pendingFocus).toBeNull();
  });

  it("leaves the focus of a situation of a task to the task screen", () => {
    header({ location: TASK, pendingFocus: "request" });

    expect(screen.getByRole("heading", { level: 1, name: "add-login" })).not.toHaveFocus();
    expect(useAppStore.getState().pendingFocus).toBe("request");
  });

  it("takes the focus to the title after a level of the breadcrumb", async () => {
    const { user } = header({ location: ARCHIVED });

    await user.click(breadcrumb().getByRole("button", { name: "History" }));

    expect(screen.getByRole("heading", { level: 1, name: "History" })).toHaveFocus();
  });

  it("leaves the focus on Back after a click on it", async () => {
    const { user } = header({ location: TASK, back: [BOARD, REVIEW] });

    await user.click(screen.getByRole("button", { name: "Back to Add the login screen" }));

    expect(screen.getByRole("button", { name: "Back to Platform Roadmap" })).toHaveFocus();
  });

  it("leaves the focus on Forward after a click on it", async () => {
    const { user } = header({ location: BOARD, forward: [REVIEW, TASK] });

    await user.click(screen.getByRole("button", { name: "Forward to add-login" }));

    expect(screen.getByRole("button", { name: "Forward to Add the login screen" })).toHaveFocus();
  });

  it("leaves the focus on Back when nothing is left ahead", async () => {
    const { user } = header({ location: BOARD, forward: [TASK] });

    await user.click(screen.getByRole("button", { name: "Forward to add-login" }));

    expect(screen.getByRole("button", { name: "Back to Platform Roadmap" })).toHaveFocus();
  });
});
