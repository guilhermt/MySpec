import { act, createEvent, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WaitingSection } from "@/features/attention/WaitingSection";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeRepoPR, makeSituation, makeState, makeTask } from "@/test/wails-mock";

const API = "/home/dev/projects/api";
const WEB = "/home/dev/projects/web";
const NOW = Date.parse("2026-09-05T10:12:00Z");

/** EXIT_MS is how long an entry takes to leave. */
const EXIT_MS = 150;

// Listed out of order on purpose: the section sorts them.
const TASKS = [
  makeTask({
    id: "t-review",
    name: "refactor-db",
    stage: "implementation",
    situations: [
      makeSituation({
        id: "review",
        taskId: "t-review",
        kind: "step_review",
        form: "review",
        place: { kind: "step", stage: "", step: 3, repoPath: "", repository: "" },
        startedAt: "2026-09-05T10:09:00Z",
      }),
    ],
  }),
  makeTask({
    id: "t-draft",
    name: "add-login",
    stage: "pr",
    repos: [
      makeRepoPR({ repository: "web", repoPath: WEB }),
      makeRepoPR({ repository: "api", repoPath: API, status: "draft_ready" }),
    ],
    situations: [
      makeSituation({
        id: "draft",
        taskId: "t-draft",
        kind: "draft",
        place: { kind: "repo", stage: "", step: 0, repoPath: API, repository: "api" },
        startedAt: "2026-09-05T10:00:00Z",
      }),
    ],
  }),
  makeTask({
    id: "t-blocked",
    name: "fix-header",
    stage: "implementation",
    situations: [
      makeSituation({
        id: "blocked",
        taskId: "t-blocked",
        kind: "step_blocked",
        group: "error",
        place: { kind: "step", stage: "", step: 2, repoPath: "", repository: "" },
        startedAt: "2026-09-05T10:10:00Z",
      }),
    ],
  }),
];

function section(): HTMLElement {
  return screen.getByRole("region", { name: "Waiting for you" });
}

function entries(): HTMLElement[] {
  return within(screen.getByRole("list")).getAllByRole("button");
}

// The entry of a task, found by the name a screen reader starts it with.
function entryOf(task: string): HTMLElement {
  return screen.getByRole("button", { name: new RegExp(`^${task},`) });
}

// Every timer is faked only where time has to pass: user events wait on a real
// timer between steps, so those tests fake nothing but the clock.
function fakeTimers() {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("WaitingSection", () => {
  it("stays closed and out of reach while nothing waits for the user", () => {
    renderWithStore(<WaitingSection />, { state: makeState({ tasks: [makeTask()] }) });

    expect(screen.queryByRole("region", { name: "Waiting for you" })).not.toBeInTheDocument();
    // Hidden, the region has no name to be found by: its title is hidden too.
    const closed = screen.getByText("Waiting for you").closest("section");
    expect(closed).toHaveAttribute("aria-hidden", "true");
    expect(closed).toHaveAttribute("inert");
  });

  it("lists what waits for the user, most urgent first, in two lines with the time waited", () => {
    renderWithStore(<WaitingSection />, { state: makeState({ tasks: TASKS }) });

    expect(within(section()).getByText("3")).toBeInTheDocument();
    // The block comes first for being an error; the draft before the review for
    // having started earlier.
    const [first, second, third] = entries();
    expect(first).toBe(entryOf("fix-header"));
    expect(second).toBe(entryOf("add-login"));
    expect(third).toBe(entryOf("refactor-db"));

    expect(within(entryOf("fix-header")).getByText("2m")).toBeInTheDocument();
    expect(within(entryOf("fix-header")).getByText("Step 2 blocked")).toBeInTheDocument();
    expect(within(entryOf("add-login")).getByText("12m")).toBeInTheDocument();
    expect(within(entryOf("add-login")).getByText("Draft to approve · api")).toBeInTheDocument();
    expect(within(entryOf("refactor-db")).getByText("3m")).toBeInTheDocument();
    expect(within(entryOf("refactor-db")).getByText("Review step 3")).toBeInTheDocument();
  });

  it("names every entry with its task, situation, place and wait", () => {
    const reply = makeTask({
      id: "t-reply",
      name: "dark-mode",
      situations: [
        makeSituation({
          id: "reply",
          taskId: "t-reply",
          place: { kind: "stage", stage: "tech_spec", step: 0, repoPath: "", repository: "" },
          startedAt: "2026-09-05T10:11:30Z",
        }),
      ],
    });
    renderWithStore(<WaitingSection />, { state: makeState({ tasks: [...TASKS, reply] }) });

    expect(entryOf("add-login")).toHaveAccessibleName(
      "add-login, Draft to approve, api, waiting 12 minutes",
    );
    expect(entryOf("dark-mode")).toHaveAccessibleName(
      "dark-mode, Waiting for reply, tech spec, waiting just now",
    );
    // The label already says where: the place is not said twice.
    expect(entryOf("refactor-db")).toHaveAccessibleName(
      "refactor-db, Review step 3, waiting 3 minutes",
    );
  });

  it("leaves the open task out, and brings it back once the task is closed", () => {
    renderWithStore(<WaitingSection />, {
      state: makeState({ tasks: TASKS }),
      ui: { openTaskId: "t-draft" },
    });

    expect(entries()).toHaveLength(2);
    expect(within(section()).getByText("2")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^add-login,/ })).not.toBeInTheDocument();

    act(() => {
      useAppStore.getState().closeTask();
    });

    expect(entries()).toHaveLength(3);
    expect(entryOf("add-login")).toBeInTheDocument();
  });

  it("opens an entry where its situation is, on the tab of its repository, and puts the history away", async () => {
    const { user } = renderWithStore(<WaitingSection />, {
      state: makeState({ tasks: TASKS }),
      ui: { historyOpen: true },
    });
    // With the history on screen no task is open, so every situation is listed.
    expect(entries()).toHaveLength(3);

    await user.click(entryOf("add-login"));

    const store = useAppStore.getState();
    expect(store.openTaskId).toBe("t-draft");
    expect(store.openRepo["t-draft"]).toBe(API);
    expect(store.historyOpen).toBe(false);
  });

  it("moves the focus along the entries with the arrows, Home and End, without wrapping around", async () => {
    const { user } = renderWithStore(<WaitingSection />, { state: makeState({ tasks: TASKS }) });
    const [first, second, third] = entries();
    act(() => first?.focus());

    await user.keyboard("{ArrowDown}");
    expect(second).toHaveFocus();

    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(third).toHaveFocus();

    await user.keyboard("{Home}{ArrowUp}");
    expect(first).toHaveFocus();

    await user.keyboard("{End}{ArrowUp}");
    expect(second).toHaveFocus();
  });

  it("keeps the arrows from scrolling the list, and leaves Enter to the entry", async () => {
    const { user } = renderWithStore(<WaitingSection />, { state: makeState({ tasks: TASKS }) });
    const entry = entryOf("add-login");
    act(() => entry.focus());

    const arrow = createEvent.keyDown(entry, { key: "ArrowDown" });
    fireEvent(entry, arrow);
    expect(arrow.defaultPrevented).toBe(true);

    await user.keyboard("{Home}{Enter}");
    expect(useAppStore.getState().openTaskId).toBe("t-blocked");
  });

  it("takes an entry on its way out out of reach before it goes", () => {
    fakeTimers();
    renderWithStore(<WaitingSection />, { state: makeState({ tasks: TASKS }) });

    act(() => {
      useAppStore.getState().openTask("t-draft");
    });

    // Still on screen while it animates out, but neither there for a screen
    // reader nor a stop for the keyboard.
    expect(screen.getByText("Draft to approve · api").closest("li")).toHaveAttribute("inert");
    expect(screen.queryByRole("button", { name: /^add-login,/ })).not.toBeInTheDocument();
    const first = entryOf("fix-header");
    act(() => first.focus());
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(entryOf("refactor-db")).toHaveFocus();

    advance(EXIT_MS);

    expect(screen.queryByText("Draft to approve · api")).not.toBeInTheDocument();
  });

  it("closes as soon as nothing waits any more, still counting the last entry while it leaves", () => {
    fakeTimers();
    renderWithStore(<WaitingSection />, { state: makeState({ tasks: TASKS.slice(1, 2) }) });
    const title = screen.getByRole("heading", { name: "Waiting for you" });
    const count = title.nextElementSibling;
    expect(section()).toHaveAttribute("aria-hidden", "false");
    expect(count).toHaveTextContent("1");

    act(() => {
      useAppStore.getState().openTask("t-draft");
    });

    // Closed at once, while what the user saw collapses without reading 0.
    expect(screen.queryByRole("region", { name: "Waiting for you" })).not.toBeInTheDocument();
    expect(title.closest("section")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Draft to approve · api")).toBeInTheDocument();
    expect(count).toHaveTextContent("1");

    advance(EXIT_MS - 1);
    expect(count).toHaveTextContent("1");

    advance(1);
    expect(screen.queryByText("Draft to approve · api")).not.toBeInTheDocument();
    expect(title.closest("section")).toHaveAttribute("aria-hidden", "true");
  });

  it("reads the waiting times again every minute", () => {
    fakeTimers();
    renderWithStore(<WaitingSection />, { state: makeState({ tasks: TASKS }) });
    expect(within(entryOf("add-login")).getByText("12m")).toBeInTheDocument();

    advance(60_000 - 1);
    expect(within(entryOf("add-login")).getByText("12m")).toBeInTheDocument();

    advance(1);
    expect(within(entryOf("add-login")).getByText("13m")).toBeInTheDocument();
    expect(entryOf("add-login")).toHaveAccessibleName(
      "add-login, Draft to approve, api, waiting 13 minutes",
    );
  });
});
