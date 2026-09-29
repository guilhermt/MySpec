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
import { capture, mainArea, setTheme, THEMES } from "@/test/painted";
import { renderWithStore } from "@/test/render";
import { TASK_ID } from "@/test/task-scenes";
import { api } from "@/test/wails-mock";

// Only the boundary is replaced, as in the jsdom suite: no call reaches the runtime of Wails. The
// mock is imported inside the factory, which runs before the imports of the file.
vi.mock("@/lib/wails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wails")>()),
  ...(await import("@/test/wails-mock")),
}));

/** WIDTHS are the main areas the column is proved at: a 1100px window, half a monitor, the mock, a wide one. */
const WIDTHS = [812, 950, 1566, 2180];

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
  const bar = area.querySelector<HTMLElement>('section[aria-label="Request"]');
  if (bar !== null) {
    pieces.push(["the bar", bar]);
  }
  // The box of the composer is the element in the column that holds its field.
  const composer = document
    .getElementById("composer-input")
    ?.closest<HTMLElement>('[class~="max-w-(--measure-conversation)"]');
  if (composer !== null && composer !== undefined) {
    pieces.push(["the composer", composer]);
  }
  const tabs = area.querySelector<HTMLElement>('[role="tablist"]');
  if (tabs !== null) {
    pieces.push(["the tabs", tabs]);
  }
  return pieces;
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

    it.each(WIDTHS)(
      "keeps every piece in the column, on whole pixels, with no time in sight at %ipx",
      async (width) => {
        setTheme(theme);
        const { area, column, feed } = draw(name, voice, width);
        await awayFromTheEntries();
        await openAll(feed);

        const edge = column.getBoundingClientRect();
        expect(Number.isInteger(edge.left) && Number.isInteger(edge.right)).toBe(true);
        for (const [piece, element] of columnPieces(area, feed)) {
          const box = element.getBoundingClientRect();
          expect([piece, box.left, box.right]).toEqual([piece, edge.left, edge.right]);
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
        await capture(`conversation-${label}-${width}-${theme}`, area);
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
