/* =====================================================================
   A · Conversation with milestones
   ?scene=plan|run|ask|error|manual|blocked|checks|findings|close
   ?theme=light|dark · ?panel=Details|Artifacts|Card · ?end · ?audit · ?clean
   ===================================================================== */
const S = { panel: ["Details", "Artifacts", "Card"].includes(Q.get("panel")) ? Q.get("panel") : null, filter: ["impl", "rev"].includes(Q.get("filter")) ? Q.get("filter") : "all", open: new Set(), pop: false, born: false, focus: null };
// Whom the composer writes to, with no chip: the voice the filter shows, else the one that asked last.
const LAST_ASKER = { run: "impl", ask: "impl", error: "rev", manual: "impl" };
const focusVoice = () => S.filter !== "all" ? S.filter : S.focus || LAST_ASKER[SC_KEY] || "impl";

// ---------------- Chapters of the task at this scene ----------------
function chapters() {
  const c = [];
  const cur = SC.cur;
  c.push({ id: "prd", kind: "stage", name: "PRD", icon: "filecheck", sub: "4 questions · PRD.md", at: "09:14", done: SC.stage > 0, entries: () => sessPRD(SC_KEY) });
  if (SC.stage === 0) return c;
  c.push({ id: "spec", kind: "stage", name: "Tech spec", icon: "filecheck", sub: "1 question · 52 actions · tech-spec.md", at: "09:41", done: true, entries: sessSpec });
  c.push({ id: "plan", kind: "stage", name: "Plan", icon: "list", sub: "7 steps · 1 automatic correction", at: "10:22", done: true, entries: sessPlan });
  const upto = SC.stage === 3 ? SC.step : 8;
  for (let n = 1; n < upto && n <= 7; n++) {
    const d = STEP_DONE[n];
    c.push({ id: `s${n}`, kind: "step", n, name: `Step ${n}`, title: STEPS[n - 1][0], icon: "commit", sha: d.sha, sub: `${d.loop} · ${d.acts} actions`, at: d.at, done: true, entries: () => pastStep(n) });
  }
  if (SC.stage === 3) {
    const n = SC.step, f = { 3: sessStep3, 4: sessStep4, 5: sessStep5 }[n];
    c.push({ id: `s${n}`, kind: "step", n, name: `Step ${n}`, title: STEPS[n - 1][0], done: false, entries: () => f(SC_KEY) });
    return c;
  }
  c.push({ id: "pr", kind: "pr", name: "Pull request", icon: "pr", sub: "draft approved · #1284 opened", at: "17:18", done: true, entries: () => sessPR("") });
  if (cur === "pr") { c.push({ id: "prr", kind: "prr", name: "PR review", done: false, entries: () => [{ o: 0, p: "gh", html: CHECKS(true) + `<div class="empty-place"><b>The review conversation starts when the checks finish.</b>MySpec reads the pull request every minute; the first pass begins once e2e and preview-deploy are done.</div>` }] }); return c; }
  c.push({ id: "prr", kind: "prr", name: "PR review", done: false, entries: () => sessPRR(SC_KEY) });
  return c;
}
// A past step, folded; opened it shows its milestones from the transcripts.
function pastStep(n) {
  const d = STEP_DONE[n], p = `s${n}`;
  const e = [
    { o: 1, p: p + "i", html: EVX("file", `Started with <span class="n">steps/0${n}-${STEPS[n - 1][0].toLowerCase().replace(/[^a-z]+/g, "-").replace(/-$/, "")}.md</span>`, d.at, "", `<div class="docbody prose"><h4>Step ${n}: ${STEPS[n - 1][0]}</h4><p>…</p></div>`) },
    { o: 2, p: p + "i", html: ACTS({ n: Math.round(d.acts * 0.55), roll: "Read 14 · Wrote 8 · Tests 5 · git 3", dur: "14 min", earlier: 20, rows: [["Run the package tests", "go test ./internal/... -race", "done", "22 s"], ["Run the linter", "golangci-lint run ./...", "done", "19 s"]] }) },
  ];
  if (n !== 4) e.push({ o: 3, p: p + "r", html: REPORT(1, n === 2 || n === 5 || n === 7, 2, d.at, n === 2 || n === 5 || n === 7 ? "Nothing to change." : [["internal/ratelimit/config.go:14", "Validate that burst is at least 1."], ["config/plans.yaml", "Enterprise has no default."]], { step: n }) });
  e.push({ o: 9, p: p + "i", html: COMMIT(d.sha, d.sub, d.at) });
  return e;
}

// ---------------- Pieces of the stream ----------------
const placeVoice = (p) => p.endsWith("r") && p !== "pr" ? "rev" : p === "prr" ? "rev" : "impl";
function stream(entries, withLanes) {
  const rows = [...entries].sort((a, b) => a.o - b.o);
  let html = "", lane = null, buf = "";
  const flush = () => { if (lane) html += `<div class="lane ${lane === "rev" && withLanes ? "lane-rev" : ""}" data-voice="${lane}">${buf}</div>`; buf = ""; };
  rows.forEach((e) => {
    const v = placeVoice(e.p), h = e.dec ? FINDCARD(false) : e.html;
    if (v !== lane) { flush(); lane = v; }
    buf += h;
  });
  flush();
  return html;
}
function beats() {
  const b = (cls, g, t, extra = "") => cls === "next" ? `<span class="beat next" role="listitem">${g}${t}${extra}</span>` : `<span role="listitem"><button class="beat ${cls}" type="button">${g}${t}${extra}</button></span>`;
  const gt = `<span class="gt" aria-hidden="true">›</span>`;
  const ok = I("check"), todo = st("todo");
  const L = {
    round1: [b("done", ok, "Implement"), b("done", ok, "Review 1", ` <span class="cap">· 2 findings</span>`), b("cur", st("run"), "Round 1", ` <span class="cap">of 3</span>`), b("next", todo, "Review 2"), b("next", todo, "Commit")],
    pass2: [b("done", ok, "Implement"), b("done", ok, "Review 1", ` <span class="cap">· 2 findings</span>`), b("done", ok, "Round 1"), b("cur", st("wait"), "Review 2", ` <span class="cap">· asks you</span>`), b("next", todo, "Commit")],
    pass2err: [b("done", ok, "Implement"), b("done", ok, "Review 1", ` <span class="cap">· 2 findings</span>`), b("done", ok, "Round 1"), b("cur is-error", st("error"), "Review 2", ` <span class="cap">· error</span>`), b("next", todo, "Commit")],
    manual: [b("done", ok, "Implement"), b("cur", st("wait"), "Your review", ` <span class="cap">· 71%</span>`), b("next", todo, "Commit")],
    blocked: [b("cur is-error", st("error"), "Clean worktree"), b("next", todo, "Implement"), b("next", todo, "Review"), b("next", todo, "Commit")],
  }[SC.loop];
  return L ? `<div class="beats" role="list" aria-label="The loop of step ${SC.step}">${L.join(gt)}</div>` : "";
}
function prBeats() {
  const b = (cls, g, t, extra = "") => cls === "next" ? `<span class="beat next" role="listitem">${g}${t}${extra}</span>` : `<span role="listitem"><button class="beat ${cls}" type="button">${g}${t}${extra}</button></span>`;
  const gt = `<span class="gt" aria-hidden="true">›</span>`, ok = I("check"), todo = st("todo");
  const L = SC_KEY === "checks" ? [b("done", ok, "Draft"), b("done", ok, "Opened #1284"), b("cur", st("gh"), "Checks", ` <span class="cap">· 3 of 5</span>`), b("next", todo, "Pass 1")]
    : SC_KEY === "findings" ? [b("done", ok, "Checks"), b("done", ok, "Pass 1", ` <span class="cap">· 4 findings</span>`), b("cur", st("wait"), "Decide", ` <span class="cap">· 1 of 4</span>`), b("next", todo, "Apply"), b("next", todo, "Your review"), b("next", todo, "Pass 2")]
    : [b("done", ok, "Pass 1"), b("done", ok, "Applied 3"), b("done", ok, "Pass 2", ` <span class="cap">· clean</span>`), b("done", ok, "Merged"), b("cur", st("close"), "Close")];
  return `<div class="beats" role="list" aria-label="The pull request">${L.join(gt)}</div>`;
}
function voiceFilter() {
  const f = S.filter;
  const imp = SC_KEY === "ask" ? st("wait", "Implementer waits for you") : SC_KEY === "run" ? st("run", "Implementer working") : st("idle", "Implementer idle");
  const rev = SC_KEY === "ask" ? st("wait", "Reviewer waits for you") : SC_KEY === "error" ? st("error", "Reviewer session error") : st("idle", "Reviewer idle");
  return `<div class="switch" role="radiogroup" aria-label="Show the voices of step ${SC.step}">
    <button class="sw" role="radio" aria-checked="${f === "all"}" data-filter="all">All</button>
    <button class="sw" role="radio" aria-checked="${f === "impl"}" data-filter="impl">${imp}Implementer</button>
    <button class="sw" role="radio" aria-checked="${f === "rev"}" data-filter="rev">${rev}Reviewer</button></div>`;
}
function chapHead(ch) {
  const mbtn = `<button class="btn ghost xs mbtn" aria-label="Milestones" data-pop aria-haspopup="dialog" aria-expanded="${S.pop}" data-tip="Milestones of the task · [ and ] jump between them">${I("list")}<span class="lbl-long">Milestones</span></button>`;
  if (ch.kind === "step") {
    const agent = SC.loop !== "manual" && SC.loop !== "blocked";
    const tools = SC.loop === "blocked" ? `<button class="btn ghost xs" aria-label="Open in VS Code" data-tip="Open the worktree in VS Code">${I("vscode")}<span class="lbl-long">Open in VS Code</span></button>`
      : `${agent ? `<button class="btn xs" data-tip="Take the review of step ${ch.n} from the agent">Review myself</button>` : ""}<button class="btn ghost xs" aria-label="Open in VS Code" data-tip="Open the worktree of step ${ch.n}">${I("vscode")}<span class="lbl-long">Open in VS Code</span></button><button class="btn ghost xs" data-tip="Discard step ${ch.n} and its changes…">Discard step…</button>`;
    return `<div class="chap-h"><div class="l1"><span class="ttl"><b>Step ${ch.n} of 7</b><span class="trunc">${ch.title}</span></span><span class="tools">${mbtn}${tools}</span></div>
      <div class="l2">${beats()}${agent ? voiceFilter() : ""}</div></div>`;
  }
  if (ch.kind === "prr" || ch.kind === "pr") {
    const tools = `<button class="btn ghost xs" data-tip="Read the pull request now · checked 40s ago">Refresh PR</button>${ch.kind === "prr" && SC_KEY !== "checks" ? `<button class="btn ghost xs" data-tip="Ask for another pass now">Review again</button>` : ""}<button class="btn ghost xs" aria-label="Open PR" data-tip="Open #1284 on GitHub">${I("external")}<span class="lbl-long">Open PR</span></button>`;
    return `<div class="chap-h"><div class="l1"><span class="ttl"><b>${ch.kind === "prr" ? "PR review" : "Pull request"}</b><span class="trunc"><a href="#">#1284</a> · Rate limit requests per API key</span></span><span class="tools">${mbtn}${tools}</span></div><div class="l2">${prBeats()}</div></div>`;
  }
  return `<div class="chap-h"><div class="l1"><span class="ttl"><b>PRD</b><span>3 answered · the agent writes PRD.md when nothing is left open</span></span><span class="tools">${mbtn}<button class="btn ghost xs" data-tip="Discard the PRD conversation and start it again…">Discard and restart…</button></span></div></div>`;
}
function chapSum(ch) {
  const open = S.open.has(ch.id);
  const tx = ch.kind === "step" ? `<span class="nm">${ch.name}</span><span class="sub"><span class="sha">${ch.sha}</span> ${ch.title} · ${ch.sub}</span>` : `<span class="nm">${ch.name}</span><span class="sub">${ch.sub}</span>`;
  return `<button class="chap-sum" aria-expanded="${open}" data-chap="${ch.id}"><span class="ci">${I(ch.icon)}</span><span class="tx">${tx}</span><span class="r">${ch.at}${I("right")}</span></button>`;
}
function renderChapters() {
  const cs = chapters();
  const done = cs.filter((c) => c.done), cur = cs.filter((c) => !c.done);
  let h = "";
  if (done.length) h += `<div class="folded" role="group" aria-label="Earlier in the task"><div class="folded-h">${I("history", "i")}Earlier in this task · ${done.length} milestones · started today 09:14</div>` +
    done.map((c) => `<section class="chap done" id="ch-${c.id}" data-chap-sec="${c.id}">${chapSum(c)}${S.open.has(c.id) ? `<div class="chap-body stream">${stream(c.entries(), true)}</div>` : ""}</section>`).join("") + `</div>`;
  cur.forEach((c) => { h += `<section class="chap cur" id="ch-${c.id}" data-chap-sec="${c.id}" aria-label="${c.name}">${chapHead(c)}<div class="stream">${stream(c.entries(), true)}</div></section>`; });
  return h;
}

// ---------------- The milestones list: in the margin, or in a popover ----------------
function milestones() {
  const cs = chapters();
  const it = (cls, g, lb, t, target, kid, sub) => cls.includes("next")
    ? `<span class="oi ${cls}"><span class="c1">${g}</span><span class="lb trunc">${lb}</span><span class="t">${t || ""}</span>${sub ? `<span class="os">${sub}</span>` : ""}</span>`
    : `<button class="oi ${cls} ${kid ? "kid" : ""}" data-go="${target || ""}"><span class="c1">${g}</span><span class="lb trunc">${lb}</span><span class="t">${t || ""}</span>${sub ? `<span class="os">${sub}</span>` : ""}</button>`;
  let h = `<div class="cap">Milestones</div>`;
  const doneIds = new Set(cs.filter((c) => c.done).map((c) => c.id));
  [["prd", "PRD", "09:14", "4 questions · PRD.md", "Opus · high"], ["spec", "Tech spec", "09:41", "1 question · tech-spec.md", "Opus · high"], ["plan", "Plan", "10:22", "7 steps · 1 correction", "Opus · medium"]].forEach(([id, n, t, sub, model], k) => {
    if (doneIds.has(id)) h += it("", I("check"), n, t, id, false, sub);
    else if (SC.stage === k) h += it("cur", st("todo"), n, "now", id, false, "3 answered");
    else h += it("next", st("todo"), n, "", "", false, model);
  });
  for (let n = 1; n <= 7; n++) {
    const id = `s${n}`;
    if (doneIds.has(id)) h += it("", I("check"), `${n} · ${STEPS[n - 1][0]}`, STEP_DONE[n].at, id, false, `${STEP_DONE[n].sha} · ${STEP_DONE[n].loop}`);
    else if (SC.stage === 3 && SC.step === n) {
      h += it("cur", st("todo"), `${n} · ${STEPS[n - 1][0]}`, "now", id, false, { run: "Addressing review · round 1 of 3", ask: "Agent review · pass 2", error: "Agent review · pass 2", manual: "Manual · your review", blocked: "Blocked before it started" }[SC_KEY]);
      if (SC_KEY === "ask") { h += it("", st("wait"), "Reviewer · Question", "18m", "askcard", true); h += it("", st("wait"), "Implementer · Permission", "4m", "askcard2", true); }
      if (SC_KEY === "run") h += it("", st("run"), "Implementer · round 1", "4m", id, true);
      if (SC_KEY === "error") h += it("", st("error"), "Reviewer · Session error", "5m", id, true);
      if (SC_KEY === "manual") h += it("", st("wait"), "Your review · 71%", "9m", "askcard", true);
      if (SC_KEY === "blocked") h += it("", st("error"), "Blocked · worktree", "6m", id, true);
    } else h += it("next", st("todo"), `${n} · ${STEPS[n - 1][0]}`, "", "", false, STEPS[n - 1][1].includes("Manual") ? "Manual · Sonnet · high" : `Agent · ${STEPS[n - 1][1]}`);
  }
  const prState = SC.stage < 4 ? "next" : "";
  h += SC.stage >= 5 ? it("", I("check"), "Pull request · #1284", "17:18", "pr", false, "draft approved · opened 17:32") : it("next", st("todo"), "Pull request", "", "", false, "Sonnet · medium");
  h += SC_KEY === "close" ? it("", I("check"), "PR review", "18:40", "prr", false, "pass 2 · clean · merged") : SC_KEY === "checks" ? it("cur", st("gh"), "PR review", "now", "prr", false, "waiting for checks · 3 of 5") : SC.stage >= 5 ? it("cur", st("todo"), "PR review", "now", "prr", false, "pass 1 · decide 1 of 4") : it("next", st("todo"), "PR review", "", "", false, "Opus · high");
  h += SC_KEY === "close" ? it("cur", st("close"), "Closing · ready", "2h", "") : it("next", st("todo"), "Closing", "", "");
  return h + `<div class="keys"><kbd>[</kbd><kbd>]</kbd> previous and next milestone</div>`;
}

// ---------------- The page ----------------
function header() {
  const i = ITEMS.t1;
  const dots = `<span class="sdots" aria-hidden="true">${STAGES.map((n, k) => `<i class="${k < SC.stage ? "d" : k === SC.stage ? "c" : ""}"></i>`).join("")}</span>`;
  return `<header class="ih1">${NAVBTNS}${crumbs()}<h1 class="ih-title">${ty(i)}<span class="trunc">${i.name}</span></h1><span class="ih-ref">acme/api#412</span>
    <button class="pos" data-pop aria-haspopup="dialog" aria-expanded="${S.pop}" aria-label="${STAGES[SC.stage]}, stage ${SC.stage + 1} of 7, ${SC.pos}. Show the milestones" data-tip="${STAGES.map((n, k) => `${k < SC.stage ? "✓" : k === SC.stage ? "●" : "○"} ${n}`).join("  ")}">${dots}<span class="stn">${STAGES[SC.stage]}</span><span class="pp">${SC.pos}</span></button>
    <span class="grow"></span>${tools({ ctx: SC.ctx })}</header>`;
}
function jump() {
  if (!SC.scrolled || Q.has("end")) return "";
  return `<div class="jump"><button type="button" id="jump-btn" data-tip="Go to the end · End">${I("arrow-down")}<span class="nm">New messages</span><span class="live">· ${st("run")}Implementer<span class="mono">go test ./internal/ratelimit/... -race</span></span></button></div>`;
}
// The ask bar speaks for the voice in focus and points to the other, as structure.md §3 asks.
function askA() {
  if (SC_KEY !== "ask") return SC.ask ? ASK(SC.ask) : "";
  const rev = { label: "Question", place: "Reviewer", s: { sev: "wait", since: "18m", long: "18 minutes" }, card: "askcard", v: "rev" }, imp = { label: "Permission", place: "Implementer", s: { sev: "wait", since: "4m", long: "4 minutes" }, card: "askcard2", v: "impl" };
  const [here, other] = focusVoice() === "rev" ? [rev, imp] : [imp, rev];
  return `<div class="ask-in quiet" role="region" aria-label="What this item asks"><span class="sr" role="status">${here.label} from the ${here.place}</span>
    <span class="req what">${st("wait")}<span class="lbl">${here.label}</span><span class="muted">· ${here.place}</span>${tw(here.s)}<button class="btn sm" data-show="${here.card}" data-tip="Go to the card · the first option takes the focus">${I("up")}Show</button></span>
    <span class="req what">${st("wait")}<span class="muted">The ${other.place.toLowerCase()} also waits · ${other.label}</span>${tw(other.s)}<button class="btn sm" data-goto="${other.v}" data-tip="Go to the ${other.place.toLowerCase()}'s ${other.label.toLowerCase()}">Go to ${other.place.toLowerCase()}</button></span></div>`;
}
function composer() {
  const v = focusVoice(), who = v === "rev" ? "reviewer" : "implementer";
  const PH = {
    run: "Queue a message for the implementer…", ask: v === "rev" ? "Answer with 1–3, or reply to the reviewer…" : "Reply to the implementer…",
    error: v === "rev" ? "Sending restarts the reviewer's session…" : "Reply to the implementer…", manual: "Ask the implementer for a change…",
  };
  const c = { ...SC.comp, to: null, ph: PH[SC_KEY] || SC.comp.ph, label: SC.stage === 3 ? `Reply to the ${who}` : "Reply to the agent" };
  if (SC_KEY === "run" && v === "rev") { c.working = null; c.ph = "Reply to the reviewer…"; c.model = "Opus · high"; }
  const quick = c.quick ? `<div class="qr" role="group" aria-label="Quick replies">Reply with ${c.quick.map(([k, t]) => `<button class="chip" data-tip="Sends “${k}”"><span class="kn">${k}</span>${t}</button>`).join("")}<span>or write below</span></div>` : "";
  const base = COMPOSER(c);
  return quick ? base.replace('<div class="cbox">', `<div class="cbox">${quick}`) : base;
}
function main() {
  const panel = S.panel ? PANEL(S.panel, { now: SC.now, doneSteps: SC.doneSteps }) : "";
  return `<main class="main" id="main">${header()}<div class="body" id="body"><div class="colconvo">
    <div class="convo-wrap"><div class="convo" id="convo" tabindex="-1" aria-label="The conversation of the task"><div class="convo-in enter">${renderChapters()}</div></div>
    <nav class="outline" aria-label="Milestones">${milestones()}</nav>
    ${jump()}</div>
    ${askA() ? `<div class="ask">${askA()}</div>` : ""}<div class="composer"><div class="composer-in">${composer()}</div></div></div>${panel}</div>
    ${S.pop ? `<div class="pop milestones" id="pop" role="dialog" aria-label="Milestones">${milestones()}</div>` : ""}</main>`;
}
function applyFilter() {
  document.querySelectorAll(".chap.cur .lane").forEach((l) => { l.classList.toggle("fl-out", S.filter !== "all" && l.dataset.voice !== S.filter && l.dataset.voice !== "gh"); });
}
function panelRule() {
  const p = document.getElementById("panel"), m = document.getElementById("main"); if (!p || !m) return;
  const w = m.getBoundingClientRect().width, pw = Math.min(480, Math.max(360, Math.round(w * 0.28)));
  p.classList.toggle("over", w - pw < 760);
}
function scrollSpy() {
  const cv = document.getElementById("convo"); if (!cv) return;
  const top = cv.getBoundingClientRect().top, bot = cv.getBoundingClientRect().bottom;
  const inview = new Set([...document.querySelectorAll("[data-chap-sec]")].filter((s) => { const r = s.getBoundingClientRect(); return r.bottom > top && r.top < bot; }).map((s) => s.dataset.chapSec));
  document.querySelectorAll(".outline .oi").forEach((o) => o.classList.toggle("inview", inview.has(o.dataset.go)));
}
function render() {
  document.getElementById("app").innerHTML = sidebar() + main() + mockbar(SCENE_KEYS, SC_KEY);
  const cv = document.getElementById("convo");
  cv.scrollTop = SC.scrolled && !Q.has("end") ? cv.scrollHeight - cv.clientHeight - 560 : cv.scrollHeight;
  cv.addEventListener("scroll", scrollSpy);
  document.getElementById("tree").addEventListener("scroll", moreBelow);
  const pop = document.getElementById("pop");
  if (pop) { const b = document.querySelector(".pos").getBoundingClientRect(), m = document.getElementById("main").getBoundingClientRect(); pop.style.left = Math.round(b.left - m.left) + "px"; pop.style.top = Math.round(b.bottom - m.top + 4) + "px"; }
  applyFilter(); panelRule(); fitHeader();
  requestAnimationFrame(() => { fitHeader(); moreBelow(); markTruncated(); scrollSpy(); });
}
document.addEventListener("DOMContentLoaded", () => {
  document.body.insertAdjacentHTML("beforeend", `<div id="app" class="app"></div><div class="toasts" role="status" aria-live="polite" aria-label="Notifications"></div><pre id="report" class="report" hidden></pre>`);
  bootCommon(render);
  document.addEventListener("click", (e) => {
    const f = e.target.closest("[data-filter]"); if (f) { S.filter = f.dataset.filter; render(); return; }
    const gt = e.target.closest("[data-goto]"); if (gt) { S.focus = gt.dataset.goto; if (S.filter !== "all") S.filter = gt.dataset.goto; render(); const c = document.getElementById(gt.dataset.goto === "rev" ? "askcard" : "askcard2"); if (c) { c.scrollIntoView({ block: "center" }); const b = c.querySelector("button"); if (b) b.focus(); } return; }
    const c = e.target.closest("[data-chap]"); if (c) { const id = c.dataset.chap; S.open.has(id) ? S.open.delete(id) : S.open.add(id); render(); document.querySelector(`[data-chap="${id}"]`).focus(); return; }
    const p = e.target.closest("[data-pop]"); if (p) { S.pop = !S.pop; render(); return; }
    const g = e.target.closest("[data-go]"); if (g && g.dataset.go) { const t = document.getElementById(g.dataset.go) || document.getElementById("ch-" + g.dataset.go); if (t) t.scrollIntoView({ block: "start" }); S.pop = false; return; }
    if (e.target.closest("#jump-btn")) { const cv = document.getElementById("convo"); cv.scrollTop = cv.scrollHeight; e.target.closest(".jump").remove(); }
  });
  document.addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("textarea, input, select")) return;
    if (e.key === "[" || e.key === "]") {
      const secs = [...document.querySelectorAll("[data-chap-sec]")], cv = document.getElementById("convo"), top = cv.getBoundingClientRect().top + 4;
      const k = secs.findIndex((s) => s.getBoundingClientRect().bottom > top);
      const t = secs[Math.max(0, Math.min(secs.length - 1, k + (e.key === "]" ? 1 : -1)))]; if (t) t.scrollIntoView({ block: "start" });
    }
    if (e.key === "Escape" && S.pop) { S.pop = false; render(); }
  });
  addEventListener("resize", panelRule);
  render();
  if (document.fonts) document.fonts.ready.then(() => { fitHeader(); markTruncated(); });
  if (Q.has("audit")) setTimeout(audit, 1200);
});
