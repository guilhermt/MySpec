import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TaskHeader } from "@/features/task/TaskHeader";
import { TASK_NAME_MAX } from "@/lib/task-name";
import { mainArea, NARROW_MAIN, placeHeaderFits, resolve, setTheme, THEMES } from "@/test/painted";
import { renderWithStore } from "@/test/render";
import { LONGEST_NAME, sceneTask, TASK_ID } from "@/test/task-scenes";

// header draws the header of the task in the loop of its step, with every piece the band can hold,
// inside a main area of a fixed width, the container its queries measure.
function header(width: number, longName = false) {
  const { state, openStepTab } = sceneTask("run", { longName });
  renderWithStore(
    <div style={mainArea(width)}>
      <TaskHeader task={state.tasks?.[0] ?? null} />
    </div>,
    { state, ui: { location: { kind: "task", id: TASK_ID }, openStepTab } },
  );
  return screen.getByRole("banner");
}

// shown tells whether an element takes room on screen: a visually hidden one keeps a single pixel,
// a hidden one none.
function shown(element: Element): boolean {
  return element.getBoundingClientRect().width > 1;
}

// pieces finds what each limit of the band gives way.
function pieces() {
  const stepper = screen.getByRole("list", { name: /^Progress/ });
  const pill = within(stepper).getByRole("listitem", { current: "step" });
  const dash = stepper.querySelector(":scope > li > span[aria-hidden='true']");
  const track = screen.getByRole("meter", { name: "Context" }).querySelector("[data-slot='track']");
  if (dash === null || track === null) {
    throw new Error("the band has no dash or no track");
  }
  return {
    levels: within(screen.getByRole("navigation", { name: "Breadcrumb" })).getByRole("list", {
      hidden: true,
    }),
    panelName: within(screen.getByRole("button", { name: "Artifacts" })).getByText("Artifacts"),
    pauseName: within(screen.getByRole("button", { name: "Pause" })).getByText("Pause"),
    track,
    dash,
    doneName: within(stepper).getByText("PRD"),
    qualifier: within(pill).getByText("· round 1"),
    word: within(pill).getByText("working"),
    upcomingName: within(stepper).getByText("Closing"),
  };
}

/** LIMITS are the main area widths from which each piece shows (design/tasks/03-task-header.md §4.2). */
const LIMITS = {
  levels: 1660,
  panelName: 1440,
  pauseName: 1360,
  track: 1300,
  dash: 1300,
  doneName: 1200,
  qualifier: 1040,
  word: 1040,
  upcomingName: 900,
} as const;

/** WIDTHS are every limit and the pixel under it. */
const WIDTHS = [...new Set(Object.values(LIMITS))].flatMap((limit) => [limit, limit - 1]);

// measures reads the spaces the limits change: between the stages, before the stepper, inside the
// pill, inside a folded stage and between the pieces on the right.
function measures(band: HTMLElement) {
  const stepper = screen.getByRole("list", { name: /^Progress/ });
  const pill = within(stepper).getByText("Implementation").parentElement;
  const folded = stepper.querySelector("[data-stage]");
  const right = band.lastElementChild;
  if (pill === null || folded === null || right === null) {
    throw new Error("the band misses a piece");
  }
  return {
    stages: getComputedStyle(stepper).columnGap,
    margin: getComputedStyle(stepper).marginLeft,
    pill: getComputedStyle(pill).paddingLeft,
    folded: getComputedStyle(folded).columnGap,
    right: getComputedStyle(right).columnGap,
  };
}

// space resolves a space token to what it computes to as a length.
function space(name: string): string {
  return resolve(`var(${name})`, "margin-left");
}

describe("the longest name", () => {
  it("is as long as a task name can be", () => {
    expect(LONGEST_NAME).toHaveLength(TASK_NAME_MAX);
  });
});

describe.each(THEMES)("TaskHeader in the %s theme", (theme) => {
  it.each(WIDTHS)("at %ipx of main area shows each piece from its limit on", (width) => {
    setTheme(theme);
    header(width);
    const found = pieces();

    const seen = Object.fromEntries(
      Object.entries(found).map(([name, element]) => [name, shown(element)]),
    );
    const want = Object.fromEntries(
      Object.entries(LIMITS).map(([name, limit]) => [name, width >= limit]),
    );
    expect(seen).toEqual(want);
  });

  it.each(WIDTHS)("at %ipx of main area spaces the pieces by their limits", (width) => {
    setTheme(theme);
    const band = header(width);

    expect(measures(band)).toEqual({
      stages: space(width >= 1300 ? "--space-1-5" : width >= 1200 ? "--space-2-5" : "--space-2"),
      margin: width >= 1040 ? space("--space-2") : "0px",
      pill: space(width >= 1040 ? "--space-3" : "--space-2-5"),
      folded: space(width >= 1040 ? "--space-1-5" : "--space-1"),
      right: space(width >= 900 ? "--space-2" : "--space-1"),
    });
  });

  it("keeps everything on one line at 812px of main area, cutting only the title", () => {
    setTheme(theme);
    expect(placeHeaderFits(header(NARROW_MAIN, true))).toBe(true);
  });
});
