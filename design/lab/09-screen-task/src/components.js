/* =====================================================================
   ROUND 09 · the specimen of the new components, every state, both modes.
   ?show=light|dark shows one mode.
   ===================================================================== */
const S = { panel: null, born: false };
const cell = (label, html, cls = "") => `<div class="cell ${cls}"><span class="sl">${label}</span>${html}</div>`;
const STATES7 = ["default", "hover", "focus", "active", "disabled", "loading", "error"];

const C = [];
// 1. Milestone that opens in place
C.push(["Milestone that opens in place", "A document written, a report written, the instruction a session started with. The content is one click away, rendered, without opening a panel. A and B.", () => [
  cell("default", DOC("PRD.md", "09:41", "6 sections · 1,240 words", PRD_EXCERPT)),
  cell("hover", DOC("PRD.md", "09:41", "6 sections", PRD_EXCERPT).replace('<summary class="ev"', '<summary class="ev is-hover"')),
  cell("focus", DOC("PRD.md", "09:41", "6 sections", PRD_EXCERPT).replace('<summary class="ev"', '<summary class="ev is-focus"')),
  cell("active · open", DOC("PRD.md", "09:41", "6 sections", PRD_EXCERPT, { open: true })),
  cell("disabled · discarded", EVX("file", "Written <span class=\"n\">PRD.md</span>", "09:41", "Discarded when you went back to PRD", "", { cls: "is-disabled", readWord: "Unavailable" })),
  cell("loading", EVX("filecheck", "Written <span class=\"n\">tech-spec.md</span>", "10:22", "8 sections", "", { cls: "is-loading", readWord: "Opening…" }).replace(`${I("right")}<span class="closed-l">Opening…`, `<span class="spin"></span><span class="closed-l">Opening…`)),
  cell("error", EVX("filecheck", "Written <span class=\"n\">tech-spec.md</span>", "10:22", "Can't read the file · it was moved or deleted", "", { cls: "is-error", readWord: "Try again" })),
]]);
// 2. Product message
C.push(["Product message", "What MySpec sends to an agent, as a milestone with its content one click away, in Markdown. Replaces the raw block (research/conversation.md §0).", () => [
  cell("default", HAND("Implementer", "· Review 1 · 2 findings · round 1 of 3", "14:19", "<div class=\"prose\"><p>…</p></div>")),
  cell("hover", HAND("Implementer", "· Review 1 · 2 findings", "14:19", "").replace('<summary class="ev"', '<summary class="ev is-hover"')),
  cell("focus", HAND("Implementer", "· Review 1 · 2 findings", "14:19", "").replace('<summary class="ev"', '<summary class="ev is-focus"')),
  cell("active · open", HAND("Reviewer", "· pass 2", "14:32", `<div class="prose"><p>The implementer is done with your last report. Review step 3 again and write <code>review-2.md</code>.</p></div>`).replace('<details class="evx hand ', '<details open class="evx hand ')),
  cell("disabled · waits for resume", HAND("Implementer", "· commit prompt · sends when you resume the task", "15:02", "", { cls: "is-disabled" })),
  cell("loading · sending", HAND("Implementer", "· commit prompt · sending…", "15:02", "", { cls: "is-loading" })),
  cell("error", HAND("Implementer", "· commit prompt · couldn't be sent", "15:02", "", { cls: "is-error" })),
]]);
// 3. Action group
C.push(["Action group", "The label is the description the agent wrote for a Bash command, the command follows faint; the summary counts by kind; a long group opens on its last rows; a subagent nests. A and B.", () => [
  cell("default · folded", ACTS({ n: 45, roll: "Read 26 · Searched 9 · Tests 6", dur: "6 min", rows: [] })),
  cell("hover", ACTS({ n: 45, roll: "Read 26 · Searched 9 · Tests 6", dur: "6 min", rows: [] }).replace("<summary>", '<summary class="is-hover">')),
  cell("focus", ACTS({ n: 45, roll: "Read 26 · Searched 9 · Tests 6", dur: "6 min", rows: [] }).replace("<summary>", '<summary class="is-focus">')),
  cell("active · open, with a subagent", ACTS({ n: 34, roll: "Read 16 · GitHub 5", dur: "7 min", open: true, earlier: 30, rows: [["Read the failed check's log", "gh run view 88213 --log-failed", "done", "2.2 s"], ["Delegated · Find why e2e failed", "", "agent", "", { roll: "44 actions · Read 21 · GitHub 9", dur: "2 min", rows: [["Replay the burst locally", "go test ./e2e/ -run TestBurst", "done", "34 s"]] }]] })),
  cell("disabled · held", ACTS({ n: 3, roll: "Read 1 · Make 1", hold: true, open: true, rows: [["Apply the migration", "the command in the card below", "wait", "waits for your permission"]] })),
  cell("loading · running", ACTS({ n: 11, live: ["Run the refill tests", "go test ./internal/ratelimit/... -race"], open: true, rows: [["Run the refill tests", "go test ./internal/ratelimit/... -race", "running", "12 s"]] })),
  cell("error", ACTS({ n: 21, roll: "Wrote 6 · Tests 4", fail: 1, dur: "12 min", open: true, rows: [["Run the rate limit tests", "go test ./internal/ratelimit/...", "error", "exit 1 · 8.2 s"]] })),
]]);
// 4. Loop beats
const beat = (cls, g, t, cap = "") => `<div class="beats"><button class="beat ${cls}" ${cls.includes("next") ? "disabled" : ""}>${g}${t}${cap ? ` <span class="cap">${cap}</span>` : ""}</button></div>`;
C.push(["Loop beat", "The agents' loop of a step, or the pull request's, in one line: implement, review, round, commit. A: in the chapter header. B: the rail holds the same facts.", () => [
  cell("default · done", beat("done", I("check"), "Review 1", "· 2")),
  cell("hover", beat("done is-hover", I("check"), "Review 1", "· 2")),
  cell("focus", beat("done is-focus", I("check"), "Review 1", "· 2")),
  cell("active · current", beat("cur", st("wait"), "Review 2", "· asks you")),
  cell("disabled · not yet", beat("next", st("todo"), "Commit")),
  cell("loading · running", beat("cur", st("run"), "Round 1", "of 3")),
  cell("error", beat("cur is-error", st("error"), "Review 2", "· error")),
]]);
// 5. Voice filter
const vf = (sel, extra = "", dis = false) => `<div class="switch" role="radiogroup"><button class="sw ${extra}" role="radio" aria-selected="${sel === "all"}">All</button><button class="sw" role="radio" aria-selected="${sel === "impl"}" ${dis ? "disabled" : ""}>${st("wait")}Implementer</button><button class="sw" role="radio" aria-selected="${sel === "rev"}">${st(extra === "err" ? "error" : "idle")}Reviewer</button></div>`;
C.push(["Voice filter", "A segmented control over the stream of a step: all voices, the implementer's or the reviewer's. Each voice carries its session glyph. A only.", () => [
  cell("default", vf("all")), cell("hover", vf("all", "").replace('class="sw "', 'class="sw is-hover"').replace('<button class="sw" role="radio" aria-selected="false">', '<button class="sw is-hover" role="radio" aria-selected="false">')),
  cell("focus", vf("impl").replace('aria-selected="true">', 'aria-selected="true" class="is-focus">')), cell("active · reviewer", vf("rev")),
  cell("disabled · no reviewer yet", `<div class="switch"><button class="sw" aria-selected="true">All</button><button class="sw">${st("run")}Implementer</button><button class="sw" disabled>Reviewer</button></div>`),
  cell("loading · starting", `<div class="switch"><button class="sw" aria-selected="true">All</button><button class="sw">${st("idle")}Implementer</button><button class="sw is-loading">${st("run")}Reviewer <span class="what">starting</span></button></div>`),
  cell("error", vf("all", "err")),
]]);
// 6. Recipient chip and quick replies
const toChip = (cls = "", dis = false) => `<button class="chip to ${cls}" ${dis ? "disabled" : ""}><span class="av rev">${I("review-s")}</span>To reviewer${I("down")}</button>`;
C.push(["Recipient (withdrawn after the critique)", "Kept for the record: the chip is gone from A. The composer writes to the voice the filter shows, else to the one that asked last, and the placeholder names it.", () => STATES7.map((s) => cell(s, s === "disabled" ? toChip("", true) : s === "loading" ? `<button class="chip to is-loading"><span class="spin"></span>To reviewer</button>` : s === "error" ? `<button class="chip to is-error" data-tip="The reviewer's session stopped">${st("error")}To reviewer · stopped</button>` : s === "active" ? toChip("", false).replace('class="chip to "', 'class="chip to" aria-pressed="true"') : toChip(s === "default" ? "" : `is-${s}`)))]);
const qr = (cls = "", dis = false) => `<div class="qr" style="padding:0"><button class="chip ${cls}" ${dis ? "disabled" : ""}><span class="kn">a</span>Plans table, cached 60 s</button></div>`;
C.push(["Quick reply", "A question asked in text, with lettered or numbered choices, gets one chip per choice above the composer. Clicking sends the letter, as users already type it (`a`, `1`, `ok`). A and B.", () => STATES7.map((s) => cell(s, s === "disabled" ? qr("", true) : s === "loading" ? `<div class="qr" style="padding:0"><button class="chip is-loading"><span class="spin"></span>Sending “a”…</button></div>` : s === "error" ? `<div class="qr" style="padding:0"><button class="chip is-error">Not sent · the session stopped</button></div>` : qr(s === "default" ? "" : `is-${s}`)))]);
// 7. Folded chapter
const cs = (cls = "", exp = false, sub = "a41c9e2 Config for rate limits · 2 passes · 61 actions") => `<button class="chap-sum ${cls}" aria-expanded="${exp}"><span class="ci">${I("commit")}</span><span class="tx"><span class="nm">Step 1</span><span class="sub">${sub}</span></span><span class="r">10:35${I("right")}</span></button>`;
C.push(["Folded chapter", "A stage or step that is over, in one line with what it produced. Opens in place. A only.", () => [
  cell("default", cs()), cell("hover", cs("is-hover")), cell("focus", cs("is-focus")), cell("active · open", cs("", true)),
  cell("disabled · discarded", cs("is-disabled", false, "discarded with step 1 · 10:52")), cell("loading", cs("is-loading", false, "loading the conversation…")), cell("error", cs("is-error", false, "Can't load the conversation · Try again")),
]]);
// 8. Milestone in the margin
const oi = (cls, g, lb, t = "") => `<div class="outline"><button class="oi ${cls}"><span class="c1">${g}</span><span class="lb">${lb}</span><span class="t">${t}</span></button></div>`;
C.push(["Milestone in the margin", "The task's milestones beside the stream when the margin holds them, in a popover when it doesn't. The bar marks what is on screen. A only.", () => [
  cell("default · done", oi("", I("check"), "Step 1 · a41c9e2", "10:35")), cell("hover", oi("is-hover", I("check"), "Step 1 · a41c9e2", "10:35")), cell("focus", oi("is-focus", I("check"), "Step 1 · a41c9e2", "10:35")),
  cell("active · current, in view", oi("cur inview", st("todo"), "Step 3 · Token bucket", "now")), cell("disabled · not yet", oi("next", st("todo"), "Step 4 · Retry-After")),
  cell("loading · a request", oi("kid", st("run"), "Implementer · round 1", "4m")), cell("error", oi("kid", st("error"), "Reviewer · Session error", "5m")),
]]);
// 9. Rail node
const rn = (cls, g, lb, r = "", l2 = "", dis = false) => `<div class="wfrail"><button class="rn ${cls}" ${dis ? "disabled" : ""}><span class="c1">${g}</span><span class="lb">${lb}</span><span class="r">${r}</span>${l2 ? `<span class="l2">${l2}</span>` : ""}</button></div>`;
C.push(["Rail node", "A stage, a step, or one of a step's two agents, as a place. The chosen place takes the identity tint. B only.", () => [
  cell("default · done", rn("done", I("check"), "PRD", "09:14", "4 questions · PRD.md"), "sunk"), cell("hover", rn("done is-hover", I("check"), "PRD", "09:14", "4 questions · PRD.md"), "sunk"),
  cell("focus", rn("done is-focus", I("check"), "PRD", "09:14"), "sunk"), cell("active · chosen place", rn("place sel you", st("wait"), "Reviewer <span class=\"k\">· pass 2 · Question</span>"), "sunk"),
  cell("disabled · not yet", rn("next", st("todo"), "<span class=\"k\">5</span>Per-plan limits", "Sonnet", "", true), "sunk"), cell("loading · working", rn("place", st("run"), "Implementer <span class=\"k\">· round 1 · 4m</span>"), "sunk"),
  cell("error", rn("cur err", st("error"), "<span class=\"k\">5</span>Per-plan limits", "", "Blocked · worktree not clean"), "sunk"),
]]);
// 10. Changed file
const file = (cls, s, word) => `<ul class="files"><li class="file ${cls}">${s === "staged" ? `<span class="ic">${I("check")}</span>` : st("todo")}<span class="kd">M</span><span class="p">internal/http/middleware/auth.go</span><span class="s">${word}</span></li></ul>`;
C.push(["Changed file", "A row of the review card of a Manual step, live with the stage in VS Code. The click opens the file.", () => [
  cell("default · not staged", file("pending", "", "not staged")), cell("hover", file("pending is-hover", "", "not staged")), cell("focus", file("pending is-focus", "", "not staged")),
  cell("active · staged", file("staged", "staged", "staged")), cell("disabled · deleted", file("is-disabled", "", "deleted · nothing to open")), cell("loading", file("is-loading", "", "opening…")), cell("error", file("pending is-error", "", "can't read git status")),
]]);
// 11. Checks
C.push(["GitHub checks", "The checks by name while the pull request waits and before each pass. The wait is GitHub's, not yours: no amber.", () => [
  cell("live", CHECKS(true)), cell("read before a pass", CHECKS(false)),
  cell("loading · first read", CHECKS(true).replace('class="gh"', 'class="gh is-loading"').replace("<b>Waiting for checks</b> · 3 of 5 passed", "<b>Checking GitHub…</b>").replace(/<ul class="checks">[\s\S]*<\/ul>/, "")),
  cell("error · read failed", CHECKS(true).replace('class="gh"', 'class="gh is-error"').replace("<b>Waiting for checks</b> · 3 of 5 passed", "<b>Couldn't read the checks</b> · gh: API rate limit exceeded")),
]]);
// 12. Finding
const fnd = (cls, ok = false, no = false, note = "", dis = false) => `<div class="fnd ${cls}"><span class="no">2</span><div class="fb"><a class="loc" href="#">internal/http/middleware/ratelimit.go:58</a><div class="ft"><code>Retry-After</code> rounds down; round up to whole seconds.</div><div class="fa"><button class="btn sm dec-a" aria-pressed="${ok}" ${dis ? "disabled" : ""}>${I("check")}Approve <span class="k">A</span></button><button class="btn sm dec-d" aria-pressed="${no}" ${dis ? "disabled" : ""}>Discard <span class="k">D</span></button>${note ? `<span class="note">${note}</span>` : ""}</div></div></div>`;
C.push(["Finding", "A finding to decide, in the decision card (A) or the decision column (B). A and D decide the one in focus; Alt+↓ goes to the next.", () => [
  cell("default", fnd("")), cell("hover", fnd("is-hover")), cell("focus", fnd("is-focus cur")), cell("active · approved", fnd("ok", true, false, "Approved · click again to undo")),
  cell("disabled · sent to the agent", fnd("is-disabled", true, false, "Sent at 18:05", true)), cell("loading · saving", fnd("is-loading", false, false, "Saving…")), cell("error", fnd("is-error", false, false, "Not saved · Try again")),
]]);
// 13. Jump to the end
const jp = (cls) => `<div class="jump"><button class="${cls}">${I("arrow-down")}<span class="nm">New messages</span><span class="live">· ${st("run")}Implementer<span class="mono">go test ./…</span></span></button></div>`;
C.push(["Back to the end", "Out of the end of the stream, the way back carries what happens there: New messages and the running action.", () => [
  cell("default", jp("")), cell("hover", jp("is-hover")), cell("focus", jp("is-focus")), cell("active", jp("is-active")),
  cell("nothing new", `<div class="jump"><button>${I("arrow-down")}<span class="nm">Back to the end</span></button></div>`),
]]);
// 14. Panel toggle group and position
const tg = (p = "", cls = "", dis = false) => `<div class="tgroup"><button class="btn ghost ${cls}" aria-pressed="${p === "Details"}">Details</button><button class="btn ghost" aria-pressed="${p === "Artifacts"}" ${dis ? "disabled" : ""}>Artifacts</button><button class="btn ghost" aria-pressed="false">Card</button></div>`;
C.push(["Panel group", "The panels as one toggle group: the open one is pressed (polish 8).", () => [
  cell("default", tg()), cell("hover", tg("", "is-hover")), cell("focus", tg("", "is-focus")), cell("active · Details open", tg("Details")), cell("disabled · no artifacts yet", tg("", "", true)),
]]);
const pos = (cls = "", exp = false) => `<button class="pos ${cls}" aria-expanded="${exp}"><span class="sdots">${STAGES.map((n, k) => `<i class="${k < 3 ? "d" : k === 3 ? "c" : ""}"></i>`).join("")}</span><span class="stn">Implementation</span><span class="pp">Step 3 of 7</span></button>`;
C.push(["Position", "The item's place in the workflow in one line of the header: seven stages and the position inside the current one. A opens the milestones from it; B shows it only when the rail folds.", () => [
  cell("default", pos()), cell("hover", pos("is-hover")), cell("focus", pos("is-focus")), cell("active · open", pos("", true)),
]]);
// 15. Ask bar variants
C.push(["Ask bar, new forms", "Two requests on screen (A), the other conversation also waits (B), and ready to close.", () => [
  cell("two requests", ASK(SCENES.ask.ask)),
  cell("the other conversation also waits", `<div class="ask-in quiet"><span class="req what">${st("wait")}<span class="lbl">Permission</span><span class="muted">· Implementer</span>${tw({ sev: "wait", since: "4m", long: "4 minutes" })}<button class="btn sm">${I("up")}Show</button></span><span class="req what">${st("wait")}<span class="muted">The reviewer also waits · Question</span>${tw({ sev: "wait", since: "18m", long: "18 minutes" })}<button class="btn sm">Go to reviewer</button></span></div>`),
  cell("ready to close", ASK(SCENES.close.ask)),
]]);

function mode(t, parts, wide) { return `<div class="mode ${wide ? "wide" : ""}" data-theme="${t}"><span class="mcap">${t}</span>${parts.join("")}</div>`; }
function render() {
  const show = Q.get("show");
  const modes = show === "light" || show === "dark" ? [show] : ["light", "dark"];
  document.getElementById("app").innerHTML = `<main class="spec"><header><h1>09 · New components</h1><p>What the task screen asks for beyond the system, in every state and both modes. Proposed in the round's README; enters <code>system/components.md</code> once decided.</p></header>
    ${C.map(([h, p, f]) => `<section class="cs"><h2>${h}</h2><p>${p}</p><div class="modes">${modes.map((t) => mode(t, f(), h.startsWith("Ask") || h.startsWith("GitHub"))).join("")}</div></section>`).join("")}</main>`;
}
document.addEventListener("DOMContentLoaded", () => {
  document.body.insertAdjacentHTML("afterbegin", SPRITE);
  document.body.insertAdjacentHTML("beforeend", `<div id="app"></div><pre id="report" class="report" hidden></pre>`);
  render();
  if (Q.has("audit")) setTimeout(audit, 700);
});
