import { screen, waitFor, within } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { api } from "@/lib/wails";
import { NONE, paintOf, resolve, setTheme, THEMES, token } from "@/test/painted";
import { renderWithStore } from "@/test/render";
import { makeState, makeTask } from "@/test/wails-mock";
import { ModelsPopover } from "./ModelsPopover";

// The painted suite has no setup that replaces the boundary with Go; the popover saves through it.
vi.mock("@/lib/wails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wails")>()),
  ...(await import("@/test/wails-mock")),
}));

function Subject() {
  const anchor = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button type="button" ref={anchor}>
        More actions
      </button>
      <ModelsPopover task={makeTask()} open onOpenChange={() => {}} anchor={anchor} />
    </>
  );
}

// open draws the popover of a Structured task in the PRD: the PRD started, every other stage editable.
async function open() {
  renderWithStore(<Subject />, { state: makeState() });
  return screen.findByRole("dialog", { name: "Models" });
}

describe.each(THEMES)("ModelsPopover in the %s theme", (theme) => {
  it("writes the choice of a started stage in the second ink, · started in the third", async () => {
    setTheme(theme);
    const popover = await open();
    const started = within(popover).getByText("· started", { exact: false });
    const choice = started.parentElement;
    expect(choice).not.toBeNull();
    if (choice !== null) {
      expect(paintOf(choice, { color: "" })).toEqual({ color: token("--ink-2") });
    }
    expect(paintOf(started, { color: "" })).toEqual({ color: token("--ink-3") });
  });

  it("separates the rows with the quiet line, none above the first", async () => {
    setTheme(theme);
    const popover = await open();
    const [first, second] = within(popover).getAllByRole("listitem");
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (first !== undefined && second !== undefined) {
      expect(paintOf(first, { shadow: "" })).toEqual({ shadow: NONE });
      const want = { shadow: resolve("inset 0 var(--border) 0 var(--line-1)", "box-shadow") };
      expect(paintOf(second, want)).toEqual(want);
    }
  });

  it("writes the note in the micro size and the third ink", async () => {
    setTheme(theme);
    await open();
    const note = screen.getByText(/^A stage takes its model when it starts\./);
    const want = { color: token("--ink-3"), fontSize: resolve("var(--text-micro)", "font-size") };
    expect(paintOf(note, want)).toEqual(want);
  });

  it("writes a failure under the row in the error ink, with Try again in the link ink", async () => {
    setTheme(theme);
    vi.mocked(api.setStageModel).mockRejectedValueOnce(new Error("The stage has started"));
    await open();
    await userEvent.click(screen.getByRole("button", { name: /^Plan model:/ }));
    await userEvent.click(await screen.findByRole("menuitemradio", { name: "Sonnet 5" }));
    const alert = await screen.findByRole("alert");
    await waitFor(() =>
      expect(paintOf(alert, { color: "" })).toEqual({ color: token("--state-error") }),
    );
    expect(
      paintOf(within(alert).getByRole("button", { name: "Try again" }), { color: "" }),
    ).toEqual({ color: token("--brand-ink") });
  });
});
