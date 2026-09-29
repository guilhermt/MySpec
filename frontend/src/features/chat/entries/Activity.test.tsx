import { act, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Activity } from "@/features/chat/entries/Activity";
import { IDLE_SESSION, type SessionState } from "@/features/chat/session";
import { renderWithStore } from "@/test/render";
import { makeAction, makeEntry } from "@/test/wails-mock";

const WORKING: SessionState = { ...IDLE_SESSION, turnRunning: true, processRunning: true };

afterEach(() => {
  vi.useRealTimers();
});

describe("Activity", () => {
  it("says the agent is thinking in the silence of a turn", () => {
    renderWithStore(<Activity session={WORKING} entries={[makeEntry("user")]} />);

    expect(screen.getByRole("status")).toHaveTextContent("Thinking…");
  });

  it("says the session is starting before its process is up", () => {
    renderWithStore(<Activity session={{ ...WORKING, processRunning: false }} entries={[]} />);

    expect(screen.getByRole("status")).toHaveTextContent("Starting session…");
  });

  it("stays quiet while an action runs, and between turns", () => {
    const running = makeEntry("action", { action: makeAction({ status: "running" }) });
    const { rerender } = renderWithStore(<Activity session={WORKING} entries={[running]} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    rerender(<Activity session={IDLE_SESSION} entries={[]} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it.each([
    ["rate_limit", "the rate limit was reached"],
    ["server", "the API failed"],
    ["connection", "the connection failed"],
    ["something", "the API refused the request"],
  ])("says why the API call is retried: %s", (reason, text) => {
    renderWithStore(
      <Activity session={{ ...WORKING, retryAttempt: 1, retryReason: reason }} entries={[]} />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(`Retrying · attempt 1 · ${text}`);
  });

  it("counts down to the next try, and says it retries now at zero", () => {
    vi.useFakeTimers({ now: new Date("2026-09-05T10:00:00Z") });
    const session = {
      ...WORKING,
      retryAttempt: 3,
      retryMax: 10,
      retryReason: "overloaded",
      retryAt: "2026-09-05T10:00:02Z",
    };
    renderWithStore(<Activity session={session} entries={[]} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Retrying · attempt 3 of 10 · the API is overloaded · next try in 2s",
    );
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole("status")).toHaveTextContent("next try in 1s");
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole("status")).toHaveTextContent("retrying now");
  });

  it("keeps the countdown out of what the status announces, so it speaks once per attempt", () => {
    vi.useFakeTimers({ now: new Date("2026-09-05T10:00:00Z") });
    const session = {
      ...WORKING,
      retryAttempt: 3,
      retryMax: 10,
      retryReason: "overloaded",
      retryAt: "2026-09-05T10:00:08Z",
    };
    renderWithStore(<Activity session={session} entries={[]} />);

    expect(screen.getByText(/next try in 8s/)).toHaveAttribute("aria-hidden", "true");
    expect(
      screen.getByText(/^Retrying · attempt 3 of 10 · the API is overloaded/),
    ).not.toHaveAttribute("aria-hidden");
  });

  it("says a fixed activity of the place", () => {
    renderWithStore(<Activity text="Starting step 5…" />);

    expect(screen.getByRole("status")).toHaveTextContent("Starting step 5…");
  });
});
