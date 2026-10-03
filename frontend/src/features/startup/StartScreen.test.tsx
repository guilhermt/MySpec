import { act, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StartScreen } from "@/features/startup/StartScreen";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeStartup, makeStartupFailure, makeStartupStep } from "@/test/wails-mock";

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

function starting() {
  return makeStartup({
    phase: "starting",
    steps: [makeStartupStep({ state: "running", startedAt: new Date().toISOString() })],
  });
}

function failed(failure = makeStartupFailure()) {
  return makeStartup({ phase: "failed", steps: [makeStartupStep()], failure });
}

describe("StartScreen", () => {
  it("shows nothing in the main area before 400 ms, and the steps after", () => {
    // A clock that moves only when the test moves it, so 399 ms is 399 ms.
    vi.useRealTimers();
    vi.useFakeTimers();
    renderWithStore(<StartScreen />, { startup: starting() });

    act(() => {
      vi.advanceTimersByTime(399);
    });

    expect(screen.queryByRole("heading", { name: "Starting MySpec…" })).not.toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Loading your work" })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(screen.getByRole("heading", { name: "Starting MySpec…" })).toBeInTheDocument();
    expect(screen.getByText("Opening your data")).toBeInTheDocument();
  });

  it("shows the failure at once, with the focus on Try again", () => {
    renderWithStore(<StartScreen />, {
      startup: failed(makeStartupFailure({ case: "permission" })),
    });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("MySpec couldn't start");
    expect(alert).toHaveTextContent("Give your user back the folder ~/.local/share/myspec");
    expect(screen.getByText("open database: unable to open database file")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Try again/ })).toHaveFocus();
  });

  it("stands the sidebar still on the failure", () => {
    renderWithStore(<StartScreen />, { startup: failed() });

    expect(screen.queryByRole("status", { name: "Loading your work" })).not.toBeInTheDocument();
  });

  it("tries again on Enter with the focus on the button", async () => {
    const { user } = renderWithStore(<StartScreen />, { startup: failed() });

    await user.keyboard("{Enter}");

    expect(api.tryStartupAgain).toHaveBeenCalledTimes(1);
  });

  it("tries again on Enter with the focus on the body", async () => {
    const { user } = renderWithStore(<StartScreen />, { startup: failed() });
    screen.getByRole("main").focus();

    await user.keyboard("{Enter}");

    expect(api.tryStartupAgain).toHaveBeenCalledTimes(1);
  });

  it("leaves Enter on Copy to Copy", async () => {
    const { user } = renderWithStore(<StartScreen />, { startup: failed() });
    screen.getByRole("button", { name: "Copy the error" }).focus();

    await user.keyboard("{Enter}");

    expect(api.tryStartupAgain).not.toHaveBeenCalled();
  });

  it("does not try again on Enter while the start runs", async () => {
    const { user } = renderWithStore(<StartScreen />, { startup: starting() });
    screen.getByRole("main").focus();

    await user.keyboard("{Enter}");

    expect(api.tryStartupAgain).not.toHaveBeenCalled();
  });
});
