import { describe, expect, it } from "vitest";
import {
  type ActionCategory,
  actionLabel,
  actionRight,
  categoryOf,
  executableOf,
  failureNotes,
  formatDuration,
  summaryOf,
} from "@/features/chat/actions";
import type { ActionEntry } from "@/lib/wails";
import { makeAction } from "@/test/wails-mock";

const bash = (target: string, rest: Partial<ActionEntry> = {}) =>
  makeAction({ tool: "Bash", label: "Running", target, ...rest });

const STARTED = "2026-09-28T13:48:00Z";
const at = (seconds: number) => new Date(Date.parse(STARTED) + seconds * 1000).toISOString();

describe("executableOf", () => {
  it.each([
    ["go test ./...", "go test ./..."],
    ["cd internal && go test ./...", "go test ./..."],
    ['cd "my dir" && ls', "ls"],
    ["CGO_ENABLED=0 go build ./cmd", "go build ./cmd"],
    ["sudo apt install jq", "apt install jq"],
    ["time go test ./...", "go test ./..."],
    ["timeout 30s go test ./...", "go test ./..."],
    ["cd web && CI=1 timeout 60 time pnpm test", "pnpm test"],
    ["git log --oneline | head -5", "git log --oneline"],
    ["  grep   -rn  foo   src ", "grep -rn foo src"],
    ["", ""],
  ])("reads %j as %j", (command, expected) => {
    expect(executableOf(command)).toBe(expected);
  });
});

describe("categoryOf", () => {
  it.each<[string, string, ActionCategory]>([
    ["Read", "src/main.tsx", "Read"],
    ["Grep", "RateLimit", "Searched"],
    ["Glob", "**/*.go", "Searched"],
    ["Write", "bucket.go", "Wrote"],
    ["Edit", "bucket.go", "Wrote"],
    ["MultiEdit", "bucket.go", "Wrote"],
    ["NotebookEdit", "analysis.ipynb", "Wrote"],
    ["WebFetch", "https://go.dev", "Web"],
    ["WebSearch", "token bucket", "Web"],
    ["Agent", "general-purpose", "Delegated"],
    ["Task", "general-purpose", "Delegated"],
    ["Skill", "pdf", "Other"],
    ["mcp__github__get_issue", "github · get_issue", "Other"],
    ["TodoWrite", "", "Other"],
    ["TaskCreate", "", "Other"],
    ["TaskUpdate", "", "Other"],
    ["LS", "src", "Other"],
  ])("puts a %s call in %s", (tool, target, expected) => {
    expect(categoryOf(makeAction({ tool, target }))).toBe(expected);
  });

  it.each<[string, ActionCategory]>([
    ["cat .myspec/rate-limit-per-api-key/steps/03-token-bucket.md", "Read"],
    ["sed -n '1,80p' internal/ratelimit/config.go", "Read"],
    ["ls migrations/ | tail -5", "Read"],
    ["wc -l internal/ratelimit/*.go", "Read"],
    ["jq .name package.json", "Read"],
    ['grep -rn "X-API-Key" internal/http', "Searched"],
    ["rg --files", "Searched"],
    ["find . -name '*.go'", "Searched"],
    ["cat > internal/ratelimit/bucket.go <<'EOF'", "Wrote"],
    ["cat >> internal/ratelimit/bucket_test.go <<'EOF'", "Wrote"],
    ["python3 - <<'PY'", "Wrote"],
    ["python3 <<'PY'", "Wrote"],
    ["sed -i 's/tokens: 0/tokens: burst/' internal/ratelimit/limiter.go", "Wrote"],
    ["perl -pi -e 's/a/b/' go.mod", "Wrote"],
    ["rm -rf dist", "Wrote"],
    ["mkdir -p internal/ratelimit", "Wrote"],
    ["go test ./internal/ratelimit/... -race", "Tests"],
    ["cd frontend && npm run test", "Tests"],
    ["npm test", "Tests"],
    ["pnpm test", "Tests"],
    ["cargo test", "Tests"],
    ["vitest run src/features", "Tests"],
    ["pytest -q", "Tests"],
    ["task test", "Tests"],
    ["task test:web", "Tests"],
    ["make test", "Tests"],
    ["golangci-lint run ./...", "Lint"],
    ["go vet ./...", "Lint"],
    ["npm run lint", "Lint"],
    ["task lint", "Lint"],
    ["tsc --noEmit", "Lint"],
    ["gofmt -l .", "Lint"],
    ["go build ./...", "Build"],
    ["npm run build", "Build"],
    ["make", "Build"],
    ["make -n migrate", "Build"],
    ["task check", "Build"],
    ["git log --oneline -3 && git diff HEAD~2 --stat", "git"],
    ["gh run view 88213 --log-failed", "GitHub"],
    ["curl -s https://api.github.com", "Web"],
    ["wget https://go.dev/dl", "Web"],
    ["python3 -c 'print(1)'", "Ran"],
    ["diff <(grep -A3 Pro docs/rate-limits.md) config/plans.yaml", "Ran"],
    ["echo done", "Ran"],
    ["./scripts/seed.sh", "Ran"],
  ])("puts the command %j in %s", (command, expected) => {
    expect(categoryOf(bash(command))).toBe(expected);
  });

  it("reads the first line an old transcript kept, cut at 120 characters", () => {
    const cut = `go test ./internal/ratelimit/... -race -run '${"Burst".repeat(20)}`.slice(0, 120);
    expect(categoryOf(bash(`${cut}…`))).toBe("Tests");
  });
});

describe("actionLabel", () => {
  it.each<[string, Partial<ActionEntry>, ReturnType<typeof actionLabel>]>([
    [
      "a command with its description",
      {
        tool: "Bash",
        target: "go test ./internal/ratelimit/... -race",
        description: "Run the rate limit tests",
        commandLines: 1,
      },
      {
        label: "Run the rate limit tests",
        command: "go test ./internal/ratelimit/... -race",
        mono: false,
        tooltip: "go test ./internal/ratelimit/... -race",
      },
    ],
    [
      "a command of several lines",
      {
        tool: "Bash",
        target: "cat > internal/ratelimit/bucket.go <<'EOF'",
        description: "Write the bucket",
        commandLines: 48,
      },
      {
        label: "Write the bucket",
        command: "cat > internal/ratelimit/bucket.go <<'EOF'",
        mono: false,
        tooltip: "cat > internal/ratelimit/bucket.go <<'EOF' · 48 lines",
      },
    ],
    [
      "a command without a description, as in an old transcript",
      { tool: "Bash", target: "git status --short" },
      { label: "git status --short", command: "", mono: true, tooltip: "git status --short" },
    ],
    [
      "a read",
      { tool: "Read", target: "internal/ratelimit/bucket.go" },
      {
        label: "Read",
        command: "internal/ratelimit/bucket.go",
        mono: false,
        tooltip: "internal/ratelimit/bucket.go",
      },
    ],
    [
      "a write",
      { tool: "Write", target: "a.go" },
      { label: "Write", command: "a.go", mono: false, tooltip: "a.go" },
    ],
    [
      "an edit",
      { tool: "MultiEdit", target: "a.go" },
      { label: "Edit", command: "a.go", mono: false, tooltip: "a.go" },
    ],
    [
      "a notebook edit",
      { tool: "NotebookEdit", target: "a.ipynb" },
      { label: "Edit", command: "a.ipynb", mono: false, tooltip: "a.ipynb" },
    ],
    [
      "a search",
      { tool: "Grep", target: "RateLimit" },
      { label: "Search", command: "RateLimit", mono: false, tooltip: "RateLimit" },
    ],
    [
      "a search for files",
      { tool: "Glob", target: "**/*.go" },
      { label: "Find files", command: "**/*.go", mono: false, tooltip: "**/*.go" },
    ],
    [
      "a fetch",
      { tool: "WebFetch", target: "https://go.dev" },
      { label: "Fetch", command: "https://go.dev", mono: false, tooltip: "https://go.dev" },
    ],
    [
      "a search of the web",
      { tool: "WebSearch", target: "token bucket" },
      { label: "Search the web", command: "token bucket", mono: false, tooltip: "token bucket" },
    ],
    [
      "a skill",
      { tool: "Skill", target: "pdf" },
      { label: "Use skill", command: "pdf", mono: false, tooltip: "pdf" },
    ],
    [
      "a tool of an MCP server",
      { tool: "mcp__github__get_issue", target: "github · get_issue" },
      {
        label: "Call",
        command: "github · get_issue",
        mono: false,
        tooltip: "github · get_issue",
      },
    ],
    [
      "the task list",
      { tool: "TodoWrite", target: "" },
      { label: "Update the task list", command: "", mono: false, tooltip: "" },
    ],
    [
      "a task of the task list",
      { tool: "TaskUpdate", target: "" },
      { label: "Update the task list", command: "", mono: false, tooltip: "" },
    ],
    [
      "a tool the app does not know",
      { tool: "LS", target: "src" },
      { label: "LS", command: "src", mono: false, tooltip: "src" },
    ],
    [
      "a subagent with its description",
      { tool: "Agent", target: "general-purpose", description: "Find why e2e failed" },
      { label: "Delegated · Find why e2e failed", command: "", mono: false, tooltip: "" },
    ],
    [
      "a subagent without a description",
      { tool: "Agent", target: "general-purpose" },
      { label: "Delegated · general-purpose", command: "", mono: false, tooltip: "" },
    ],
    [
      "a subagent without either",
      { tool: "Task", target: "" },
      { label: "Delegated", command: "", mono: false, tooltip: "" },
    ],
  ])("labels %s", (_, action, expected) => {
    expect(actionLabel(makeAction(action))).toEqual(expected);
  });
});

describe("summaryOf", () => {
  const of = (counts: [string, number][]) =>
    counts.flatMap(([command, count]) => Array.from({ length: count }, () => bash(command)));

  it.each<[string, ActionEntry[], string]>([
    ["nothing", [], ""],
    [
      "the categories, the most frequent first",
      of([
        ["git status", 2],
        ["cat a.go", 8],
        ["grep -rn x .", 4],
      ]),
      "Read 8 · Searched 4 · git 2",
    ],
    [
      "equal counts in the order of the table",
      of([
        ["git status", 2],
        ["go test ./...", 2],
        ["cat a.go", 2],
      ]),
      "Read 2 · Tests 2 · git 2",
    ],
    [
      "at most five categories",
      of([
        ["go build ./...", 1],
        ["cat a.go", 3],
        ["grep -rn x .", 3],
        ["rm a", 2],
        ["go test ./...", 2],
        ["go vet ./...", 1],
      ]),
      "Read 3 · Searched 3 · Wrote 2 · Tests 2 · Lint 1",
    ],
    [
      "a subagent as one delegation, and the tools by name",
      [
        makeAction({ tool: "Agent" }),
        makeAction({ tool: "Read" }),
        makeAction({ tool: "Edit" }),
        makeAction({ tool: "TodoWrite" }),
      ],
      "Read 1 · Wrote 1 · Delegated 1 · Other 1",
    ],
  ])("summarises %s", (_, actions, expected) => {
    expect(summaryOf(actions)).toBe(expected);
  });
});

describe("failureNotes", () => {
  const tests = "go test ./...";
  it.each<[string, ActionEntry[], string | null, ReturnType<typeof failureNotes>]>([
    ["a group that went well", [bash(tests), bash("cat a.go")], null, []],
    [
      "a failure nothing passed after",
      [bash(tests, { status: "error" }), bash("cat a.go")],
      null,
      [{ text: "1 failed", tone: "error" }],
    ],
    [
      "a failure the same command passed after",
      [bash(tests, { status: "error" }), bash("sed -i s/a/b/ a.go"), bash(tests)],
      null,
      [{ text: "1 failed, then passed", tone: "meta" }],
    ],
    [
      "a failure that failed again",
      [bash(tests, { status: "error" }), bash(tests, { status: "error" })],
      null,
      [{ text: "2 failed", tone: "error" }],
    ],
    [
      "a failure that passed and one that did not",
      [bash(tests, { status: "error" }), bash(tests), bash("go vet ./...", { status: "error" })],
      null,
      [
        { text: "1 failed", tone: "error" },
        { text: "1 failed, then passed", tone: "meta" },
      ],
    ],
    [
      "a command stopped",
      [bash("golangci-lint run ./...", { status: "interrupted", interruptedBy: "user" })],
      null,
      [{ text: "1 stopped", tone: "meta" }],
    ],
    [
      "a command that waits for the permission",
      [bash(tests), bash("rm -rf dist", { toolUseId: "toolu_9", status: "running" })],
      "toolu_9",
      [{ text: "1 waits for your permission", tone: "meta" }],
    ],
    [
      "a permission of another group",
      [bash("rm -rf dist", { toolUseId: "toolu_9", status: "running" })],
      "toolu_1",
      [],
    ],
  ])("notes %s", (_, actions, waiting, expected) => {
    expect(failureNotes(actions, waiting)).toEqual(expected);
  });
});

describe("formatDuration", () => {
  it.each([
    [0, "0.0s"],
    [100, "0.1s"],
    [8_200, "8.2s"],
    [9_960, "9.9s"],
    [10_000, "10s"],
    [12_400, "12s"],
    [59_999, "59s"],
    [60_000, "1m 0s"],
    [112_000, "1m 52s"],
    [3_780_000, "1h 3m"],
  ])("writes %i ms as %s", (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected);
  });
});

describe("actionRight", () => {
  const now = Date.parse(at(12));
  it.each<[string, Partial<ActionEntry>, boolean, ReturnType<typeof actionRight>]>([
    [
      "the duration of a command done",
      { status: "done", startedAt: STARTED, finishedAt: at(8) },
      false,
      { text: "8.0s", tone: "meta" },
    ],
    ["nothing for a command done in an old transcript", { status: "done" }, false, null],
    [
      "the exit code and the duration of a failure",
      { status: "error", startedAt: STARTED, finishedAt: at(8), exitCode: 1 },
      false,
      { text: "exit 1 · 8.0s", tone: "error" },
    ],
    [
      "failed without the exit code",
      { status: "error", startedAt: STARTED, finishedAt: at(75) },
      false,
      { text: "failed · 1m 15s", tone: "error" },
    ],
    [
      "failed for a failure in an old transcript",
      { status: "error" },
      false,
      { text: "failed", tone: "error" },
    ],
    [
      "the time since a running command started",
      { status: "running", startedAt: STARTED },
      false,
      { text: "12s", tone: "live" },
    ],
    ["nothing for a running command not yet started", { status: "running" }, false, null],
    [
      "the wait of a command for the permission",
      { status: "running", startedAt: STARTED },
      true,
      { text: "waits for your permission", tone: "wait" },
    ],
    [
      "stopped for a command you stopped",
      { status: "interrupted", interruptedBy: "user" },
      false,
      { text: "stopped", tone: "meta" },
    ],
    [
      "stopped with the session for a command a crash stopped",
      { status: "interrupted", interruptedBy: "crash" },
      false,
      { text: "stopped with the session", tone: "meta" },
    ],
    [
      "stopped for a command stopped in an old transcript",
      { status: "interrupted" },
      false,
      { text: "stopped", tone: "meta" },
    ],
  ])("shows %s", (_, action, waiting, expected) => {
    expect(actionRight(bash("go test ./...", action), waiting, now)).toEqual(expected);
  });
});

// The commands of the scenes of the mock (lab/16-conversation-wide/src/conv-data.js), each labelled
// by the description the agent wrote and counted in the category of its command.
describe("the commands of the scenes", () => {
  it.each<[string, string, ActionCategory]>([
    ["Read the card context", "cat .myspec/rate-limit-per-api-key/context.md", "Read"],
    ["Find the gateway's global limiter", 'grep -rn "rate.NewLimiter" internal/', "Searched"],
    ["Read the gateway middleware", "sed -n '1,120p' internal/http/middleware/gateway.go", "Read"],
    ["List the plan migrations", "ls migrations | grep -i plan", "Read"],
    ["See what steps 1 and 2 changed", "git log --oneline -3 && git diff HEAD~2 --stat", "git"],
    ["Write the bucket", "cat > internal/ratelimit/bucket.go <<'EOF'", "Wrote"],
    ["Add the refill test", "cat >> internal/ratelimit/bucket_test.go <<'EOF'", "Wrote"],
    ["Wire the limiter into the auth middleware", "python3 - <<'PY'", "Wrote"],
    ["Run the rate limit tests", "go test ./internal/ratelimit/... -race", "Tests"],
    [
      "Start a new bucket full",
      "sed -i 's/tokens: 0/tokens: burst/' internal/ratelimit/limiter.go",
      "Wrote",
    ],
    ["Run the linter", "golangci-lint run ./...", "Lint"],
    ["Format", "gofmt -w internal/ratelimit", "Lint"],
    ["Look for eviction of idle keys", 'grep -n "delete(" internal/ratelimit/*.go', "Searched"],
    ["See what the step changed", "git diff --stat && git status --short", "git"],
    [
      "Apply the migration",
      "make migrate-local DATABASE_URL=postgres://localhost:5432/api_dev",
      "Build",
    ],
  ])(
    "labels “%s” by its description and counts it by its command",
    (description, command, category) => {
      const action = bash(command, { description });

      expect(actionLabel(action)).toMatchObject({ label: description, command, mono: false });
      expect(categoryOf(action)).toBe(category);
    },
  );
});
