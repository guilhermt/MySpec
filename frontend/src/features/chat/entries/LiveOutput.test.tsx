import { act, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LIVE_OUTPUT_MS, LiveOutput } from "@/features/chat/entries/LiveOutput";
import { renderWithStore } from "@/test/render";
import { api } from "@/test/wails-mock";

const lines = (count: number, from = 1) =>
  Array.from({ length: count }, (_, i) => `tick ${from + i}`).join("\n");

function renderLive() {
  return renderWithStore(<LiveOutput itemId="task-1" stage="step:3" taskId="b1x2" />);
}

// tick lets the clock run one interval and the readings that follow settle.
async function tick() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(LIVE_OUTPUT_MS);
  });
}

describe("LiveOutput", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads the output with a glow, then shows it", async () => {
    let resolve: (value: { text: string; lines: number; truncated: boolean }) => void = () => {};
    api.getTaskOutput.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    renderLive();

    expect(screen.getByText("Reading the output…")).toBeInTheDocument();
    expect(api.getTaskOutput).toHaveBeenCalledWith("task-1", "step:3", "b1x2");

    await act(async () => resolve({ text: lines(2), lines: 2, truncated: false }));
    expect(document.querySelector("pre")?.textContent).toBe(lines(2));
  });

  it("says there is no output yet", async () => {
    renderLive();

    expect(await screen.findByText("No output yet")).toBeInTheDocument();
  });

  it("reads it again every second, without a reading on top of another", async () => {
    api.getTaskOutput.mockImplementation(() =>
      Promise.resolve({ text: lines(2), lines: 2, truncated: false }),
    );
    renderLive();
    await screen.findByText(/tick 1/);
    expect(api.getTaskOutput).toHaveBeenCalledTimes(1);

    api.getTaskOutput.mockImplementation(() =>
      Promise.resolve({ text: lines(3), lines: 3, truncated: false }),
    );
    await tick();

    expect(api.getTaskOutput).toHaveBeenCalledTimes(2);
    expect(document.querySelector("pre")?.textContent).toBe(lines(3));
  });

  it("shows the last twelve lines of a long output and the whole one on request", async () => {
    api.getTaskOutput.mockResolvedValue({ text: lines(30), lines: 30, truncated: false });
    const { user } = renderLive();

    expect(await screen.findByText("18 more lines above")).toBeInTheDocument();
    expect(document.querySelector("pre")?.textContent).toBe(lines(12, 19));

    await user.click(screen.getByRole("button", { name: "Show all 30 lines" }));
    expect(document.querySelector("pre")?.textContent).toBe(lines(30));
    expect(screen.getByRole("button", { name: "Show less" })).toBeInTheDocument();
  });

  it("says only the end is shown while it runs", async () => {
    api.getTaskOutput.mockResolvedValue({ text: "tick 9", lines: 1, truncated: true });
    renderLive();

    expect(
      await screen.findByText("Only the last 8 KiB is shown while it runs"),
    ).toBeInTheDocument();
  });

  it("says the reading failed, and reads again on Try again", async () => {
    api.getTaskOutput.mockRejectedValueOnce(new Error("Claude Code did not answer."));
    api.getTaskOutput.mockResolvedValue({ text: "tick 1", lines: 1, truncated: false });
    const { user } = renderLive();

    expect(await screen.findByText("Couldn't read the output")).toBeInTheDocument();
    await tick();
    expect(api.getTaskOutput).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("tick 1")).toBeInTheDocument();
    expect(screen.queryByText("Couldn't read the output")).not.toBeInTheDocument();
  });
});
