import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { ReviewInstructionsBlock } from "@/features/repositories/ReviewInstructionsBlock";
import { mainArea, resolve, setTheme, THEMES } from "@/test/painted";
import { renderWithStore } from "@/test/render";
import { makeRepository, makeState } from "@/test/wails-mock";

function block() {
  renderWithStore(
    <div style={mainArea(800)}>
      <ReviewInstructionsBlock repository={makeRepository()} onClose={() => {}} />
    </div>,
    { state: makeState() },
  );
}

const field = () => screen.getByRole("textbox", { name: "Review instructions" });

/** places is where Cancel and Save stand, from the right edge of the block. */
function places() {
  const cancel = screen.getByRole("button", { name: "Cancel" });
  const right = (
    cancel.closest("div[class*='bg-surface-0']") as HTMLElement
  ).getBoundingClientRect().right;
  return {
    cancel: right - cancel.getBoundingClientRect().right,
    save: right - screen.getByRole("button", { name: "Save" }).getBoundingClientRect().right,
  };
}

describe.each(THEMES)("ReviewInstructionsBlock in the %s theme", (theme) => {
  it("keeps Cancel and Save in place with the reason on the left and without it", async () => {
    setTheme(theme);
    block();
    const reason = screen.getByText("Nothing changed yet.");
    const before = places();

    expect(reason.getBoundingClientRect().right).toBeLessThan(
      screen.getByRole("button", { name: "Cancel" }).getBoundingClientRect().left,
    );
    expect(reason.getBoundingClientRect().left).toBe(field().getBoundingClientRect().left);
    await userEvent.type(field(), "Look at the tests.");
    expect(screen.queryByText("Nothing changed yet.")).toBeNull();
    expect(places()).toEqual(before);
  });

  it("holds five lines of its text at least", () => {
    setTheme(theme);
    block();

    const line = Number.parseFloat(resolve("var(--leading-meta)", "line-height"));
    const frame = Number.parseFloat(
      resolve("calc(var(--space-2) * 2 + var(--border) * 2)", "width"),
    );
    expect(field().getBoundingClientRect().height).toBe(5 * line + frame);
  });
});
