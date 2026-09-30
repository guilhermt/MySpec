import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ItemPause, type PausableSession } from "@/components/ItemPause";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";

/** NOW is the clock the item is drawn at. */
const NOW = Date.now();

function pauseOf(
  session: Partial<PausableSession> | null,
  refusal: (session: PausableSession) => string | null = () => null,
) {
  return renderWithStore(
    <ItemPause
      id="review-1"
      item="the review"
      session={
        session === null
          ? null
          : { stage: "review", sessionStatus: "working", pausedAt: "", ...session }
      }
      refusal={refusal}
      now={NOW}
    />,
  );
}

// clock writes a time the way the button does for today: 14:52.
function clock(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

describe("ItemPause", () => {
  it("pauses the session of the item with no dialog, naming the item in its tooltip", async () => {
    const { user } = pauseOf({});
    const button = screen.getByRole("button", { name: "Pause" });

    expect(button).toHaveAccessibleDescription("Pause the review · the session that works stops");
    await user.click(button);

    expect(api.pause).toHaveBeenCalledWith("review-1", "review");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("says Pausing… with the spinner until the call comes back", async () => {
    let answer: () => void = () => {};
    vi.mocked(api.pause).mockReturnValueOnce(
      new Promise<void>((settle) => {
        answer = settle;
      }),
    );
    const { user } = pauseOf({});

    await user.click(screen.getByRole("button", { name: "Pause" }));

    expect(screen.getByRole("button", { name: "Pausing…" })).toHaveAttribute("aria-busy", "true");
    answer();
    expect(await screen.findByRole("button", { name: "Pause" })).not.toHaveAttribute("aria-busy");
  });

  it("resumes a paused session, saying since when", async () => {
    const at = new Date(NOW);
    const { user } = pauseOf({ sessionStatus: "paused", pausedAt: at.toISOString() });
    const button = screen.getByRole("button", { name: "Resume" });

    expect(button).toHaveAccessibleDescription(`Resume the review · paused since ${clock(at)}`);
    await user.click(button);

    expect(api.resume).toHaveBeenCalledWith("review-1", "review");
  });

  it("says only what it does when the time of the pause is unknown", () => {
    pauseOf({ sessionStatus: "paused" });

    expect(screen.getByRole("button", { name: "Resume" })).toHaveAccessibleDescription(
      "Resume the review",
    );
  });

  it("is disabled with the refusal as its tooltip when the session can't be paused", () => {
    const refusal = vi.fn(() => "Nothing is running to pause.");
    pauseOf({ sessionStatus: "error" }, refusal);

    const button = screen.getByRole("button", { name: "Pause" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription("Nothing is running to pause.");
    expect(refusal).toHaveBeenCalledWith(expect.objectContaining({ stage: "review" }));
  });

  it("doesn't ask for a refusal while paused: Resume always acts", () => {
    const refusal = vi.fn(() => "Nothing is running to pause.");
    pauseOf({ sessionStatus: "paused" }, refusal);

    expect(screen.getByRole("button", { name: "Resume" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(refusal).not.toHaveBeenCalled();
  });

  it("draws nothing without a session", () => {
    pauseOf(null);

    expect(screen.queryByRole("button", { name: /Pause|Resume/ })).not.toBeInTheDocument();
  });
});
