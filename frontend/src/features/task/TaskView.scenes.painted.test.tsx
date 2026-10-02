import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { TaskView } from "@/features/task/TaskView";
import { sessionKey } from "@/lib/wails";
import { fromTranscript } from "@/store/transcript";
import {
  capture,
  conversationEdges,
  cutTexts,
  edgesOf,
  mainArea,
  offWholePixels,
  overlaps,
  placeHeaderOneLine,
  placeHeaderPieces,
  resolve,
  setTheme,
  settle,
  stepperText,
  THEMES,
  visiblePrimaries,
  withoutTooltip,
} from "@/test/painted";
import { renderWithStore } from "@/test/render";
import {
  type FixedCardName,
  fixedCardScene,
  fixSceneClock,
  SCENES,
  type Scene,
  type SceneName,
  sceneTask,
  TASK_ID,
} from "@/test/task-scenes";
import { makeTranscript } from "@/test/wails-mock";

// Only the boundary is replaced, as in the jsdom suite: no call reaches the runtime of Wails. The
// mock is imported inside the factory, which runs before the imports of the file.
vi.mock("@/lib/wails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wails")>()),
  ...(await import("@/test/wails-mock")),
}));

/** SCENE_MAIN is the main area the scenes are drawn in, the one of the mock. */
const SCENE_MAIN = 1566;

// The nine scenes of the mock (design/screens/task.md §11): what the stepper shows, and its glyph.
const STEPPERS: [SceneName, string, string][] = [
  ["plan", "PRD ○ Tech spec ○ Plan ○ Implementation ○ PR ○ PR review ○ Closing", "wait"],
  [
    "run",
    "✓ PRD ✓ Tech spec ✓ Plan Implementation 3/7 · round 1 working ○ PR ○ PR review ○ Closing",
    "work",
  ],
  [
    "ask",
    "✓ PRD ✓ Tech spec ✓ Plan Implementation 3/7 · pass 2 ○ PR ○ PR review ○ Closing",
    "wait",
  ],
  [
    "error",
    "✓ PRD ✓ Tech spec ✓ Plan Implementation 3/7 · pass 2 ○ PR ○ PR review ○ Closing",
    "error",
  ],
  [
    "manual",
    "✓ PRD ✓ Tech spec ✓ Plan Implementation 4/7 · Manual ○ PR ○ PR review ○ Closing",
    "wait",
  ],
  ["blocked", "✓ PRD ✓ Tech spec ✓ Plan Implementation 5/7 ○ PR ○ PR review ○ Closing", "error"],
  [
    "checks",
    "✓ PRD ✓ Tech spec ✓ Plan ✓ Implementation ✓ PR PR review checks 3/5 ○ Closing",
    "github",
  ],
  ["findings", "✓ PRD ✓ Tech spec ✓ Plan ✓ Implementation ✓ PR PR review pass 1 ○ Closing", "wait"],
  [
    "findings-apply",
    "✓ PRD ✓ Tech spec ✓ Plan ✓ Implementation ✓ PR PR review pass 1 ○ Closing",
    "wait",
  ],
  [
    "findings-discarded",
    "✓ PRD ✓ Tech spec ✓ Plan ✓ Implementation ✓ PR ✓ PR review Closing",
    "close",
  ],
  [
    "findings-edit",
    "✓ PRD ✓ Tech spec ✓ Plan ✓ Implementation ✓ PR PR review pass 1 ○ Closing",
    "wait",
  ],
  [
    "findings-revised",
    "✓ PRD ✓ Tech spec ✓ Plan ✓ Implementation ✓ PR PR review pass 1 ○ Closing",
    "wait",
  ],
  [
    "findings-sent",
    "✓ PRD ✓ Tech spec ✓ Plan ✓ Implementation ✓ PR PR review pass 1 working ○ Closing",
    "work",
  ],
  [
    "findings-text",
    "✓ PRD ✓ Tech spec ✓ Plan ✓ Implementation ✓ PR PR review pass 1 ○ Closing",
    "wait",
  ],
  [
    "findings-unreadable",
    "✓ PRD ✓ Tech spec ✓ Plan ✓ Implementation ✓ PR PR review pass 2 ○ Closing",
    "wait",
  ],
  ["close", "✓ PRD ✓ Tech spec ✓ Plan ✓ Implementation ✓ PR ✓ PR review Closing", "close"],
];

/** HALF_MAIN is the main area of a 1250px window, the narrowest the column is proved at. */
const HALF_MAIN = 950;

/** WIDE_MAIN is the main area of a 2560px window. */
const WIDE_MAIN = 2180;

/**
 * COLUMN_WIDTHS are the main areas the fixed cards and the empty place are proved at: a 1250px
 * window, one whose column has an odd margin to share, and a 2560px window.
 */
const COLUMN_WIDTHS = [HALF_MAIN, 1567, WIDE_MAIN];

/**
 * PLACES are the moments whose conversation ends in a fixed card or that have no conversation, and
 * the ones of the findings, whose card stands in the conversation: the
 * changed files of the Manual step, the step blocked with its error block, the empty place with the
 * live checks, the merge line of the close, the draft of the pull request and the live checks at
 * the end of the review.
 */
const PLACES: [string, () => Scene][] = [
  ...SCENES.filter((name) => name.startsWith("findings")).map((name): [string, () => Scene] => [
    name,
    () => sceneTask(name),
  ]),
  ["manual", () => sceneTask("manual")],
  ["blocked", () => sceneTask("blocked")],
  ["checks", () => sceneTask("checks")],
  ["close", () => sceneTask("close")],
  ...(["draft", "checks-after-a-pass"] as const).map(
    (name: FixedCardName): [string, () => Scene] => [name, () => fixedCardScene(name)],
  ),
];

/** FINDING_SCENES are the scenes of the findings of the review of the pull request. */
const FINDING_SCENES = SCENES.filter((name) => name.startsWith("findings"));

/** CARDS are the scenes whose conversation holds the card of the findings. */
const CARDS: SceneName[] = [
  "findings",
  "findings-apply",
  "findings-discarded",
  "findings-edit",
  "findings-revised",
];

/** PRIMARY is the primary each scene of the findings draws (PRD §13), none where Send is not written. */
const PRIMARY: Record<string, string[]> = {
  findings: ["Apply approved"],
  "findings-apply": ["Apply approved"],
  "findings-discarded": [],
  "findings-edit": ["Apply approved"],
  "findings-revised": ["Apply approved"],
  "findings-sent": [],
  "findings-text": [],
  "findings-unreadable": [],
};

// nameOf is what names an element in a failure: its label, else the start of its text.
const nameOf = (element: Element) =>
  element.getAttribute("aria-label") ?? element.textContent?.trim().slice(0, 48) ?? "";

// px is a length token in pixels.
const px = (name: `--${string}`) => parseFloat(resolve(`var(${name})`, "width"));

// scene draws the task screen at a moment of the reference task, in the main area of the mock.
function scene(
  name: SceneName,
  { width = SCENE_MAIN, earlier = null }: { width?: number; earlier?: string | null } = {},
) {
  return drawScene(sceneTask(name), { width, earlier });
}

// drawScene draws the task screen of a scene in a main area of a width.
function drawScene(
  { state, transcripts, openStepTab }: Scene,
  { width = SCENE_MAIN, earlier = null }: { width?: number; earlier?: string | null } = {},
) {
  const { container } = renderWithStore(
    <div style={{ ...mainArea(width), height: "800px", display: "flex" }}>
      <TaskView taskId={TASK_ID} />
    </div>,
    {
      state,
      ui: {
        location: { kind: "task", id: TASK_ID },
        transcripts:
          earlier === null
            ? transcripts
            : {
                ...transcripts,
                [sessionKey(TASK_ID, earlier)]: fromTranscript(
                  makeTranscript({ taskId: TASK_ID, stage: earlier }),
                ),
              },
        openStepTab,
        earlierConversation:
          earlier === null ? null : { taskId: TASK_ID, stage: earlier, from: "panel" },
      },
    },
  );
  const area = container.firstElementChild;
  if (!(area instanceof HTMLElement)) {
    throw new Error("the main area is not drawn");
  }
  return { area, band: screen.getByRole("banner") };
}

/** SCENE_WIDTHS are the main areas every scene of the findings is proved at: a 1250px window, the mock's and a 2560px window. */
const SCENE_WIDTHS = [HALF_MAIN, SCENE_MAIN, WIDE_MAIN];

/**
 * prepare puts the scene where the mock holds it: the focus on finding 2 in the findings scene, and
 * its inline editor open in findings-edit. Every other scene is as it is drawn.
 */
async function prepare(name: SceneName): Promise<void> {
  if (name !== "findings" && name !== "findings-edit") {
    return;
  }
  const second = await screen.findByRole("group", { name: /^Finding 2 of / });
  if (name === "findings") {
    second.focus();
    return;
  }
  await userEvent.click(within(second).getByRole("button", { name: /^Edit/ }));
  await screen.findByRole("textbox", { name: "Text of finding 2" });
}

// barAndComposer are the bar of the request and the box of the composer, the ones the scene has.
function barAndComposer(): HTMLElement[] {
  const bar = document.querySelector<HTMLElement>('section[aria-label="Request"]');
  const composer = document.querySelector<HTMLElement>('[data-slot="composer"]');
  return [bar, composer].filter((piece) => piece !== null);
}

/**
 * captureTogether saves one screenshot of pieces that stand one over the other: whatever else their
 * common container holds leaves the flow first, and the container takes only their height. The
 * screen is drawn again for the next test, so nothing is put back.
 */
async function captureTogether(name: string, pieces: readonly HTMLElement[]): Promise<void> {
  let common = pieces[0]?.parentElement ?? null;
  while (common !== null && !pieces.every((piece) => common?.contains(piece))) {
    common = common.parentElement;
  }
  if (common === null) {
    throw new Error("the pieces share no container");
  }
  for (const child of common.children) {
    if (child instanceof HTMLElement && !pieces.some((piece) => child.contains(piece))) {
      child.style.display = "none";
    }
  }
  common.style.flex = "none";
  await capture(name, common);
}

// The scenes are drawn at the moment of the mock, whatever the day the suite runs.
fixSceneClock();

describe.each(THEMES)("TaskView, the nine scenes in the %s theme", (theme) => {
  it.each(STEPPERS)("draws the %s scene", async (name, text, glyph) => {
    setTheme(theme);
    const { area, band } = scene(name);
    await prepare(name);

    expect(placeHeaderOneLine(band)).toBe(true);
    expect(overlaps(placeHeaderPieces(band))).toBe(false);
    const stepper = within(band).getByRole("list", { name: /^Progress/ });
    expect(stepperText(stepper)).toBe(text);
    const pill = within(stepper).getByRole("listitem", { current: "step" });
    expect(pill.querySelector("[data-state]")).toHaveAttribute("data-state", glyph);
    await capture(`scene-${name}-${theme}`, area);
  });

  it.each(
    STEPPERS.flatMap(([name]) => [HALF_MAIN, WIDE_MAIN].map((width) => [name, width] as const)),
  )("captures the %s scene at the main area of %ipx", async (name, width) => {
    setTheme(theme);
    const { area } = scene(name, { width });
    await prepare(name);
    await capture(`scene-${name}-${width}-${theme}`, area);
  });

  describe.each(PLACES)("the place of the %s moment", (_, sceneOf) => {
    it.each(COLUMN_WIDTHS)(
      "keeps every card, the empty place and what it waits for in the column at %ipx",
      (width) => {
        setTheme(theme);
        const { area } = drawScene(sceneOf(), { width });

        const edges = conversationEdges(area);
        const column = area.querySelector('[data-slot="conversation"]');
        if (column === null) {
          throw new Error("the conversation column is not drawn");
        }
        expect(edgesOf(column)).toEqual(edges);
        const pieces = [
          ...column.querySelectorAll("article"),
          ...column.querySelectorAll(
            '[data-slot="place-empty"], [data-slot="place-empty"] > * > *',
          ),
          ...area.querySelectorAll('section[aria-label="Request"], [data-slot="composer"]'),
        ];
        expect(pieces.length).toBeGreaterThan(0);
        for (const piece of pieces) {
          const name = piece.getAttribute("aria-label") ?? piece.textContent?.slice(0, 40) ?? "";
          // A paragraph of the empty place is read at --measure-read, from the left edge.
          const want =
            piece.tagName === "P" && piece.closest('[data-slot="place-empty"]') !== null
              ? { left: edges.left, right: edgesOf(piece).right }
              : edges;
          expect([name, edgesOf(piece)]).toEqual([name, want]);
        }
      },
    );
  });

  it.each(STEPPERS.map(([name]) => name))(
    "captures the bar and the composer of the %s scene",
    async (name) => {
      setTheme(theme);
      scene(name);
      await prepare(name);

      // Waiting for its checks, the pull request asks nothing and has no conversation to write in.
      const pieces = barAndComposer();
      expect(pieces.length === 0).toBe(name === "checks");
      if (pieces.length > 0) {
        await captureTogether(`bar-${name}-${theme}`, pieces);
      }
    },
  );

  describe.each(FINDING_SCENES)("the findings of the %s scene", (name) => {
    it.each(COLUMN_WIDTHS)(
      "keeps the card and every finding on whole pixels in the column at %ipx",
      async (width) => {
        setTheme(theme);
        const { area } = drawScene(sceneTask(name), { width });
        await prepare(name);
        await settle();

        const edges = conversationEdges(area);
        const card = screen.queryByRole("group", { name: /^Findings of pass/ });
        expect(card === null).toBe(!CARDS.includes(name));
        if (card !== null) {
          const findings = [...card.querySelectorAll("[data-finding]")];
          expect(findings.length).toBeGreaterThan(0);
          expect(edgesOf(card)).toEqual(edges);
          // Each finding stands inside the card, in the padding of its column.
          for (const finding of findings) {
            const inner = edgesOf(finding);
            expect([nameOf(finding), inner.left > edges.left, inner.right < edges.right]).toEqual([
              nameOf(finding),
              true,
              true,
            ]);
          }
          expect(offWholePixels([card, ...findings])).toEqual([]);
        }
      },
    );

    it.each(SCENE_WIDTHS)("gives every cut text a tooltip at %ipx", async (width) => {
      setTheme(theme);
      const { area } = scene(name, { width });
      await prepare(name);
      await settle();
      expect(await withoutTooltip(cutTexts(area))).toEqual([]);
    });

    it.each(SCENE_WIDTHS)(
      "draws one primary at most, the one of the table, at %ipx",
      async (width) => {
        setTheme(theme);
        scene(name, { width });
        await prepare(name);
        await settle();
        const primaries = visiblePrimaries().map(nameOf);
        expect(primaries).toEqual(PRIMARY[name]);
      },
    );
  });

  it("opens the editor of a finding five lines high", async () => {
    setTheme(theme);
    scene("findings-edit");
    await prepare("findings-edit");
    await settle();

    const field = screen.getByRole("textbox", { name: "Text of finding 2" });
    const style = getComputedStyle(field);
    const lines =
      (field.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)) /
      parseFloat(style.lineHeight);
    expect(lines).toBeGreaterThanOrEqual(5);
  });

  it("draws the bar of the close scene inside the main area", () => {
    setTheme(theme);
    const { area } = scene("close");

    const bar = screen.getByRole("region", { name: "Request" });
    const inner = bar.getBoundingClientRect();
    const outer = area.getBoundingClientRect();
    expect(inner.height).toBeGreaterThan(0);
    expect(inner.left).toBeGreaterThanOrEqual(outer.left);
    expect(inner.right).toBeLessThanOrEqual(outer.right);
    expect(inner.bottom).toBeLessThanOrEqual(outer.bottom);
  });

  // The column is the main area less --space-6 on each side, for the tabs, the bar and the foot.
  it("keeps the bar in the column of the tabs at the main area of a 1250px window", () => {
    setTheme(theme);
    const { area } = scene("manual", { width: HALF_MAIN });

    const bar = screen.getByRole("region", { name: "Request" }).getBoundingClientRect();
    const outer = area.getBoundingClientRect();
    expect(bar.left - outer.left).toBe(px("--space-6"));
    expect(outer.right - bar.right).toBe(px("--space-6"));
  });

  it("keeps the strip of an earlier conversation in the column at the main area of a 1250px window", () => {
    setTheme(theme);
    const { area } = scene("close", { width: HALF_MAIN, earlier: "prd" });

    const back = screen.getByRole("button", { name: /^Back to/ });
    const strip = back.closest("p")?.parentElement ?? back.parentElement;
    if (!(strip instanceof HTMLElement)) {
      throw new Error("the strip is not drawn");
    }
    const box = strip.getBoundingClientRect();
    const outer = area.getBoundingClientRect();
    expect(box.left - outer.left).toBe(px("--space-6"));
    expect(outer.right - box.right).toBe(px("--space-6"));
  });

  it("keeps every item of the ⋯ of the run scene on one line", async () => {
    setTheme(theme);
    scene("run", { width: HALF_MAIN });

    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    const menu = await screen.findByRole("menu");
    const items = within(menu).getAllByRole("menuitem");
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      // offsetHeight is the height of the layout, before the scale the menu opens with.
      expect(item.offsetHeight).toBe(px("--size-control"));
    }
    for (const label of menu.querySelectorAll('[data-slot="dropdown-menu-label"]')) {
      if (!(label instanceof HTMLElement)) {
        throw new Error("a legend of the menu is not an element");
      }
      const style = getComputedStyle(label);
      expect(label.offsetHeight).toBe(
        parseFloat(style.lineHeight) +
          parseFloat(style.paddingTop) +
          parseFloat(style.paddingBottom),
      );
    }
  });
});
