/* =====================================================================
   ROUND 15 · the entries of the conversation, as data. The three
   variations render the same entries; only the treatment differs.
   Volumes follow research/conversation.md §4: an implementer has a
   median of 33 actions in 8 groups and 9 short speeches (p90 69 and 16);
   Bash is ~90% of the actions and each is labelled by the description the
   agent wrote; product messages are long (a report to the implementer has
   a median of 5.6k characters); planning answers are short ("ok", "yes").

   Entry kinds
   agent    { who, at, html, streaming, interrupted }
   user     { at, text, queued, fromQueue }
   acts     { at, n, roll, dur, fail, live, open, earlier, rows }
            row: [description, command, status, note, sub]; status "agent" is a subagent
   mark     { at, icon, text, n, kind, body, foot }   kind: event, product, decision, retry, compact, report
   question { at, q, opts, answered, answer }
   permission { at, tool, desc, cmd, foot }
   error    { at, text, detail }
   activity { at, text }
   findings { }
   fold     { title, n, at, to, speeches, actions, entries }   a stretch of the past, folded in `long`
   ===================================================================== */
const SPRITE_15 = `<svg class="sprite" aria-hidden="true">
  <symbol id="i-retry" viewBox="0 0 16 16"><path d="M3.5 8a4.5 4.5 0 1 0 1.4-3.3M3.5 3v2.5H6"/></symbol>
  <symbol id="i-expand" viewBox="0 0 16 16"><path d="M5 6.5 8 3.5l3 3M5 9.5l3 3 3-3"/></symbol>
  <symbol id="i-full" viewBox="0 0 16 16"><path d="M3 6V3h3M10 3h3v3M13 10v3h-3M6 13H3v-3"/></symbol>
  <symbol id="i-dot" viewBox="0 0 16 16"><circle cx="8" cy="8" r="2"/></symbol>
</svg>`;

// ---------------- Shared content ----------------
const GO_LIMITER = `<div class="code">${codeHead("go", "internal/ratelimit/limiter.go")}<pre><span class="kw">package</span> ratelimit

<span class="kw">import</span> (
	<span class="str">"sync"</span>
	<span class="str">"time"</span>
)

<span class="com">// Limiter keeps one bucket per API key, created on first use.</span>
<span class="kw">type</span> Limiter <span class="kw">struct</span> {
	mu      sync.RWMutex
	buckets <span class="kw">map</span>[<span class="kw">string</span>]*Bucket
	plans   PlanSource
}

<span class="com">// For returns the bucket of a key, creating it full from the key's plan.</span>
<span class="kw">func</span> (l *Limiter) <span class="fn">For</span>(keyID <span class="kw">string</span>, now time.Time) *Bucket {
	l.mu.<span class="fn">RLock</span>()
	b, ok := l.buckets[keyID]
	l.mu.<span class="fn">RUnlock</span>()
	<span class="kw">if</span> ok {
		<span class="kw">return</span> b
	}
	plan := l.plans.<span class="fn">PlanFor</span>(keyID)
	l.mu.<span class="fn">Lock</span>()
	<span class="kw">defer</span> l.mu.<span class="fn">Unlock</span>()
	<span class="kw">if</span> b, ok = l.buckets[keyID]; ok {
		<span class="kw">return</span> b
	}
	b = &amp;Bucket{burst: plan.Burst, rate: plan.RefillPerSecond, tokens: plan.Burst, last: now}
	l.buckets[keyID] = b
	<span class="kw">return</span> b
}

<span class="com">// Allow takes one token if there is one, refilling first from the time elapsed.</span>
<span class="kw">func</span> (b *Bucket) <span class="fn">Allow</span>(now time.Time) <span class="kw">bool</span> {
	b.mu.<span class="fn">Lock</span>()
	<span class="kw">defer</span> b.mu.<span class="fn">Unlock</span>()
	elapsed := now.<span class="fn">Sub</span>(b.last).<span class="fn">Seconds</span>()
	b.tokens = <span class="fn">min</span>(<span class="fn">float64</span>(b.burst), b.tokens+elapsed*b.rate)
	b.last = now
	<span class="kw">if</span> b.tokens &lt; <span class="num">1</span> {
		<span class="kw">return</span> <span class="kw">false</span>
	}
	b.tokens--
	<span class="kw">return</span> <span class="kw">true</span>
}</pre></div>`;

// A mermaid diagram as the app renders it: the figure, the language and a full screen button.
const MERMAID = `<figure class="mmd"><div class="ch">${I("code")}<span>mermaid</span><span class="grow"></span><button class="btn ghost xs icon" data-tip="Full screen · zoom and pan" aria-label="Open the diagram full screen">${I("full")}</button></div>
<svg viewBox="0 0 640 132" role="img" aria-label="Flow: a request goes through auth, then the limiter; an empty bucket answers 429 with Retry-After, otherwise the handler runs.">
  <g class="mmd-e"><path d="M112 42H150"/><path d="M262 42H300"/><path d="M412 42H450"/><path d="M356 60V88"/></g>
  <g class="mmd-a"><path d="M144 38l6 4-6 4"/><path d="M294 38l6 4-6 4"/><path d="M444 38l6 4-6 4"/><path d="M352 82l4 6 4-6"/></g>
  <g class="mmd-n"><rect x="12" y="24" width="100" height="36" rx="6"/><rect x="150" y="24" width="112" height="36" rx="6"/><rect x="300" y="24" width="112" height="36" rx="18"/><rect x="450" y="24" width="112" height="36" rx="6"/><rect x="276" y="88" width="160" height="36" rx="6"/></g>
  <g class="mmd-t"><text x="62" y="46">Request</text><text x="206" y="46">API key auth</text><text x="356" y="46">Bucket of key</text><text x="506" y="46">Handler</text><text x="356" y="110">429 · Retry-After</text></g>
  <g class="mmd-l"><text x="431" y="36">token</text><text x="382" y="78" class="lft">empty</text></g>
</svg></figure>`;

const PLAN_TABLE = `<div class="tbl"><table><thead><tr><th>Plan</th><th class="r">Requests per minute</th><th class="r">Burst</th><th>Source</th></tr></thead><tbody>
<tr><td>Free</td><td class="r">60</td><td class="r">20</td><td><code>plans</code> row</td></tr>
<tr><td>Pro</td><td class="r">600</td><td class="r">100</td><td><code>plans</code> row</td></tr>
<tr><td>Enterprise</td><td class="r">from the contract</td><td class="r">from the contract</td><td><code>contracts.limits</code></td></tr>
<tr><td>Internal scope</td><td class="r">exempt</td><td class="r">exempt</td><td>key scope</td></tr></tbody></table></div>`;

const REVIEW1_MSG = `<h4>Review 1 · changes</h4><p>The agent review of this step found changes. Address each finding, fixing it or saying why you disagree. Don't commit.</p><ol><li><code>internal/ratelimit/limiter.go:22</code> · The map of buckets grows with every key ever seen. Evict buckets idle for more than 10 minutes.</li><li><code>internal/ratelimit/bucket_test.go</code> · No test covers the refill after the burst is spent.</li></ol><p><strong>Checks run.</strong> <code>go test ./... -race</code> passed · <code>golangci-lint run</code> passed.</p><p class="faint">5,612 characters · the whole report as the implementer received it</p>`;

// ---------------- Action rows, by the description the agent wrote ----------------
const R = (label, cmd, s = "done", note = "") => [label, cmd, s, note];

// ---------------- The scenes ----------------
const CONV = {};

// Planning · the PRD agent asks one question at a time, mostly in text; you answer short.
CONV.planning = { impl: [
  { t: "mark", at: "09:14", icon: "play", text: "PRD started", n: "with the card acme/api#412", kind: "event", body: CARD_CTX },
  { t: "acts", at: "09:14", n: 5, roll: "Read 3 · Searched 2", dur: "22 s", rows: [R("Read the card context", "cat .myspec/rate-limit-per-api-key/context.md", "done", "0.1 s"), R("Find the gateway's global limiter", "grep -rn \"rate.NewLimiter\" internal/", "done", "0.3 s"), R("Read the gateway middleware", "sed -n '1,120p' internal/http/middleware/gateway.go", "done", "0.1 s"), R("List the plan migrations", "ls migrations | grep -i plan", "done", "0.1 s"), R("Read the plans table", "sed -n '1,40p' migrations/0042_plans.sql", "done", "0.1 s")] },
  { t: "agent", who: "agent", at: "09:16", html: `<p>I read the card and the gateway. Today one <code>rate.Limiter</code> in <code>gateway.go</code> guards every request, and keys with the <code>internal</code> scope skip it.</p><p class="ask-p done">Should <code>internal</code> keys stay exempt under the new limit?</p>` },
  { t: "user", at: "09:17", text: "yes" },
  { t: "agent", who: "agent", at: "09:17", html: `<p>Internal keys stay exempt.</p>` },
  { t: "question", at: "09:18", answered: true, answeredAt: "09:19", q: "What should a throttled request get back?", answer: "Retry-After and the X-RateLimit-* headers",
    opts: [["Retry-After only", "The minimum HTTP asks for; clients guess the remaining budget."], ["Retry-After and the X-RateLimit-* headers", "Limit, remaining and reset on every response; clients can pace themselves."]] },
  { t: "acts", at: "09:19", n: 3, roll: "Read 2 · Searched 1", dur: "9 s", rows: [R("Read how contracts store limits", "sed -n '1,60p' internal/billing/contracts.go", "done", "0.1 s"), R("Find where plans are cached", "grep -rn \"PlanCache\" internal/", "done", "0.2 s"), R("Read the plan cache", "sed -n '1,50p' internal/billing/plancache.go", "done", "0.1 s")] },
  { t: "user", at: "09:21", text: "ok" },
  { t: "agent", who: "agent", at: "09:22", html: `<h3>What the PRD will say</h3><p>Each API key gets the limit of its plan, checked in the gateway right after the key is resolved:</p>${MERMAID}<ul><li>Over the limit, the answer is 429 with <code>Retry-After</code> and the <code>X-RateLimit-Limit</code>, <code>-Remaining</code> and <code>-Reset</code> headers.</li><li>Keys with the <code>internal</code> scope are exempt.</li><li>A limit change takes effect within 60 seconds.</li></ul>${PLAN_TABLE}<h3>One thing left</h3><p class="ask-p">Where should the limits live? <strong>a)</strong> In the <code>plans</code> table, read and cached for 60 s, so a change needs no deploy. <strong>b)</strong> In <code>config/plans.yaml</code>, shipped with a release, reviewed like code.</p>` },
] };

// Running · the implementer of step 3, round 1, one group open with the action in flight.
const STEP3_START = [
  { t: "mark", at: "13:48", icon: "play", text: "Started with", n: "steps/03-token-bucket.md", kind: "event", body: STEPFILE3 },
  { t: "acts", at: "13:48", n: 14, roll: "Read 8 · Searched 4 · git 2", dur: "1 min 50 s", earlier: 8, rows: [R("Read the step file", "cat .myspec/rate-limit-per-api-key/steps/03-token-bucket.md", "done", "0.1 s"), R("Read the rate limit config from step 1", "sed -n '1,80p' internal/ratelimit/config.go", "done", "0.1 s"), R("Find the API key middleware", "grep -rn \"X-API-Key\" internal/http", "done", "0.2 s"), R("Read the auth middleware", "sed -n '20,90p' internal/http/middleware/auth.go", "done", "0.1 s"), R("Read the key cache of step 2", "sed -n '1,60p' internal/keys/cache.go", "done", "0.1 s"), R("See what steps 1 and 2 changed", "git log --oneline -3 && git diff HEAD~2 --stat", "done", "0.2 s")] },
  { t: "agent", who: "impl", at: "13:52", html: `<p>I'll add the bucket to <code>internal/ratelimit</code> and wire it into the API key middleware. The config from step 1 already exposes <code>burst</code> and <code>refill_per_second</code>, so the bucket only needs:</p><ul><li>one <code>Bucket</code> per key, created on first use;</li><li>a refill computed from the time elapsed on each read, with no ticker;</li><li>a mutex per bucket, and the map behind a <code>sync.RWMutex</code>.</li></ul>` },
  { t: "acts", at: "13:53", n: 21, roll: "Wrote 6 · Read 5 · Tests 4 · Searched 3 · git 3", fail: 1, recovered: true, dur: "12 min", earlier: 15, rows: [R("Write the bucket", "cat > internal/ratelimit/bucket.go <<'EOF'", "done", "0.1 s"), R("Write the map of buckets", "cat > internal/ratelimit/limiter.go <<'EOF'", "done", "0.1 s"), R("Wire the limiter into the auth middleware", "python3 - <<'PY'", "done", "0.2 s"), R("Run the rate limit tests", "go test ./internal/ratelimit/... -race", "error", "exit 1 · 8.2 s"), R("Start a new bucket full", "sed -i 's/tokens: 0/tokens: burst/' internal/ratelimit/limiter.go", "done", "0.1 s"), R("Run the rate limit tests", "go test ./internal/ratelimit/... -race", "done", "7.9 s")] },
  { t: "agent", who: "impl", at: "14:09", html: `<p>Done. The bucket refills when it's read, so an idle key costs nothing, and a new key starts with a full burst:</p>${GO_LIMITER}<p><code>go test ./internal/ratelimit/... -race</code> passes, including the burst test with 50 concurrent requests on one key.</p>` },
];
const STEP3_REV1 = [
  { t: "mark", at: "14:11", icon: "product", text: "MySpec → Reviewer", n: "pass 1 · the step, the PRD, the tech spec and the implementer's answer", kind: "product", body: `<p>Review step 3 against <code>steps/03-token-bucket.md</code>, the PRD and the tech spec. Write the report to <code>reviews/step-03/review-1.md</code>.</p><h4>The implementer's last answer</h4><p>Done. The bucket refills when it's read, so an idle key costs nothing…</p><p class="faint">1,087 characters</p>` },
  { t: "acts", at: "14:11", n: 45, roll: "Read 26 · Searched 9 · Tests 6 · Lint 2 · git 2", dur: "6 min", earlier: 39, rows: [R("See what the step changed", "git diff --stat && git status --short", "done", "0.2 s"), R("Read the bucket", "cat internal/ratelimit/bucket.go", "done", "0.1 s"), R("Read the map of buckets", "cat internal/ratelimit/limiter.go", "done", "0.1 s"), R("Run the whole suite with the race detector", "go test ./... -race", "done", "48 s"), R("Run the linter", "golangci-lint run ./...", "done", "21 s"), R("Look for eviction of idle keys", "grep -n \"delete(\" internal/ratelimit/*.go", "done", "0.1 s")] },
  { t: "agent", who: "rev", at: "14:18", html: `<p>Tests and lint pass, and the bucket matches the spec. Two findings: the map of buckets never forgets a key, and nothing tests the refill after a burst.</p>` },
  { t: "mark", at: "14:19", icon: "file", text: "Review 1 written", n: "changes · 2 findings", kind: "rpt", body: `<ol class="flist">${REPORT1.map((f, k) => `<li><span class="fn">${k + 1}</span><span>${f[1]}<span class="loc">${f[0]}</span></span></li>`).join("")}</ol>`, foot: "Open in Reports" },
];
const HAND_IMPL1 = { t: "mark", at: "14:19", icon: "product", text: "MySpec → Implementer", n: "Review 1 · 2 findings · round 1 of 3", kind: "product", body: REVIEW1_MSG };

CONV.running = {
  impl: [
    ...STEP3_START,
    HAND_IMPL1,
    { t: "agent", who: "impl", at: "14:19", html: `<p>Two findings. I'll sweep idle buckets once a minute and add the refill test.</p>` },
    { t: "acts", at: "14:19", n: 11, open: true, live: ["Run the refill and eviction tests", "go test ./internal/ratelimit/... -race -run 'Evict|Refill'", "12 s"], earlier: 5, rows: [
      R("Read the finding's file", "sed -n '1,60p' internal/ratelimit/limiter.go", "done", "0.1 s"),
      ["Delegated · Check how other packages evict idle entries", "", "agent", "", { roll: "12 actions · Read 7 · Searched 5", dur: "48 s", rows: [R("Find maps with a janitor", "grep -rn \"time.NewTicker\" internal/", "done", "0.2 s"), R("Read the session cache's sweep", "sed -n '40,90p' internal/session/cache.go", "done", "0.1 s"), R("Read the key cache's sweep", "sed -n '60,110p' internal/keys/cache.go", "done", "0.1 s")] }],
      R("Add the idle sweep", "python3 - <<'PY'", "done", "0.2 s"),
      R("Add the refill test", "cat >> internal/ratelimit/bucket_test.go <<'EOF'", "done", "0.1 s"),
      R("Format", "gofmt -w internal/ratelimit", "done", "0.2 s"),
      R("Run the refill and eviction tests", "go test ./internal/ratelimit/... -race -run 'Evict|Refill'", "running", "12 s")] },
    { t: "user", at: "14:22", queued: true, text: "Also log the key id, never the key, when a bucket is evicted. Debug level is enough." },
  ],
  rev: [...STEP3_REV1],
};

// Ask · the reviewer's pass 2 asks a question; the implementer waits for a permission.
const STEP3_ROUND1_DONE = [
  HAND_IMPL1,
  { t: "agent", who: "impl", at: "14:19", html: `<p>Two findings. I'll sweep idle buckets once a minute and add the refill test.</p>` },
  { t: "acts", at: "14:19", n: 14, roll: "Wrote 3 · Tests 4 · Read 4 · Searched 3", dur: "8 min", earlier: 9, rows: [R("Add the idle sweep", "python3 - <<'PY'", "done", "0.2 s"), R("Add the refill test", "cat >> internal/ratelimit/bucket_test.go <<'EOF'", "done", "0.1 s"), R("Run the refill and eviction tests", "go test ./internal/ratelimit/... -race -run 'Evict|Refill'", "done", "14 s"), R("Run the rate limit tests", "go test ./internal/ratelimit/... -race", "done", "8.1 s"), R("Run the linter", "golangci-lint run ./internal/ratelimit/...", "done", "9 s")] },
  { t: "user", at: "14:28", fromQueue: true, text: "Also log the key id, never the key, when a bucket is evicted. Debug level is enough." },
  { t: "acts", at: "14:28", n: 3, roll: "Wrote 1 · Tests 2", dur: "40 s", rows: [R("Log the evicted key id", "sed -i '/delete(l.buckets, id)/i …' internal/ratelimit/limiter.go", "done", "0.1 s"), R("Run the eviction test", "go test ./internal/ratelimit/... -run Evict -v", "done", "4.2 s"), R("Check nothing logs the raw key", "grep -rn '\"key\", k\\b' internal/ratelimit", "done", "0.1 s")] },
  { t: "agent", who: "impl", at: "14:31", html: `<p>Both findings addressed. Idle buckets are swept every minute; a new test drains the burst and checks one token comes back after a second. Eviction logs the key id at debug level.</p>` },
];
const REV_PASS2_MSG = { t: "mark", at: "14:32", icon: "product", text: "MySpec → Reviewer", n: "pass 2 · the implementer is done with your last report", kind: "product", body: `<p>The implementer is done with your last report. Review step 3 again and write <code>reviews/step-03/review-2.md</code>.</p><h4>The implementer's answer</h4><p>Both findings addressed. Idle buckets are swept every minute…</p><p class="faint">1,341 characters</p>` };
CONV.ask = {
  rev: [...STEP3_REV1, REV_PASS2_MSG,
    { t: "acts", at: "14:32", n: 31, roll: "Read 18 · Searched 6 · Tests 5 · Lint 2", dur: "5 min", earlier: 25, rows: [R("See what changed since pass 1", "git diff HEAD --stat", "done", "0.2 s"), R("Read the sweep", "sed -n '30,70p' internal/ratelimit/limiter.go", "done", "0.1 s"), R("Read the refill test", "sed -n '80,140p' internal/ratelimit/bucket_test.go", "done", "0.1 s"), R("Run the whole suite with the race detector", "go test ./... -race", "done", "51 s"), R("Run the linter", "golangci-lint run ./...", "done", "20 s"), R("Read the auth middleware again", "sed -n '30,60p' internal/http/middleware/auth.go", "done", "0.1 s")] },
    { t: "agent", who: "rev", at: "14:38", html: `<p>Both findings are fixed. One case the spec doesn't settle: the middleware checks the limit <strong>after</strong> resolving the key.</p>${GO_AUTH}<p>A flood of unknown keys never reaches the limiter, so every one of those requests pays the key lookup. I can't judge that trade-off alone.</p>` },
    { t: "question", at: "14:38", live: true, q: "Should a request with an unknown API key be rate limited before the auth check?", opts: [["Yes, by client IP with the anonymous plan", "Protects the key lookup from floods; adds a second bucket keyed by IP."], ["No, reject it with 401 first", "Matches the spec literally; the lookup cache takes the load."]] },
  ],
  impl: [...STEP3_START, ...STEP3_ROUND1_DONE,
    { t: "user", at: "14:50", text: "While the reviewer runs: apply the new migration to the local database so I can try it." },
    { t: "agent", who: "impl", at: "14:51", html: `<p>I'll run the local migration target. It reads the dev database URL from <code>.env.local</code>.</p>` },
    { t: "acts", at: "14:51", n: 3, roll: "Read 1 · Make 1", hold: true, rows: [R("Read the local env", "cat .env.local", "done", "0.1 s"), R("Dry-run the migration target", "make -n migrate-local", "done", "0.4 s"), R("Apply the migration to api_dev", "the command in the card below", "wait", "waits for your permission")] },
    { t: "permission", at: "14:52", live: true, tool: "Bash", desc: "Apply the migration to the local database <code>api_dev</code>.", cmd: "make migrate-local DATABASE_URL=postgres://localhost:5432/api_dev", foot: "Not in the allowed commands of this session. Nothing runs until you answer." },
  ],
};

// Error · the reviewer's pass 2: an automatic retry that went through, a speech you stopped, then the crash.
const REV_ERROR_TAIL = [
  { t: "mark", at: "14:33", icon: "retry", text: "Retried on its own", n: "the API was overloaded · 2 attempts · went through at 14:34", kind: "retry" },
  { t: "acts", at: "14:34", n: 12, roll: "Read 9 · Searched 3", dur: "1 min 10 s", earlier: 6, rows: [R("See what changed since pass 1", "git diff HEAD --stat", "done", "0.2 s"), R("Read the sweep", "sed -n '30,70p' internal/ratelimit/limiter.go", "done", "0.1 s"), R("Read the refill test", "sed -n '80,140p' internal/ratelimit/bucket_test.go", "done", "0.1 s"), R("Read the rate limit docs", "cat docs/rate-limits.md", "done", "0.1 s"), R("Compare the docs with the config", "diff <(grep -A3 Pro docs/rate-limits.md) config/plans.yaml", "done", "0.1 s"), R("Read the docs' changelog", "git log --oneline -5 -- docs/", "done", "0.2 s")] },
  { t: "agent", who: "rev", at: "14:35", interrupted: true, html: `<p>Before the tests, the docs: <code>docs/rate-limits.md</code> says Pro gets 600 requests per minute, while <code>config/plans.yaml</code> ships 500. The docs were last touched in step 7's plan, so I'll read the whole plan to see whether this step was meant to</p>` },
  { t: "user", at: "14:36", text: "Skip the docs, step 7 covers them. Finish the pass on the code." },
  { t: "acts", at: "14:36", n: 7, roll: "Read 3 · Tests 2 · 1 interrupted", dur: "4 min", fail: 0, interruptedN: 1, rows: [R("Read the auth middleware again", "sed -n '30,60p' internal/http/middleware/auth.go", "done", "0.1 s"), R("Run the whole suite with the race detector", "go test ./... -race", "done", "51 s"), R("Run the burst test ten times", "go test ./internal/ratelimit/ -run Burst -count 10", "done", "1 min 12 s"), R("Run the linter", "golangci-lint run ./...", "interrupted", "stopped with the session")] },
];
CONV.error = {
  rev: [...STEP3_REV1, REV_PASS2_MSG, ...REV_ERROR_TAIL,
    { t: "error", at: "14:41", text: "Claude Code stopped unexpectedly during the pass. The report was not written, and the implementer waits until the review goes on.", detail: "exit status 1 · claude --resume 7d1e…c04b" }],
  impl: [...STEP3_START, ...STEP3_ROUND1_DONE],
};
CONV.retrying = {
  rev: [...STEP3_REV1, REV_PASS2_MSG, ...REV_ERROR_TAIL.slice(1, 4),
    { t: "acts", at: "14:36", n: 6, roll: "Read 3 · Tests 2", dur: "3 min", rows: [R("Read the auth middleware again", "sed -n '30,60p' internal/http/middleware/auth.go", "done", "0.1 s"), R("Run the whole suite with the race detector", "go test ./... -race", "done", "51 s"), R("Run the burst test ten times", "go test ./internal/ratelimit/ -run Burst -count 10", "done", "1 min 12 s")] },
    { t: "activity", at: "14:40", retry: true, text: "Retrying · attempt 3 of 10", sub: "the API is overloaded · next try in 8 s" }],
  impl: [...STEP3_START, ...STEP3_ROUND1_DONE],
};

// Review · the PR review of the task, pass 1: the checks read, a subagent, the report and the findings to decide.
CONV.review = { impl: [
  { t: "mark", at: "17:41", icon: "play", text: "PR review started", n: "pass 1 · #1284 into dev", kind: "event", body: `<p>Review pull request #1284 against the PRD, the tech spec and the plan. Read the failed checks first.</p><p class="faint">2,605 characters · the prompt the reviewer received</p>` },
  { t: "mark", at: "17:41", icon: "check", text: "Checks read before pass 1", n: "4 of 5 passed · e2e / rate-limit-burst failed", kind: "event" },
  { t: "acts", at: "17:41", n: 34, roll: "Read 16 · Searched 7 · GitHub 5 · Tests 3", dur: "7 min", earlier: 27, rows: [R("Read the diff against dev", "git diff origin/dev...HEAD", "done", "0.4 s"), R("Read the failed check's log", "gh run view 88213 --log-failed", "done", "2.2 s"),
    ["Delegated · Find why e2e / rate-limit-burst failed", "", "agent", "", { roll: "44 actions · Read 21 · Searched 14 · GitHub 9", dur: "2 min", rows: [R("Read the e2e test", "sed -n '1,90p' e2e/ratelimit_test.go", "done", "0.1 s"), R("Count requests the test lets through", "grep -n \"want 20\" e2e/ratelimit_test.go", "done", "0.1 s"), R("Read how a new bucket starts", "sed -n '20,40p' internal/ratelimit/bucket.go", "done", "0.1 s"), R("Replay the burst locally", "go test ./e2e/ -run TestBurstThenRefill -count 5", "done", "34 s")] }],
    R("Check the docs against the config", "diff <(grep -A3 Pro docs/rate-limits.md) config/plans.yaml", "done", "0.1 s"), R("Look for a burst migration", "ls migrations/ | tail -5", "done", "0.1 s")] },
  { t: "agent", who: "rev", at: "17:49", html: `<p>The pull request does what the PRD asks. Four findings, one of them the failed check: the e2e failure is a real off-by-one in the bucket, not a flake. A new bucket refills from the zero time on its first read:</p><div class="code">${codeHead("go", "internal/ratelimit/bucket.go · 28–33")}<pre>b = &amp;Bucket{burst: plan.Burst, rate: plan.RefillPerSecond, tokens: plan.Burst}
<span class="com">// last is the zero time: the first Allow adds years of refill,</span>
<span class="com">// capped at burst, then spends one. The 21st request passes.</span></pre></div>` },
  { t: "mark", at: "17:50", icon: "file", text: "Review 1 written", n: "changes · 4 findings", kind: "rpt", body: `<ol class="flist">${FINDINGS.map((f, k) => `<li><span class="fn">${k + 1}</span><span>${f.text}<span class="loc">${f.loc}</span></span></li>`).join("")}</ol>`, foot: "Open in Reports" },
  { t: "findings" },
] };

// Long · step 6, after two review rounds: 16 speeches, 148 actions in 15 groups, two reports, the context
// compacted once. The earlier stretches fold; the latest one is open, and the implementer is writing.
const LONG_POOL = [
  ["Read the metrics package", "sed -n '1,120p' internal/metrics/metrics.go", "0.1 s"], ["Find where 429s are written", "grep -rn \"StatusTooManyRequests\" internal/", "0.2 s"],
  ["Read the Prometheus registry", "sed -n '1,60p' internal/metrics/registry.go", "0.1 s"], ["Write the throttle counter", "cat > internal/metrics/throttle.go <<'EOF'", "0.1 s"],
  ["Count in the rate limit middleware", "python3 - <<'PY'", "0.2 s"], ["Run the metrics tests", "go test ./internal/metrics/... -race", "6.4 s"],
  ["Run the middleware tests", "go test ./internal/http/middleware/... -race", "9.1 s"], ["Run the linter", "golangci-lint run ./internal/...", "18 s"],
  ["See what the step changed", "git diff --stat", "0.2 s"], ["Read the plan label values", "grep -n \"Plan\" internal/billing/plans.go", "0.1 s"],
];
const longRows = (k, n, extra = []) => [...Array(n)].map((_, i) => { const p = LONG_POOL[(k + i) % LONG_POOL.length]; return R(p[0], p[1], "done", p[2]); }).concat(extra);
const LONG = { impl: [
  { t: "fold", n: 1, title: "Started with", sub: "steps/06-throttle-metrics.md", at: "16:12", to: "16:48", speeches: 5, actions: 71, entries: [
    { t: "mark", at: "16:12", icon: "play", text: "Started with", n: "steps/06-throttle-metrics.md", kind: "event", body: `<h4>Step 6: Count throttled requests per plan</h4><p>A counter of 429 answers labelled by plan, exported to Prometheus, and a panel in the gateway dashboard.</p>` },
    { t: "acts", at: "16:12", n: 18, roll: "Read 12 · Searched 6", dur: "2 min", earlier: 12, rows: longRows(0, 6) },
    { t: "agent", who: "impl", at: "16:15", html: `<p>The metrics package already registers a <code>requests_total</code> counter. I'll add <code>ratelimit_throttled_total</code> with a <code>plan</code> label, counted where the middleware writes the 429.</p>` },
    { t: "acts", at: "16:15", n: 9, roll: "Wrote 3 · Read 4 · Tests 2", dur: "3 min", earlier: 3, rows: longRows(3, 6) },
    { t: "agent", who: "impl", at: "16:19", html: `<p>Now let me check the label values against the plans table.</p>` },
    { t: "acts", at: "16:19", n: 22, roll: "Read 11 · Tests 6 · Wrote 3 · Searched 2", fail: 2, recovered: true, dur: "14 min", earlier: 16, rows: longRows(5, 6) },
    { t: "agent", who: "impl", at: "16:34", html: `<p>The tests pass. The <code>plan</code> label takes the plan's slug, never the key, so the series stay four.</p>` },
    { t: "acts", at: "16:34", n: 14, roll: "Wrote 2 · Tests 5 · Read 5 · git 2", dur: "11 min", earlier: 8, rows: longRows(2, 6) },
    { t: "agent", who: "impl", at: "16:46", html: `<p>Done. <code>ratelimit_throttled_total{plan}</code> counts every 429; the dashboard panel shows the rate per plan over 5 minutes.</p>` },
    { t: "acts", at: "16:46", n: 8, roll: "Tests 4 · Lint 2 · git 2", dur: "2 min", rows: longRows(6, 6) },
    { t: "agent", who: "impl", at: "16:48", html: `<p>Tests and lint pass.</p>` },
  ] },
  { t: "fold", n: 2, title: "MySpec → Implementer", sub: "Review 1 · 3 findings · round 1 of 3", at: "16:55", to: "17:19", speeches: 4, actions: 44, product: true, entries: [
    { t: "mark", at: "16:55", icon: "product", text: "MySpec → Implementer", n: "Review 1 · 3 findings · round 1 of 3", kind: "product", body: `<h4>Review 1 · changes</h4><ol><li>The counter is registered twice in tests.</li><li>The dashboard query sums across instances without <code>rate()</code>.</li><li>No test for the internal scope, which must not count.</li></ol><p class="faint">4,980 characters</p>` },
    { t: "agent", who: "impl", at: "16:56", html: `<p>Three findings. The first two are right; for the third, internal keys never reach the limiter, so they can't count. I'll add a test that proves it.</p>` },
    { t: "acts", at: "16:56", n: 16, roll: "Wrote 4 · Tests 6 · Read 6", dur: "9 min", earlier: 10, rows: longRows(1, 6) },
    { t: "agent", who: "impl", at: "17:05", html: `<p>Registered once through a <code>sync.Once</code>; the query now uses <code>rate()</code>.</p>` },
    { t: "acts", at: "17:05", n: 19, roll: "Tests 8 · Read 7 · Wrote 4", dur: "10 min", earlier: 13, rows: longRows(4, 6) },
    { t: "user", at: "17:12", text: "Keep the dashboard panel in the same row as the latency one." },
    { t: "agent", who: "impl", at: "17:13", html: `<p>Moved it next to latency.</p>` },
    { t: "acts", at: "17:13", n: 9, roll: "Wrote 2 · Tests 4 · Read 3", dur: "5 min", earlier: 3, rows: longRows(7, 6) },
    { t: "agent", who: "impl", at: "17:19", html: `<p>All three findings addressed.</p>` },
  ] },
  { t: "mark", at: "17:26", icon: "product", text: "MySpec → Implementer", n: "Review 2 · 1 finding · round 2 of 3", kind: "product", body: `<h4>Review 2 · changes</h4><ol><li><code>internal/metrics/throttle.go:18</code> · The <code>plan</code> label reads the plan at every 429; read it from the bucket, which already holds it.</li></ol><p class="faint">3,114 characters</p>`, anchor: true },
  { t: "agent", who: "impl", at: "17:26", html: `<p>One finding. The bucket already carries the plan it was built from, so the middleware can pass <code>b.Plan</code> to the counter instead of asking the plan source again.</p>` },
  { t: "acts", at: "17:27", n: 12, roll: "Read 6 · Wrote 3 · Tests 3", dur: "6 min", earlier: 6, rows: longRows(8, 6) },
  { t: "mark", at: "17:33", icon: "compact", text: "Context compacted", n: "at 81% · the session goes on", kind: "compact" },
  { t: "agent", who: "impl", at: "17:34", html: `<p>Done. The counter takes the plan from the bucket; the lookup is gone from the hot path.</p>` },
  { t: "acts", at: "17:34", n: 9, roll: "Tests 5 · Lint 2 · Read 2", dur: "4 min", earlier: 3, rows: longRows(5, 6) },
  { t: "user", at: "17:38", text: "Also run the e2e burst test before you finish." },
  { t: "acts", at: "17:38", n: 10, roll: "Tests 6 · Read 4", dur: "2 min 05 s", earlier: 4, rows: longRows(6, 5).concat([R("Run the e2e burst test", "go test ./e2e/ -run TestBurstThenRefill", "done", "31 s")]), newFrom: true },
  { t: "agent", who: "impl", at: "17:41", streaming: true, html: `<h3>Round 2</h3><p>The finding is addressed. The middleware passes the bucket's plan to the counter, so a 429 costs no lookup:</p><div class="code">${codeHead("go", "internal/http/middleware/ratelimit.go · 52–64")}<pre>b := h.limiter.<span class="fn">For</span>(key.ID, now)
<span class="kw">if</span> !b.<span class="fn">Allow</span>(now) {
	metrics.<span class="fn">Throttled</span>(b.Plan)
	w.Header().<span class="fn">Set</span>(<span class="str">"Retry-After"</span>, strconv.<span class="fn">Itoa</span>(b.<span class="fn">RetryAfter</span>(now)))
	<span class="fn">writeLimitHeaders</span>(w, b, now)
	w.<span class="fn">WriteHeader</span>(http.StatusTooManyRequests)
	<span class="kw">return</span>
}
<span class="fn">writeLimitHeaders</span>(w, b, now)
next.<span class="fn">ServeHTTP</span>(w, r)</pre></div><p>What I checked:</p><ul><li><code>ratelimit_throttled_total{plan}</code> takes the plan from the bucket;</li><li><code>go test ./e2e/ -run TestBurstThenRefill</code> passes in 31 s;</li><li>the dashboard panel sits next to</li></ul>` },
] };
LONG.rev = [
  { t: "mark", at: "17:20", icon: "product", text: "MySpec → Reviewer", n: "pass 2 · the implementer is done with your last report", kind: "product", body: `<p>The implementer is done with your last report. Review step 6 again.</p>` },
  { t: "acts", at: "17:20", n: 22, roll: "Read 14 · Tests 5 · Searched 3", dur: "5 min", earlier: 16, rows: longRows(2, 6) },
  { t: "agent", who: "rev", at: "17:25", html: `<p>Two of three fixed. The counter still asks the plan source on every 429.</p>` },
  { t: "mark", at: "17:26", icon: "file", text: "Review 2 written", n: "changes · 1 finding", kind: "rpt", body: `<ol class="flist"><li><span class="fn">1</span><span>Read the plan from the bucket.<span class="loc">internal/metrics/throttle.go:18</span></span></li></ol>`, foot: "Open in Reports" },
];
CONV.long = LONG;

// ---------------- The shell around each scene ----------------
// long is step 6 of 7, round 2; retrying is the reviewer of step 3 working again.
if (SCENE === "long") {
  Object.assign(SC, { now: "17:41", step: 6, doneSteps: 5, ctx: 23 });
  Object.assign(NOW, { pos: "Step 6 of 7 · round 2 of 3", posShort: "6/7 · round 2" });
  ITEMS.t1.pos = "Step 6/7 · round 2"; ITEMS.t1.posShort = "Step 6/7 · round 2";
  if (ITEMS.t1.run) Object.assign(ITEMS.t1.run, { turn: "2m", long: "2 minutes 5 seconds", verb: "Writing", target: "the round 2 summary", short: "summary" });
}
if (SCENE === "retrying") {
  Object.assign(NOW, { g: "run", word: "Reviewer working", short: "working" });
  Object.assign(TURN.rev, { g: "run", word: "", tip: "Reviewer working · retrying, attempt 3 of 10" });
  Object.assign(TURN.impl, { g: "idle", tip: "Implementer idle · waits for the reviewer's pass 2" });
  ITEMS.t1.sits = []; ITEMS.t1.ctx = 41; ITEMS.t1.pos = "Step 3/7 · Reviewer · pass 2"; ITEMS.t1.posShort = "Step 3/7 · pass 2";
  ITEMS.t1.run = { who: "Reviewer", turn: "9m", long: "9 minutes", verb: "Retrying", target: "attempt 3 of 10 · API overloaded", short: "attempt 3/10" };
}

// The entries of the conversation on screen.
function convEntries() {
  const c = CONV[SCENE] || CONV.running;
  const v = typeof curVoice === "function" ? curVoice() : "impl";
  return c[v] || c.impl || c.rev;
}
// Is this entry something you read (a speech, a request, an error), something you may skip (actions), or a
// milestone that marks the time? The three variations weigh the three differently.
const ROLE = (e) => ["agent", "user", "question", "permission", "error", "findings"].includes(e.t) ? "read" : e.t === "acts" || e.t === "activity" ? "skip" : "time";
