/**
 * A conversation fifteen times the longest one seen in use: 1,500 entries, each stretch opened by a
 * report to the implementer but the first, the agent writing at the end. In OPEN_STRETCHES stretches
 * none folds, so the window has 362 units to mount from. The tests of the window of the conversation
 * and of the motion draw it.
 */

import type { SessionState } from "@/features/chat/session";
import type { Entry, UserEntry } from "@/lib/wails";

/** ENTRIES is how many entries the long conversation has: 15 times the p90 of a real one. */
const ENTRIES = 1500;

/** OPEN_STRETCHES is how many it has in the open scenario: fewer than 12 rows each, so none folds. */
export const OPEN_STRETCHES = 36;

/** ACTIONS_PER_GROUP is how many actions the agent runs between two things it says. */
const ACTIONS_PER_GROUP = 8;

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

// longConversation is the long conversation: each stretch opened by a report to the implementer
// but the first, then speeches, each followed by a group of actions, to the last entry, a speech
// still being written.
export function longConversation(stretches: number): Entry[] {
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
