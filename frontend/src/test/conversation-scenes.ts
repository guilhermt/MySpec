/**
 * The scenes of the conversation (design/tasks/04-task-conversation.md §4.2, As cenas): the
 * conversations of design/lab/16-conversation-wide/src/conv-data.js on the reference task of
 * task-scenes.ts, at the moment of each scene. The conversation test draws TaskView from them.
 */

import { afterEach, beforeEach, vi } from "vitest";
import type {
  ActionEntry,
  ActionStatus,
  AppKind,
  AssistantEntry,
  Entry,
  MarkerEntry,
  MarkerType,
  Situation,
  Step,
  TaskSummary,
  Transcript,
  UserEntry,
} from "@/lib/wails";
import {
  inStep,
  type Scene,
  type SceneName,
  sceneOf,
  sceneTask,
  TASK_ID,
} from "@/test/task-scenes";
import { makeEntry, makeStepReviewer, makeTranscript } from "@/test/wails-mock";

/** CONVERSATION_SCENES are the seven scenes of the conversation mock. */
export const CONVERSATION_SCENES = [
  "planning",
  "running",
  "ask",
  "long",
  "error",
  "retrying",
  "review",
] as const;

/** ConversationSceneName is one scene of the conversation mock. */
export type ConversationSceneName = (typeof CONVERSATION_SCENES)[number];

// clock is an hour of the day of the scenes, "14:23" or "14:23:48", in the local time of the
// machine, so the times the conversation shows are the ones of the mock on any machine.
function clock(time: string): string {
  const [hours = 0, minutes = 0, seconds = 0] = time.split(":").map(Number);
  return new Date(2026, 8, 27, hours, minutes, seconds).toISOString();
}

// later is an instant some seconds after another.
function later(iso: string, seconds: number): string {
  return new Date(Date.parse(iso) + seconds * 1000).toISOString();
}

/**
 * CONVERSATION_NOW is the moment each scene is drawn at, the hour of the scene of the mock: the tests
 * fix the clock on it, so the ages, the durations and the countdowns are the ones of the mock.
 */
export const CONVERSATION_NOW: Record<ConversationSceneName, string> = {
  planning: clock("09:31"),
  running: clock("14:23"),
  ask: clock("14:56"),
  long: clock("17:41:30"),
  error: clock("14:41"),
  retrying: clock("14:41"),
  review: clock("18:02"),
};

/**
 * fixConversationClock stops the clock of the page at the moment of a scene for each test that runs
 * next in the describe it is called in, and gives it back after; only Date is faked, so the timers
 * of the page still run.
 */
export function fixConversationClock(name: ConversationSceneName): void {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(CONVERSATION_NOW[name]));
  });
  afterEach(() => {
    vi.useRealTimers();
  });
}

// ---------------- The entries ----------------

// lines joins the lines of a text.
const lines = (...all: string[]) => all.join("\n");

function speech(at: string, text: string, rest: Partial<AssistantEntry> = {}): Entry {
  return makeEntry("assistant", {
    createdAt: clock(at),
    assistant: {
      messageId: `msg_${at.replace(":", "")}`,
      blockIndex: 0,
      text,
      complete: true,
      interrupted: false,
      parentToolUseId: "",
      interruptedBy: "",
      ...rest,
    },
  });
}

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

function you(at: string, text: string, rest: Partial<UserEntry> = {}): Entry {
  return makeEntry("user", { createdAt: clock(at), user: { ...USER, text, ...rest } });
}

// product is a message the app sent the agent, with the numbers of what it is.
function product(
  at: string,
  appKind: AppKind,
  numbers: Pick<Partial<UserEntry>, "appPass" | "appRound" | "appRounds" | "appCount">,
  text: string,
): Entry {
  return you(at, text, { app: true, appKind, ...numbers });
}

function marker(at: string, type: MarkerType, fields: Partial<MarkerEntry> = {}): Entry {
  const base = makeEntry("marker").marker;
  if (base === null) {
    throw new Error("a marker entry has no marker");
  }
  return makeEntry("marker", { createdAt: clock(at), marker: { ...base, type, ...fields } });
}

// start is the marker that opens a conversation and the prompt that follows it.
function start(at: string, fields: Partial<MarkerEntry>, prompt: Partial<UserEntry>): Entry[] {
  const type = fields.step !== undefined && fields.step > 0 ? "step_started" : "stage_started";
  return [marker(at, type, fields), you(at, "", { prompt: true, ...prompt })];
}

// firstPass is the first message to a reviewer: its start marker and the prompt it got.
function firstPass(at: string, step: number, text: string): Entry[] {
  return [
    marker(at, "step_review_started", { step, pass: 1 }),
    you(at, text, { prompt: true, app: true }),
  ];
}

/**
 * Act is a command of a group: what the agent wrote it does, the command, how it ended and after how
 * many seconds, and what it printed. A subagent carries its actions and its report.
 */
interface Act {
  label: string;
  command: string;
  status?: ActionStatus;
  seconds?: number;
  /** at is when it started, when it is not its place in the group. */
  at?: string;
  /** out is the tail of the output, and outLines how many lines the whole output has. */
  out?: string;
  outLines?: number;
  exitCode?: number;
  interruptedBy?: string;
  commandLines?: number;
  /** children are the actions of the subagent it started; a subagent is an act with them. */
  children?: Act[];
}

// action is the entry of one act of a group, started at an instant.
function action(
  act: Act,
  startedAt: string,
  toolUseId: string,
  turnId: string,
  parentToolUseId = "",
): Entry {
  const status = act.status ?? "done";
  const subagent = act.children !== undefined;
  const out = act.out ?? "";
  const outputLines = act.outLines ?? (out === "" ? 0 : out.split("\n").length);
  const fields: ActionEntry = {
    toolUseId,
    tool: subagent ? "Agent" : "Bash",
    label: subagent ? "Agent" : "Bash",
    target: subagent ? "general-purpose" : act.command,
    status,
    description: act.label,
    commandLines: act.commandLines ?? 1,
    startedAt,
    finishedAt: status === "running" ? "" : later(startedAt, act.seconds ?? 0.1),
    exitCode: status === "error" ? (act.exitCode ?? 1) : status === "done" ? 0 : -1,
    parentToolUseId,
    interruptedBy: act.interruptedBy ?? "",
    outputLines,
    outputTail: out,
    outputTruncated: false,
  };
  return makeEntry("action", { turnId, createdAt: startedAt, action: fields });
}

/**
 * group is a run of actions of one turn, started at an hour and spread over some seconds; the actions
 * of a subagent follow it, spread over its own time.
 */
function group(at: string, spanSeconds: number, acts: readonly Act[]): Entry[] {
  const turnId = `turn_${at.replace(":", "")}`;
  const first = clock(at);
  const gap = spanSeconds / Math.max(acts.length, 1);
  return acts.flatMap((act, index) => {
    const startedAt = act.at === undefined ? later(first, index * gap) : clock(act.at);
    const toolUseId = `toolu_${turnId}_${index}`;
    const children = act.children ?? [];
    const step = (act.seconds ?? 0) / Math.max(children.length, 1);
    return [
      action(act, startedAt, toolUseId, turnId),
      ...children.map((child, number) =>
        action(child, later(startedAt, number * step), `${toolUseId}_${number}`, turnId, toolUseId),
      ),
    ];
  });
}

// act is a command that ended well after some seconds.
function act(label: string, command: string, seconds = 0.1, rest: Partial<Act> = {}): Act {
  return { label, command, seconds, ...rest };
}

// earlier are the first acts of a group, the ones the mock leaves under Show N earlier actions,
// taken in turn from a pool of the commands of the scene.
function earlier(count: number, pool: readonly Act[], from = 0): Act[] {
  return Array.from({ length: count }, (_, index) => {
    const one = pool[(from + index) % pool.length];
    if (one === undefined) {
      throw new Error("the pool of a scene is empty");
    }
    return one;
  });
}

// ---------------- The shared content ----------------

const GO_LIMITER = lines(
  "```go",
  "package ratelimit",
  "",
  "import (",
  '\t"sync"',
  '\t"time"',
  ")",
  "",
  "// Limiter keeps one bucket per API key, created on first use.",
  "type Limiter struct {",
  "\tmu      sync.RWMutex",
  "\tbuckets map[string]*Bucket",
  "\tplans   PlanSource",
  "}",
  "",
  "// For returns the bucket of a key, creating it full from the key's plan.",
  "func (l *Limiter) For(keyID string, now time.Time) *Bucket {",
  "\tl.mu.RLock()",
  "\tb, ok := l.buckets[keyID]",
  "\tl.mu.RUnlock()",
  "\tif ok {",
  "\t\treturn b",
  "\t}",
  "\tplan := l.plans.PlanFor(keyID)",
  "\tl.mu.Lock()",
  "\tdefer l.mu.Unlock()",
  "\tif b, ok = l.buckets[keyID]; ok {",
  "\t\treturn b",
  "\t}",
  "\tb = &Bucket{burst: plan.Burst, rate: plan.RefillPerSecond, tokens: plan.Burst, last: now}",
  "\tl.buckets[keyID] = b",
  "\treturn b",
  "}",
  "",
  "// Allow takes one token if there is one, refilling first from the time elapsed.",
  "func (b *Bucket) Allow(now time.Time) bool {",
  "\tb.mu.Lock()",
  "\tdefer b.mu.Unlock()",
  "\telapsed := now.Sub(b.last).Seconds()",
  "\tb.tokens = min(float64(b.burst), b.tokens+elapsed*b.rate)",
  "\tb.last = now",
  "\tif b.tokens < 1 {",
  "\t\treturn false",
  "\t}",
  "\tb.tokens--",
  "\treturn true",
  "}",
  "```",
);

const GO_AUTH = lines(
  "```go",
  'key, err := h.keys.Lookup(ctx, r.Header.Get("X-API-Key"))',
  "if err != nil {",
  "\treturn unauthorized(w)",
  "}",
  "if !h.limiter.For(key.ID).Allow(time.Now()) {",
  "\treturn tooManyRequests(w, h.limiter.RetryAfter(key.ID))",
  "}",
  "```",
);

const CARD_CONTEXT = lines(
  "#### acme/api#412 · Rate limit per API key",
  "",
  "Today every client shares one global limit in the gateway; one noisy integration throttles everyone.",
  "",
  "Limit each API key with its plan's burst and refill, and answer 429 with `Retry-After`.",
  "",
  "**Epic.** API hardening · **Siblings.** #413 Rotate API keys without downtime, #415 Audit log for key changes.",
);

const STEP_FILE_3 = lines(
  "#### Step 3: Token bucket middleware",
  "",
  "**Scope.** A token bucket per API key in `internal/ratelimit`, checked in the API key middleware. Burst and refill come from the plan config of step 1.",
  "",
  "- One bucket per key, created on first use.",
  "- Refill computed on read from the time elapsed; no ticker.",
  "- 429 with `Retry-After` when the bucket is empty.",
  "",
  "**Completion checklist.** `go test ./... -race`, `golangci-lint run`, a burst test with 50 concurrent requests on one key.",
);

const REVIEW_1 = lines(
  "#### Review 1 · changes",
  "",
  "The agent review of this step found changes. Address each finding, fixing it or saying why you disagree. Don't commit.",
  "",
  "1. `internal/ratelimit/limiter.go:22` · The map of buckets grows with every key ever seen. Evict buckets idle for more than 10 minutes.",
  "2. `internal/ratelimit/bucket_test.go` · No test covers the refill after the burst is spent.",
  "",
  "**Checks run.** `go test ./... -race` passed · `golangci-lint run` passed.",
);

const FAILED_TESTS = lines(
  "=== RUN   TestBucketAllow",
  "--- PASS: TestBucketAllow (0.00s)",
  "=== RUN   TestLimiterFor",
  "--- PASS: TestLimiterFor (0.01s)",
  "=== RUN   TestConcurrentBurst",
  "    limiter_test.go:58: allowed 0 of 50 requests, want 20",
  "--- FAIL: TestConcurrentBurst (0.04s)",
  "FAIL",
  "FAIL\tgithub.com/acme/api/internal/ratelimit\t8.214s",
  "FAIL",
);

const PASSED_TESTS = lines(
  "=== RUN   TestConcurrentBurst",
  "--- PASS: TestConcurrentBurst (0.03s)",
  "PASS",
  "ok  \tgithub.com/acme/api/internal/ratelimit\t7.912s",
);

/**
 * CONVERSATION_ARTIFACTS are the documents of the reference task the lines of the scenes open: the
 * step files and the reports, by the name ReadArtifact takes.
 */
export const CONVERSATION_ARTIFACTS: Record<string, string> = {
  "steps/3-count-the-requests-in-a-token-bucket.md": STEP_FILE_3,
  "steps/6-document-the-limits.md": lines(
    "#### Step 6: Count throttled requests per plan",
    "",
    "A counter of 429 answers labelled by plan, exported to Prometheus, and a panel in the gateway dashboard.",
  ),
  "step-reviews/3-review-1.md": REVIEW_1,
  "step-reviews/6-review-2.md": lines(
    "#### Review 2 · changes",
    "",
    "1. `internal/metrics/throttle.go:18` · Read the plan from the bucket.",
  ),
  "pr/1.md": lines(
    "#### Review 1 · changes",
    "",
    "1. `internal/ratelimit/bucket.go:31` · **e2e / rate-limit-burst failed.** A new bucket refills from the zero time on its first read, so a burst of 20 lets 21 requests through. Start `last` at creation.",
    "2. `internal/http/middleware/ratelimit.go:58` · `Retry-After` rounds down: a client told to wait 0 s retries at once and gets another 429. Round up to whole seconds.",
    "3. No migration sets `plans.burst` for the 14 existing Enterprise rows; they fall back to the Free burst of 20.",
    "4. `docs/rate-limits.md:12` · The table says 600 requests per minute for Pro; `config/plans.yaml` ships 500.",
  ),
};

// ---------------- Step 3: the implementer and the reviewer ----------------

const STEP_3_READS: readonly Act[] = [
  act("Read the PRD's limits section", "sed -n '40,90p' .myspec/rate-limit-per-api-key/PRD.md"),
  act("Read the tech spec", "cat .myspec/rate-limit-per-api-key/tech-spec.md"),
  act("Find the plan source", 'grep -rn "PlanSource" internal/', 0.2),
  act("Read the plan source", "sed -n '1,40p' internal/billing/plans.go"),
  act("Find where 429 is written", 'grep -rn "StatusTooManyRequests" internal/', 0.2),
  act("List the ratelimit package", "ls internal/ratelimit"),
  act("Find the middleware tests", "find internal/http -name '*_test.go'", 0.2),
  act("See the branch", "git status --short"),
];

const STEP_3_START: Entry[] = [
  ...start("13:48", { stage: "step:3", step: 3 }, { text: "Implement step 3." }),
  ...group("13:48", 110, [
    ...earlier(8, STEP_3_READS),
    act("Read the step file", "cat .myspec/rate-limit-per-api-key/steps/03-token-bucket.md"),
    act("Read the rate limit config from step 1", "sed -n '1,80p' internal/ratelimit/config.go"),
    act("Find the API key middleware", 'grep -rn "X-API-Key" internal/http', 0.2),
    act("Read the auth middleware", "sed -n '20,90p' internal/http/middleware/auth.go"),
    act("Read the key cache of step 2", "sed -n '1,60p' internal/keys/cache.go"),
    act("See what steps 1 and 2 changed", "git log --oneline -3 && git diff HEAD~2 --stat", 0.2),
  ]),
  speech(
    "13:52",
    lines(
      "I'll add the bucket to `internal/ratelimit` and wire it into the API key middleware. The config from step 1 already exposes `burst` and `refill_per_second`, so the bucket only needs:",
      "",
      "- one `Bucket` per key, created on first use;",
      "- a refill computed from the time elapsed on each read, with no ticker;",
      "- a mutex per bucket, and the map behind a `sync.RWMutex`.",
    ),
  ),
  ...group("13:53", 720, [
    ...earlier(15, [
      act("Read the bucket test of the spec", "sed -n '1,60p' internal/ratelimit/bucket_test.go"),
      act("Write the plan source", "cat > internal/ratelimit/plans.go <<'EOF'", 0.1, {
        commandLines: 24,
      }),
      act("Run the config tests", "go test ./internal/ratelimit/ -run Config", 3.4),
      act("Find the key middleware's tests", 'grep -rn "func TestAuth" internal/http', 0.2),
      act("Write the bucket test", "cat > internal/ratelimit/bucket_test.go <<'EOF'", 0.1, {
        commandLines: 58,
      }),
      act("Read the time helpers", "sed -n '1,30p' internal/clock/clock.go"),
      act("See the diff so far", "git diff --stat", 0.2),
    ]),
    act("Write the bucket", "cat > internal/ratelimit/bucket.go <<'EOF'", 0.1, {
      commandLines: 41,
    }),
    act("Write the map of buckets", "cat > internal/ratelimit/limiter.go <<'EOF'", 0.1, {
      commandLines: 46,
    }),
    act("Wire the limiter into the auth middleware", "python3 - <<'PY'", 0.2, {
      commandLines: 18,
    }),
    act("Run the rate limit tests", "go test ./internal/ratelimit/... -race", 8.2, {
      status: "error",
      exitCode: 1,
      out: FAILED_TESTS,
      outLines: 38,
    }),
    act(
      "Start a new bucket full",
      "sed -i 's/tokens: 0/tokens: burst/' internal/ratelimit/limiter.go",
    ),
    act("Run the rate limit tests", "go test ./internal/ratelimit/... -race", 7.9, {
      out: PASSED_TESTS,
      outLines: 31,
    }),
  ]),
  speech(
    "14:09",
    lines(
      "Done. The bucket refills when it's read, so an idle key costs nothing, and a new key starts with a full burst:",
      "",
      GO_LIMITER,
      "",
      "`go test ./internal/ratelimit/... -race` passes, including the burst test with 50 concurrent requests on one key.",
    ),
  ),
];

const STEP_3_REVIEWER_READS: readonly Act[] = [
  act("Read the step file", "cat .myspec/rate-limit-per-api-key/steps/03-token-bucket.md"),
  act("Read the PRD", "cat .myspec/rate-limit-per-api-key/PRD.md"),
  act("Read the tech spec", "cat .myspec/rate-limit-per-api-key/tech-spec.md"),
  act("Find the bucket's callers", 'grep -rn "limiter.For" internal/', 0.2),
  act("Read the auth middleware", "sed -n '20,90p' internal/http/middleware/auth.go"),
  act("Read the bucket test", "cat internal/ratelimit/bucket_test.go"),
  act("Find the tickers", 'grep -rn "time.NewTicker" internal/ratelimit', 0.2),
  act("Run the rate limit tests", "go test ./internal/ratelimit/... -race", 8.4),
];

const STEP_3_REVIEW_1: Entry[] = [
  ...firstPass(
    "14:11",
    3,
    lines(
      "Review step 3 against `steps/03-token-bucket.md`, the PRD and the tech spec. Write the report to `reviews/step-03/review-1.md`.",
      "",
      "#### The implementer's last answer",
      "",
      "Done. The bucket refills when it's read, so an idle key costs nothing…",
    ),
  ),
  ...group("14:11", 360, [
    ...earlier(39, STEP_3_REVIEWER_READS),
    act("See what the step changed", "git diff --stat && git status --short", 0.2),
    act("Read the bucket", "cat internal/ratelimit/bucket.go"),
    act("Read the map of buckets", "cat internal/ratelimit/limiter.go"),
    act("Run the whole suite with the race detector", "go test ./... -race", 48, {
      out: "ok  \tgithub.com/acme/api/internal/ratelimit\t8.102s",
      outLines: 42,
    }),
    act("Run the linter", "golangci-lint run ./...", 21),
    act("Look for eviction of idle keys", 'grep -n "delete(" internal/ratelimit/*.go'),
  ]),
  speech(
    "14:18",
    "Tests and lint pass, and the bucket matches the spec. Two findings: the map of buckets never forgets a key, and nothing tests the refill after a burst.",
  ),
  marker("14:19", "step_review_written", { step: 3, pass: 1, clean: false, findings: 2 }),
];

const HAND_IMPLEMENTER_1 = product(
  "14:19",
  "report",
  { appPass: 1, appRound: 1, appRounds: 3, appCount: 2 },
  REVIEW_1,
);

const STEP_3_ROUND_1_DONE: Entry[] = [
  HAND_IMPLEMENTER_1,
  speech("14:19", "Two findings. I'll sweep idle buckets once a minute and add the refill test."),
  ...group("14:19", 480, [
    ...earlier(9, STEP_3_READS, 2),
    act("Add the idle sweep", "python3 - <<'PY'", 0.2, { commandLines: 22 }),
    act("Add the refill test", "cat >> internal/ratelimit/bucket_test.go <<'EOF'", 0.1, {
      commandLines: 31,
    }),
    act(
      "Run the refill and eviction tests",
      "go test ./internal/ratelimit/... -race -run 'Evict|Refill'",
      14,
    ),
    act("Run the rate limit tests", "go test ./internal/ratelimit/... -race", 8.1),
    act("Run the linter", "golangci-lint run ./internal/ratelimit/...", 9),
  ]),
  you(
    "14:28",
    "Also log the key id, never the key, when a bucket is evicted. Debug level is enough.",
  ),
  ...group("14:28", 40, [
    act(
      "Log the evicted key id",
      "sed -i '/delete(l.buckets, id)/i …' internal/ratelimit/limiter.go",
    ),
    act("Run the eviction test", "go test ./internal/ratelimit/... -run Evict -v", 4.2),
    act("Check nothing logs the raw key", "grep -rn '\"key\", k\\b' internal/ratelimit"),
  ]),
  speech(
    "14:31",
    "Both findings addressed. Idle buckets are swept every minute; a new test drains the burst and checks one token comes back after a second. Eviction logs the key id at debug level.",
  ),
];

const REVIEWER_PASS_2 = product(
  "14:32",
  "pass",
  { appPass: 2 },
  lines(
    "The implementer is done with your last report. Review step 3 again and write `reviews/step-03/review-2.md`.",
    "",
    "#### The implementer's answer",
    "",
    "Both findings addressed. Idle buckets are swept every minute…",
  ),
);

const REVIEWER_ERROR_TAIL: Entry[] = [
  marker("14:33", "retried", { attempts: 2, reason: "overloaded" }),
  ...group("14:34", 70, [
    ...earlier(6, STEP_3_REVIEWER_READS, 3),
    act("See what changed since pass 1", "git diff HEAD --stat", 0.2),
    act("Read the sweep", "sed -n '30,70p' internal/ratelimit/limiter.go"),
    act("Read the refill test", "sed -n '80,140p' internal/ratelimit/bucket_test.go"),
    act("Read the rate limit docs", "cat docs/rate-limits.md"),
    act(
      "Compare the docs with the config",
      "diff <(grep -A3 Pro docs/rate-limits.md) config/plans.yaml",
    ),
    act("Read the docs' changelog", "git log --oneline -5 -- docs/", 0.2),
  ]),
  speech(
    "14:35",
    "Before the tests, the docs: `docs/rate-limits.md` says Pro gets 600 requests per minute, while `config/plans.yaml` ships 500. The docs were last touched in step 7's plan, so I'll read the whole plan to see whether this step was meant to",
    { interrupted: true, interruptedBy: "user" },
  ),
  you("14:36", "Skip the docs, step 7 covers them. Finish the pass on the code."),
];

const REVIEWER_LAST_GROUP: readonly Act[] = [
  act("Read the auth middleware again", "sed -n '30,60p' internal/http/middleware/auth.go"),
  act("Run the whole suite with the race detector", "go test ./... -race", 51),
  act("Run the burst test ten times", "go test ./internal/ratelimit/ -run Burst -count 10", 72),
];

// ---------------- Step 6: a long session ----------------

const LONG_POOL: readonly Act[] = [
  act("Read the metrics package", "sed -n '1,120p' internal/metrics/metrics.go"),
  act("Find where 429s are written", 'grep -rn "StatusTooManyRequests" internal/', 0.2),
  act("Read the Prometheus registry", "sed -n '1,60p' internal/metrics/registry.go"),
  act("Write the throttle counter", "cat > internal/metrics/throttle.go <<'EOF'", 0.1, {
    commandLines: 27,
  }),
  act("Count in the rate limit middleware", "python3 - <<'PY'", 0.2, { commandLines: 14 }),
  act("Run the metrics tests", "go test ./internal/metrics/... -race", 6.4),
  act("Run the middleware tests", "go test ./internal/http/middleware/... -race", 9.1),
  act("Run the linter", "golangci-lint run ./internal/...", 18),
  act("See what the step changed", "git diff --stat", 0.2),
  act("Read the plan label values", 'grep -n "Plan" internal/billing/plans.go'),
];

// longRows are count acts of the pool of the long session, from one of them on.
const longRows = (from: number, count: number) => earlier(count, LONG_POOL, from);

const LONG_IMPLEMENTER: Entry[] = [
  ...start("16:12", { stage: "step:6", step: 6 }, { text: "Implement step 6." }),
  ...group("16:12", 120, longRows(0, 18)),
  speech(
    "16:15",
    "The metrics package already registers a `requests_total` counter. I'll add `ratelimit_throttled_total` with a `plan` label, counted where the middleware writes the 429.",
  ),
  ...group("16:15", 180, longRows(3, 9)),
  speech("16:19", "Now let me check the label values against the plans table."),
  ...group("16:19", 840, [
    ...longRows(5, 18),
    act("Run the metrics tests", "go test ./internal/metrics/... -race", 6.1, {
      status: "error",
      exitCode: 1,
      out: lines(
        "--- FAIL: TestThrottledByPlan (0.00s)",
        '    throttle_test.go:31: plan label = "Pro plan", want "pro"',
        "FAIL",
      ),
      outLines: 12,
    }),
    act("Run the middleware tests", "go test ./internal/http/middleware/... -race", 9.3, {
      status: "error",
      exitCode: 1,
      out: lines("--- FAIL: TestLimitCounts (0.01s)", "FAIL"),
      outLines: 9,
    }),
    act("Run the metrics tests", "go test ./internal/metrics/... -race", 6.4),
    act("Run the middleware tests", "go test ./internal/http/middleware/... -race", 9.1),
  ]),
  speech(
    "16:34",
    "The tests pass. The `plan` label takes the plan's slug, never the key, so the series stay four.",
  ),
  you("16:35", "Keep the label values lowercase, like the other series."),
  ...group("16:35", 660, longRows(2, 14)),
  speech(
    "16:46",
    "Done. `ratelimit_throttled_total{plan}` counts every 429; the dashboard panel shows the rate per plan over 5 minutes.",
  ),
  ...group("16:46", 120, longRows(6, 8)),
  speech("16:48", "Tests and lint pass."),
  product(
    "16:55",
    "report",
    { appPass: 1, appRound: 1, appRounds: 3, appCount: 3 },
    lines(
      "#### Review 1 · changes",
      "",
      "1. The counter is registered twice in tests.",
      "2. The dashboard query sums across instances without `rate()`.",
      "3. No test for the internal scope, which must not count.",
    ),
  ),
  speech(
    "16:56",
    "Three findings. The first two are right; for the third, internal keys never reach the limiter, so they can't count. I'll add a test that proves it.",
  ),
  ...group("16:56", 540, longRows(1, 16)),
  speech("17:05", "Registered once through a `sync.Once`; the query now uses `rate()`."),
  marker("17:05", "retried", { attempts: 2, reason: "overloaded" }),
  ...group("17:06", 180, longRows(4, 10)),
  you("17:09", "Run the whole metrics suite, not only the new test."),
  ...group("17:09", 180, longRows(5, 9)),
  you("17:12", "Keep the dashboard panel in the same row as the latency one."),
  speech("17:13", "Moved it next to latency."),
  ...group("17:13", 300, longRows(7, 9)),
  speech("17:19", "All three findings addressed."),
  product(
    "17:26",
    "report",
    { appPass: 2, appRound: 2, appRounds: 3, appCount: 1 },
    lines(
      "#### Review 2 · changes",
      "",
      "1. `internal/metrics/throttle.go:18` · The `plan` label reads the plan at every 429; read it from the bucket, which already holds it.",
    ),
  ),
  speech(
    "17:26",
    "One finding. The bucket already carries the plan it was built from, so the middleware can pass `b.Plan` to the counter instead of asking the plan source again.",
  ),
  ...group("17:27", 360, longRows(8, 12)),
  marker("17:33", "compacted", { percent: 81, preTokens: 162_000 }),
  speech(
    "17:34",
    "Done. The counter takes the plan from the bucket; the lookup is gone from the hot path.",
  ),
  ...group("17:34", 240, longRows(5, 9)),
  you("17:38", "Also run the e2e burst test before you finish."),
  ...group("17:38", 125, [
    ...longRows(6, 9),
    act("Run the e2e burst test", "go test ./e2e/ -run TestBurstThenRefill", 31),
  ]),
  speech(
    "17:41",
    lines(
      "### Round 2",
      "",
      "The finding is addressed. The middleware passes the bucket's plan to the counter, so a 429 costs no lookup:",
      "",
      "```go",
      "b := h.limiter.For(key.ID, now)",
      "if !b.Allow(now) {",
      "\tmetrics.Throttled(b.Plan)",
      '\tw.Header().Set("Retry-After", strconv.Itoa(b.RetryAfter(now)))',
      "\twriteLimitHeaders(w, b, now)",
      "\tw.WriteHeader(http.StatusTooManyRequests)",
      "\treturn",
      "}",
      "writeLimitHeaders(w, b, now)",
      "next.ServeHTTP(w, r)",
      "```",
      "",
      "What I checked:",
      "",
      "- `ratelimit_throttled_total{plan}` takes the plan from the bucket;",
      "- `go test ./e2e/ -run TestBurstThenRefill` passes in 31 s;",
      "- the dashboard panel sits next to",
    ),
    { complete: false },
  ),
];

const LONG_REVIEWER: Entry[] = [
  product(
    "17:20",
    "pass",
    { appPass: 2 },
    "The implementer is done with your last report. Review step 6 again.",
  ),
  ...group("17:20", 300, longRows(2, 22)),
  speech("17:25", "Two of three fixed. The counter still asks the plan source on every 429."),
  marker("17:26", "step_review_written", { step: 6, pass: 2, clean: false, findings: 1 }),
];

// ---------------- The conversations of each scene ----------------

const PLANNING: Entry[] = [
  ...start("09:14", { stage: "prd" }, { text: CARD_CONTEXT }),
  ...group("09:14", 22, [
    act("Read the card context", "cat .myspec/rate-limit-per-api-key/context.md"),
    act("Find the gateway's global limiter", 'grep -rn "rate.NewLimiter" internal/', 0.3),
    act("Read the gateway middleware", "sed -n '1,120p' internal/http/middleware/gateway.go"),
    act("List the plan migrations", "ls migrations | grep -i plan"),
    act("Read the plans table", "sed -n '1,40p' migrations/0042_plans.sql"),
  ]),
  speech(
    "09:16",
    lines(
      "I read the card and the gateway. Today one `rate.Limiter` in `gateway.go` guards every request, and keys with the `internal` scope skip it.",
      "",
      "Should `internal` keys stay exempt under the new limit?",
    ),
  ),
  you("09:17", "yes"),
  speech("09:17", "Internal keys stay exempt."),
  makeEntry("question", {
    createdAt: clock("09:18"),
    question: {
      requestId: "req-throttled",
      toolUseId: "toolu_throttled",
      questions: [
        {
          question: "What should a throttled request get back?",
          header: "Throttled",
          options: [
            {
              label: "Retry-After only",
              description: "The minimum HTTP asks for; clients guess the remaining budget.",
            },
            {
              label: "Retry-After and the X-RateLimit-* headers",
              description:
                "Limit, remaining and reset on every response; clients can pace themselves.",
            },
          ],
          multiSelect: false,
        },
      ],
      answers: {
        "What should a throttled request get back?": "Retry-After and the X-RateLimit-* headers",
      },
      status: "allowed",
      answeredAt: clock("09:19"),
    },
  }),
  ...group("09:19", 9, [
    act("Read how contracts store limits", "sed -n '1,60p' internal/billing/contracts.go"),
    act("Find where plans are cached", 'grep -rn "PlanCache" internal/', 0.2),
    act("Read the plan cache", "sed -n '1,50p' internal/billing/plancache.go"),
  ]),
  you("09:21", "ok"),
  speech(
    "09:22",
    lines(
      "### What the PRD will say",
      "",
      "Each API key gets the limit of its plan, checked in the gateway right after the key is resolved:",
      "",
      "```mermaid",
      "flowchart LR",
      "  request[Request] --> auth[API key auth] --> bucket([Bucket of key])",
      "  bucket -- token --> handler[Handler]",
      "  bucket -- empty --> throttled[429 · Retry-After]",
      "```",
      "",
      "- Over the limit, the answer is 429 with `Retry-After` and the `X-RateLimit-Limit`, `-Remaining` and `-Reset` headers.",
      "- Keys with the `internal` scope are exempt.",
      "- A limit change takes effect within 60 seconds.",
      "",
      "| Plan | Requests per minute | Burst | Source |",
      "|---|--:|--:|---|",
      "| Free | 60 | 20 | `plans` row |",
      "| Pro | 600 | 100 | `plans` row |",
      "| Enterprise | from the contract | from the contract | `contracts.limits` |",
      "| Internal scope | exempt | exempt | key scope |",
      "",
      "### One thing left",
      "",
      "Where should the limits live?",
      "**a)** In the `plans` table, read and cached for 60 s, so a change needs no deploy.",
      "**b)** In `config/plans.yaml`, shipped with a release, reviewed like code.",
    ),
  ),
];

const RUNNING: Entry[] = [
  ...STEP_3_START,
  HAND_IMPLEMENTER_1,
  speech("14:19", "Two findings. I'll sweep idle buckets once a minute and add the refill test."),
  ...group("14:19", 200, [
    ...earlier(5, STEP_3_READS, 3),
    act("Read the finding's file", "sed -n '1,60p' internal/ratelimit/limiter.go"),
    {
      label: "Check how other packages evict idle entries",
      command: "",
      seconds: 48,
      out: lines(
        "Two packages sweep idle entries with a ticker:",
        "",
        "- `internal/session/cache.go:52` sweeps every minute and deletes entries idle for 10 minutes.",
        "- `internal/keys/cache.go:71` does the same with a `time.NewTicker` stopped on `Close`.",
        "",
        "Both hold the map lock only while they delete.",
      ),
      children: [
        ...earlier(9, [
          act("Read the session cache", "sed -n '1,40p' internal/session/cache.go"),
          act("Find the idle deadlines", 'grep -rn "idleFor" internal/', 0.2),
          act("Read the key cache", "sed -n '1,60p' internal/keys/cache.go"),
          act("Find the sweep intervals", 'grep -rn "sweepEvery" internal/', 0.2),
        ]),
        act("Find maps with a janitor", 'grep -rn "time.NewTicker" internal/', 0.2),
        act("Read the session cache's sweep", "sed -n '40,90p' internal/session/cache.go"),
        act("Read the key cache's sweep", "sed -n '60,110p' internal/keys/cache.go"),
      ],
    },
    act("Add the idle sweep", "python3 - <<'PY'", 0.2, { commandLines: 22 }),
    act("Add the refill test", "cat >> internal/ratelimit/bucket_test.go <<'EOF'", 0.1, {
      commandLines: 31,
    }),
    act("Format", "gofmt -w internal/ratelimit", 0.2),
    act(
      "Run the refill and eviction tests",
      "go test ./internal/ratelimit/... -race -run 'Evict|Refill'",
      0,
      { status: "running", at: "14:22:48" },
    ),
  ]),
];

const QUEUED = makeEntry("user", {
  createdAt: clock("14:22"),
  user: {
    ...USER,
    pending: true,
    text: "Also log the key id, never the key, when a bucket is evicted. Debug level is enough.",
  },
});

const ASK_REVIEWER: Entry[] = [
  ...STEP_3_REVIEW_1,
  REVIEWER_PASS_2,
  ...group("14:32", 300, [
    ...earlier(25, STEP_3_REVIEWER_READS, 1),
    act("See what changed since pass 1", "git diff HEAD --stat", 0.2),
    act("Read the sweep", "sed -n '30,70p' internal/ratelimit/limiter.go"),
    act("Read the refill test", "sed -n '80,140p' internal/ratelimit/bucket_test.go"),
    act("Run the whole suite with the race detector", "go test ./... -race", 51),
    act("Run the linter", "golangci-lint run ./...", 20),
    act("Read the auth middleware again", "sed -n '30,60p' internal/http/middleware/auth.go"),
  ]),
  speech(
    "14:38",
    lines(
      "Both findings are fixed. One case the spec doesn't settle: the middleware checks the limit **after** resolving the key.",
      "",
      GO_AUTH,
      "",
      "A flood of unknown keys never reaches the limiter, so every one of those requests pays the key lookup. I can't judge that trade-off alone.",
    ),
  ),
  makeEntry("question", {
    createdAt: clock("14:38"),
    question: {
      requestId: "req-unknown-key",
      toolUseId: "toolu_unknown_key",
      questions: [
        {
          question:
            "Should a request with an unknown API key be rate limited before the auth check?",
          header: "Unknown key",
          options: [
            {
              label: "Yes, by client IP with the anonymous plan",
              description: "Protects the key lookup from floods; adds a second bucket keyed by IP.",
            },
            {
              label: "No, reject it with 401 first",
              description: "Matches the spec literally; the lookup cache takes the load.",
            },
          ],
          multiSelect: false,
        },
      ],
      answers: null,
      status: "pending",
      answeredAt: "",
    },
  }),
];

const MIGRATION = "make migrate-local DATABASE_URL=postgres://localhost:5432/api_dev";

// The permission of the ask scene holds the last action of its group.
const HELD = "toolu_turn_1451_2";

const ASK_IMPLEMENTER: Entry[] = [
  ...STEP_3_START,
  ...STEP_3_ROUND_1_DONE,
  you(
    "14:50",
    "While the reviewer runs: apply the new migration to the local database so I can try it.",
  ),
  speech(
    "14:51",
    "I'll run the local migration target. It reads the dev database URL from `.env.local`.",
  ),
  ...group("14:51", 60, [
    act("Read the local env", "cat .env.local"),
    act("Dry-run the migration target", "make -n migrate-local", 0.4),
    act("Apply the migration to api_dev", MIGRATION, 0, { status: "running", at: "14:52" }),
  ]),
  makeEntry("permission", {
    createdAt: clock("14:52"),
    permission: {
      requestId: "req-migrate",
      toolUseId: HELD,
      tool: "Bash",
      displayName: "Bash",
      description: "Apply the migration to the local database api_dev.",
      input: JSON.stringify({ command: MIGRATION }),
      suggestions: "",
      blockedPath: "",
      decisionReason: "Not in the allowed commands of this session.",
      suppressAlwaysAllow: false,
      defaultToNo: false,
      status: "pending",
      denyMessage: "",
      answeredAt: "",
    },
  }),
];

const ERROR_REVIEWER: Entry[] = [
  ...STEP_3_REVIEW_1,
  REVIEWER_PASS_2,
  ...REVIEWER_ERROR_TAIL,
  ...group("14:36", 240, [
    ...REVIEWER_LAST_GROUP,
    act("Run the linter", "golangci-lint run ./...", 0, {
      status: "interrupted",
      interruptedBy: "crash",
    }),
  ]),
  makeEntry("error", {
    createdAt: clock("14:41"),
    error: {
      kind: "process_exit",
      message: "exit status 1 · claude --resume 7d1e…c04b",
      retryable: true,
    },
  }),
];

const RETRYING_REVIEWER: Entry[] = [
  ...STEP_3_REVIEW_1,
  REVIEWER_PASS_2,
  ...REVIEWER_ERROR_TAIL.slice(1),
  ...group("14:36", 180, REVIEWER_LAST_GROUP),
];

const REVIEW: Entry[] = [
  ...start(
    "17:41",
    { stage: "pr_review" },
    {
      text: "Review the pull request #1284.",
      sent: "Review pull request #1284 against the PRD, the tech spec and the plan. Read the failed checks first.",
    },
  ),
  marker("17:41", "checks_read", {
    pass: 1,
    passed: 4,
    total: 5,
    failed: ["e2e / rate-limit-burst"],
  }),
  ...group("17:41", 420, [
    ...earlier(29, [
      act("Read the PRD", "cat .myspec/rate-limit-per-api-key/PRD.md"),
      act("Read the tech spec", "cat .myspec/rate-limit-per-api-key/tech-spec.md"),
      act("Read the plan", "ls .myspec/rate-limit-per-api-key/steps"),
      act("Find the limiter's callers", 'grep -rn "limiter.For" internal/', 0.2),
      act("Read the checks", "gh pr checks 1284", 1.8),
      act("Run the rate limit tests", "go test ./internal/ratelimit/... -race", 8.3),
      act("Read the bucket", "cat internal/ratelimit/bucket.go"),
    ]),
    act("Read the diff against dev", "git diff origin/dev...HEAD", 0.4),
    act("Read the failed check's log", "gh run view 88213 --log-failed", 2.2, {
      out: lines(
        "e2e / rate-limit-burst\tRun tests\t--- FAIL: TestBurstThenRefill (1.02s)",
        "e2e / rate-limit-burst\tRun tests\t    ratelimit_test.go:44: 21 requests passed, want 20",
        "e2e / rate-limit-burst\tRun tests\tFAIL",
      ),
      outLines: 214,
    }),
    {
      label: "Find why e2e / rate-limit-burst failed",
      command: "",
      seconds: 120,
      out: lines(
        "The failure is real, not a flake: a new bucket starts with `last` at the zero time, so its first `Allow` adds years of refill, capped at the burst, and then spends one. The 21st request of a burst passes.",
        "",
        "Replayed locally five times; it fails every time.",
      ),
      children: [
        ...earlier(40, [
          act("Read the e2e test", "sed -n '1,90p' e2e/ratelimit_test.go"),
          act("Find the burst assertions", 'grep -n "want" e2e/ratelimit_test.go', 0.1),
          act("Read the check's run", "gh run view 88213 --json jobs", 1.9),
          act("Read how a new bucket starts", "sed -n '20,40p' internal/ratelimit/bucket.go"),
          act("Find the zero times", 'grep -rn "time.Time{}" internal/ratelimit', 0.2),
        ]),
        act("Read the e2e test", "sed -n '1,90p' e2e/ratelimit_test.go"),
        act("Count requests the test lets through", 'grep -n "want 20" e2e/ratelimit_test.go'),
        act("Read how a new bucket starts", "sed -n '20,40p' internal/ratelimit/bucket.go"),
        act("Replay the burst locally", "go test ./e2e/ -run TestBurstThenRefill -count 5", 34),
      ],
    },
    act(
      "Check the docs against the config",
      "diff <(grep -A3 Pro docs/rate-limits.md) config/plans.yaml",
    ),
    act("Look for a burst migration", "ls migrations/ | tail -5"),
  ]),
  speech(
    "17:49",
    lines(
      "The pull request does what the PRD asks. Four findings, one of them the failed check: the e2e failure is a real off-by-one in the bucket, not a flake. A new bucket refills from the zero time on its first read:",
      "",
      "```go",
      "b = &Bucket{burst: plan.Burst, rate: plan.RefillPerSecond, tokens: plan.Burst}",
      "// last is the zero time: the first Allow adds years of refill,",
      "// capped at burst, then spends one. The 21st request passes.",
      "```",
    ),
  ),
  marker("17:50", "pr_review_written", { pass: 1, clean: false }),
];

// ---------------- The task of each scene ----------------

/** SHELL is the scene of the task screen each conversation scene stands in, as the mock takes it. */
const SHELL: Record<ConversationSceneName, SceneName> = {
  planning: "plan",
  running: "run",
  ask: "ask",
  long: "run",
  error: "error",
  retrying: "error",
  review: "findings",
};

// WAITS are how long each situation of a scene has waited, in minutes, as the chips of the mock say.
const WAITS: Partial<Record<ConversationSceneName, Record<string, number>>> = {
  planning: { reply: 2 },
  ask: { question: 18, permission: 4 },
  error: { session_error: 5 },
  review: { findings: 12 },
};

// minutesBefore is an instant some minutes before the moment of a scene.
function minutesBefore(name: ConversationSceneName, minutes: number): string {
  return later(CONVERSATION_NOW[name], -minutes * 60);
}

// waited dates the situations of a scene from its moment, each by how long it has waited.
function waited(name: ConversationSceneName, situations: readonly Situation[]): Situation[] {
  return situations.map((situation) => ({
    ...situation,
    startedAt: minutesBefore(name, WAITS[name]?.[situation.kind] ?? 0),
  }));
}

// withReports gives the current step the reports of its agent review up to a pass.
function withReports(task: TaskSummary, reports: Step["reports"]): TaskSummary {
  return {
    ...task,
    steps: (task.steps ?? []).map((step) =>
      step.number === task.currentStep ? { ...step, reports } : step,
    ),
  };
}

const REPORT_3 = [{ pass: 1, file: "3-review-1.md", clean: false, findings: 2 }];

// taskOf is the reference task at the moment of a scene.
function taskOf(name: ConversationSceneName): TaskSummary {
  const shell = sceneTask(SHELL[name]).state.tasks?.[0];
  if (shell === undefined) {
    throw new Error("the scene has no task");
  }
  const task = { ...shell, situations: waited(name, shell.situations ?? []) };
  switch (name) {
    case "planning":
    case "review":
      return task;
    case "running":
      return withReports(
        { ...task, turnStartedAt: later(CONVERSATION_NOW.running, -220) },
        REPORT_3,
      );
    case "ask":
    case "error":
      return withReports(task, REPORT_3);
    case "retrying":
      return withReports(
        inStep(
          3,
          {
            status: "agent_review",
            reviewPass: 2,
            reviewer: makeStepReviewer({
              sessionStage: "step_review:3",
              sessionStatus: "working",
              turnRunning: true,
              processRunning: true,
              turnStartedAt: minutesBefore(name, 9),
              retryAttempt: 3,
              retryMax: 10,
              retryAt: later(CONVERSATION_NOW.retrying, 8),
              retryReason: "overloaded",
              contextPercent: 41,
            }),
          },
          { contextPercent: 31 },
          false,
        ),
        REPORT_3,
      );
    case "long":
      return inStep(
        6,
        {
          status: "addressing_review",
          reviewRound: 2,
          reviewPass: 2,
          reports: [
            { pass: 1, file: "6-review-1.md", clean: false, findings: 3 },
            { pass: 2, file: "6-review-2.md", clean: false, findings: 1 },
          ],
          reviewer: makeStepReviewer({ sessionStage: "step_review:6", contextPercent: 47 }),
        },
        {
          sessionStatus: "working",
          turnRunning: true,
          processRunning: true,
          turnStartedAt: later(CONVERSATION_NOW.long, -125),
          contextPercent: 23,
        },
        false,
      );
  }
}

// transcript is a conversation of the reference task, already read.
function transcript(stage: string, entries: Entry[], pending: Entry[] = []): Transcript {
  return makeTranscript({ taskId: TASK_ID, stage, entries, pending });
}

// conversationsOf are the conversations of a scene, the one on screen and the other of its step.
function conversationsOf(name: ConversationSceneName): Transcript[] {
  switch (name) {
    case "planning":
      return [transcript("prd", PLANNING)];
    case "running":
      return [
        transcript("step:3", RUNNING, [QUEUED]),
        transcript("step_review:3", STEP_3_REVIEW_1),
      ];
    case "ask":
      return [transcript("step:3", ASK_IMPLEMENTER), transcript("step_review:3", ASK_REVIEWER)];
    case "long":
      return [transcript("step:6", LONG_IMPLEMENTER), transcript("step_review:6", LONG_REVIEWER)];
    case "error":
      return [
        transcript("step:3", [...STEP_3_START, ...STEP_3_ROUND_1_DONE]),
        transcript("step_review:3", ERROR_REVIEWER),
      ];
    case "retrying":
      return [
        transcript("step:3", [...STEP_3_START, ...STEP_3_ROUND_1_DONE]),
        transcript("step_review:3", RETRYING_REVIEWER),
      ];
    case "review":
      return [transcript("pr_review", REVIEW)];
  }
}

// The reviewer is on screen where it asks, failed or retries; the implementer everywhere else.
const REVIEWER_SCENES: readonly ConversationSceneName[] = ["ask", "error", "retrying"];

/**
 * conversationScene is a scene of the conversation mock on the reference task; voice "impl" puts the
 * implementer's tab on screen, as ?voice=impl does in the mock.
 */
export function conversationScene(
  name: ConversationSceneName,
  { voice }: { voice?: "impl" } = {},
): Scene {
  const tab = REVIEWER_SCENES.includes(name) && voice !== "impl" ? "reviewer" : "implementer";
  return sceneOf(taskOf(name), conversationsOf(name), tab);
}
