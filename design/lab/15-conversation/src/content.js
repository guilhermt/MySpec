/* =====================================================================
   ROUND 09 · the task "Rate limit per API key" at nine moments. Every
   session (place) is written once as ordered entries { o, p, html }:
   o orders the entries across sessions (A merges them), p is the place
   (B shows one at a time). The volumes follow research/conversation.md §4.
   ===================================================================== */
// Round 15 · the scenes of the conversation. Each maps to the round-10 moment whose shell (stepper, tabs,
// ask bar, composer) surrounds it; the conversation itself is written in conv-data.js.
const SCENE_KEYS = [
  ["planning", "Planning · PRD asks in text"], ["running", "Implementer running"], ["ask", "Reviewer asks, implementer waits"],
  ["long", "A long session · step 6, round 2"], ["error", "Errors · session stopped"], ["retrying", "Errors · retrying on its own"],
  ["review", "PR review · report and findings"],
];
const SCENE = SCENE_KEYS.some(([k]) => k === Q.get("scene")) ? Q.get("scene") : "running";
const SC_KEY = { planning: "plan", running: "run", ask: "ask", long: "run", error: "error", retrying: "error", review: "findings" }[SCENE];

// Stages of the workflow, in order. The index of the current one per scene.
const STAGES = ["PRD", "Tech spec", "Plan", "Implementation", "PR", "PR review", "Closing"];

// ---------------- Shared snippets ----------------
const GO_BUCKET = `<div class="code">${codeHead("go", "internal/ratelimit/bucket.go")}<pre><span class="com">// Allow takes one token if there is one, refilling first from the time elapsed.</span>
<span class="kw">func</span> (b *Bucket) <span class="fn">Allow</span>(now time.Time) <span class="kw">bool</span> {
	b.mu.<span class="fn">Lock</span>()
	<span class="kw">defer</span> b.mu.<span class="fn">Unlock</span>()
	elapsed := now.<span class="fn">Sub</span>(b.last).<span class="fn">Seconds</span>()
	b.tokens = <span class="fn">min</span>(b.burst, b.tokens+elapsed*b.rate)
	b.last = now
	<span class="kw">if</span> b.tokens &lt; <span class="num">1</span> {
		<span class="kw">return</span> <span class="kw">false</span>
	}
	b.tokens--
	<span class="kw">return</span> <span class="kw">true</span>
}</pre></div>`;
const GO_AUTH = `<div class="code">${codeHead("go", "internal/http/middleware/auth.go · 41–48")}<pre>key, err := h.keys.<span class="fn">Lookup</span>(ctx, r.Header.<span class="fn">Get</span>(<span class="str">"X-API-Key"</span>))
<span class="kw">if</span> err != <span class="kw">nil</span> {
	<span class="kw">return</span> <span class="fn">unauthorized</span>(w)
}
<span class="kw">if</span> !h.limiter.<span class="fn">For</span>(key.ID).<span class="fn">Allow</span>(time.<span class="fn">Now</span>()) {
	<span class="kw">return</span> <span class="fn">tooManyRequests</span>(w, h.limiter.<span class="fn">RetryAfter</span>(key.ID))
}</pre></div>`;
const STEPFILE3 = `<h4>Step 3: Token bucket middleware</h4><p><strong>Scope.</strong> A token bucket per API key in <code>internal/ratelimit</code>, checked in the API key middleware. Burst and refill come from the plan config of step 1.</p><ul><li>One bucket per key, created on first use.</li><li>Refill computed on read from the time elapsed; no ticker.</li><li>429 with <code>Retry-After</code> when the bucket is empty.</li></ul><p><strong>Completion checklist.</strong> <code>go test ./... -race</code>, <code>golangci-lint run</code>, a burst test with 50 concurrent requests on one key.</p>`;
const PRD_EXCERPT = `<h4>Rate limit per API key · PRD</h4><p><strong>Problem.</strong> Every client shares one global limit in the gateway, so one noisy integration throttles everyone.</p><p><strong>Goal.</strong> Each API key gets its plan's limit: Free 60 requests per minute with a burst of 20, Pro 600 with a burst of 100, Enterprise from the contract.</p><ul><li>The limit applies in the gateway middleware, before the handlers.</li><li>Over the limit: 429 with <code>Retry-After</code> and the <code>X-RateLimit-*</code> headers.</li><li>Keys with the <code>internal</code> scope are exempt.</li><li>A limit change takes effect within 60 seconds, without a deploy.</li></ul>`;
const CARD_CTX = `<h4>acme/api#412 · Rate limit per API key</h4><p>Today every client shares one global limit in the gateway; one noisy integration throttles everyone.</p><p>Limit each API key with its plan's burst and refill, and answer 429 with <code>Retry-After</code>.</p><p><strong>Epic.</strong> API hardening · <strong>Siblings.</strong> #413 Rotate API keys without downtime, #415 Audit log for key changes.</p>`;
const REPORT1 = [["internal/ratelimit/limiter.go:22", "The map of buckets grows with every key ever seen. Evict buckets idle for more than 10 minutes."], ["internal/ratelimit/bucket_test.go", "No test covers the refill after the burst is spent."]];
const FINDINGS = [
  { loc: "internal/ratelimit/bucket.go:31", text: "<strong>e2e / rate-limit-burst failed.</strong> A new bucket refills from the zero time on its first read, so a burst of 20 lets 21 requests through. Start <code>last</code> at creation.", d: "ok" },
  { loc: "internal/http/middleware/ratelimit.go:58", text: "<code>Retry-After</code> rounds down: a client told to wait 0 s retries at once and gets another 429. Round up to whole seconds.", d: "" },
  { loc: "General", text: "No migration sets <code>plans.burst</code> for the 14 existing Enterprise rows; they fall back to the Free burst of 20.", d: "" },
  { loc: "docs/rate-limits.md:12", text: "The table says 600 requests per minute for Pro; <code>config/plans.yaml</code> ships 500.", d: "" },
];

// ---------------- The sessions ----------------
// Each returns entries for the scene. p: prd spec plan s1i s1r s2i s2r s3i s3r s4i s5i s6i s6r s7i s7r pr prr
function sessPRD(sc) {
  const live = sc === "plan";
  const e = [
    { o: 1, p: "prd", html: EVX("flag", "Started with the card <span class=\"n\">acme/api#412</span>", "09:14", "Initial context · Structured · Agent review", `<div class="docbody prose">${CARD_CTX}</div>`) },
    { o: 2, p: "prd", html: ACTS({ n: 6, roll: "Read 4 · Searched 1 · GitHub 1", dur: "38 s", rows: [["Read the plans documentation", "cat docs/plans.md", "done", "0.1 s"], ["Find where the gateway limits requests", "grep -rn \"RateLimit\" internal/ --include=*.go", "done", "0.3 s"], ["Read the global limiter", "sed -n '1,80p' internal/http/middleware/limit.go", "done", "0.1 s"], ["List the plan fields", "sed -n '1,60p' internal/plans/plan.go", "done", "0.1 s"], ["Read the epic's siblings", "gh issue view 413 --json title,body", "done", "1.4 s"], ["Read the gateway config", "cat config/gateway.yaml", "done", "0.1 s"]] }) },
    { o: 3, p: "prd", html: AG("agent", `<p>I read the card, the epic <strong>API hardening</strong> and the global limiter in <code>internal/http/middleware/limit.go</code>. The siblings #413 and #415 stay out of scope. A few gaps before I write the PRD.</p><p><strong>Where should the limit apply?</strong></p><ol type="a"><li>In the gateway middleware, before the handlers.</li><li>Per handler, so each route can have its own limit.</li><li>At the load balancer.</li></ol>`, "09:16", "PRD") },
    { o: 4, p: "prd", html: US("a", "09:17") },
    { o: 5, p: "prd", html: AG("agent", `<p><strong>What happens when a key goes over its limit?</strong></p><ol><li>429 with <code>Retry-After</code> and the <code>X-RateLimit-*</code> headers.</li><li>429 with only <code>Retry-After</code>.</li><li>Queue the request for up to a second, then 429.</li></ol>`, "09:18", "PRD") },
    { o: 6, p: "prd", html: US("1", "09:19") },
    { o: 7, p: "prd", html: QCARD({ answered: true, place: "PRD", q: "Do keys of internal services count against a plan?", answer: "No, keys with the internal scope are exempt", answeredAt: "09:24" }) },
    { o: 8, p: "prd", html: AG("agent", `<p>The plans table already has <code>requests_per_minute</code>, and the pricing page sells these limits:</p><table><thead><tr><th>Plan</th><th>Per minute</th><th>Burst</th></tr></thead><tbody><tr><td>Free</td><td class="num">60</td><td class="num">20</td></tr><tr><td>Pro</td><td class="num">600</td><td class="num">100</td></tr><tr><td>Enterprise</td><td>contract</td><td>contract</td></tr></tbody></table>` +
      `<p class="${live ? "qtext" : ""}"><strong>Last one: should a limit change take effect without a deploy?</strong></p><ol type="a"><li>Yes. Read the limits from the plans table and cache them for 60 s. Sales can raise a customer's limit on the spot; one query per cache miss.</li><li>No. Limits live in config and ship with a release. Simplest; a change waits for the next deploy.</li></ol><p>Once you answer I'll list what I understood before writing <code>PRD.md</code>.</p>`, "09:29", "PRD") },
  ];
  if (!live) e.push(
    { o: 9, p: "prd", html: US("a", "09:31") },
    { o: 10, p: "prd", html: AG("agent", `<p>Here's what I understood:</p><ul><li>A limit per API key in the gateway middleware, before the handlers.</li><li>429 with <code>Retry-After</code> and <code>X-RateLimit-*</code> over the limit.</li><li>Internal keys exempt; limits from the plans table, cached 60 s.</li></ul><p>Shall I write the PRD?</p>`, "09:33", "PRD") },
    { o: 11, p: "prd", html: US("ok", "09:34") },
    { o: 12, p: "prd", html: ACTS({ n: 2, roll: "Wrote 1 · Read 1", dur: "4 s", rows: [["Write the PRD", "cat > .myspec/rate-limit-per-api-key/PRD.md <<'EOF'", "done", "0.1 s"], ["Check the PRD renders", "head -40 .myspec/rate-limit-per-api-key/PRD.md", "done", "0.1 s"]] }) },
    { o: 13, p: "prd", html: DOC("PRD.md", "09:41", "6 sections · 1,240 words", PRD_EXCERPT) },
  );
  return e;
}
function sessSpec() {
  return [
    { o: 20, p: "spec", html: ACTS({ n: 52, roll: "Read 31 · Searched 14 · Tests 4 · git 3", dur: "6 min", earlier: 46, rows: [["Read how the key cache invalidates", "sed -n '40,120p' internal/keys/cache.go", "done", "0.1 s"], ["Find every caller of the global limiter", "grep -rn \"limit.Global\" --include=*.go .", "done", "0.4 s"], ["Check the gateway runs more than one instance", "cat deploy/gateway/values.yaml", "done", "0.1 s"], ["Measure the current middleware", "go test ./internal/http/middleware/ -bench Limit -run ^$", "done", "14 s"], ["Read the plans table migration", "cat migrations/0042_plans.sql", "done", "0.1 s"], ["See how headers are written today", "grep -rn \"Header().Set\" internal/http", "done", "0.3 s"]] }) },
    { o: 21, p: "spec", html: AG("agent", `<p>Two ways to keep the buckets. The gateway runs 4 instances behind a load balancer that hashes on the API key header, so the same key always lands on the same instance.</p><ol><li><strong>In memory, per instance.</strong> No new dependency, sub-microsecond checks. A deploy resets the buckets, which only gives a key a fresh burst.</li><li><strong>In Redis.</strong> Exact across instances and restarts; one round trip per request, and Redis becomes a dependency of every request.</li></ol>`, "09:58", "Tech spec") },
    { o: 22, p: "spec", html: QCARD({ answered: true, place: "Tech spec", q: "Where do the buckets live?", answer: "In memory, per gateway instance", answeredAt: "10:04" }) },
    { o: 23, p: "spec", html: DOC("tech-spec.md", "10:22", "8 sections · 2,310 words", `<h4>Rate limit per API key · Tech spec</h4><p><strong>Decision.</strong> Token buckets in memory, one per key, in <code>internal/ratelimit</code>. The load balancer's hash on <code>X-API-Key</code> keeps a key on one instance.</p><p><strong>Refill.</strong> Computed on read from the time elapsed, no ticker.</p>`) },
  ];
}
function sessPlan() {
  return [
    { o: 30, p: "plan", html: ACTS({ n: 9, roll: "Wrote 7 · Read 2", dur: "1 min", rows: [["Write step 1", "cat > steps/01-config.md <<'EOF'", "done"], ["Write step 4", "cat > steps/04-retry-after.md <<'EOF'", "done"], ["Write step 5", "cat > steps/04-per-plan-limits.md <<'EOF'", "done"]] }) },
    { o: 31, p: "plan", html: HAND("Agent", "· the step files are not a valid plan yet · correction 1 of 3", "10:30", `<div class="prose"><p><strong>The step files do not form a valid plan yet.</strong></p><ul><li><code>04-retry-after.md</code> and <code>04-per-plan-limits.md</code> share the number 4.</li><li>Numbers start at 1 with no gaps or repeats.</li></ul></div>`) },
    { o: 32, p: "plan", html: AG("agent", `<p>Renumbered: per-plan limits is step 5, and the rest moved down by one.</p>`, "10:31", "Plan") },
    { o: 33, p: "plan", html: EV("list", "Plan written <span class=\"n\">· 7 steps</span>", "10:35", "Config · Key cache · Token bucket · Headers · Per-plan limits · Metrics · Docs", `<button class="btn ghost xs" data-panel="Artifacts">Steps</button>`) },
  ];
}
function sessStep3(sc) {
  const e = [
    { o: 300, p: "s3i", html: EVX("file", "Started with <span class=\"n\">steps/03-token-bucket.md</span>", "13:48", "Steps 1 and 2 are committed", `<div class="docbody prose">${STEPFILE3}</div>`) },
    { o: 301, p: "s3i", html: ACTS({ n: 14, roll: "Read 8 · Searched 4 · git 2", dur: "1 min 50 s", earlier: 8, rows: [["Read the step file", "cat .myspec/rate-limit-per-api-key/steps/03-token-bucket.md", "done", "0.1 s"], ["Read the rate limit config from step 1", "sed -n '1,80p' internal/ratelimit/config.go", "done", "0.1 s"], ["Find the API key middleware", "grep -rn \"X-API-Key\" internal/http", "done", "0.2 s"], ["Read the auth middleware", "sed -n '20,90p' internal/http/middleware/auth.go", "done", "0.1 s"], ["Read the key cache of step 2", "sed -n '1,60p' internal/keys/cache.go", "done", "0.1 s"], ["See what steps 1 and 2 changed", "git log --oneline -3 && git diff HEAD~2 --stat", "done", "0.2 s"]] }) },
    { o: 302, p: "s3i", html: AG("impl", `<p>I'll add the bucket to <code>internal/ratelimit</code> and wire it into the API key middleware. The config from step 1 already exposes <code>burst</code> and <code>refill_per_second</code>, so the bucket only needs:</p><ul><li>one <code>Bucket</code> per key, created on first use;</li><li>a refill computed from the time elapsed on each read, with no ticker;</li><li>a mutex per bucket, and the map behind a <code>sync.RWMutex</code>.</li></ul>`, "13:52") },
    { o: 303, p: "s3i", html: ACTS({ n: 21, roll: "Wrote 6 · Read 5 · Tests 4 · Searched 3 · git 3", fail: 1, recovered: true, dur: "12 min", earlier: 15, rows: [["Write the bucket", "cat > internal/ratelimit/bucket.go <<'EOF'", "done", "0.1 s"], ["Write the map of buckets", "cat > internal/ratelimit/limiter.go <<'EOF'", "done", "0.1 s"], ["Wire the limiter into the auth middleware", "python3 - <<'PY'", "done", "0.2 s"], ["Run the rate limit tests", "go test ./internal/ratelimit/... -race", "error", "exit 1 · 8.2 s"], ["Start a new bucket full", "sed -i 's/tokens: 0/tokens: burst/' internal/ratelimit/limiter.go", "done", "0.1 s"], ["Run the rate limit tests", "go test ./internal/ratelimit/... -race", "done", "7.9 s"]] }) },
    { o: 304, p: "s3i", html: AG("impl", `<p>Done. The bucket refills when it's read, so an idle key costs nothing:</p>${GO_BUCKET}<p><code>go test ./internal/ratelimit/... -race</code> passes, including the burst test with 50 concurrent requests on one key.</p>`, "14:09") },
    { o: 305, p: "s3r", html: HAND("Reviewer", "· pass 1 · the step, the PRD, the tech spec and the implementer's answer", "14:11", `<div class="prose"><p>Review step 3 against <code>steps/03-token-bucket.md</code>, the PRD and the tech spec. Write the report to <code>reviews/step-03/review-1.md</code>.</p><p><strong>The implementer's last answer</strong></p><p>Done. The bucket refills when it's read, so an idle key costs nothing…</p></div>`) },
    { o: 306, p: "s3r", html: ACTS({ n: 45, roll: "Read 26 · Searched 9 · Tests 6 · Lint 2 · git 2", dur: "6 min", earlier: 39, rows: [["See what the step changed", "git diff --stat && git status --short", "done", "0.2 s"], ["Read the bucket", "cat internal/ratelimit/bucket.go", "done", "0.1 s"], ["Read the map of buckets", "cat internal/ratelimit/limiter.go", "done", "0.1 s"], ["Run the whole suite with the race detector", "go test ./... -race", "done", "48 s"], ["Run the linter", "golangci-lint run ./...", "done", "21 s"], ["Look for eviction of idle keys", "grep -n \"delete(\" internal/ratelimit/*.go", "done", "0.1 s"]] }) },
    { o: 307, p: "s3r", html: AG("rev", `<p>Tests and lint pass, and the bucket matches the spec. Two findings: the map of buckets never forgets a key, and nothing tests the refill after a burst.</p>`, "14:18", "pass 1") },
    { o: 308, p: "s3r", html: REPORT(1, false, 2, "14:19", REPORT1) },
    { o: 309, p: "s3i", html: HAND("Implementer", "· Review 1 · 2 findings · round 1 of 3", "14:19", `<div class="prose"><p>The agent review of this step found changes. Address each finding, fixing it or saying why you disagree. Don't commit.</p><h4>Review 1 · changes</h4><ol><li><code>internal/ratelimit/limiter.go:22</code> · The map of buckets grows with every key ever seen. Evict buckets idle for more than 10 minutes.</li><li><code>internal/ratelimit/bucket_test.go</code> · No test covers the refill after the burst is spent.</li></ol><p><strong>Checks run.</strong> <code>go test ./... -race</code> passed · <code>golangci-lint run</code> passed.</p></div>`) },
    { o: 310, p: "s3i", html: AG("impl", `<p>Two findings. I'll sweep idle buckets once a minute and add the refill test.</p>`, "14:19", "round 1") },
  ];
  if (sc === "run") {
    e.push(
      { o: 311, p: "s3i", html: ACTS({ n: 11, live: ["Run the refill and eviction tests", "go test ./internal/ratelimit/... -race -run 'Evict|Refill'"], open: true, earlier: 5, rows: [["Read the finding's file", "sed -n '1,60p' internal/ratelimit/limiter.go", "done", "0.1 s"], ["Add the idle sweep", "python3 - <<'PY'", "done", "0.2 s"], ["Add the refill test", "cat >> internal/ratelimit/bucket_test.go <<'EOF'", "done", "0.1 s"], ["Format", "gofmt -w internal/ratelimit", "done", "0.2 s"], ["Run the refill and eviction tests", "go test ./internal/ratelimit/... -race -run 'Evict|Refill'", "running", "12 s"]] }) },
      { o: 312, p: "s3i", html: QUEUED("Also log the key id, never the key, when a bucket is evicted. Debug level is enough.", "Implementer") },
    );
    return e;
  }
  e.push(
    { o: 311, p: "s3i", html: ACTS({ n: 14, roll: "Wrote 3 · Tests 4 · Read 4 · Searched 3", dur: "8 min", earlier: 9, rows: [["Add the idle sweep", "python3 - <<'PY'", "done", "0.2 s"], ["Add the refill test", "cat >> internal/ratelimit/bucket_test.go <<'EOF'", "done", "0.1 s"], ["Run the refill and eviction tests", "go test ./internal/ratelimit/... -race -run 'Evict|Refill'", "done", "14 s"], ["Run the rate limit tests", "go test ./internal/ratelimit/... -race", "done", "8.1 s"], ["Run the linter", "golangci-lint run ./internal/ratelimit/...", "done", "9 s"]] }) },
    { o: 312, p: "s3i", html: US("Also log the key id, never the key, when a bucket is evicted. Debug level is enough.", "14:28 · from the queue", "Implementer") },
    { o: 312.5, p: "s3i", html: ACTS({ n: 3, roll: "Wrote 1 · Tests 2", dur: "40 s", rows: [["Log the evicted key id", "sed -i '/delete(l.buckets, id)/i …' internal/ratelimit/limiter.go", "done", "0.1 s"], ["Run the eviction test", "go test ./internal/ratelimit/... -run Evict -v", "done", "4.2 s"], ["Check nothing logs the raw key", "grep -rn '\"key\", k\\b' internal/ratelimit", "done", "0.1 s"]] }) },
    { o: 313, p: "s3i", html: AG("impl", `<p>Both findings addressed. Idle buckets are swept every minute; a new test drains the burst and checks one token comes back after a second. Eviction logs the key id at debug level.</p>`, "14:31", "round 1") },
    { o: 314, p: "s3r", html: HAND("Reviewer", "· pass 2 · the implementer is done with your last report", "14:32", `<div class="prose"><p>The implementer is done with your last report. Review step 3 again and write <code>reviews/step-03/review-2.md</code>.</p><p><strong>The implementer's answer</strong></p><p>Both findings addressed. Idle buckets are swept every minute…</p></div>`) },
  );
  if (sc === "error") {
    e.push(
      { o: 315, p: "s3r", html: ACTS({ n: 19, roll: "Read 12 · Searched 4 · Tests 2 · 1 interrupted", cls: "is-error", dur: "3 min", earlier: 13, rows: [["See what changed since pass 1", "git diff HEAD --stat", "done", "0.2 s"], ["Read the sweep", "sed -n '30,70p' internal/ratelimit/limiter.go", "done", "0.1 s"], ["Read the refill test", "sed -n '80,140p' internal/ratelimit/bucket_test.go", "done", "0.1 s"], ["Run the whole suite with the race detector", "go test ./... -race", "done", "51 s"], ["Read the auth middleware again", "sed -n '30,60p' internal/http/middleware/auth.go", "done", "0.1 s"], ["Run the linter", "golangci-lint run ./...", "interrupted", "interrupted"]] }) },
      { o: 316, p: "s3r", html: ERR("Session error · Reviewer · pass 2", "Claude Code stopped unexpectedly during the pass. The report was not written; the implementer waits until the review goes on.", "exit status 1 · claude --resume 7d1e…c04b") },
    );
    return e;
  }
  e.push(
    { o: 315, p: "s3r", html: ACTS({ n: 31, roll: "Read 18 · Searched 6 · Tests 5 · Lint 2", dur: "5 min", earlier: 25, rows: [["See what changed since pass 1", "git diff HEAD --stat", "done", "0.2 s"], ["Read the sweep", "sed -n '30,70p' internal/ratelimit/limiter.go", "done", "0.1 s"], ["Read the refill test", "sed -n '80,140p' internal/ratelimit/bucket_test.go", "done", "0.1 s"], ["Run the whole suite with the race detector", "go test ./... -race", "done", "51 s"], ["Run the linter", "golangci-lint run ./...", "done", "20 s"], ["Read the auth middleware again", "sed -n '30,60p' internal/http/middleware/auth.go", "done", "0.1 s"]] }) },
    { o: 316, p: "s3r", html: AG("rev", `<p>Both findings are fixed. One case the spec doesn't settle: the middleware checks the limit <strong>after</strong> resolving the key.</p>${GO_AUTH}<p>A flood of unknown keys never reaches the limiter, so every one of those requests pays the key lookup. I can't judge that trade-off alone.</p>`, "14:38", "pass 2") },
    { o: 317, p: "s3r", html: QCARD({ live: true, place: "Reviewer · pass 2", at: "14:38", q: "Should a request with an unknown API key be rate limited before the auth check?", opts: [["Yes, by client IP with the anonymous plan", "Protects the key lookup from floods; adds a second bucket keyed by IP."], ["No, reject it with 401 first", "Matches the spec literally; the lookup cache takes the load."]] }) },
    { o: 318, p: "s3i", html: US("While the reviewer runs: apply the new migration to the local database so I can try it.", "14:50", "Implementer") },
    { o: 319, p: "s3i", html: AG("impl", `<p>I'll run the local migration target. It reads the dev database URL from <code>.env.local</code>.</p>`, "14:51") },
    { o: 320, p: "s3i", html: ACTS({ n: 3, roll: "Read 1 · Make 1", hold: true, rows: [["Read the local env", "cat .env.local", "done", "0.1 s"], ["Dry-run the migration target", "make -n migrate-local", "done", "0.4 s"], ["Apply the migration to api_dev", "the command in the card below", "wait", "waits for your permission"]] }) },
    { o: 321, p: "s3i", html: PCARD({ live: true, primary: true, tool: "Bash", place: "Implementer", at: "14:52", desc: "Apply the migration to the local database <code>api_dev</code>.", cmd: "make migrate-local DATABASE_URL=postgres://localhost:5432/api_dev", foot: "Not in the allowed commands of this session. Nothing runs until you answer." }) },
  );
  return e;
}
function sessStep4() {
  return [
    { o: 400, p: "s4i", html: EVX("file", "Started with <span class=\"n\">steps/04-retry-after.md</span>", "15:11", "Manual review: you review this step in VS Code", `<div class="docbody prose"><h4>Step 4: Retry-After and rate limit headers</h4><p>Every response carries <code>X-RateLimit-Limit</code>, <code>-Remaining</code> and <code>-Reset</code>; a 429 adds <code>Retry-After</code>.</p></div>`) },
    { o: 401, p: "s4i", html: ACTS({ n: 12, roll: "Read 6 · Searched 3 · Wrote 1 · git 2", dur: "2 min", earlier: 6, rows: [["Read the step file", "cat .myspec/rate-limit-per-api-key/steps/04-retry-after.md", "done", "0.1 s"], ["Find where 429 is written", "grep -rn \"StatusTooManyRequests\" internal/", "done", "0.2 s"], ["Read the rate limit middleware", "cat internal/http/middleware/ratelimit.go", "done", "0.1 s"]] }) },
    { o: 402, p: "s4i", html: ACTS({ n: 26, roll: "Wrote 7 · Read 8 · Tests 6 · Searched 3 · git 2", fail: 2, recovered: true, dur: "16 min", earlier: 20, rows: [["Add the headers helper", "cat > internal/ratelimit/headers.go <<'EOF'", "done", "0.1 s"], ["Round Retry-After up", "python3 - <<'PY'", "done", "0.2 s"], ["Run the middleware tests", "go test ./internal/http/middleware/... -race", "error", "exit 1 · 6.4 s"], ["Fix the header name in the test", "sed -i 's/X-Ratelimit/X-RateLimit/' internal/http/middleware/ratelimit_test.go", "done", "0.1 s"], ["Run the middleware tests", "go test ./internal/http/middleware/... -race", "done", "6.1 s"], ["Document the headers", "python3 - <<'PY'", "done", "0.2 s"]] }) },
    { o: 403, p: "s4i", html: AG("impl", `<p>Done. Every response now carries <code>X-RateLimit-Limit</code>, <code>X-RateLimit-Remaining</code> and <code>X-RateLimit-Reset</code>; a 429 adds <code>Retry-After</code>, rounded up to whole seconds. Seven files changed, tests and lint pass.</p>`, "15:34") },
    { o: 404, p: "s4i", html: CHANGES() },
  ];
}
function CHANGES() {
  const f = [["M", "internal/http/middleware/ratelimit.go", "staged"], ["A", "internal/http/middleware/ratelimit_test.go", "staged"], ["M", "internal/ratelimit/bucket.go", "staged"], ["A", "internal/ratelimit/headers.go", "staged"], ["M", "docs/api/errors.md", "staged"], ["M", "internal/http/middleware/auth.go", "partial"], ["M", "CHANGELOG.md", "pending"]];
  return `<fieldset class="card" id="askcard" aria-labelledby="chg-t"><div class="hd">${st("wait")}<span class="kind" id="chg-t">Review</span><span>Step 4 · Manual</span><span class="grow"></span><span class="faint num">ready 15:34</span></div>
    <div class="bd"><div class="stagebar"><span class="num">5 of 7 files staged</span><span class="trk"><span class="fil" style="--p:71"></span></span><span class="num">71%</span></div>
    <ul class="files" aria-label="Changed files">${f.map(([k, p, s]) => `<li class="file ${s}" tabindex="0" data-tip="Open ${p} in VS Code">${s === "staged" ? `<span class="ic">${I("check")}</span>` : st("todo")}<span class="kd">${k}</span><span class="p">${p}</span><span class="s">${s === "staged" ? "staged" : s === "partial" ? "1 hunk left" : "not staged"}</span></li>`).join("")}</ul>
    <div class="foot">Stage each file in VS Code once you've reviewed it. MySpec never stages for you; Approve opens at 100%.</div></div></fieldset>`;
}
function sessStep5() {
  return [
    { o: 500, p: "s5i", html: EV("play", "Step 5 is next <span class=\"n\">· Per-plan limits from the plans table</span>", "15:59", "MySpec checks the worktree is clean before it opens the session") },
    { o: 501, p: "s5i", html: ERR("Step 5 blocked · worktree not clean", "The worktree has changes no step made. A step starts only on a clean worktree, so its commit holds only its own work.", "$ git status --porcelain\n M go.sum\n?? scratch/bench_test.go\n?? scratch/results.txt") },
  ];
}
function sessPR(sc) {
  const e = [
    { o: 700, p: "pr", html: ACTS({ n: 9, roll: "git 5 · Read 3 · Wrote 1", dur: "1 min 40 s", rows: [["List the branch's commits", "git log --oneline origin/dev..HEAD", "done", "0.1 s"], ["Measure the diff", "git diff origin/dev --stat", "done", "0.2 s"], ["Read the PRD and the tech spec", "cat .myspec/rate-limit-per-api-key/PRD.md", "done", "0.1 s"], ["Write the draft", "cat > .myspec/rate-limit-per-api-key/pr.md <<'EOF'", "done", "0.1 s"]] }) },
    { o: 701, p: "pr", html: DOC("the pull request draft", "17:21", "Rate limit requests per API key · Closes acme/api#412", `<h4>Rate limit requests per API key</h4><p>Closes acme/api#412.</p><p>Each API key gets a token bucket with its plan's burst and refill, checked in the gateway middleware before the handlers. Over the limit the gateway answers 429 with <code>Retry-After</code> and the <code>X-RateLimit-*</code> headers.</p>`, { verb: "Wrote" }) },
    { o: 702, p: "pr", html: EV("check", "You approved the draft <span class=\"n\">· title edited</span>", "17:31") },
    { o: 703, p: "pr", html: HAND("PR", "· open the pull request now", "17:31", `<div class="prose"><p>The user approved the draft at <code>pr.md</code>. Open the pull request now, against <code>dev</code>, with the draft as it is.</p></div>`) },
    { o: 704, p: "pr", html: ACTS({ n: 3, roll: "git 2 · GitHub 1", dur: "22 s", rows: [["Push the branch", "git push -u origin rate-limit-per-api-key", "done", "3.1 s"], ["Open the pull request", "gh pr create --base dev --title \"Rate limit requests per API key\" --body-file pr.md", "done", "2.4 s"]] }) },
    { o: 705, p: "pr", html: EV("pr", "Opened <a href=\"#\">#1284</a> <span class=\"n\">· Rate limit requests per API key</span>", "17:32", "rate-limit-per-api-key → dev · 9 commits", `<button class="btn ghost xs">${I("external")}Open PR</button>`) },
  ];
  if (sc === "checks") e.push({ o: 706, p: "pr", html: CHECKS(true) });
  return e;
}
function CHECKS(live) {
  const rows = live
    ? [["pass", "build", "passed", "1m 52s"], ["pass", "lint", "passed", "48s"], ["pass", "unit", "passed", "3m 10s"], ["run", "e2e / rate-limit-burst", "running", "4m 12s"], ["todo", "preview-deploy", "queued", "—"]]
    : [["fail", "e2e / rate-limit-burst", "failed", "5m 02s"], ["pass", "build", "passed", "1m 52s"], ["pass", "lint", "passed", "48s"], ["pass", "preview-deploy", "passed", "2m 40s"], ["pass", "unit", "passed", "3m 10s"]];
  const g = (s) => s === "pass" ? I("check") : s === "fail" ? st("error") : s === "run" ? st("run") : st("todo");
  return `<div class="gh" role="group" aria-label="GitHub checks"><div class="gh-h">${live ? st("gh") : I("check", "i")}<span>${live ? "<b>Waiting for checks</b> · 3 of 5 passed" : "<b>Checks read before pass 1</b> · 4 of 5 passed · merges clean"}</span><span class="t" data-tip="MySpec reads the pull request every minute">${live ? "checked 40s ago" : "17:41"}</span>${live ? `<button class="btn ghost xs" data-tip="Read the pull request now">Refresh</button>` : ""}</div>
    <ul class="checks">${rows.map(([s, n, w, d]) => `<li class="chk ${s}"><span class="c1">${g(s)}</span><span class="nm">${n}</span><span class="w">${w}</span><span class="d">${d}</span></li>`).join("")}</ul></div>`;
}
function sessPRR(sc) {
  const e = [
    { o: 800, p: "prr", html: CHECKS(false) },
    { o: 801, p: "prr", html: ACTS({ n: 34, roll: "Read 16 · Searched 7 · GitHub 5 · Tests 3", dur: "7 min", earlier: 27, rows: [["Read the diff against dev", "git diff origin/dev...HEAD", "done", "0.4 s"], ["Read the failed check's log", "gh run view 88213 --log-failed", "done", "2.2 s"], ["Delegated · Find why e2e / rate-limit-burst failed", "", "agent", "", { roll: "44 actions · Read 21 · Searched 14 · GitHub 9", dur: "2 min", rows: [["Read the e2e test", "sed -n '1,90p' e2e/ratelimit_test.go", "done", "0.1 s"], ["Count requests the test lets through", "grep -n \"want 20\" e2e/ratelimit_test.go", "done", "0.1 s"], ["Read how a new bucket starts", "sed -n '20,40p' internal/ratelimit/bucket.go", "done", "0.1 s"], ["Replay the burst locally", "go test ./e2e/ -run TestBurstThenRefill -count 5", "done", "34 s"]] }], ["Check the docs against the config", "diff <(grep -A3 Pro docs/rate-limits.md) config/plans.yaml", "done", "0.1 s"], ["Look for a burst migration", "ls migrations/ | tail -5", "done", "0.1 s"]] }) },
    { o: 802, p: "prr", html: AG("rev", `<p>The pull request does what the PRD asks. Four findings, one of them the failed check: the e2e failure is a real off-by-one in the bucket, not a flake.</p>`, "17:49", "PR review · pass 1") },
    { o: 803, p: "prr", html: REPORT(1, false, 4, "17:50", FINDINGS.map((f) => [f.loc, f.text]), { sub: "reviews/pr/review-1.md" }) },
  ];
  if (sc === "findings") e.push({ o: 804, p: "prr", html: "", dec: true });
  if (sc === "close") e.push(
    { o: 804, p: "prr", html: EV("check", "You decided <span class=\"n\">· 3 approved, 1 discarded</span>", "18:05", "Findings 1, 2 and 4 go to the agent; 3 is out of this pull request") },
    { o: 805, p: "prr", html: ACTS({ n: 14, roll: "Wrote 4 · Tests 4 · Read 4 · git 2", dur: "8 min", earlier: 8, rows: [["Start new buckets at creation time", "python3 - <<'PY'", "done", "0.2 s"], ["Round Retry-After up", "sed -i 's/math.Floor/math.Ceil/' internal/http/middleware/ratelimit.go", "done", "0.1 s"], ["Fix the Pro limit in the docs", "sed -i 's/| 600 |/| 500 |/' docs/rate-limits.md", "done", "0.1 s"], ["Run the e2e burst test", "go test ./e2e/ -run TestBurstThenRefill", "done", "31 s"]] }) },
    { o: 806, p: "prr", html: EV("check", "You approved the changes <span class=\"n\">· 3 files staged</span>", "18:29") },
    { o: 807, p: "prr", html: COMMIT("4b7e0aa", "Fix the burst off-by-one and round Retry-After up", "18:31", "Pushed to #1284") },
    { o: 808, p: "prr", html: REPORT(2, true, 0, "18:40", "All five checks pass and the three approved findings are fixed. Nothing to change.", { sub: "reviews/pr/review-2.md" }) },
    { o: 809, p: "prr", html: EV("merge", "Merged <a href=\"#\">#1284</a> into dev <span class=\"n\">· by lnakamura</span>", "18:44", "Read from GitHub at 18:45") },
  );
  return e;
}
function FINDCARD(col) {
  const btn = (f, k) => `<div class="fa"><button class="btn sm dec-a" aria-pressed="${f.d === "ok"}">${I("check")}Approve <span class="k">A</span></button><button class="btn sm dec-d" aria-pressed="${f.d === "no"}">Discard <span class="k">D</span></button>${f.d === "ok" ? `<span class="note">Approved · click again to undo</span>` : ""}</div>`;
  const items = FINDINGS.map((f, k) => `<div class="fnd ${f.d === "ok" ? "ok" : ""} ${k === 1 ? "cur" : ""}" tabindex="${k === 1 ? 0 : -1}" role="group" aria-label="Finding ${k + 1} of 4"><span class="no">${k + 1}</span><div class="fb">${f.loc === "General" ? `<span class="loc gen">General</span>` : `<a class="loc" href="#" data-tip="Open in VS Code at this line">${f.loc}</a>`}<div class="ft" data-tip="Click to edit the text that goes to the agent">${f.text}</div>${btn(f, k)}</div></div>`).join("");
  const sum = `<div class="dsum"><span class="lbl">Summary · editable</span>Checks: 4 of 5 passed, e2e / rate-limit-burst failed. Merges clean into dev.</div>`;
  if (col) return { sum, items };
  return `<fieldset class="card dec" id="askcard" aria-labelledby="dec-t"><div class="hd">${st("wait")}<span class="kind" id="dec-t">Findings</span><span>PR review · pass 1</span><span class="prog">1 of 4 decided</span></div>
    <div class="bd">${sum}<div class="fnds">${items}</div><div class="foot">A approves and D discards the finding in focus · Alt+↓ goes to the next one to decide. Ask the agent below to add, change or drop a finding.</div></div></fieldset>`;
}

// ---------------- The scenes ----------------
// Each scene: now, the tree row of the task, the stage, the position, the context, the ask bar(s), the composer,
// the chapters' state and the conversation that is current. ask: A version; askB: B version when it differs.
const SCENES = {
  plan: { now: "09:31", stage: 0, pos: "3 answered", ctx: 12, doneSteps: 0, cur: "prd", place: "prd",
    row: { sits: [{ sev: "wait", label: "Reply", place: "PRD", since: "2m", long: "2 minutes", min: 2 }], row: ["Reply · PRD", "Reply · PRD"], pos: "PRD" },
    ask: { kind: "tinted", label: "Reply", place: "PRD", s: { sev: "wait", since: "2m", long: "2 minutes" }, detail: "The agent asks in text · answer a or b, or in your own words", actions: "" },
    comp: { ph: "Answer the agent… a, b, or your own words", model: "Opus · high", quick: [["a", "Plans table, cached 60 s"], ["b", "Config, with a release"]] } },
  run: { now: "14:23", stage: 3, step: 3, pos: "Step 3 of 7", ctx: 38, doneSteps: 2, cur: "s3", place: "s3i", loop: "round1",
    row: { run: { who: "Implementer", turn: "4m", long: "3 minutes 40 seconds", verb: "Running", target: "go test ./internal/ratelimit/... -race", short: "go test …/ratelimit" }, pos: "Step 3/7 · Addressing review · round 1", posShort: "Step 3/7 · round 1", ctx: 38 },
    ask: null, comp: { ph: "Queue a message for the implementer…", model: "Sonnet · high", working: "Implementer working · 3m 40s" }, scrolled: true },
  ask: { now: "14:56", stage: 3, step: 3, pos: "Step 3 of 7", ctx: 44, doneSteps: 2, cur: "s3", place: "s3r", loop: "pass2",
    row: { sits: [{ sev: "wait", label: "Question", place: "Reviewer", since: "18m", long: "18 minutes", min: 18 }, { sev: "wait", label: "Permission", place: "Implementer", since: "4m", long: "4 minutes", min: 4 }], row: ["Question · Reviewer · Step 3/7", "Question · Step 3/7"], pos: "Step 3 of 7 · Agent review · pass 2" },
    ask: { kind: "two", reqs: [{ label: "Question", place: "Reviewer", s: { sev: "wait", since: "18m", long: "18 minutes" }, card: "askcard" }, { label: "Permission", place: "Implementer", s: { sev: "wait", since: "4m", long: "4 minutes" }, card: "askcard2" }] },
    comp: { ph: "Answer with 1–3, or reply to the reviewer…", model: "Opus · high" } },
  error: { now: "14:41", stage: 3, step: 3, pos: "Step 3 of 7", ctx: 41, doneSteps: 2, cur: "s3", place: "s3r", loop: "pass2err",
    row: { sits: [{ sev: "error", label: "Session error", place: "Reviewer", since: "5m", long: "5 minutes", min: 5 }], row: ["Session error · Reviewer · Step 3/7", "Session error · Step 3/7"], pos: "Step 3 of 7 · Agent review · pass 2" },
    ask: { kind: "error", label: "Session error", place: "Reviewer · pass 2", s: { sev: "error", since: "5m", long: "5 minutes" }, detail: "Claude Code stopped unexpectedly · exit status 1", actions: `<button class="btn sm primary" data-tip="Start the reviewer's session again; pass 2 goes on">Retry reviewer</button>` },
    comp: { ph: "Sending restarts the reviewer's session…", model: "Opus · high" } },
  manual: { now: "15:43", stage: 3, step: 4, pos: "Step 4 of 7", ctx: 29, doneSteps: 3, cur: "s4", place: "s4i", loop: "manual",
    row: { sits: [{ sev: "wait", label: "Review step 4", place: "71% staged", since: "9m", long: "9 minutes", min: 9 }], row: ["Review · Step 4/7 · 71% staged", "Review · Step 4/7"], pos: "Step 4 of 7" },
    ask: { kind: "tinted", label: "Review step 4", place: "", s: { sev: "wait", since: "9m", long: "9 minutes" }, detail: "5 of 7 files staged · 71%", actions: `<button class="btn sm">${I("vscode")}Open in VS Code</button><span class="why" id="why-approve">Stage 2 more files</span><button class="btn sm primary" disabled aria-describedby="why-approve">Approve</button>` },
    comp: { ph: "Ask the implementer for a change…", model: "Sonnet · high" } },
  blocked: { now: "16:05", stage: 3, step: 5, pos: "Step 5 of 7", ctx: null, doneSteps: 4, cur: "s5", place: "s5i", loop: "blocked",
    row: { sits: [{ sev: "error", label: "Step 5 blocked", place: "worktree not clean", since: "6m", long: "6 minutes", min: 6 }], row: ["Step 5/7 blocked · worktree not clean", "Step 5/7 blocked"], pos: "Step 5 of 7" },
    ask: { kind: "error", label: "Step 5 blocked", place: "worktree not clean", s: { sev: "error", since: "6m", long: "6 minutes" }, detail: "3 files changed outside a step", actions: `<button class="btn sm" data-tip="Discard the 3 files and start step 5">Clean and start…</button><button class="btn sm primary" data-tip="Check the worktree again">Try again</button>` },
    comp: { disabled: true, ph: "Step 5 opens its conversation once the worktree is clean.", why: "No session yet", model: "Sonnet · high" } },
  checks: { now: "17:38", stage: 5, pos: "waiting for checks · 3 of 5", ctx: 18, doneSteps: 7, cur: "pr", place: "prr",
    row: { gh: true, pos: "PR review · checks 3/5" },
    ask: null, comp: { disabled: true, ph: "The review conversation starts when the checks finish.", why: "Checks running", model: "Opus · high" } },
  findings: { now: "18:02", stage: 5, pos: "pass 1 · 1 of 4 decided", ctx: 33, doneSteps: 7, cur: "prr", place: "prr",
    row: { sits: [{ sev: "wait", label: "Findings", place: "PR review", since: "12m", long: "12 minutes", min: 12 }], row: ["Findings · PR review · 1 of 4", "Findings · 1/4"], pos: "PR review · pass 1" },
    ask: { kind: "tinted", label: "Decide findings", place: "PR review · pass 1", s: { sev: "wait", since: "12m", long: "12 minutes" }, detail: "1 of 4 decided", actions: `<button class="btn sm" data-tip="The next finding to decide · Alt+↓">${I("arrow-down")}Next to decide <span class="k">Alt ↓</span></button><span class="why" id="why-apply">Decide 3 more</span><button class="btn sm primary" disabled aria-describedby="why-apply">Apply approved</button>` },
    comp: { ph: "Ask the reviewer to add, change or drop a finding…", model: "Opus · high" } },
  close: { now: "20:44", stage: 6, pos: "#1284 merged", ctx: 36, doneSteps: 7, cur: "prr", place: "prr",
    row: { sits: [{ sev: "close", label: "Ready to close", place: "PR #1284 merged", since: "2h", long: "2 hours", min: 120 }], row: ["Ready to close · PR #1284 merged", "Ready to close · #1284"], pos: "Closing" },
    ask: { kind: "tinted", sev: "close", label: "Ready to close", place: "#1284 merged", s: { sev: "close", since: "2h", long: "2 hours" }, detail: "Removes the worktree and the branch, then updates dev", actions: `<button class="btn sm primary" data-tip="Close the task and archive it">Close task</button>` },
    comp: { ph: "Reply to the PR reviewer…", model: "Opus · high" } },
};
const SC = SCENES[SC_KEY];
Object.assign(ITEMS.t1, SC.row);

// What each chapter is, done or current, with its summary line. Steps carry their loop and their commit.
const STEP_DONE = {
  1: { sha: "a41c9e2", sub: "Add rate limit config per plan", loop: "2 passes · round 1 of 3", at: "10:35", acts: 61 },
  2: { sha: "7be0d13", sub: "Cache API key lookups for 60 seconds", loop: "1 pass · clean", at: "11:02", acts: 48 },
  3: { sha: "c19f02e", sub: "Add a token bucket rate limiter per API key", loop: "2 passes · 1 question", at: "13:48", acts: 142 },
  4: { sha: "3e8d21a", sub: "Add Retry-After and X-RateLimit headers", loop: "Manual · you approved", at: "15:11", acts: 38 },
  5: { sha: "5a90b7c", sub: "Read limits from the plans table", loop: "1 pass · clean", at: "16:08", acts: 57 },
  6: { sha: "9d14e02", sub: "Count throttled requests per plan", loop: "2 passes · round 1 of 3", at: "16:31", acts: 66 },
  7: { sha: "e7c3f51", sub: "Document rate limits per plan", loop: "1 pass · clean", at: "17:02", acts: 19 },
};
