import { screen, waitFor } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { api, type TaskSummary } from "@/lib/wails";
import { dashedDisabled, paintOf, resolve, setTheme, THEMES, token } from "@/test/painted";
import { renderWithStore } from "@/test/render";
import { makeStep, makeTask } from "@/test/wails-mock";
import { ReviewModePopover } from "./ReviewModePopover";

// The painted suite has no setup that replaces the boundary with Go; the popover saves through it.
vi.mock("@/lib/wails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wails")>()),
  ...(await import("@/test/wails-mock")),
}));

function Subject({ task }: { task: TaskSummary }) {
  const anchor = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button type="button" ref={anchor}>
        More actions
      </button>
      <ReviewModePopover task={task} open onOpenChange={() => {}} anchor={anchor} />
    </>
  );
}

const TASK = makeTask({
  reviewMode: "agent",
  steps: [makeStep({ number: 1, status: "not_started" })],
});

async function open(task: TaskSummary = TASK) {
  renderWithStore(<Subject task={task} />);
  await screen.findByRole("dialog", { name: "Review mode" });
}

const option = (name: RegExp) => screen.getByRole("radio", { name });

describe.each(THEMES)("ReviewModePopover in the %s theme", (theme) => {
  it("tints the chosen option with the brand ring, its check in the brand ink", async () => {
    setTheme(theme);
    await open();
    const chosen = option(/^Agent/);
    const want = {
      background: token("--brand-tint"),
      shadow: resolve("inset 0 0 0 var(--border) var(--brand-ring)", "box-shadow"),
    };
    expect(paintOf(chosen, want)).toEqual(want);
    const check = chosen.querySelectorAll("svg")[1];
    expect(check).toBeDefined();
    if (check !== undefined) {
      expect(paintOf(check, { color: "" })).toEqual({ color: token("--brand-ink") });
      expect(getComputedStyle(check).visibility).toBe("visible");
    }
  });

  it("leaves the other option without a check, veiled under the pointer", async () => {
    setTheme(theme);
    await open();
    const other = option(/^Manual/);
    const check = other.querySelectorAll("svg")[1];
    if (check !== undefined) expect(getComputedStyle(check).visibility).toBe("hidden");
    await userEvent.hover(other);
    expect(paintOf(other, { background: "" })).toEqual({ background: token("--veil-hover") });
  });

  it("dashes both options when the mode can't change, the chosen one untinted", async () => {
    setTheme(theme);
    await open(makeTask({ reviewMode: "agent", reviewModeEditable: false, steps: [] }));
    const want = dashedDisabled();
    expect(paintOf(option(/^Agent/), want)).toEqual(want);
    expect(paintOf(option(/^Manual/), want)).toEqual(want);
  });

  it("writes the note in the micro size and the third ink", async () => {
    setTheme(theme);
    await open();
    const note = screen.getByText("Applies to the steps not started that follow the task: 1.");
    const want = { color: token("--ink-3"), fontSize: resolve("var(--text-micro)", "font-size") };
    expect(paintOf(note, want)).toEqual(want);
  });

  it("writes a failure to save in the error ink, with Try again in the link ink", async () => {
    setTheme(theme);
    vi.mocked(api.setReviewMode).mockRejectedValueOnce(new Error("the step started"));
    await open();
    await userEvent.click(option(/^Manual/));
    const alert = await screen.findByRole("alert");
    await waitFor(() =>
      expect(paintOf(alert, { color: "" })).toEqual({ color: token("--state-error") }),
    );
    expect(paintOf(screen.getByRole("button", { name: "Try again" }), { color: "" })).toEqual({
      color: token("--brand-ink"),
    });
  });
});
