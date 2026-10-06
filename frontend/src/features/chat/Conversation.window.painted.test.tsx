import { act, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  measuredConversation,
  OPEN_STRETCHES,
  SESSION,
  STAGE,
  TASK_ID,
} from "@/dev/measure-conversation";
import { Conversation } from "@/features/chat/Conversation";
import { roundLineOf } from "@/features/chat/discussion-markers";
import { MarkerLine } from "@/features/chat/entries/MarkerLine";
import { type Entry, sessionKey } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { fromTranscript } from "@/store/transcript";
import { mainArea, settle } from "@/test/painted";
import { renderWithStore } from "@/test/render";
import { makeEntry, makeState, makeTask } from "@/test/wails-mock";

// Only the boundary is replaced, as in the jsdom suite: no call reaches the runtime of Wails.
vi.mock("@/lib/wails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wails")>()),
  ...(await import("@/test/wails-mock")),
}));

/**
 * The conversation of 1,500 entries with every stretch open, in the area of a 1450px window with
 * the sidebar closed (1134px wide, 1080px tall): where it opens, what keeps the reader in place,
 * what stays mounted far from the window and how the articles are numbered.
 */
const MAIN_WIDTH = 1134;
const MAIN_HEIGHT = 1080;
// The places of the entries that are put in the conversation, far from its end.
const MARKER_AT = 200;
const QUESTION_AT = 320;
// The question asked last, the one pending that the conversation holds: the earlier one is stale.
const LATE_QUESTION_AT = 900;

const QUESTION_ID = "entry-question";
const MARKER_ID = "entry-marker";

// speechAt is the index of the first speech from a place on.
function speechAt(all: readonly Entry[], from: number): number {
  return all.findIndex((entry, at) => at >= from && entry.kind === "assistant");
}

// entries are the measured conversation with a pending question and a marker in its middle, each
// in the place of a speech, so that no stretch gets long enough to fold.
function entries(): Entry[] {
  const all = measuredConversation(OPEN_STRETCHES);
  const questionAt = speechAt(all, QUESTION_AT);
  const markerAt = speechAt(all, MARKER_AT);
  const question = makeEntry("question", { ...entryOf(all, questionAt), id: QUESTION_ID });
  const base = makeEntry("marker", { ...entryOf(all, markerAt), id: MARKER_ID });
  const marker: Entry =
    base.marker === null ? base : { ...base, marker: { ...base.marker, type: "prd_written" } };
  const lateAt = speechAt(all, LATE_QUESTION_AT);
  const late = makeEntry("question", { ...entryOf(all, lateAt), id: "entry-late-question" });
  all[questionAt] = { ...question, kind: "question", assistant: null };
  all[lateAt] = { ...late, kind: "question", assistant: null };
  all[markerAt] = { ...marker, kind: "marker", assistant: null };
  return all;
}

// entryOf is what an entry keeps of its place: its time and its turn.
function entryOf(all: readonly Entry[], at: number): Partial<Entry> {
  const entry = all[at];
  return { seq: entry?.seq ?? 0, turnId: entry?.turnId ?? "", createdAt: entry?.createdAt ?? "" };
}

// Anchors are the nodes a conversation draws before and after an entry, by its id.
interface Anchors {
  before: ReadonlyMap<string, ReactNode>;
  after: ReadonlyMap<string, ReactNode>;
}

async function draw(anchorsOf?: (all: readonly Entry[]) => Anchors) {
  const all = entries();
  const anchors = anchorsOf?.(all);
  const { container, user } = renderWithStore(
    <div style={{ ...mainArea(MAIN_WIDTH), height: `${MAIN_HEIGHT}px`, display: "flex" }}>
      <Conversation
        taskId={TASK_ID}
        stage={STAGE}
        session={SESSION}
        {...(anchors === undefined ? {} : { before: anchors.before, after: anchors.after })}
      />
    </div>,
    {
      state: makeState({ tasks: [makeTask({ id: TASK_ID })] }),
      ui: {
        transcripts: {
          [sessionKey(TASK_ID, STAGE)]: fromTranscript({
            taskId: TASK_ID,
            sessionId: "measure",
            stage: STAGE,
            entries: all,
            pending: [],
          }),
        },
      },
    },
  );
  await settle();
  const scroll = container.querySelector<HTMLElement>("[data-window-viewport]");
  if (scroll === null) {
    throw new Error("the conversation is not windowed");
  }
  const feed = screen.getByRole("feed");
  return { all, container, user, scroll, feed };
}

const atEnd = (scroll: HTMLElement) =>
  Math.abs(scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight) <= 1;

const units = (feed: HTMLElement) => [...feed.querySelectorAll<HTMLElement>("[data-unit-index]")];

// scrollAway puts the reader at a distance from the end and waits until the list stops moving.
async function scrollAway(scroll: HTMLElement, top: number) {
  scroll.scrollTo({ top });
  await vi.waitFor(() => expect(Math.abs(scroll.scrollTop - top)).toBeLessThan(2000));
  await settle();
  await still();
}

// still waits until the scroll has been quiet: the list corrects it only once it has stopped.
const still = () => new Promise((done) => setTimeout(done, 400));

// textOf writes the text of an entry, as the agent does while it writes.
function textOf(id: string, text: string) {
  act(() =>
    useAppStore.getState().applyTranscriptEvent({
      taskId: TASK_ID,
      stage: STAGE,
      kind: "text",
      entry: null,
      entryId: id,
      text,
    }),
  );
}

// numbered are the articles of a unit that take a position in the feed.
const numbered = (unit: HTMLElement) => [
  ...unit.querySelectorAll<HTMLElement>(":scope > article:not([role])"),
];

// checkContiguity expects the first article of each unit to follow the last one of the unit before.
function checkContiguity(feed: HTMLElement) {
  const mounted = units(feed);
  let compared = 0;
  for (const [at, unit] of mounted.entries()) {
    const next = mounted[at + 1];
    const positions = numbered(unit).map((article) =>
      Number(article.getAttribute("aria-posinset")),
    );
    for (const [place, position] of positions.entries()) {
      expect(position).toBe((positions[0] ?? 0) + place);
    }
    if (
      next === undefined ||
      Number(next.dataset.unitIndex) !== Number(unit.dataset.unitIndex) + 1
    ) {
      continue;
    }
    const first = Number(numbered(next)[0]?.getAttribute("aria-posinset"));
    expect(first).toBe((positions.at(-1) ?? 0) + 1);
    compared += 1;
  }
  expect(compared).toBeGreaterThan(10);
}

describe("the conversation window", () => {
  it("opens at the end, mounting only what shows", async () => {
    const { scroll, feed } = await draw();

    await vi.waitFor(() => expect(atEnd(scroll)).toBe(true));
    expect(units(feed).length).toBeLessThan(80);
    expect(units(feed).at(-1)).toBeInTheDocument();
  });

  it("stays at the end while the agent writes", async () => {
    const { all, scroll } = await draw();
    await vi.waitFor(() => expect(atEnd(scroll)).toBe(true));
    const last = all.at(-1);
    const text = `${last?.assistant?.text ?? ""} and a longer text`.padEnd(1200, " more words");

    textOf(last?.id ?? "", text);

    await vi.waitFor(() => expect(atEnd(scroll)).toBe(true));
  });

  it("does not move what the reader sees when a row above it changes height", async () => {
    const { all, scroll, feed } = await draw();
    await vi.waitFor(() => expect(atEnd(scroll)).toBe(true));
    await scrollAway(scroll, scroll.scrollHeight / 2);
    const mounted = units(feed);
    const frame = scroll.getBoundingClientRect();
    const first = mounted.find((unit) => unit.getBoundingClientRect().bottom > frame.top + 1);
    const above = mounted.find(
      (unit) => unit.getBoundingClientRect().bottom <= frame.top && unit.querySelector("p"),
    );
    if (first === undefined || above === undefined) {
      throw new Error("no unit above the view and one in it");
    }
    const before = first.getBoundingClientRect().top;
    const speech = all.find((entry) =>
      above.textContent?.includes(entry.assistant?.text.slice(0, 40) ?? "\0"),
    );
    const id = speech?.id ?? "";
    const grown = `${speech?.assistant?.text ?? ""}\n\n${"A line that makes the speech taller.\n\n".repeat(6)}`;

    textOf(id, grown);
    await still();

    expect(first.getBoundingClientRect().top).toBe(before);
  });

  it("keeps the pending question and the tab stop mounted far from the window", async () => {
    const { scroll, feed } = await draw();
    await vi.waitFor(() => expect(atEnd(scroll)).toBe(true));
    const stop = feed.querySelector<HTMLElement>('[data-feed-item][tabindex="0"]');
    expect(stop).not.toBeNull();

    await scrollAway(scroll, 0);

    expect(feed.querySelector("[data-pending-card=question]")).toBeInTheDocument();
    expect(stop).toBeInTheDocument();
    expect(feed.querySelectorAll('[data-feed-item][tabindex="0"]')).toHaveLength(1);
  });

  it("pins only the question the conversation holds pending, not an earlier one left pending", async () => {
    const { scroll, feed } = await draw();
    await vi.waitFor(() => expect(atEnd(scroll)).toBe(true));

    await scrollAway(scroll, 0);

    expect(feed.querySelectorAll("[data-pending-card=question]")).toHaveLength(1);
  });

  it("keeps the unit of the tab stop mounted when it is an ordinary entry far from the window", async () => {
    const { scroll, feed } = await draw();
    await vi.waitFor(() => expect(atEnd(scroll)).toBe(true));
    await scrollAway(scroll, scroll.scrollHeight / 2);
    const frame = scroll.getBoundingClientRect();
    const middle = units(feed).find(
      (unit) =>
        unit.getBoundingClientRect().top > frame.top && unit.querySelector("[data-feed-item]"),
    );
    const item = middle?.querySelector<HTMLElement>("[data-feed-item]");
    if (item == null || item.matches("[data-pending-card]")) {
      throw new Error("no ordinary entry in the middle of the conversation");
    }
    item.focus();
    expect(item).toHaveAttribute("tabindex", "0");

    await scrollAway(scroll, 0);

    expect(item).toBeInTheDocument();
    expect(item).toHaveAttribute("tabindex", "0");
  });

  it("mounts the marker the request bar asked for, from afar", async () => {
    const { scroll } = await draw();
    await vi.waitFor(() => expect(atEnd(scroll)).toBe(true));
    await scrollAway(scroll, 0);

    act(() => useAppStore.getState().requestMarkerOpen(TASK_ID, "prd_written"));

    await vi.waitFor(() => expect(useAppStore.getState().markerRequest).toBeNull());
  });

  it("takes New messages back to the end", async () => {
    const { all, scroll, user } = await draw();
    await vi.waitFor(() => expect(atEnd(scroll)).toBe(true));
    await scrollAway(scroll, scroll.scrollHeight / 2);
    const born = makeEntry("assistant", { id: "entry-born", seq: all.length + 1 });

    act(() =>
      useAppStore.getState().applyTranscriptEvent({
        taskId: TASK_ID,
        stage: STAGE,
        kind: "entry",
        entry: born,
        entryId: born.id,
        text: "",
      }),
    );

    const back = await screen.findByRole("button", { name: /^New messages: 1\./ });
    await user.click(back);
    await vi.waitFor(() => expect(atEnd(scroll)).toBe(true));
  });

  it("numbers the articles of the top level over the whole conversation", async () => {
    const { scroll, feed } = await draw();
    await vi.waitFor(() => expect(atEnd(scroll)).toBe(true));
    const check = () => {
      const articles = [
        ...feed.querySelectorAll<HTMLElement>(":scope > div > article, :scope > article"),
      ];
      expect(articles.length).toBeGreaterThan(0);
      const sizes = new Set(articles.map((article) => article.getAttribute("aria-setsize")));
      expect(sizes.size).toBe(1);
      const positions = articles.map((article) => Number(article.getAttribute("aria-posinset")));
      expect(positions.every((position) => Number.isInteger(position) && position > 0)).toBe(true);
      expect([...positions].sort((a, b) => a - b)).toEqual(positions);
      return { positions, size: Number([...sizes][0]) };
    };

    const end = check();
    expect(end.positions.at(-1)).toBe(end.size);
    for (const unit of units(feed)) {
      const inside = [...unit.querySelectorAll<HTMLElement>(":scope > article")].map((article) =>
        Number(article.getAttribute("aria-posinset")),
      );
      for (const [at, position] of inside.entries()) {
        expect(position).toBe((inside[0] ?? 0) + at);
      }
    }

    await scrollAway(scroll, 0);
    const start = check();
    expect(start.positions[0]).toBe(1);
    expect(start.size).toBe(end.size);
  });

  it("numbers the articles contiguously across units, with lines before and after entries and a card", async () => {
    const { scroll, feed } = await draw((all) => {
      const near = (back: number) => all[speechAt(all, all.length - back)]?.id ?? "";
      const line = (round: number) => (
        <MarkerLine key={round} view={roundLineOf(round, [], 0)} createdAt="" />
      );
      return {
        before: new Map([[near(40), line(1)]]),
        after: new Map([
          [near(30), line(2)],
          [
            near(20),
            // biome-ignore lint/a11y/useSemanticElements: the card of decisions is an article with the role of group
            <article key="card" role="group" aria-label="Cards" data-testid="card">
              A card
            </article>,
          ],
        ]),
      };
    });
    await vi.waitFor(() => expect(atEnd(scroll)).toBe(true));
    await settle();

    expect(screen.getByRole("article", { name: /^Round 1/ })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: /^Round 2/ })).toBeInTheDocument();
    const card = screen.getByTestId("card");
    expect(card).not.toHaveAttribute("aria-posinset");
    checkContiguity(feed);
    const sizes = new Set(
      [...feed.querySelectorAll<HTMLElement>("[aria-setsize]")].map((article) =>
        article.getAttribute("aria-setsize"),
      ),
    );
    expect(sizes.size).toBe(1);
  });
});
