/* =====================================================================
   ROUND 16 · the specimen: every piece of the wide conversation, in
   every state, for both variations, light and dark side by side. Hover,
   focus and press are drawn with the classes is-hover, is-focus and
   is-press, which the CSS maps to the same look as the real states.
   ===================================================================== */
const SPEECH = `<p>I'll add the bucket to <code>internal/ratelimit</code> and wire it into the API key middleware. The config from step 1 already exposes <code>burst</code> and <code>refill_per_second</code>.</p>`;
const SP = (extra = {}) => ({ t: "agent", who: "impl", at: "13:52", html: SPEECH, ...extra });
const U = (extra = {}) => ({ t: "user", at: "14:28", text: "Also log the key id, never the key, when a bucket is evicted.", ...extra });
const G = (extra = {}) => ({ t: "acts", at: "13:48", n: 14, roll: "Read 8 · Searched 4 · git 2", dur: "1 min 50 s", rows: [R("Read the step file", "cat .myspec/rate-limit-per-api-key/steps/03-token-bucket.md", "done", "0.1 s"), R("Find the API key middleware", "grep -rn \"X-API-Key\" internal/http", "done", "0.2 s")], ...extra });
const MKS = (extra = {}) => ({ t: "mark", at: "14:19", icon: "file", text: "Review 1 written", n: "changes · 2 findings", kind: "rpt", body: `<ol class="flist"><li><span class="fn">1</span><span>Evict buckets idle for more than 10 minutes.<span class="loc">internal/ratelimit/limiter.go:22</span></span></li></ol>`, foot: "Open in Reports", ...extra });
const FOLD = () => ({ ...LONG.impl[0], entries: LONG.impl[0].entries.slice(0, 4) });
const cls = (c) => (h) => h.replace(/class="/, `class="${c} `);
const onSummary = (c) => (h) => h.replace(/<summary class="/, `<summary class="${c} `).replace(/<summary (data-nav|aria)/, `<summary class="${c}" $1`);
const onRow = (c) => (h) => h.replace(/class="wrs"/, `class="wrs ${c}"`);
const MBODY = /<div class="mbody">[\s\S]*?<\/div><\/div>(?=<\/details>)/;

const LOAD_OUT = (h) => h.replace(/<div class="wout[^"]*">[\s\S]*<\/div>(?=<\/details>)/, `<div class="wout load"><div class="wmore" aria-busy="true"><span class="shim">Reading the output…</span></div></div>`);
const FAIL_OUT = (h) => h.replace(/<div class="wout[^"]*">[\s\S]*<\/div>(?=<\/details>)/, `<div class="wout fail"><div class="wmore bad">Couldn't read the output: the session's log is gone.<button class="btn ghost xs" type="button">Try again</button></div></div>`);
const openD = (h) => h.replace(/<details class="([^"]*)"\s*(open)?/, '<details class="$1" open');

// Sending and not sent take the place of the head (b's name and time, a's time on hover).
const userHead = (h, head) => h.replace(/<div class="wuh">[\s\S]*?<\/div>|<span class="wat">[^<]*<\/span>/, head);
// A cell is [state, html].
function groups(v) {
  W.v = v;
  const sp = (e, show = true) => wSpeech(e, show);
  const row = (r, o = {}) => `<ul class="wrows">${wRow(r, o)}</ul>`;
  const inGroup = (h) => `<div class="wgb">${h}</div>`;
  const test = R("Run the rate limit tests", "go test ./internal/ratelimit/... -race", "done", "7.9 s");
  const fail = R("Run the rate limit tests", "go test ./internal/ratelimit/... -race", "error", "exit 1 · 8.2 s");
  const run = R("Run the refill and eviction tests", "go test ./internal/ratelimit/... -race -run 'Evict|Refill'", "running", "12 s");
  return [
    ["The agent's speech", "Text on the page, edge to edge of the column, like everything else in the conversation; its code and tables take the same width. The author is a word in a band above the text, written when the voice changes; hover and focus show it with the time on every speech. The band is always there, so nothing moves.", [
      ["default · the voice changes", sp(SP())], ["the same voice · quiet", sp(SP(), false)], ["hover · who and when", cls("is-hover")(sp(SP(), false))], ["focus", cls("is-focus")(sp(SP()))],
      ["streaming", sp(SP({ html: `<p>I'll add the bucket to <code>internal/ratelimit</code> and wire</p>`, streaming: true }))],
      ["interrupted", sp(SP({ who: "rev", html: `<p>Before the tests, the docs: Pro gets 600 requests per minute, while the config ships</p>`, interrupted: true }))],
      ["a question in text · waits", sp(SP({ who: "agent", html: `<p class="ask-p">Where should the limits live? <strong>a)</strong> In the <code>plans</code> table. <strong>b)</strong> In <code>config/plans.yaml</code>.</p>` }))],
      ["a code block · the same width as the text", sp(SP({ html: `<p>The middleware checks the limit <strong>after</strong> resolving the key:</p>${GO_AUTH}` }))]]],
    ["Your message", "Its own ground, the same width as the speech. Sending and not sent are its loading and error; queued is removable. The time shows on hover and focus.", [
      ["default", wUser(U())], ["hover · the time", cls("is-hover")(wUser(U()))], ["focus", cls("is-focus")(wUser(U()))], ["queued", wUser(U({ queued: true }))],
      ["sending", userHead(wUser(U()), `<div class="wuh sending">${st("run")}Sending…</div>`)],
      ["error · not sent", userHead(wUser(U()), `<div class="wuh"><span class="bad">Not sent · the session stopped</span><button class="btn ghost xs" type="button">Send again</button></div>`)]]],
    ["A group of actions", "Folded by default: what it did, what failed, what runs now, and the duration, whose tooltip has the start. It has no disabled state: a group always opens.", [
      ["default", wGroup(G({ earlier: 8 }))], ["hover", onSummary("is-hover")(wGroup(G()))], ["focus", onSummary("is-focus")(wGroup(G()))], ["pressed", onSummary("is-press")(wGroup(G()))],
      ["open · active", wGroup(G({ earlier: 8 }), { open: true })],
      ["live · the action in flight", wGroup(G({ n: 11, live: ["Run the refill and eviction tests", "go test ./internal/ratelimit/... -race -run 'Evict|Refill'", "12 s"] }))],
      ["failed", wGroup(G({ n: 7, roll: "Read 3 · Tests 2", fail: 1, dur: "4 min" }))], ["failed, then passed", wGroup(G({ n: 21, roll: "Wrote 6 · Read 5 · Tests 4", fail: 1, recovered: true, dur: "12 min" }))],
      ["waits for your permission", wGroup(G({ n: 3, roll: "Read 1 · Make 1", hold: true, dur: "", rows: [R("Apply the migration to api_dev", "the command in the card below", "wait", "waits for your permission")] }), { open: true })],
      ["loading · earlier actions", wGroup(G({ earlier: 15 }), { open: true }).replace(/<button class="earlier"[^>]*>[\s\S]*?<\/button>/, `<button class="earlier is-loading" type="button" aria-busy="true"><span class="shim">Loading 15 earlier actions…</span></button>`)],
      ["error · earlier actions", wGroup(G({ earlier: 15 }), { open: true }).replace(/<button class="earlier"[^>]*>[\s\S]*?<\/button>/, `<span class="earlier-err">Couldn't load the earlier actions<button class="btn ghost xs" type="button">Try again</button></span>`)],
      ["a subagent, nested", wGroup({ ...CONV.review.impl[2], rows: CONV.review.impl[2].rows.slice(2, 3), earlier: 0 }, { open: true, subOpen: true })]]],
    ["A command", "The unit of the actions: the description the agent wrote, the command dimmed, the duration or the exit code. Its output is folded; a failure keeps its tail open. A command that printed nothing, or whose output was not kept, has no fold (the disabled state).", [
      ["default · folded", inGroup(row(test))], ["hover", inGroup(onRow("is-hover")(row(test)))], ["focus", inGroup(onRow("is-focus")(row(test)))], ["pressed", inGroup(onRow("is-press")(row(test)))],
      ["open · the output", inGroup(row(R("Read the auth middleware", "sed -n '20,90p' internal/http/middleware/auth.go", "done", "0.1 s"), { outOpen: true }))],
      ["running · the output as it comes", inGroup(row(run, { outOpen: true }))], ["failed · the tail stays open", inGroup(row(fail))],
      ["interrupted", inGroup(row(R("Run the linter", "golangci-lint run ./...", "interrupted", "stopped with the session"), { outOpen: true }))],
      ["no output · disabled", inGroup(row(R("Write the bucket", "cat > internal/ratelimit/bucket.go <<'EOF'", "done", "0.1 s")))],
      ["loading · the output", inGroup(LOAD_OUT(row(test, { outOpen: true })))], ["error · the output", inGroup(FAIL_OUT(row(test, { outOpen: true })))]]],
    ["A milestone", "The discreet line; the one with content opens in place, the width of the column, and is a stop on the keyboard path; the one without content is read, not operated. The time shows on hover and focus. Disabled is a document discarded by a restart; reading the content is a read, so loading shimmers.", [
      ["default", wMark(MKS())], ["hover · the time", onSummary("is-hover")(wMark(MKS()))], ["focus", onSummary("is-focus")(wMark(MKS()))], ["open · active", wMark(MKS(), { open: true })],
      ["the product's message", wMark({ t: "mark", at: "14:19", icon: "product", text: "MySpec → Implementer", n: "Review 1 · 2 findings · round 1 of 3", kind: "product", body: "<p>The agent review of this step found changes…</p>" })],
      ["an event without content", wMark({ t: "mark", at: "17:33", icon: "compact", text: "Context compacted", n: "at 81% · the session goes on", kind: "compact" })],
      ["retried on its own", wMark({ t: "mark", at: "14:33", icon: "retry", text: "Retried on its own", n: "the API was overloaded · 2 attempts", kind: "retry" })],
      ["disabled · discarded", wMark({ t: "mark", at: "09:41", icon: "file", text: "PRD written", n: "discarded with the restart", kind: "event gone" })],
      ["loading", wMark(MKS(), { open: true }).replace(MBODY, `<div class="mbody"><span class="shim">Reading reviews/step-03/review-1.md…</span></div>`)],
      ["error", wMark(MKS(), { open: true }).replace(MBODY, `<div class="mbody err">Couldn't read reviews/step-03/review-1.md: the file is gone from the worktree.<button class="btn ghost xs" type="button">Try again</button></div>`)]]],
    ["A stretch of the past", "In a long session, what came before the latest round folds behind one line. It is not a milestone: its own icon, and the size first (5 speeches · 27 actions), then where it began. Open, the entries as they were.", [
      ["default", wFold(FOLD())], ["hover · the time", onSummary("is-hover")(wFold(FOLD()))], ["focus", onSummary("is-focus")(wFold(FOLD()))], ["open · active", wFold(FOLD(), { open: true })],
      ["loading", wFold(FOLD(), { open: true, inner: `<div class="mbody"><span class="shim">Opening 11 entries…</span></div>` })],
      ["error", wFold(FOLD(), { open: true, inner: `<div class="mbody err">Couldn't read this stretch of the conversation.<button class="btn ghost xs" type="button">Try again</button></div>` })]]],
    ["The question and the permission", "The only blocks with a contour. Answered, the question is a flat block without it.", [
      ["question · waits", `<article class="wrq">${reqCard({ t: "question", at: "14:38", q: "Should a request with an unknown API key be rate limited before the auth check?", opts: [["Yes, by client IP with the anonymous plan", "Protects the key lookup from floods."], ["No, reject it with 401 first", "Matches the spec literally."]] })}</article>`],
      ["permission · waits", `<article class="wrq">${reqCard({ t: "permission", at: "14:52", tool: "Bash", desc: "Apply the migration to the local database <code>api_dev</code>.", cmd: "make migrate-local DATABASE_URL=postgres://localhost:5432/api_dev", foot: "Not in the allowed commands of this session." })}</article>`],
      ["question · answered", `<article class="wrq">${reqCard(CONV.planning.impl[5])}</article>`]]],
    ["Long code", "Past 24 lines, a block shows the first 20 and the rest on demand, so one answer never pushes the next entries out of sight.", [
      ["default · clipped", `<div class="prose">${GO_LIMITER}</div>`], ["hover", `<div class="prose">${GO_LIMITER}</div>`, "hover"], ["focus", `<div class="prose">${GO_LIMITER}</div>`, "focus"], ["open", `<div class="prose">${GO_LIMITER}</div>`, "open"]]],
  ];
}
function cellHTML(v, [label, h, fx]) {
  return `<div class="cell" data-fx="${fx || ""}"><span class="sl">${label}</span><div class="cv wv w${v}">${h}</div></div>`;
}
function modes(inner) {
  return `<div class="modes"><div class="mode" data-theme="light"><div class="mcap">Light</div>${inner}</div><div class="mode" data-theme="dark"><div class="mcap">Dark</div>${inner}</div></div>`;
}
function build() {
  let html = `<main class="spec"><header><h1>Wide conversation components</h1><p>Round 16, one width for everything. Every piece of the two variations in every state, light and dark side by side. Hover, focus and pressed are drawn with the classes the real states map to.</p></header>`;
  for (const [v, name] of [["a", "a · Column of 960 px, body 15/22"], ["b", "b · Fluid up to 1120 px, body 16/26"]]) {
    html += `<h2 class="vh">${name}</h2>`;
    for (const [title, note, cells] of groups(v)) html += `<section class="cs"><h2>${title}</h2><p>${note}</p>${modes(cells.map((c) => cellHTML(v, c)).join(""))}</section>`;
  }
  const nm = (c) => `<div class="tomsg static"><button class="newmsg2 ${c}" type="button">${I("arrow-down")}<span class="nm-l">New messages</span><span class="nm-n">2</span><span class="nm-sep" aria-hidden="true"></span>${st("run")}<span class="nm-w">Implementer writing</span></button></div>`;
  html += `<section class="cs"><h2>Shared · the way back to the end</h2><p>Out of the end, it names what arrived and who works. It leaves once you are at the end.</p>${modes(["", "is-hover", "is-focus", "is-active"].map((c) => `<div class="cell"><span class="sl">${c ? c.slice(3) : "default"}</span>${nm(c)}</div>`).join("") + `<div class="cell"><span class="sl">nothing new</span><div class="tomsg static"><button class="newmsg2 only" type="button" aria-label="Go to the end">${I("arrow-down")}</button></div></div>`)}</section>`;
  html += `<section class="cs"><h2>Shared · the activity</h2><p>No time: what happens now, with the spinner.</p>${modes(`<div class="cell"><span class="sl">retrying</span><div class="cv wv wa">${wEntry({ t: "activity", at: "14:40", text: "Retrying · attempt 3 of 10", sub: "the API is overloaded · next try in 8 s" })}</div></div>`)}</section>`;
  return html + `</main>`;
}
document.addEventListener("DOMContentLoaded", () => {
  document.body.insertAdjacentHTML("afterbegin", SPRITE + SPRITE_15);
  document.body.insertAdjacentHTML("beforeend", build());
  clipCode(document); snapWide(document);
  // Long code: the states of its button, drawn on the button.
  document.querySelectorAll('.cell[data-fx="hover"] [data-allcode]').forEach((b) => b.classList.add("is-hover"));
  document.querySelectorAll('.cell[data-fx="focus"] [data-allcode]').forEach((b) => b.classList.add("is-focus"));
  document.querySelectorAll('.cell[data-fx="open"] [data-allcode]').forEach((b) => b.click());
});
if (Q.has("audit")) document.addEventListener("DOMContentLoaded", () => { document.body.insertAdjacentHTML("beforeend", '<pre id="report" class="report" hidden></pre>'); setTimeout(audit, 1200); });
