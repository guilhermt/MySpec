import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TaskHeader } from "@/features/task/TaskHeader";
import { TASK_NAME_MAX } from "@/lib/task-name";
import { mainArea, NARROW_MAIN, placeHeaderFits, setTheme, THEMES } from "@/test/painted";
import { renderWithStore } from "@/test/render";
import {
  makeBoard,
  makeRepository,
  makeSituation,
  makeState,
  makeTask,
  makeTaskCard,
} from "@/test/wails-mock";

/** LONGEST_NAME is a task name as long as a name can be, the longest title a task place has. */
const LONGEST_NAME = "rotate-the-api-keys-of-every-service-without-downtime-for-client";

const EPIC = {
  key: "dev/web#1",
  repository: "dev/web",
  number: 1,
  title: "API hardening",
  url: "https://github.com/dev/web/issues/1",
  state: "",
};

// header draws the header of a task with every piece its right side can hold,
// inside a main area of a fixed width, the container its queries measure.
function header(width: number) {
  const task = makeTask({
    name: LONGEST_NAME,
    sessionStatus: "working",
    contextPercent: 72,
    card: makeTaskCard({ epic: EPIC }),
    situations: [makeSituation(), makeSituation({ id: "s-2" })],
  });
  renderWithStore(
    <div style={mainArea(width)}>
      <TaskHeader task={task} artifactsOpen={false} onToggleArtifacts={() => undefined} />
    </div>,
    {
      state: makeState({
        boards: [makeBoard({ title: "Platform Roadmap" })],
        repositories: [makeRepository({ boardId: "board-1" })],
        tasks: [task],
      }),
      ui: { location: { kind: "task", id: task.id } },
    },
  );
  return screen.getByRole("banner");
}

// shown tells whether an element takes room on screen: a visually hidden one
// keeps a single pixel, a hidden one none.
function shown(element: Element): boolean {
  return element.getBoundingClientRect().width > 1;
}

// pieces finds what each rule of the header gives way.
function pieces() {
  const pause = screen.getByRole("button", { name: "Pause" });
  const review = screen.getByRole("button", { name: "Review: Manual" });
  const models = screen.getByRole("button", { name: "Models" });
  return {
    levels: screen.getByRole("list", { hidden: true }),
    ring: screen.getByText("72%").querySelector("svg") as Element,
    pause: within(pause).getByText("Pause"),
    review: within(review).getByText("Review: Manual"),
    models: within(models).getByText("Models"),
  };
}

describe("the longest name", () => {
  it("is as long as a task name can be", () => {
    expect(LONGEST_NAME).toHaveLength(TASK_NAME_MAX);
  });
});

describe.each(THEMES)("TaskHeader in the %s theme", (theme) => {
  it.each([
    [1660, true, true, true, true],
    [1659, false, true, true, true],
    [1360, false, true, true, true],
    [1359, false, true, false, true],
    [1300, false, true, false, true],
    [1299, false, false, false, true],
    [1040, false, false, false, true],
    [1039, false, false, false, false],
  ])(
    "at %ipx of main area shows the levels %s, the ring %s, the name of Pause %s and the text of Review and Models %s",
    (width, levels, ring, pause, menus) => {
      setTheme(theme);
      header(width);
      const found = pieces();
      expect({
        levels: shown(found.levels),
        ring: shown(found.ring),
        pause: shown(found.pause),
        review: shown(found.review),
        models: shown(found.models),
      }).toEqual({ levels, ring, pause, review: menus, models: menus });
    },
  );

  it("keeps everything on one line at 812px of main area, cutting only the title", () => {
    setTheme(theme);
    expect(placeHeaderFits(header(NARROW_MAIN))).toBe(true);
  });
});
