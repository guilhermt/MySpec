/* =====================================================================
   ROUND 16 · the wide conversation, refined from 15-c (light cards).
   What both variations share, as one renderer; a.js and b.js set W.v,
   and a.css and b.css give the width and the weight of the card.

   - No time on screen. The author is a small word in the corner of a
     card, written when the voice changes; the time shows beside it on
     hover and focus, and is always in the accessible name.
   - No avatar, no margin, no thread.
   - Actions are command blocks outside the cards: the label is the
     description the agent wrote, the command is dimmed, the output is
     folded. A failed command keeps the tail of its output open.
   - Milestones are the discreet line. A stretch of the past folds
     behind that same line.
   - The question and the permission are the only blocks with a contour.
   - Keyboard: the arrows walk every entry (a card, a group, a command of
     an open group, a milestone, a fold); → opens, ← folds; 1–9 answer on
     a card; one Tab stop for the conversation.
   ===================================================================== */
const W = { v: "a" };
const esc2 = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ---------------- The output of a command, folded ----------------
// The product keeps no output today (research/conversation.md §1.3): these are the tails a command prints,
// written for the mock. A command that prints nothing has no fold.
// The last lines of what the command printed: the tail, with the count of the lines above it.
const FILES = {
  "limiter.go": ["\tl.buckets[keyID] = b", "\treturn b", "}"],
  "bucket.go": ["\tb.tokens--", "\treturn true", "}"],
  "auth.go": ["\tif !h.limiter.For(key.ID).Allow(time.Now()) {", "\t\treturn tooManyRequests(w, h.limiter.RetryAfter(key.ID))", "\t}", "\tnext.ServeHTTP(w, r.WithContext(withKey(ctx, key)))"],
  "context.md": ["## Acceptance", "- Keys with the internal scope are exempt.", "- A limit change takes effect within 60 seconds."],
  "03-token-bucket.md": ["## Completion checklist", "- go test ./... -race", "- golangci-lint run", "- a burst test with 50 concurrent requests on one key"],
  "metrics.go": ["\tprometheus.MustRegister(requestsTotal)", "}"],
  default: ["\treturn nil", "}"],
};
function outputOf(cmd, s, note) {
  if (s === "wait" || s === "agent" || /<<'|python3 -|sed -i|gofmt|^cat >/.test(cmd)) return null;
  const file = (cmd.match(/([\w.-]+\.(?:go|md|sql|yaml))\b/) || [])[1] || "";
  if (/^go test/.test(cmd)) {
    if (s === "error") return { lines: ["=== RUN   TestBurstThenRefill", "--- FAIL: TestBurstThenRefill (0.02s)", "    bucket_test.go:48: request 21: got allowed, want throttled", "FAIL", "FAIL\tgithub.com/acme/api/internal/ratelimit\t8.214s"], more: 31, bad: true };
    if (s === "running") return { lines: ["=== RUN   TestEvictIdle", "--- PASS: TestEvictIdle (0.00s)", "=== RUN   TestRefillAfterBurst"], more: 0, live: true };
    if (/\.\/\.\.\. -race$/.test(cmd) && !/internal/.test(cmd)) return { lines: ["ok  \tgithub.com/acme/api/internal/http/middleware\t3.102s", "ok  \tgithub.com/acme/api/internal/keys\t1.877s", "ok  \tgithub.com/acme/api/internal/ratelimit\t8.034s"], more: 21 };
    return { lines: [`ok  \tgithub.com/acme/api/${(cmd.match(/\.\/(\S+?)\/?(?:\.\.\.)?(?:\s|$)/) || [, "internal/ratelimit"])[1].replace(/\/$/, "")}\t${(note.match(/[\d.]+/) || ["7.9"])[0]}s`], more: 0 };
  }
  if (/^golangci-lint/.test(cmd)) return s === "interrupted" ? { lines: ["level=info msg=\"[runner] linters took 14.2s\""], more: 0, note: "Stopped with the session" } : { lines: ["0 issues."], more: 0 };
  if (/^git diff.*--stat|^git diff --stat/.test(cmd)) return { lines: [" internal/ratelimit/bucket.go      | 48 ++++++++++++", " internal/ratelimit/limiter.go     | 61 ++++++++++++++++", " internal/http/middleware/auth.go  |  9 ++-", " 3 files changed, 114 insertions(+), 4 deletions(-)"], more: 0 };
  if (/^git log/.test(cmd)) return { lines: ["b41e0aa Read limits from the plans table", "7c2d913 Cache API keys for 60 s", "e09f1c2 Add the rate limit config"], more: 0 };
  if (/^git diff origin/.test(cmd)) return { lines: ["diff --git a/internal/ratelimit/bucket.go b/internal/ratelimit/bucket.go", "new file mode 100644", "index 0000000..9a41c7e"], more: 412 };
  if (/^grep/.test(cmd)) return { lines: [`internal/${file ? file : "http/middleware/gateway.go"}:22: ${/NewTicker/.test(cmd) ? "t := time.NewTicker(time.Minute)" : /delete\(/.test(cmd) ? "(no match)" : "limiter := rate.NewLimiter(rate.Limit(cfg.RPS), cfg.Burst)"}`], more: /delete\(/.test(cmd) ? 0 : 3 };
  if (/^(cat|sed -n)/.test(cmd)) { const lines = FILES[file] || FILES.default; return { lines, more: 40 + (file.length * 7) % 60 }; }
  if (/^gh run view/.test(cmd)) return { lines: ["e2e / rate-limit-burst  TestBurstThenRefill  ratelimit_test.go:61:", "    got 21 requests through, want 20", "##[error]Process completed with exit code 1."], more: 188 };
  if (/^make -n/.test(cmd)) return { lines: ["migrate -path migrations -database \"$DATABASE_URL\" up"], more: 0 };
  if (/^ls/.test(cmd)) return { lines: ["0041_api_keys.sql", "0042_plans.sql", "0043_plan_burst.sql"], more: 0 };
  if (/^diff/.test(cmd)) return { lines: ["< | Pro | 600 requests per minute |", "> requests_per_minute: 500"], more: 0 };
  return { lines: ["(no output)"], more: 0 };
}
function outputHTML(o) {
  const more = o.more ? `<div class="wmore"><span>${o.more} more lines above</span><button class="btn ghost xs" type="button" data-allout>Show all ${o.more + o.lines.length} lines</button></div>` : "";
  const note = o.note ? `<div class="wmore">${o.note}</div>` : "";
  return `<div class="wout ${o.bad ? "bad" : ""}">${more}<pre>${o.lines.map(esc2).join("\n")}${o.live ? `<span class="caret" aria-hidden="true"></span>` : ""}</pre>${note}</div>`;
}

// ---------------- A command: the unit of the actions ----------------
function wIcon(s) { return actIcon(s); }
function wRow(r, opts = {}) {
  const [label, cmd, s, note, sub] = r;
  if (s === "agent") {
    return `<li class="wrow sub"><details class="wsub" ${opts.subOpen ? "open" : ""}><summary data-nav tabindex="-1" aria-label="${esc2(label)}, ${sub.roll}, ${sub.dur}">${I("right", "i chev")}${wIcon("agent")}<span class="wl">${label}</span><span class="wsr">${sub.roll}</span><span class="wd">${sub.dur}</span></summary><ul class="wsubrows">${sub.rows.map((x) => wRow(x)).join("")}</ul></details></li>`;
  }
  const cls = s === "error" ? "is-err" : s === "running" ? "is-now" : s === "wait" ? "is-hold" : s === "interrupted" ? "is-int" : "";
  const o = opts.noOut ? null : outputOf(cmd, s, note || "");
  const line = `${o ? I("right", "i chev") : `<span class="nochev" aria-hidden="true"></span>`}${wIcon(s)}<span class="wl">${label}</span><span class="wc">${esc2(cmd)}</span><span class="wd">${note || s}</span>`;
  const name = `${esc2(label)}: ${esc2(cmd)}, ${note || s}`;
  // Without output there is nothing to open: the list item itself is the stop, named by what it did.
  if (!o) return `<li class="wrow ${cls}" data-nav tabindex="-1" aria-label="${name}"><div class="wrs">${line}</div></li>`;
  // A failure keeps the tail of its output open: it is what you need to see.
  const open = opts.outOpen ?? (s === "error");
  return `<li class="wrow ${cls}"><details class="wrd" ${open ? "open" : ""}><summary class="wrs" data-nav tabindex="-1" aria-label="${name}, output">${line}</summary>${outputHTML(o)}</details></li>`;
}
function wRows(g, opts = {}) {
  const earlier = g.earlier ? `<li class="wrow more"><button class="earlier" type="button" data-nav tabindex="-1">${I("up")}Show ${g.earlier} earlier actions</button></li>` : "";
  return `<ul class="wrows">${earlier}${g.rows.map((r) => wRow(r, opts)).join("")}</ul>`;
}
// A group of actions: folded, one line with what it did and what runs now; the duration carries the start time.
function wGroup(e, opts = {}) {
  const dur = e.live ? e.live[2] : e.dur;
  const open = opts.open ?? false;
  const d = dur ? `<span class="wd" data-tip="Started ${e.at} · ${e.live ? "running for" : "ran for"} ${dur}">${dur}</span>` : "";
  const retried = e.retried ? `<span class="wre">${I("retry")}${e.retried}</span>` : "";
  return `<article class="went" aria-label="${actName(e)}, started ${e.at}"><details class="wgrp ${e.live ? "live" : ""}" ${open ? "open" : ""}><summary class="wline" data-nav tabindex="-1" aria-label="${actName(e)}, started ${e.at}">${I("right", "i chev")}<span class="wn">${e.n} actions</span>${actRoll(e)}${retried}<span class="wat">${e.at}</span>${d}</summary><div class="wgb">${wRows(e, opts)}</div></details></article>`;
}

// ---------------- Speech, message, milestone ----------------
// The author: a band above the text, at the start of the reading line, written when the voice changes. Hover and
// focus show it, with the time, on every speech. It never moves the text, at any width.
function wWho(who, at, show, streaming) {
  return `<span class="wwho ${show || streaming ? "" : "quiet"}">${streaming ? st("run") : ""}<span class="wname">${WHO[who]}</span><span class="wat">${at}</span></span>`;
}
function wSpeech(e, show) {
  const label = `${WHO[e.who]}, ${e.at}${e.streaming ? ", writing" : ""}${e.interrupted ? ", interrupted" : ""}`;
  return `<article class="wsp ${e.streaming ? "streaming" : ""}" data-nav tabindex="-1" aria-label="${label}">${wWho(e.who, e.at, show, e.streaming)}<div class="prose">${speechHTML(e)}</div>${e.interrupted ? `<div class="intr">${I("ban")}Interrupted by you</div>` : ""}</article>`;
}
function wUser(e) {
  const head = e.queued
    ? `<div class="wuh"><span class="wq">Queued</span><span class="wqn">sends when the turn ends</span><button class="btn ghost xs" type="button" data-tip="Remove the message from the queue">Remove</button></div>`
    : `<div class="wuh"><span class="wname">You</span><span class="wat">${e.at}</span></div>`;
  return `<article class="wus ${e.queued ? "queued" : ""}" data-nav tabindex="-1" aria-label="You, ${e.at}${e.queued ? ", queued, sends when the turn ends" : e.fromQueue ? ", sent from the queue" : ""}">${head}<div class="wut">${e.text}</div></article>`;
}
function wMark(e, opts = {}) {
  // The chevron sits in the gutter, as on a group; a milestone that does not open keeps the gutter empty.
  const line = (chev) => `${chev ? I("right", "i chev") : `<span class="nochev" aria-hidden="true"></span>`}${I(e.icon, "i wmi")}<span class="wmt">${e.text}</span>${e.n ? `<span class="wmn" data-tip="${plain(e.n)}">${e.n}</span>` : ""}<span class="wat">${e.at}</span>`;
  const cls = `wmk wline ${e.kind || ""}`;
  // A milestone that does not open is read, not operated: no stop on the keyboard path.
  if (!e.body) return `<article class="went" aria-label="${markName(e)}"><div class="${cls}">${line(false)}</div></article>`;
  return `<article class="went" aria-label="${markName(e)}"><details class="wmkd" ${opts.open ? "open" : ""}><summary class="${cls}" data-nav tabindex="-1" aria-label="${markName(e)}, opens here">${line(true)}</summary>${markBody(e)}</details></article>`;
}
// A stretch of the past: one line, with what it holds; open, the entries as they were.
function wFold(e, opts = {}) {
  const acts = e.entries.filter((x) => x.t === "acts").reduce((n, x) => n + x.n, 0);
  const inner = opts.inner ?? wEntries(e.entries.slice(1));
  // Not a milestone: its own icon, and the size first, then where the stretch began.
  const from = e.product ? `from ${plain(e.title).replace(/^MySpec → /, "")} · ${plain(e.sub)}` : `from the start · ${plain(e.sub)}`;
  const name = `Earlier: ${e.speeches} speeches and ${acts} actions, ${from}, ${e.at} to ${e.to}`;
  return `<article class="went" aria-label="${name}"><details class="wfold" ${opts.open ? "open" : ""}><summary class="wmk wline fold" data-nav tabindex="-1" aria-label="${name}">${I("right", "i chev")}${I("history", "i wmi")}<span class="wmt">${e.speeches} speeches · ${acts} actions</span><span class="wmn" data-tip="${from}">${from}</span><span class="wat">${e.at}–${e.to}</span></summary><div class="wfold-in">${inner}</div></details></article>`;
}
// The voice changes when someone else spoke since the agent's last speech: you, the product, or nobody yet.
// Its actions and the events of the session (a report written, a retry, the context compacted) do not change it.
const QUIET_BETWEEN = (x) => x.t === "acts" || x.t === "activity" || (x.t === "mark" && x.kind !== "product");
function voiceChanged(list, k) {
  for (let j = k - 1; j >= 0; j--) { const x = list[j]; if (QUIET_BETWEEN(x)) continue; return x.t !== "agent" || x.who !== list[k].who; }
  return true;
}
function wEntry(e, prev, opts = {}) {
  if (e.t === "agent") return wSpeech(e, opts.show ?? opts.voice ?? true);
  if (e.t === "user") return wUser(e);
  if (e.t === "acts") return wGroup(e, opts);
  if (e.t === "mark") return wMark(e, opts);
  if (e.t === "question" || e.t === "permission") return `<article class="wrq" data-nav tabindex="-1" aria-label="${e.t === "question" ? (e.answered ? `Question, answered ${e.answeredAt}` : "Question, answer with 1 to 9") : "Permission, answer with 1 to 3"}, ${e.at}">${reqCard(e)}</article>`;
  if (e.t === "findings") return `<article class="wrq" data-nav tabindex="-1" aria-label="Findings to decide, 17:50">${findingsCard()}</article>`;
  if (e.t === "error") return `<article class="wrq" data-nav tabindex="-1" aria-label="Session error, ${e.at}">${errBlock({ ...e, text: `<p class="wet">${e.text}</p>` })}</article>`;
  if (e.t === "activity") return `<article class="went" aria-label="${e.text}, ${e.sub}"><div class="wact wline" data-nav tabindex="-1" role="status" aria-label="${e.text}, ${e.sub}">${st("run")}<b>${e.text}</b><span>· ${e.sub}</span></div></article>`;
  if (e.t === "fold") return wFold(e, opts);
  return "";
}
function wEntries(list) { return list.map((e, k) => wEntry(e, list[k - 1], e.t === "agent" ? { voice: voiceChanged(list, k) } : {})).join(""); }

// ---------------- Long code: the first 20 lines, and the rest on demand ----------------
const CODE_KEEP = 20, CODE_MAX = 24;
function clipCode(root) {
  root.querySelectorAll(".prose .code").forEach((c) => {
    if (c.dataset.clipped) return;
    const pre = c.querySelector("pre"); const n = pre.textContent.replace(/\n$/, "").split("\n").length;
    if (n <= CODE_MAX) return;
    c.dataset.clipped = "1"; c.classList.add("clip");
    c.insertAdjacentHTML("beforeend", `<div class="code-more"><button class="btn ghost xs" type="button" data-allcode aria-expanded="false">${I("down")}<span>Show all ${n} lines</span></button><span class="cm-n">${n - CODE_KEEP} more</span></div>`);
  });
}

// ---------------- Whole pixels ----------------
// A piece of text that pushes a glyph (the count of a group before the spinner, the author before the time, the time
// before the duration) takes a whole width, so what follows it lands on a whole pixel (principle 10).
function snapWide(root = document) {
  root.querySelectorAll(".wv .wn, .wv .wname, .wv .wat, .wv .wline > .wd, .wv .wrs > .wd").forEach((el) => { el.style.width = ""; if (!el.getClientRects().length || !el.getBoundingClientRect().width) return; el.style.width = Math.ceil(el.getBoundingClientRect().width) + "px"; });
}
addEventListener("resize", () => snapWide());
if (document.fonts) document.fonts.ready.then(() => snapWide());
document.addEventListener("toggle", (e) => { if (e.target.closest && e.target.closest(".wv")) snapWide(e.target); }, true);

// ---------------- The variation ----------------
V.nav = "[data-nav]";
V.key = (e, cur) => {
  const d = cur.tagName === "SUMMARY" ? cur.parentElement : null; if (!d) return;
  if (e.key === "ArrowRight" && !d.open) { e.preventDefault(); d.open = true; }
  if (e.key === "ArrowLeft" && d.open) { e.preventDefault(); d.open = false; }
};
V.conv = () => { ENTRY_N = 0; return `<div class="cv wv w${W.v}" role="feed" aria-label="The conversation with the ${(WHO[curVoice()] || "agent").toLowerCase()}">${wEntries(convEntries())}</div>${newMessages()}`; };
V.after = (cv) => { clipCode(cv); snapWide(cv); afterRender(cv); };
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-allcode]");
  if (b) { const c = b.closest(".code"); const on = !c.classList.contains("all"); c.classList.toggle("all", on); b.setAttribute("aria-expanded", String(on)); b.querySelector("span").textContent = on ? "Show less" : `Show all ${c.querySelector("pre").textContent.replace(/\n$/, "").split("\n").length} lines`; snapWide(c.closest(".wv") || document); return; }
  const o = e.target.closest("[data-allout]");
  // The mock has no earlier lines to show: it writes plausible ones, so the block can be seen at its full height.
  if (o) { const w = o.closest(".wout"); const n = +o.textContent.replace(/\D+/g, "") - w.querySelector("pre").textContent.split("\n").length; const pool = ["=== RUN   TestBucketAllow", "--- PASS: TestBucketAllow (0.00s)", "=== RUN   TestLimiterFor", "--- PASS: TestLimiterFor (0.01s)", "=== RUN   TestConcurrentBurst", "--- PASS: TestConcurrentBurst (0.03s)"]; w.querySelector("pre").insertAdjacentText("afterbegin", [...Array(Math.max(0, n))].map((_, k) => pool[k % pool.length]).join("\n") + "\n"); w.classList.add("all"); o.closest(".wmore").remove(); }
});

