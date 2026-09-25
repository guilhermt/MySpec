/* =====================================================================
   ROUND 15 · the specimen: every entry the three treatments draw, in
   every state, light and dark side by side. Hover, focus and press are
   shown by the classes is-hover, is-focus and is-active, which the
   treatments' CSS maps to the same look as the real state.
   ===================================================================== */
const SPEC = [];
const GA = (at, n, roll, extra = {}) => ({ t: "acts", at, n, roll, dur: "1 min 50 s", rows: [R("Read the step file", "cat .myspec/rate-limit-per-api-key/steps/03-token-bucket.md", "done", "0.1 s"), R("Find the API key middleware", "grep -rn \"X-API-Key\" internal/http", "done", "0.2 s")], ...extra });
const SP = (who, html, extra = {}) => ({ t: "agent", who, at: "13:52", html, ...extra });
const MKX = (extra = {}) => ({ t: "mark", at: "14:19", icon: "file", text: "Review 1 written", n: "changes · 2 findings", kind: "rpt", body: `<ol class="flist"><li><span class="fn">1</span><span>Evict buckets idle for more than 10 minutes.<span class="loc">internal/ratelimit/limiter.go:22</span></span></li></ol>`, ...extra });
const FOLD = (extra = {}) => ({ t: "fold", n: 1, title: "Started with", sub: "steps/06-throttle-metrics.md", at: "16:12", to: "16:48", speeches: 5, actions: 71, entries: LONG.impl[0].entries.slice(0, 4), ...extra });
const U = (extra = {}) => ({ t: "user", at: "14:28", text: "Also log the key id, never the key, when a bucket is evicted.", ...extra });
const EARLIER_LOADING = (h) => h.replace(/<button class="earlier" type="button">[\s\S]*?<\/button>/, `<button class="earlier is-loading" type="button" aria-busy="true"><span class="shim">Loading 15 earlier actions…</span></button>`);
const EARLIER_ERROR = (h) => h.replace(/<button class="earlier" type="button">[\s\S]*?<\/button>/, `<span class="earlier-err">Couldn't load the earlier actions<button class="btn ghost xs" type="button">Try again</button></span>`);
const MBODY = /<div class="mbody">[\s\S]*?<div class="mfoot">[\s\S]*?<\/div><\/div>/;
const MARK_LOADING = (h) => h.replace(MBODY, `<div class="mbody"><span class="shim">Reading reviews/step-03/review-1.md…</span></div>`);
const MARK_ERROR = (h) => h.replace(MBODY, `<div class="mbody err">Couldn't read reviews/step-03/review-1.md: the file is gone from the worktree.<button class="btn ghost xs" type="button">Try again</button></div>`);
const FOLD_LOADING = (h) => h.replace(/<div class="(dfold-in|t-fold-in|cfold-in)">[\s\S]*<\/div><\/(details|section)>$/, `<div class="$1"><span class="shim">Opening 11 entries…</span></div></$2>`);
const FOLD_ERROR = (h) => h.replace(/<div class="(dfold-in|t-fold-in|cfold-in)">[\s\S]*<\/div><\/(details|section)>$/, `<div class="$1"><span class="earlier-err">Couldn't read this stretch of the conversation<button class="btn ghost xs" type="button">Try again</button></span></div></$2>`);
const USER_SENDING = (h) => h.replace(/(You · 14:28|<span class="cct">14:28<\/span>)/, (m) => m.includes("cct") ? `<span class="cct sending">${st("run")}Sending…</span>` : `<span class="sending">${st("run")}Sending…</span>`).replace('<div class="tut">', `<div class="tq sending">${st("run")}Sending…</div><div class="tut">`);
const USER_ERROR = (h) => h.replace(/(You · 14:28|<span class="cct">14:28<\/span>)/, (m) => m.includes("cct") ? `<span class="cct bad">Not sent · the session stopped</span><button class="btn ghost xs">Send again</button>` : `<span class="bad">Not sent · the session stopped</span><button class="btn ghost xs">Send again</button>`).replace('<div class="tut">', `<div class="tq bad">Not sent · the session stopped<button class="btn ghost xs">Send again</button></div><div class="tut">`);
const open = (h) => /<details/.test(h) ? h.replace(/<details class="([^"]*)"( open)?/, '<details class="$1" open') : h.replace('class="cfold"', 'class="cfold is-open"').replace(/class="cc min"/g, 'class="cc min is-open"');
const cls = (c) => (h) => h.replace(/class="/, `class="${c} `);
const onSummary = (c) => (h) => h.replace(/<summary class="/, `<summary class="${c} `).replace(/<summary (aria)/, `<summary class="${c}" $1`);

// Each treatment: [name, note, cells], a cell is [state, entry, transform].
const DOCS = {
  a: { name: "A · Document", wrap: (h) => `<div class="cv doc">${h}</div>`, render: (e) => docEntries([e]) },
  b: { name: "B · Timeline", wrap: (h) => `<div class="cv tl">${h}</div>`, render: (e) => { TL_LAST = ""; return tlEntries([e]); } },
  c: { name: "C · Light cards", wrap: (h) => `<div class="cv cards">${h}</div>`, render: (e) => cEntries([e]) },
};
const SPEECH = `<p>I'll add the bucket to <code>internal/ratelimit</code> and wire it into the API key middleware.</p>`;
const GROUPS = {
  speech: ["The agent's speech", "Not interactive: it reads, and takes the focus on the keyboard path. Streaming and interrupted are its states.", [
    ["default · implementer", SP("impl", SPEECH)], ["reviewer", SP("rev", SPEECH)], ["focus", SP("impl", SPEECH), cls("is-focus")],
    ["streaming", SP("impl", `<p>I'll add the bucket to <code>internal/ratelimit</code> and wire</p>`, { streaming: true })], ["interrupted", SP("rev", `<p>Before the tests, the docs: Pro gets 600 requests per minute, while the config ships</p>`, { interrupted: true })],
    ["a question in text · waits", SP("agent", `<p class="ask-p">Where should the limits live? <strong>a)</strong> In the <code>plans</code> table. <strong>b)</strong> In <code>config/plans.yaml</code>.</p>`)],
    ["a question in text · answered", SP("agent", `<p class="ask-p done">Should <code>internal</code> keys stay exempt?</p>`)]]],
  user: ["Your message", "Sending and not sent are its loading and error; queued is removable.", [
    ["default", U()], ["from the queue", U({ fromQueue: true })], ["queued", U({ queued: true })], ["focus", U(), cls("is-focus")], ["sending", U(), USER_SENDING], ["error · not sent", U(), USER_ERROR]]],
  acts: ["A group of actions", "Folded by default. Loading and error belong to the earlier actions, read on demand. It has no disabled state: a group always opens.", [
    ["default", GA("13:48", 14, "Read 8 · Searched 4 · git 2", { earlier: 8 })], ["hover", GA("13:48", 14, "Read 8 · Searched 4 · git 2"), "hover"], ["focus", GA("13:48", 14, "Read 8 · Searched 4 · git 2"), "focus"],
    ["open · active", GA("13:48", 14, "Read 8 · Searched 4 · git 2", { open: true, earlier: 8 })],
    ["live", GA("14:19", 11, "", { live: ["Run the refill and eviction tests", "go test ./internal/ratelimit/... -race -run 'Evict|Refill'", "12 s"] })],
    ["failed", GA("14:36", 7, "Read 3 · Tests 2", { fail: 1, rows: [R("Run the rate limit tests", "go test ./internal/ratelimit/... -race", "error", "exit 1 · 8.2 s")], open: true })],
    ["failed, then passed", GA("13:53", 21, "Wrote 6 · Read 5 · Tests 4", { fail: 1, recovered: true })],
    ["waits for your permission", GA("14:51", 3, "Read 1 · Make 1", { hold: true, rows: [R("Apply the migration to api_dev", "the command in the card below", "wait", "waits for your permission")] })],
    ["loading · earlier actions", GA("13:48", 14, "Read 8 · Searched 4", { open: true, earlier: 15 }), EARLIER_LOADING], ["error · earlier actions", GA("13:48", 14, "Read 8 · Searched 4", { open: true, earlier: 15 }), EARLIER_ERROR],
    ["subagent", { ...CONV.review.impl[2], rows: CONV.review.impl[2].rows.slice(2, 3), earlier: 0, open: true }, (h) => h.replace('<details class="subag">', '<details class="subag" open>')]]],
  mark: ["A milestone", "One line; the one with content opens in place. Disabled is a document discarded by a restart; reading its content is a read, so loading shimmers.", [
    ["default", MKX()], ["hover", MKX(), "hover"], ["focus", MKX(), "focus"], ["open · active", MKX(), open],
    ["product message", { t: "mark", at: "14:19", icon: "product", text: "MySpec → Implementer", n: "Review 1 · 2 findings · round 1 of 3", kind: "product", body: "<p>The agent review of this step found changes…</p>" }],
    ["event without content", { t: "mark", at: "17:33", icon: "compact", text: "Context compacted", n: "at 81% · the session goes on", kind: "compact" }],
    ["retried on its own", { t: "mark", at: "14:33", icon: "retry", text: "Retried on its own", n: "the API was overloaded · 2 attempts · went through at 14:34", kind: "retry" }],
    ["disabled · discarded", { t: "mark", at: "09:41", icon: "file", text: "PRD written", n: "discarded with the restart at 10:02", kind: "event gone" }],
    ["loading", MKX(), (h) => MARK_LOADING(open(h))], ["error", MKX(), (h) => MARK_ERROR(open(h))]]],
  fold: ["A stretch of the past (long sessions)", "A folds it behind its rule, B compresses it on a dashed span of the thread, C collapses each speech to one line.", [
    ["default", FOLD()], ["hover", FOLD(), "hover"], ["focus", FOLD(), "focus"], ["open · active", FOLD(), open], ["loading", FOLD(), (h) => FOLD_LOADING(open(h))], ["error", FOLD(), (h) => FOLD_ERROR(open(h))]]],
};
// Per treatment, how hover and focus land: on the summary or on the entry.
function applyState(v, h, s) {
  if (s !== "hover" && s !== "focus") return s(h);
  const c = `is-${s}`;
  if (/<summary/.test(h)) return onSummary(c)(h);
  if (v === "c") return h.replace(/<(article|section|div) class="/, `<$1 class="${c} `);
  return cls(c)(h);
}
function cell(v, [label, e, fx]) {
  let h = DOCS[v].render(e);
  if (fx) h = applyState(v, h, fx);
  return `<div class="cell"><span class="sl">${label}</span>${DOCS[v].wrap(h)}</div>`;
}
function modes(inner) {
  return `<div class="modes"><div class="mode" data-theme="light"><div class="mcap">Light</div>${inner}</div><div class="mode" data-theme="dark"><div class="mcap">Dark</div>${inner}</div></div>`;
}
const SHARED = () => {
  const rows = [R("Read the finding's file", "sed -n '1,60p' internal/ratelimit/limiter.go", "done", "0.1 s"), R("Run the rate limit tests", "go test ./internal/ratelimit/... -race", "error", "exit 1 · 8.2 s"), R("Run the refill and eviction tests", "go test ./internal/ratelimit/... -race -run 'Evict|Refill'", "running", "12 s"), R("Run the linter", "golangci-lint run ./...", "interrupted", "stopped with the session"), R("Apply the migration to api_dev", "the command in the card below", "wait", "waits for your permission")];
  const nm = (c, extra = "") => `<div class="tomsg static"><button class="newmsg2 ${c}" type="button">${I("arrow-down")}<span class="nm-l">New messages</span><span class="nm-n">2</span><span class="nm-sep" aria-hidden="true"></span>${st("run")}<span class="nm-w">Implementer writing</span></button></div>${extra}`;
  const nothing = `<div class="tomsg static"><button class="newmsg2 only" type="button" aria-label="Go to the end">${I("arrow-down")}</button></div>`;
  return `<section class="cs"><h2>Shared · the action row</h2><p>The description the agent wrote, the command dimmed, and the duration or the exit code. The state is the icon and, for a failure, the red of the label.</p>
    ${modes(`<div class="cell wide"><span class="sl">done · error · running · interrupted · waits</span><ul class="arows">${rows.map(actRow).join("")}</ul></div>`)}</section>
    <section class="cs"><h2>Shared · the way back to the end</h2><p>Out of the end, it names what arrived and who works. It leaves once you are at the end.</p>
    ${modes(`<div class="cell"><span class="sl">default</span>${nm("")}</div><div class="cell"><span class="sl">hover</span>${nm("is-hover")}</div><div class="cell"><span class="sl">focus</span>${nm("is-focus")}</div><div class="cell"><span class="sl">active</span>${nm("is-active")}</div><div class="cell"><span class="sl">nothing new</span>${nothing}</div>`)}</section>
    <section class="cs"><h2>Shared · mermaid</h2><p>The figure on the sunken ground, the language and full screen; the diagram in the ink of the text.</p>${modes(`<div class="cell wide"><span class="sl">default · full screen in hover</span>${MERMAID.replace('class="btn ghost xs icon"', 'class="btn ghost xs icon is-hover"')}</div>`)}</section>`;
};
function build() {
  let html = `<main class="spec"><header><h1>Conversation components</h1><p>Round 15. Every entry the three treatments draw, in every state, light and dark side by side. Hover, focus and pressed are drawn with the classes the real states map to.</p></header>`;
  for (const v of ["a", "b", "c"]) {
    html += `<h2 class="vh">${DOCS[v].name}</h2>`;
    for (const [key, [title, note, cells]] of Object.entries(GROUPS)) {
      const inner = cells.map((c) => cell(v, c)).join("");
      html += `<section class="cs"><h2>${title}</h2><p>${note}</p>${modes(inner)}</section>`;
    }
  }
  html += SHARED() + `</main>`;
  return html;
}
document.addEventListener("DOMContentLoaded", () => {
  document.body.insertAdjacentHTML("afterbegin", SPRITE);
  document.body.insertAdjacentHTML("beforeend", build());
});
// ?audit: the contrast of every text on its ground and the controls without a name, in both modes.
if (Q.has("audit")) document.addEventListener("DOMContentLoaded", () => { document.body.insertAdjacentHTML("beforeend", '<pre id="report" class="report" hidden></pre>'); setTimeout(audit, 1200); });
