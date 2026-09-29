import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { TaskView } from "@/features/task/TaskView";
import {
  CONVERSATION_ARTIFACTS,
  CONVERSATION_SCENES,
  type ConversationSceneName,
  conversationScene,
  fixConversationClock,
} from "@/test/conversation-scenes";
import {
  capture,
  conversationEdges,
  type Edges,
  edgesOf,
  innerEdgesOf,
  mainArea,
  setTheme,
  THEMES,
} from "@/test/painted";
import { renderWithStore } from "@/test/render";
import { TASK_ID } from "@/test/task-scenes";
import { api } from "@/test/wails-mock";

// Only the boundary is replaced, as in the jsdom suite: no call reaches the runtime of Wails. The
// mock is imported inside the factory, which runs before the imports of the file.
vi.mock("@/lib/wails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wails")>()),
  ...(await import("@/test/wails-mock")),
}));

/**
 * WIDTHS are the main areas the column is proved and captured at: a 1100px window, a 1250px one
 * (half a monitor), the mock, and a 2560px one.
 */
const WIDTHS = [812, 950, 1566, 2180];

/**
 * ODD_WIDTHS are main areas whose column has an odd margin to share: centred without rounding, the
 * column would stand on half a pixel.
 */
const ODD_WIDTHS = [1567, 2181];

/** FRAMES are the sunken blocks that hold blocks of their own: the open group and the body of a line. */
const FRAMES = '[data-slot="group-block"], [data-slot="marker-body"]';

/**
 * BLOCKS are the blocks inside an entry: the text of a speech, a code block, cut or not, a table, a
 * diagram, the open group and the body of a line. Outside a frame, each one has the edges of the
 * column; inside one, the edges of what the frame holds.
 */
const BLOCKS = [
  ".markdown",
  "[data-code-cut]",
  '[data-streamdown="code-block"]',
  '[data-streamdown="table-wrapper"]',
  '[data-streamdown="mermaid-block"]',
  FRAMES,
].join(", ");

/**
 * CASES are the scenes, each by the name of its captures, and the implementer's tab of the two where
 * the reviewer is on screen, as ?voice=impl draws them in the mock.
 */
const CASES: [string, ConversationSceneName, "impl" | undefined][] = [
  ...CONVERSATION_SCENES.map((name): [string, ConversationSceneName, undefined] => [
    name,
    name,
    undefined,
  ]),
  ["ask-impl", "ask", "impl"],
  ["error-impl", "error", "impl"],
];

/** CLOCK is a time of day as the conversation writes one: 9:14, 14:19. */
const CLOCK = /\b\d{1,2}:\d{2}\b/;

/**
 * UNTIMED are the entries whose name the material writes without a time (§4.2): the message in the
 * queue, not sent yet; the group that runs, named by what runs; and the pending card, named by its
 * keys.
 */
const UNTIMED = /^You, queued|, running: |^(Question|Permission), answer with/;

// awayFromTheEntries puts the pointer on the header, where no entry is under it.
async function awayFromTheEntries(): Promise<void> {
  await userEvent.hover(screen.getByRole("banner"));
}

// draw puts the task screen of a scene in a main area of a width.
function draw(name: ConversationSceneName, voice: "impl" | undefined, width: number) {
  const { state, transcripts, openStepTab } = conversationScene(
    name,
    voice === undefined ? {} : { voice },
  );
  const { container } = renderWithStore(
    <div style={{ ...mainArea(width), height: "900px", display: "flex" }}>
      <TaskView taskId={TASK_ID} />
    </div>,
    { state, ui: { location: { kind: "task", id: TASK_ID }, transcripts, openStepTab } },
  );
  const area = container.firstElementChild;
  const column = container.querySelector('[data-slot="conversation"]');
  if (!(area instanceof HTMLElement) || !(column instanceof HTMLElement)) {
    throw new Error("the conversation is not drawn");
  }
  return { area, column, feed: screen.getByRole("feed") };
}

// settle waits for what a click set off: the next frame, and the reads it started.
async function settle(): Promise<void> {
  await new Promise((done) => requestAnimationFrame(() => setTimeout(done, 20)));
}

// openAll opens every group, command, subagent, line and stretch, what opening one shows included.
async function openAll(feed: HTMLElement): Promise<void> {
  for (let round = 0; round < 12; round++) {
    const closed = feed.querySelectorAll<HTMLElement>('[data-feed-toggle][aria-expanded="false"]');
    if (closed.length === 0) {
      return;
    }
    for (const toggle of closed) {
      toggle.click();
    }
    await settle();
  }
  throw new Error("the conversation keeps showing more to open");
}

// columnPieces are what stands in the column: every entry, the bar, the composer and the tabs.
function columnPieces(area: HTMLElement, feed: HTMLElement): [string, HTMLElement][] {
  const pieces: [string, HTMLElement][] = [...feed.querySelectorAll<HTMLElement>("article")].map(
    (article) => [article.getAttribute("aria-label") ?? "an entry", article],
  );
  const others: [string, string][] = [
    ["the bar", 'section[aria-label="Request"]'],
    ["the composer", '[data-slot="composer"]'],
    ["the tabs", '[role="tablist"]'],
  ];
  for (const [name, selector] of others) {
    const piece = area.querySelector<HTMLElement>(selector);
    if (piece !== null) {
      pieces.push([name, piece]);
    }
  }
  return pieces;
}

// nameOf names a block by the entry it is in and what it is, for the message of a failure.
function nameOf(block: Element): string {
  const entry = block.closest("article")?.getAttribute("aria-label") ?? "an entry";
  const what =
    block.getAttribute("data-slot") ??
    block.getAttribute("data-streamdown") ??
    (block.hasAttribute("data-code-cut") ? "cut code" : "text");
  return `${what} in ${entry}`;
}

// blockEdges are the edges of every block inside the entries, each beside the edges it should have:
// the column's, or those of what the frame around it holds.
function blockEdges(feed: HTMLElement, column: Edges): [string, Edges, Edges][] {
  return [...feed.querySelectorAll(BLOCKS)].map((block) => {
    const frame = block.parentElement?.closest(FRAMES) ?? null;
    return [nameOf(block), edgesOf(block), frame === null ? column : innerEdgesOf(frame)];
  });
}

// outputEdges are the right edge of every output of a command and the right edge of the inside of
// the open group that holds it: the output is indented under its row and ends where the group does.
function outputEdges(feed: HTMLElement): [string, number, number][] {
  return [...feed.querySelectorAll("[data-output]")].map((output) => {
    const frame = output.closest(FRAMES);
    if (frame === null) {
      throw new Error(`${nameOf(output)} is outside an open group`);
    }
    return [nameOf(output), edgesOf(output).right, innerEdgesOf(frame).right];
  });
}

// shows tells whether an element and every one around it up to a root paints: a visually hidden
// one keeps a pixel at most, and a time waiting for the hover is transparent.
function shows(element: Element, root: Element): boolean {
  for (let current: Element | null = element; current !== null; current = current.parentElement) {
    const style = getComputedStyle(current);
    if (
      current.getBoundingClientRect().width <= 1 ||
      style.opacity === "0" ||
      style.visibility === "hidden"
    ) {
      return false;
    }
    if (current === root) {
      return true;
    }
  }
  return true;
}

// visibleClocks are the times of day the screen shows inside a root, outside code.
function visibleClocks(root: Element): string[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const clocks: string[] = [];
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const parent = node.parentElement;
    const match = CLOCK.exec(node.textContent ?? "");
    if (match !== null && parent !== null && parent.closest("pre, code") === null) {
      if (shows(parent, root)) {
        clocks.push(match[0]);
      }
    }
  }
  return clocks;
}

beforeEach(() => {
  api.readArtifact.mockImplementation((_, name) =>
    Promise.resolve(CONVERSATION_ARTIFACTS[name] ?? ""),
  );
});

describe.each(THEMES)("TaskView, the conversation scenes in the %s theme", (theme) => {
  describe.each(CASES)("the %s scene", (label, name, voice) => {
    // The scene is drawn at the moment of the mock, whatever the day the suite runs.
    fixConversationClock(name);

    it.each([...WIDTHS, ...ODD_WIDTHS])(
      "keeps every piece and every block in the column, on whole pixels, with no time in sight at %ipx",
      async (width) => {
        setTheme(theme);
        const { area, column, feed } = draw(name, voice, width);
        await awayFromTheEntries();
        await openAll(feed);

        // The column is min(960, area − 48) wide, centred on a whole pixel.
        const edges = conversationEdges(area);
        expect(Number.isInteger(edges.left) && Number.isInteger(edges.right)).toBe(true);
        expect(edgesOf(column)).toEqual(edges);
        for (const [piece, element] of columnPieces(area, feed)) {
          expect([piece, edgesOf(element)]).toEqual([piece, edges]);
        }
        for (const [block, got, want] of blockEdges(feed, edges)) {
          expect([block, got]).toEqual([block, want]);
        }
        for (const [output, right, want] of outputEdges(feed)) {
          expect([output, right]).toEqual([output, want]);
        }
        expect(visibleClocks(area)).toEqual([]);
        for (const article of feed.querySelectorAll("article")) {
          const label = article.getAttribute("aria-label") ?? "";
          if (!UNTIMED.test(label)) {
            expect(label).toMatch(CLOCK);
          }
        }
        // The diagram of the planning is drawn after the text, as the app draws it.
        if (name === "planning") {
          await expect
            .poll(() => feed.querySelector("svg[aria-roledescription]"), { timeout: 10_000 })
            .not.toBeNull();
        }
        if (WIDTHS.includes(width)) {
          await capture(`conversation-${label}-${width}-${theme}`, area);
        }
      },
    );
  });

  describe("the running scene", () => {
    fixConversationClock("running");

    it.each([
      ["a speech", /^Implementer, 13:52/, "13:52"],
      ["a line", /^MySpec → Implementer · Review 1/, "14:19"],
      ["a group", /^14 actions/, "13:48"],
    ])("shows the time of %s on hover", async (_, entry, time) => {
      setTheme(theme);
      draw("running", undefined, 1566);
      await awayFromTheEntries();
      const article = screen.getByRole("article", { name: entry });
      expect(visibleClocks(article)).toEqual([]);

      await userEvent.hover(article);
      expect(visibleClocks(article)).toContain(time);
    });
  });
});
