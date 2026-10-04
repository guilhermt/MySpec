/**
 * measure-conversation times the conversation at fifteen times the longest one measured in use
 * (design/tasks/04-task-conversation.md §4.2, A virtualização): 1,500 entries in four stretches, the
 * first three folded, the agent writing at the end. It measures the first paint, from before the
 * render to the frame after the commit with its layout, and an update of the text being written:
 * the work it takes, the commit and the layout, which must fit in a frame, and the time to the next
 * frame, which also waits for the display.
 *
 * With ?measure=conversation&stretches=open the same 1,500 entries come in stretches too short to
 * fold, so the window has 362 units to mount from, and it also measures ↓ in the feed, from the
 * keydown to the next frame, and Home, to the frame with an entry of the first unit focused.
 *
 * A tool of the development build: main.tsx mounts it in place of the app only with
 * ?measure=conversation under the Vite dev server (task dev) or in the measure build, and the
 * production bundle never has it. The numbers go to the console and to the page.
 */

import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { Conversation } from "@/features/chat/Conversation";
import type { SessionState } from "@/features/chat/session";
import { type Entry, sessionKey, type UserEntry } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { fromTranscript } from "@/store/transcript";

/** ENTRIES is how many entries the measured conversation has: 15 times the p90 of a real one. */
const ENTRIES = 1500;

/** STRETCHES is how many stretches it has; all but the last fold. */
const STRETCHES = 4;

/** OPEN_STRETCHES is how many it has in the open scenario: fewer than 12 rows each, so none folds. */
export const OPEN_STRETCHES = 36;

/** ACTIONS_PER_GROUP is how many actions the agent runs between two things it says. */
const ACTIONS_PER_GROUP = 8;

/** WARM_RUNS and UPDATES are how many times the paint and the update are measured again, warm. */
const WARM_RUNS = 5;
const UPDATES = 30;

/** KEY_RUNS is how many times each key is pressed: once cold and the rest warm. */
const KEY_RUNS = 6;

export const TASK_ID = "measure";
export const STAGE = "step:6";

/** SESSION is the implementer at work, writing the last entry. */
export const SESSION: SessionState = {
  sessionStatus: "working",
  sessionModel: "claude-opus-5-5[1m]",
  sessionEffort: "high",
  turnRunning: true,
  processRunning: true,
  retryAttempt: 0,
  retryMax: 0,
  retryAt: "",
  retryReason: "",
  turnStartedAt: new Date().toISOString(),
  lastError: "",
  turnFailed: false,
  pausedAt: "",
};

const EMPTY = {
  user: null,
  assistant: null,
  action: null,
  permission: null,
  question: null,
  marker: null,
  error: null,
};

const USER: UserEntry = {
  text: "",
  pending: false,
  prompt: false,
  app: false,
  sent: "",
  appKind: "",
  appPass: 0,
  appRound: 0,
  appRounds: 0,
  appCount: 0,
};

const SPEECH = [
  "The bucket refills when it's read, so an idle key costs nothing, and a new key starts with a full burst:",
  "",
  "- one `Bucket` per key, created on first use;",
  "- a refill computed from the time elapsed on each read, with no ticker;",
  "- a mutex per bucket, and the map behind a `sync.RWMutex`.",
].join("\n");

// measuredConversation is the measured conversation: each stretch opened by a report to the implementer
// but the first, then speeches, each followed by a group of actions, to the last entry, a speech
// still being written.
export function measuredConversation(stretches: number): Entry[] {
  const start = Date.now() - ENTRIES * 5000;
  const entries: Entry[] = [];
  const add = (fields: Partial<Entry> & Pick<Entry, "kind">, turn: number) => {
    const seq = entries.length + 1;
    entries.push({
      id: `entry-${seq}`,
      seq,
      turnId: `turn-${turn}`,
      createdAt: new Date(start + seq * 5000).toISOString(),
      ...EMPTY,
      ...fields,
    });
  };
  const perStretch = ENTRIES / stretches;
  let opened = 1;
  for (let turn = 0; entries.length < ENTRIES - 1; turn++) {
    if (entries.length >= opened * perStretch) {
      add(
        {
          kind: "user",
          user: {
            ...USER,
            app: true,
            appKind: "report",
            appPass: opened,
            appRound: opened,
            appRounds: stretches,
            appCount: 2,
            text: "#### Review · changes\n\n1. Evict idle buckets.\n2. Test the refill.",
          },
        },
        turn,
      );
      opened += 1;
    }
    add(
      {
        kind: "assistant",
        assistant: {
          messageId: `msg-${turn}`,
          blockIndex: 0,
          text: SPEECH,
          complete: true,
          interrupted: false,
          parentToolUseId: "",
          interruptedBy: "",
        },
      },
      turn,
    );
    for (let index = 0; index < ACTIONS_PER_GROUP && entries.length < ENTRIES - 1; index++) {
      const at = new Date(start + (entries.length + 1) * 5000).toISOString();
      add(
        {
          kind: "action",
          action: {
            toolUseId: `toolu-${turn}-${index}`,
            tool: "Bash",
            label: "Bash",
            target: "go test ./internal/ratelimit/... -race",
            status: "done",
            description: "Run the rate limit tests",
            commandLines: 1,
            startedAt: at,
            finishedAt: at,
            exitCode: 0,
            parentToolUseId: "",
            interruptedBy: "",
            outputLines: 2,
            outputTail: "PASS\nok  \tgithub.com/acme/api/internal/ratelimit\t7.912s",
            outputTruncated: false,
          },
        },
        turn,
      );
    }
  }
  add(
    {
      kind: "assistant",
      assistant: {
        messageId: "msg-last",
        blockIndex: 0,
        text: "Done. The counter takes the plan from the bucket",
        complete: false,
        interrupted: false,
        parentToolUseId: "",
        interruptedBy: "",
      },
    },
    ENTRIES,
  );
  return entries;
}

// nextFrame is the time of the frame after now, with the layout of what was committed done.
function nextFrame(): Promise<number> {
  return new Promise((done) =>
    requestAnimationFrame(() => {
      void document.body.offsetHeight;
      done(performance.now());
    }),
  );
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

// paint mounts the conversation and returns the milliseconds to the frame after its commit.
async function paint(root: Root): Promise<number> {
  const started = performance.now();
  flushSync(() => root.render(<Conversation taskId={TASK_ID} stage={STAGE} session={SESSION} />));
  return (await nextFrame()) - started;
}

// update writes one more word of the last entry and returns the milliseconds of the work, to the
// commit and its layout, and to the frame after it.
async function update(entryId: string, text: string): Promise<{ work: number; frame: number }> {
  const started = performance.now();
  flushSync(() =>
    useAppStore.getState().applyTranscriptEvent({
      taskId: TASK_ID,
      stage: STAGE,
      kind: "text",
      entry: null,
      entryId,
      text,
    }),
  );
  void document.body.offsetHeight;
  const work = performance.now() - started;
  return { work, frame: (await nextFrame()) - started };
}

// feedItems are the stops of the feed, in the order of the page.
function feedItems(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>("[role=feed] [data-feed-item]")];
}

// press presses a key on the item in focus and returns the milliseconds to the frame after it, or,
// given what to wait for, to the frame in which it holds.
async function press(key: string, item: HTMLElement, until?: () => boolean): Promise<number> {
  const started = performance.now();
  item.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  let frame = await nextFrame();
  while (until !== undefined && !until() && frame - started < 2000) {
    frame = await nextFrame();
  }
  return frame - started;
}

// inFirstUnit tells whether the focus is on an entry of the first unit of the conversation, which
// the window mounts when Home brings it into view.
const inFirstUnit = () => document.activeElement?.closest('[data-unit-index="0"]') != null;

// ms rounds milliseconds to a tenth.
const ms = (value: number) => Number(value.toFixed(1));

/** measureConversation mounts the measured conversation in the element and times it. */
export async function measureConversation(container: HTMLElement): Promise<void> {
  const open = new URLSearchParams(window.location.search).get("stretches") === "open";
  const entries = measuredConversation(open ? OPEN_STRETCHES : STRETCHES);
  const last = entries.at(-1);
  const load = () =>
    useAppStore.setState({
      transcripts: {
        [sessionKey(TASK_ID, STAGE)]: fromTranscript({
          taskId: TASK_ID,
          sessionId: "measure",
          stage: STAGE,
          entries,
          pending: [],
        }),
      },
    });
  document.documentElement.dataset.theme = "light";
  container.style.cssText = "display:flex;flex-direction:column;width:1566px;height:900px";
  load();

  const root = createRoot(container);
  const first = await paint(root);
  const warm: number[] = [];
  for (let run = 0; run < WARM_RUNS; run++) {
    flushSync(() => root.render(null));
    load();
    await nextFrame();
    warm.push(await paint(root));
  }
  const work: number[] = [];
  const frames: number[] = [];
  let text = last?.assistant?.text ?? "";
  for (let word = 0; word < UPDATES; word++) {
    text += " word";
    const one = await update(last?.id ?? "", text);
    work.push(one.work);
    frames.push(one.frame);
  }

  const keys: Record<string, number> = {};
  if (open) {
    const items = feedItems();
    const downs: number[] = [];
    const homes: number[] = [];
    for (let run = 0; run < KEY_RUNS; run++) {
      const from = items[items.length - 2 - run];
      from?.focus();
      if (from !== undefined) {
        const next = items[items.length - 1 - run];
        downs.push(await press("ArrowDown", from, () => document.activeElement === next));
      }
    }
    for (let run = 0; run < KEY_RUNS; run++) {
      const from = feedItems().at(-1);
      from?.focus();
      if (from !== undefined) {
        homes.push(await press("Home", from, inFirstUnit));
      }
    }
    keys.keyDownFirstMs = ms(downs[0] ?? 0);
    keys.keyDownWarmMedianMs = ms(median(downs.slice(1)));
    keys.keyDownWarmMaxMs = ms(Math.max(...downs.slice(1)));
    keys.keyHomeFirstMs = ms(homes[0] ?? 0);
    keys.keyHomeWarmMedianMs = ms(median(homes.slice(1)));
    keys.keyHomeWarmMaxMs = ms(Math.max(...homes.slice(1)));
  }

  const result = {
    scenario: open ? "open stretches" : "folded stretches",
    ...keys,
    entries: entries.length,
    mountedArticles: container.querySelectorAll("article").length,
    firstPaintMs: Math.round(first),
    warmPaintMedianMs: Math.round(median(warm)),
    // The first update is the cold one, the rest are warm.
    updateWorkFirstMs: ms(work[0] ?? 0),
    updateWorkWarmMedianMs: ms(median(work.slice(1))),
    updateWorkWarmMaxMs: ms(Math.max(...work.slice(1))),
    updateFrameWarmMedianMs: ms(median(frames.slice(1))),
    userAgent: navigator.userAgent,
  };
  console.info("measure-conversation", result);
  const out = document.createElement("pre");
  out.id = "measure-conversation";
  // Fixed, so that the focus the keys move down the feed does not scroll it out of the page.
  out.style.cssText = "position:fixed;top:0;left:0;z-index:9999;margin:0;background:#fff";
  out.textContent = JSON.stringify(result, null, 2);
  document.body.prepend(out);
}
