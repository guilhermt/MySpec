import { act, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  measuredConversation,
  OPEN_STRETCHES,
  SESSION,
  STAGE,
  TASK_ID,
} from "@/dev/measure-conversation";
import { Conversation } from "@/features/chat/Conversation";
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
  all[questionAt] = { ...question, kind: "question", assistant: null };
  all[markerAt] = { ...marker, kind: "marker", assistant: null };
  return all;
}

// entryOf is what an entry keeps of its place: its time and its turn.
function entryOf(all: readonly Entry[], at: number): Partial<Entry> {
  const entry = all[at];
  return { seq: entry?.seq ?? 0, turnId: entry?.turnId ?? "", createdAt: entry?.createdAt ?? "" };
}

async function draw() {
  const all = entries();
  const { container, user } = renderWithStore(
    <div style={{ ...mainArea(MAIN_WIDTH), height: `${MAIN_HEIGHT}px`, display: "flex" }}>
      <Conversation taskId={TASK_ID} stage={STAGE} session={SESSION} />
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
});
