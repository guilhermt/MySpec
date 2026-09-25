/* =====================================================================
   ROUND 10 · the minimal task screen, shared by a and b.
   The screen holds three things: the progress, the conversation of the
   place the task is in, and the composer with the ask bar when something
   waits for you. Everything else is in a closed panel or in the ⋯ menu.
   Each variation gives: V.center() (the progress in the header),
   V.below() (under the header), V.tabs (voice tabs above the conversation),
   V.swap (the voice switch in the composer), V.pointOther (the ask bar
   points to the other agent when both wait).
   ?scene= · ?theme= · ?panel=Details|Artifacts|Card · ?menu · ?past=s2i
   ?voice=impl|rev · ?audit · ?clean
   ===================================================================== */
const SPRITE_M = `<svg class="sprite" aria-hidden="true">
  <symbol id="i-info" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.5"/><path d="M8 7.3v3.4M8 5.3h.01"/></symbol>
  <symbol id="i-card" viewBox="0 0 16 16"><rect x="2.5" y="3.5" width="11" height="9" rx="1.5"/><path d="M5 6.5h6M5 9.5h3.5"/></symbol>
  <symbol id="i-swap" viewBox="0 0 16 16"><path d="M3.5 5.5h9M10 3l2.5 2.5L10 8M12.5 10.5h-9M6 8l-2.5 2.5L6 13"/></symbol>
  <symbol id="i-chat" viewBox="0 0 16 16"><path d="M3 4.4A1.4 1.4 0 0 1 4.4 3h7.2A1.4 1.4 0 0 1 13 4.4v5.2A1.4 1.4 0 0 1 11.6 11H7.2L4.2 13.3V11A1.4 1.4 0 0 1 3 9.6z"/></symbol>
</svg>`;

const S = {
  panel: ["Details", "Artifacts", "Card"].includes(Q.get("panel")) ? Q.get("panel") : null,
  voice: ["impl", "rev"].includes(Q.get("voice")) ? Q.get("voice") : null,
  menu: Q.has("menu"), past: Q.get("past"), born: false,
  // The popover open over the screen (review mode, models, a step's mode or model) and a listbox over it.
  pop: ["review", "models"].includes(Q.get("pop")) ? { kind: Q.get("pop"), from: "more-btn" } : null,
  pop2: Q.get("pop") === "step" ? "mode:6" : null, pop2from: "sm-6",
  taskMode: "Agent", stepMode: { 4: "Manual" }, stepModel: {}, stageModel: {},
};
const NAME = { impl: "Implementer", rev: "Reviewer" };
// A place without a session (the checks before pass 1, a blocked step) has no context to measure.
if (SC_KEY === "checks") SC.ctx = null;

// ---------------- Where the task is, per scene ----------------
// The state of the place, for the progress: the glyph, the long word and the short one.
const NOW = {
  plan: { g: "wait", word: "The agent asks you", short: "asks you", pos: "", posShort: "" },
  run: { g: "run", word: "Implementer working", short: "working", pos: "Step 3 of 7 · round 1 of 3", posShort: "3/7 · round 1" },
  ask: { g: "wait", word: "Reviewer asks you", short: "asks you", pos: "Step 3 of 7 · review pass 2", posShort: "3/7 · pass 2" },
  error: { g: "error", word: "Reviewer stopped", short: "error", pos: "Step 3 of 7 · review pass 2", posShort: "3/7 · pass 2" },
  manual: { g: "wait", word: "Your review", short: "your review", pos: "Step 4 of 7 · Manual", posShort: "4/7 · Manual" },
  blocked: { g: "error", word: "Blocked", short: "blocked", pos: "Step 5 of 7", posShort: "5/7" },
  checks: { g: "gh", word: "Waiting for checks · 3 of 5", short: "checks 3/5", pos: "", posShort: "" },
  findings: { g: "wait", word: "Findings to decide", short: "decide", pos: "Pass 1", posShort: "pass 1" },
  close: { g: "close", word: "Ready to close", short: "ready", pos: "", posShort: "" },
}[SC_KEY];
// The two agents of step 3, when both exist: whose turn it is, and what each one does or asks.
const TURN = {
  run: { on: "impl", impl: { g: "run", word: "working", tip: "Implementer working for 3 minutes 40 seconds" }, rev: { g: "idle", word: "", tip: "Reviewer idle · pass 1 wrote 2 findings" } },
  ask: { on: "rev", impl: { g: "wait", word: "waits", tip: "Implementer waits for you · Permission, 4 minutes" }, rev: { g: "wait", word: "waits", tip: "Reviewer waits for you · Question, 18 minutes" } },
  error: { on: "rev", impl: { g: "idle", word: "", tip: "Implementer idle · waits for the reviewer's pass 2" }, rev: { g: "error", word: "error", tip: "Reviewer · Session error, 5 minutes" } },
}[SC_KEY] || null;
const curVoice = () => S.voice || (TURN ? TURN.on : "impl");
function curPlace() {
  if (S.past) return S.past;
  if (SC.stage === 0) return "prd";
  if (SC.stage === 3) return `s${SC.step}${TURN && curVoice() === "rev" ? "r" : "i"}`;
  return "prr";
}
const stageOfPlace = (p) => ({ prd: "PRD", spec: "Tech spec", plan: "Plan", pr: "Pull request", prr: "PR review" }[p] || `Step ${p[1]} · ${p.endsWith("r") ? "Reviewer" : "Implementer"}`);

// ---------------- The entries of one session ----------------
function pastStep(n) {
  const d = STEP_DONE[n], p = `s${n}`, slug = STEPS[n - 1][0].toLowerCase().replace(/[^a-z]+/g, "-").replace(/-$/, "");
  const clean = n === 2 || n === 5 || n === 7;
  const e = [
    { o: 1, p: p + "i", html: EVX("file", `Started with <span class="n">steps/0${n}-${slug}.md</span>`, d.at, "", `<div class="docbody prose"><h4>Step ${n}: ${STEPS[n - 1][0]}</h4><p>The scope, the checklist and the pointers to the PRD and the tech spec.</p></div>`) },
    { o: 2, p: p + "i", html: ACTS({ n: Math.round(d.acts * 0.55), roll: "Read 14 · Wrote 8 · Tests 5 · git 3", dur: "14 min", earlier: 20, rows: [["Run the package tests", "go test ./internal/... -race", "done", "22 s"], ["Run the linter", "golangci-lint run ./...", "done", "19 s"]] }) },
    { o: 3, p: p + "i", html: AG("impl", `<p>Done. ${d.sub}; tests and lint pass.</p>`, d.at) },
    { o: 4, p: p + "r", html: HAND("Reviewer", "· pass 1", d.at, `<div class="prose"><p>Review step ${n} against the step file, the PRD and the tech spec.</p></div>`) },
    { o: 5, p: p + "r", html: ACTS({ n: 24, roll: "Read 16 · Searched 5 · Tests 3", dur: "5 min", rows: [["Run the whole suite with the race detector", "go test ./... -race", "done", "48 s"]] }) },
    { o: 6, p: p + "r", html: REPORT(1, clean, 2, d.at, clean ? "Nothing to change." : [["internal/ratelimit/config.go:14", "Validate that burst is at least 1."], ["config/plans.yaml", "Enterprise has no default."]], { step: n }) },
    { o: 9, p: p + "i", html: COMMIT(d.sha, d.sub, d.at) },
  ];
  return e;
}
function sessionOf(place) {
  let all = [];
  if (place === "prd") all = sessPRD(SC_KEY === "plan" ? "plan" : "");
  else if (place === "spec") all = sessSpec();
  else if (place === "plan") all = sessPlan();
  else if (place === "pr") all = sessPR("");
  else if (place === "prr") all = sessPRR(SC_KEY);
  else if (/^s\d/.test(place)) {
    const n = +place[1];
    if (SC.stage === 3 && SC.step === n) all = n === 3 ? sessStep3(SC_KEY) : n === 4 ? sessStep4() : sessStep5();
    else all = pastStep(n);
  }
  return all.filter((e) => e.p === place).sort((a, b) => a.o - b.o).map((e) => {
    if (e.dec) return FINDCARD(false).replace(/<fieldset class="card dec" id="askcard" aria-labelledby="dec-t"><div class="hd">[\s\S]*?<\/div>/, '<fieldset class="card dec plain" id="askcard" aria-labelledby="dec-t"><div class="hd"><span id="dec-t">Findings</span><span class="grow"></span><span class="faint num">4</span></div>');
    // The checks read before a pass: one discreet line, the names in Details.
    if (e.o === 800) return EV("check", `Checks read before pass 1 <span class="n">· 4 of 5 passed · e2e / rate-limit-burst failed</span>`, "17:41");
    // Action groups rest folded, the live one too: its summary already names the running action.
    let h = e.html.replace(/<details class="acts([^"]*)" open>/g, '<details class="acts$1">');
    // The review of a Manual step: a neutral list of the files. The bar carries the request and the progress.
    h = h.replace(/<fieldset class="card" id="askcard" aria-labelledby="chg-t"><div class="hd">[\s\S]*?<\/div>/, '<fieldset class="card plain" id="askcard" aria-labelledby="chg-t"><div class="hd"><span id="chg-t">Changed files</span><span class="grow"></span><span class="faint num">7</span></div>');
    return h;
  }).join("");
}

// ---------------- The header ----------------
function crumbsM() {
  return `<nav class="crumbs" aria-label="Breadcrumb"><span class="up row crumb-path">
    <button class="ellb" aria-haspopup="menu" aria-label="Show the hidden levels: Platform Roadmap, API hardening" data-tip="Platform Roadmap / API hardening">…</button>
    <span class="board row crumb-path"><a href="#">Platform Roadmap</a><span class="gt" aria-hidden="true">/</span></span>
    <span class="epicl row crumb-path"><a href="#">API hardening</a><span class="gt" aria-hidden="true">/</span></span></span></nav>`;
}
function toolsM() {
  const P = S.panel;
  const pb = (n, icon, tip) => `<button class="btn ghost pbtn" aria-pressed="${P === n}" data-panel="${n}" aria-label="${n}" data-tip="${tip}">${I(icon)}<span class="pl">${n}</span></button>`;
  return `<div class="ih-tools">${SC.ctx != null ? ctxm(SC.ctx) : ""}
    <button class="btn ghost sm pz" aria-label="Pause the task" data-tip="Pause the task · the session that works stops">${I("pause")}<span class="pl">Pause</span></button>
    <div class="tgroup" role="group" aria-label="Panels">${pb("Details", "info", "Steps, earlier conversations, reports and the facts of the task")}${pb("Artifacts", "file", "PRD, tech spec, step files and the pull request draft")}${pb("Card", "card", "The card acme/api#412 on the board")}</div>
    <button class="btn ghost sm icon" id="more-btn" aria-label="More actions" aria-haspopup="menu" aria-expanded="${S.menu}" data-tip="More actions">${I("more")}</button></div>`;
}
function headerM() {
  return `<header class="ih1 mh ${V.headCls || ""}">${NAVBTNS}${crumbsM()}<h1 class="ih-title"><span class="trunc">${ITEMS.t1.name}</span></h1>${V.center()}<span class="grow"></span>${toolsM()}${V.below ? V.below() : ""}</header>`;
}
// The top gives way by the width of the main area alone, at fixed limits written in the variation's CSS
// (container queries on main), never by the length of what it says. Only the line of A is measured, to lay
// its segments on whole pixels.
function fitHeader() { if (V.layout) V.layout(); }

// ---------------- The ⋯ menu: the tools that are not the screen's ----------------
function moreMenu() {
  const it = (label, tip, extra = "", key = "") => `<button class="mi" role="menuitem" data-tip="${tip}" ${extra}>${label}${key ? `<span class="k">${key}</span>` : ""}</button>`;
  const dis = (label, why) => `<button class="mi" role="menuitem" aria-disabled="true" data-tip="${why}">${label}<span class="sub">· ${why}</span></button>`;
  const sub = (label, val, kind) => `<button class="mi" role="menuitem" aria-haspopup="dialog" data-open-pop="${kind}">${label}<span class="sub">${val}</span><span class="k">›</span></button>`;
  let h = "";
  if (SC.stage === 0) h += `<div class="menu-cap">PRD</div>${it("Discard and restart the PRD…", "Throws the conversation away and starts it again")}`;
  if (SC.stage === 3) {
    const n = SC.step, agent = SC_KEY !== "manual" && SC_KEY !== "blocked";
    h += `<div class="menu-cap">Step ${n} · ${STEPS[n - 1][0]}</div>`;
    if (agent) h += it("Review myself", `Take the review of step ${n} from the agent`);
    h += it("Open in VS Code", `Open the worktree of step ${n}`, "", "Ctrl+E");
    h += it(`Discard step ${n}…`, `Throws away step ${n} and its changes`);
  }
  if (SC.stage >= 5) {
    h += `<div class="menu-cap">Pull request #1284</div>${it("Open PR", "Open #1284 on GitHub")}${it("Refresh PR", "Read the pull request now · checked 40s ago")}`;
    h += SC_KEY === "checks" ? dis("Review again", "a pass waits for the checks") : it("Review again…", "Ask for another pass now");
    h += it("Open in VS Code", "Open the worktree of the pull request", "", "Ctrl+E");
  }
  h += `<div class="menu-sep" role="separator"></div><div class="menu-cap">Task</div>${sub("Review mode", S.taskMode, "review")}${sub("Models", "per stage", "models")}`;
  // Every stage the product lets you go back to: a finished PRD and tech spec, and the plan while the steps run.
  if (SC.stage >= 1) h += it("Back to PRD…", "Reopens the PRD and deletes everything after it");
  if (SC.stage >= 2) h += it("Back to Tech spec…", "Reopens the tech spec and deletes everything after it");
  if (SC.stage === 3) h += it("Discard and restart the plan…", "Deletes the plan, the step files, the steps and their worktrees, and writes the plan again");
  h += `<div class="menu-sep" role="separator"></div><button class="mi danger" role="menuitem" data-tip="Deletes the task, its worktree and its branch">Delete task…</button>`;
  return `<div class="pop menu more" id="more-menu" role="menu" aria-label="More actions">${h}</div>`;
}

// ---------------- Review mode and models: the same popovers from ⋯ and from Details ----------------
const MODELS = ["Opus · high", "Opus · medium", "Sonnet · high", "Sonnet · medium", "Haiku"];
const STAGE_MODELS = [["PRD", "Opus · high", 0], ["Tech spec", "Opus · high", 1], ["Plan", "Opus · medium", 2], ["Implementation", "Sonnet · high", 3], ["Step review", "Opus · high", 3.5], ["PR", "Sonnet · medium", 4], ["PR review", "Opus · high", 5]];
// A stage's choice is editable until the stage starts; the step review, until the last step is committed.
const notStarted = (n) => SC.stage < 3 || (SC.stage === 3 && n > SC.step);
const stepModeOf = (n) => S.stepMode[n] || S.taskMode;
const modeIcon = (m) => I(m === "Manual" ? "user" : "bot");
function popReview() {
  const left = STEPS.map((_, k) => k + 1).filter((n) => notStarted(n) && !S.stepMode[n]);
  const off = SC.stage > 3 || (SC.stage === 3 && left.length === 0);
  const opt = (m, d) => `<button class="pop-opt" role="radio" aria-checked="${S.taskMode === m}" data-task-mode="${m}" ${off ? 'aria-disabled="true"' : ""}>${modeIcon(m)}<span class="po-t"><b>${m}</b><small>${d}</small></span>${I("check", "i ck")}</button>`;
  const note = off ? "No step is left to start, so the mode can't change." : SC.stage < 3 ? "Applies to the steps the plan writes." : `Applies to the steps not started that follow the task: ${left.join(", ")}. ${Object.keys(S.stepMode).filter((n) => notStarted(+n)).map((n) => `Step ${n} has its own mode.`).join(" ")}`;
  return `<div class="pop popm" id="popm" role="dialog" aria-label="Review mode"><div class="pop-h">Review mode</div><div role="radiogroup" aria-label="Review mode of the task">${opt("Agent", "An agent reviews each step with the implementer; clean steps are committed.")}${opt("Manual", "You review each step in VS Code, stage the files and approve.")}</div><p class="pop-note">${note}</p></div>`;
}
function popModels() {
  const rows = STAGE_MODELS.map(([n, m, k]) => {
    const v = S.stageModel[n] || m, open = k === 3.5 ? SC.stage <= 3 : SC.stage < k;
    return `<div class="pm-row"><span class="pm-n">${n}</span>${open ? `<button class="chip sm" aria-haspopup="listbox" id="pm-${n.replace(/\W/g, "")}" data-list="stage:${n}" aria-label="${n} model: ${v}">${v}${I("down")}</button>` : `<span class="pm-v" data-tip="The stage has started; its session keeps this model">${v}<span class="faint"> · started</span></span>`}</div>`;
  }).join("");
  return `<div class="pop popm" id="popm" role="dialog" aria-label="Models"><div class="pop-h">Models</div><div class="pm">${rows}</div><p class="pop-note">A stage takes its model when it starts. Each step not started can have its own, in Details.</p></div>`;
}
function popList() {
  const [kind, key] = S.pop2.split(":");
  const opts = kind === "mode" ? ["Agent", "Manual"] : MODELS;
  const cur = kind === "mode" ? stepModeOf(+key) : kind === "model" ? (S.stepModel[key] || STEPS[key - 1][1].replace("Manual · ", "")) : (S.stageModel[key] || STAGE_MODELS.find((x) => x[0] === key)[1]);
  return `<div class="pop menu popl" id="popl" role="listbox" aria-label="${kind === "mode" ? `Review mode of step ${key}` : `Model of ${kind === "model" ? `step ${key}` : key}`}">${opts.map((o) => `<button class="mi" role="option" aria-selected="${o === cur}" data-pick="${o}">${I("check", "i ck")}${kind === "mode" ? modeIcon(o) : ""}${o}</button>`).join("")}${kind === "mode" && S.stepMode[key] ? `<div class="menu-sep"></div><button class="mi" role="option" aria-selected="false" data-pick="">Follow the task · ${S.taskMode}</button>` : ""}</div>`;
}
function placePop(id, fromId) {
  const m = document.getElementById(id), b = document.getElementById(fromId), main = document.getElementById("main"); if (!m || !b) return;
  const r = b.getBoundingClientRect(), mr = main.getBoundingClientRect();
  const top = Math.round(r.bottom - mr.top + 4), left = Math.round(Math.min(r.left - mr.left, mr.width - m.offsetWidth - 8));
  m.style.top = Math.min(top, Math.round(mr.height - m.offsetHeight - 8)) + "px"; m.style.left = Math.max(8, left) + "px";
}

// ---------------- The panels, closed by default ----------------
function PANEL_M(name) {
  let b = "";
  const conv = (place, label, at) => `<button class="pl-row conv ${S.past === place ? "is-on" : ""}" data-past="${place}" data-tip="Read this conversation">${I("chat")}<span class="grow trunc">${label}</span><span class="m">${at || ""}</span></button>`;
  if (name === "Details") {
    // Before the plan, the steps do not exist yet; the review mode applies to the ones the plan writes.
    const steps = STEPS.map((s, k) => {
      const n = k + 1, d = STEP_DONE[n];
      const done = SC.stage > 3 || (SC.stage === 3 && n < SC.step), cur = SC.stage === 3 && n === SC.step;
      const g = done ? `<span class="c1">${I("check")}</span>` : cur ? `<span class="c1">${st(NOW.g)}</span>` : `<span class="c1">${st("todo")}</span>`;
      // A step not started chooses its mode and its model; a started one shows them, without edit.
      const own = !!S.stepMode[n], mode = stepModeOf(n), model = S.stepModel[n] || s[1].replace("Manual · ", "");
      const right = done ? `<span class="m mono">${d.sha}</span>` : cur ? `<span class="m now">now · ${mode}</span>`
        : `<span class="pl-sel"><button class="chip xs ${own ? "own" : ""}" id="sm-${n}" aria-haspopup="listbox" data-list="mode:${n}" aria-label="Review mode of step ${n}: ${mode}${own ? ", its own" : ", follows the task"}" data-tip="${own ? "Its own mode" : "Follows the task"}">${modeIcon(mode)}${mode}</button><button class="chip xs ${S.stepModel[n] ? "own" : ""}" id="sd-${n}" aria-haspopup="listbox" data-list="model:${n}" aria-label="Model of step ${n}: ${model}">${model}</button></span>`;
      const kids = done ? `<div class="pl-kids">${conv(`s${n}i`, "Implementer", "")}${n !== 4 ? conv(`s${n}r`, "Reviewer", "") : ""}${s[2] ? s[2].map((r) => `<button class="pl-row rep" data-tip="Open the report">${I("file")}<span class="grow trunc">${r}</span></button>`).join("") : n !== 4 ? `<button class="pl-row rep" data-tip="Open the report">${I("file")}<span class="grow trunc">Review 1 · ${n === 2 || n === 5 || n === 7 ? "clean" : "changes"}</span></button>` : ""}</div>` : "";
      return `<li class="pl-step ${cur ? "cur" : done ? "done" : "todo"}"><div class="pl-row head">${g}<span class="grow trunc">${n} · ${s[0]}</span>${right}</div>${kids}</li>`;
    }).join("");
    const planning = SC.stage > 0 ? `<div class="pgrp"><h3>Planning</h3><div class="pl-list">${conv("prd", "PRD", "09:14")}${conv("spec", "Tech spec", "09:41")}${conv("plan", "Plan", "10:22")}</div></div>` : "";
    const pr = SC.stage >= 5 ? `<div class="pgrp"><h3>Pull request</h3><div class="pl-list">${conv("pr", "Draft and opening · #1284", "17:18")}</div>
      <dl class="kv"><dt>Pull request</dt><dd><a href="#">#1284</a> · into dev</dd><dt>Checks</dt><dd>${SC_KEY === "checks" ? "3 of 5 passed · e2e running · preview-deploy queued" : "5 of 5 passed"}</dd><dt>Checked</dt><dd>40s ago</dd></dl></div>` : "";
    b = `${SC.stage >= 3 ? `<div class="pgrp"><h3>Steps · ${SC.stage > 3 ? "7 committed" : `${SC.step - 1} of 7 committed`}</h3><ul class="pl-steps">${steps}</ul></div>` : ""}${planning}${pr}
      <div class="pgrp"><h3>Task</h3><dl class="kv"><dt>Repository</dt><dd>acme/api · ~/code/api</dd><dt>Card</dt><dd><a href="#">acme/api#412</a> · In progress</dd><dt>Epic</dt><dd>API hardening</dd><dt>Mode</dt><dd>Structured</dd><dt>Review mode</dt><dd><button class="chip xs" id="dt-review" aria-haspopup="dialog" data-open-pop="review" data-from="dt-review">${modeIcon(S.taskMode)}${S.taskMode}${I("down")}</button></dd><dt>Models</dt><dd><button class="chip xs" id="dt-models" aria-haspopup="dialog" data-open-pop="models" data-from="dt-models">Per stage${I("down")}</button></dd><dt>Branch</dt><dd class="mono">rate-limit-per-api-key</dd><dt>Base</dt><dd class="mono">dev</dd><dt>Worktree</dt><dd class="mono">~/.local/share/myspec/worktrees/acme/api/rate-limit-per-api-key</dd><dt>Started</dt><dd>Today 09:14</dd></dl></div>`;
  }
  if (name === "Artifacts") {
    const doc = (label, m, on = true) => `<button class="pl-row" ${on ? "" : 'aria-disabled="true"'} data-tip="${on ? "Read the document" : "Not written yet"}">${I("file")}<span class="grow trunc">${label}</span><span class="m">${m}</span></button>`;
    b = `<div class="pgrp"><h3>Documents</h3><div class="pl-list">${doc("PRD", SC.stage > 0 ? "09:41" : "not yet", SC.stage > 0)}${doc("Tech spec", SC.stage > 1 ? "10:22" : "not yet", SC.stage > 1)}</div></div>
      ${SC.stage >= 3 ? `<div class="pgrp"><h3>Step files · 7</h3><div class="pl-list">${STEPS.map((s, k) => doc(`${k + 1} · ${s[0]}`, "")).join("")}</div></div>` : ""}
      ${SC.stage >= 5 ? `<div class="pgrp"><h3>Pull request</h3><div class="pl-list">${doc("Draft · Rate limit requests per API key", "approved")}</div></div>` : ""}`;
  }
  if (name === "Card") b = `<div class="pgrp"><h3>acme/api#412 · In progress</h3></div><div class="prose pl-prose"><p>Today every client shares one global limit in the gateway, so one noisy integration throttles everyone.</p><p>Limit each API key with its plan's burst and refill, and answer 429 with <code>Retry-After</code>.</p></div>
    <div class="pgrp"><h3>Epic · API hardening</h3><div class="pl-list"><div class="pl-row">${st("run")}<span class="grow trunc">#441 Rotate API keys without downtime</span></div><div class="pl-row">${st("todo")}<span class="grow trunc">#415 Audit log for key changes</span></div></div></div>`;
  return `<aside class="panel" id="panel" aria-label="${name}"><div class="panel-h"><h2>${name}</h2><button class="btn ghost sm icon" data-panel="${name}" aria-label="Close ${name}" data-tip="Close · Esc">${I("x")}</button></div><div class="panel-b">${b}</div></aside>`;
}
function panelRule() {
  const p = document.getElementById("panel"), m = document.getElementById("main"); if (!p || !m) return;
  const w = m.getBoundingClientRect().width, pw = Math.min(480, Math.max(360, Math.round(w * 0.28)));
  p.classList.toggle("over", w - pw < 760);
}

// ---------------- The conversation ----------------
function convo() {
  if (!S.past && V.conv) return V.conv();
  if (S.past) return `<div class="stream">${sessionOf(S.past)}</div>`;
  if (SC_KEY === "checks") return `<div class="empty"><p class="em-t">The review starts when the checks finish.</p><p class="em-s">MySpec reads #1284 every minute. The first pass begins once e2e and preview-deploy are done.</p>${CHECKS(true).replace(/<button class="btn ghost xs"[^>]*>Refresh<\/button>/, "")}</div>`;
  return `<div class="stream">${sessionOf(curPlace())}</div>`;
}

// ---------------- The ask bar ----------------
// A request of one agent, quiet: its card is in the conversation.
const REQ = {
  rev: { label: SC_KEY === "error" ? "Session error" : "Question", place: "Reviewer", s: SC_KEY === "error" ? { sev: "error", since: "5m", long: "5 minutes" } : { sev: "wait", since: "18m", long: "18 minutes" }, card: "askcard" },
  impl: { label: "Permission", place: "Implementer", s: { sev: "wait", since: "4m", long: "4 minutes" }, card: "askcard2" },
};
const waits = (v) => (SC_KEY === "ask") || (SC_KEY === "error" && v === "rev");
function reqRow(r, show) {
  const g = r.s.sev === "error" ? "error" : "wait";
  return `<span class="req what">${st(g)}<span class="lbl">${r.label}</span><span class="muted">· ${r.place}</span>${tw(r.s)}${show ? `<button class="btn sm" data-show="${r.card}" data-tip="Go to the card · the first option takes the focus">${I("up")}Show</button>` : ""}</span>`;
}
function otherRow(v) {
  const r = REQ[v];
  return `<span class="req what other">${st(r.s.sev === "error" ? "error" : "wait")}<span class="muted">The ${NAME[v].toLowerCase()} also waits · ${r.label}</span>${tw(r.s)}<button class="btn sm" data-goto="${v}" data-tip="Show the ${NAME[v].toLowerCase()}'s conversation">Go to ${NAME[v].toLowerCase()}</button></span>`;
}
function askM() {
  if (S.past || SCENE === "retrying") return "";
  if (TURN && (SC_KEY === "ask" || SC_KEY === "error")) {
    const on = curVoice(), off = on === "rev" ? "impl" : "rev";
    if (waits(on)) {
      if (SC_KEY === "error") return ASK({ ...SC.ask, detail: "" });
      const here = `<span class="sr" role="status">${REQ[on].label} from the ${NAME[on].toLowerCase()}</span>${reqRow(REQ[on], true)}`;
      return `<div class="ask-in quiet ${V.pointOther && waits(off) ? "two-rows" : ""}" role="region" aria-label="What this item asks">${here}${V.pointOther && waits(off) ? otherRow(off) : ""}</div>`;
    }
    if (waits(off)) {
      if (SC_KEY === "error") return `<div class="ask-in err" role="region" aria-label="What this item asks"><span class="sr" role="status">The reviewer's session stopped</span><span class="what">${st("error")}<span class="lbl">Session error</span><span class="muted">· Reviewer · pass 2</span>${tw(REQ.rev.s)}</span><span class="adet">The implementer waits for the reviewer</span><span class="acts-r"><button class="btn sm" data-goto="rev">Go to reviewer</button></span></div>`;
      return `<div class="ask-in quiet" role="region" aria-label="What this item asks"><span class="sr" role="status">The ${NAME[off].toLowerCase()} waits for you</span>${otherRow(off).replace("also waits", "waits")}</div>`;
    }
    return "";
  }
  // The quick replies say how to answer; the bar only says whose turn it is.
  return SC.ask ? ASK(["plan", "error", "blocked"].includes(SC_KEY) ? { ...SC.ask, detail: "" } : SC.ask) : "";
}

// ---------------- The composer ----------------
function composerM() {
  if (S.past) {
    const back = SC.stage === 3 ? `step ${SC.step}` : SC.stage === 0 ? "the PRD" : "now";
    return `<div class="pastfoot" role="region" aria-label="Earlier conversation"><span>${I("history")}<b>${stageOfPlace(S.past)}</b> · an earlier conversation. It takes no more messages.</span><button class="btn sm" data-now data-tip="Back to where the task is · Esc">Back to ${back}</button></div>`;
  }
  const v = curVoice(), who = TURN ? NAME[v].toLowerCase() : null;
  const PH = {
    run: v === "impl" ? "Queue a message for the implementer…" : "Reply to the reviewer…",
    ask: v === "rev" ? "Answer with 1–3, or reply to the reviewer…" : "Allow with 1–3 above, or reply to the implementer…",
    error: v === "rev" ? "Sending restarts the reviewer's session…" : "Reply to the implementer…",
  };
  // A place with no session yet (the checks, a blocked step) has no composer: the screen says why above.
  if (SC.comp.disabled) return "";
  const c = { ...SC.comp, to: null, ph: PH[SC_KEY] || SC.comp.ph, label: who ? `Reply to the ${who}` : "Reply to the agent" };
  if (TURN && v === "rev") { c.working = null; c.model = "Opus · high"; }
  if (TURN && v === "impl") c.model = "Sonnet · high";
  if (SCENE === "retrying") { c.working = "Working · 9m 12s"; c.ph = "Queue a message for the reviewer…"; }
  if (c.working) c.working = SCENE === "long" ? "Working · 2m 05s" : SCENE === "retrying" ? c.working : "Working · 3m 40s";
  // The quick replies take the first words of each option as the agent wrote it.
  if (c.quick) c.quick = [["a", "In the plans table, read and cached for 60 s…"], ["b", "In config/plans.yaml, shipped with a release…"]];
  let html = COMPOSER(c);
  if (V.swap && TURN) html = html.replace('<div class="cfoot">', `<div class="cfoot">${voiceSwitch()}`);
  if (c.quick) html = html.replace('<div class="cbox">', `<div class="cbox"><div class="qr" role="group" aria-label="Quick replies">${c.quick.map(([k, t]) => `<button class="chip" data-tip="Sends “${k}”"><span class="kn">${k}</span>${t}</button>`).join("")}</div>`);
  return html;
}
function av(v) { return `<span class="av ${v === "rev" ? "rev" : ""}">${I(v === "rev" ? "review-s" : "bot")}</span>`; }
// A: the voice on screen and the other one, and one click swaps them.
function voiceSwitch(state = "") {
  const on = curVoice(), off = on === "rev" ? "impl" : "rev";
  return `<button class="vsw ${state}" type="button" data-voice="${off}" aria-label="Talking to the ${NAME[on].toLowerCase()}. Show the ${NAME[off].toLowerCase()}'s conversation: ${TURN[off].tip}" data-tip="Show the ${NAME[off].toLowerCase()}'s conversation · Alt+\`">${av(on)}<span class="on">${NAME[on]}</span><span class="sw-i">${I("swap")}</span>${st(TURN[off].g)}<span class="off">${NAME[off]}</span></button>`;
}
// B: two tabs, only when the step has both agents.
function voiceTabs() {
  if (!TURN || S.past) return "";
  const on = curVoice();
  const tab = (v) => `<button role="tab" class="vt" id="vt-${v}" aria-selected="${on === v}" aria-controls="convo" tabindex="${on === v ? 0 : -1}" data-voice="${v}" aria-label="${NAME[v]}. ${TURN[v].tip}" data-tip="${TURN[v].tip}">${st(TURN[v].g)}<span>${NAME[v]}</span>${on !== v && (TURN[v].g === "wait" || TURN[v].g === "error") ? `<span class="vw ${TURN[v].g === "error" ? "err" : ""}">· ${TURN[v].word}</span>` : ""}</button>`;
  return `<div class="vtabs"><div class="vtabs-in" role="tablist" aria-label="Conversations of step 3">${tab("impl")}${tab("rev")}</div></div>`;
}

// ---------------- The page ----------------
function mainM() {
  const panel = S.panel ? PANEL_M(S.panel) : "";
  const ask = askM();
  // While the ask bar is on screen, the top says where the task is, and the bar says what it asks.
  S.hasBar = !!ask;
  return `<main class="main m" id="main">${headerM()}<div class="body" id="body"><div class="colconvo">
    ${V.tabs ? voiceTabs() : ""}
    <div class="convo-wrap"><div class="convo" id="convo" tabindex="-1" aria-label="${S.past ? stageOfPlace(S.past) : "The conversation"}"><div class="convo-in enter">${convo()}</div></div></div>
    ${ask ? `<div class="ask">${ask}</div>` : ""}${composerM() ? `<div class="composer"><div class="composer-in">${composerM()}</div></div>` : `<div class="composer-end"></div>`}</div>${panel}</div>
    ${S.menu ? moreMenu() : ""}${S.pop ? (S.pop.kind === "review" ? popReview() : popModels()) : ""}${S.pop2 ? popList() : ""}</main>`;
}
function placeMenu() {
  const m = document.getElementById("more-menu"), b = document.getElementById("more-btn"), main = document.getElementById("main"); if (!m || !b) return;
  const r = b.getBoundingClientRect(), mr = main.getBoundingClientRect();
  m.style.top = Math.round(r.bottom - mr.top + 4) + "px"; m.style.right = Math.round(mr.right - r.right) + "px";
}
function render() {
  document.getElementById("app").innerHTML = sidebar() + mainM() + mockbar(SCENE_KEYS, SCENE);
  const cv = document.getElementById("convo");
  cv.scrollTop = S.past ? 0 : cv.scrollHeight;
  if (V.after) V.after(cv);
  document.getElementById("tree").addEventListener("scroll", moreBelow);
  const pops = () => { if (S.pop) placePop("popm", S.pop.from); if (S.pop2) placePop("popl", S.pop2from); };
  panelRule(); fitHeader(); placeMenu(); pops();
  requestAnimationFrame(() => { fitHeader(); moreBelow(); markTruncated(); placeMenu(); pops(); });
}
function goVoice(v, focusCard) {
  S.voice = v; render();
  if (focusCard) { const c = document.getElementById(REQ[v].card); if (c) { c.scrollIntoView({ block: "center" }); const b = c.querySelector("button"); if (b) b.focus(); } }
}
document.addEventListener("DOMContentLoaded", () => {
  document.body.insertAdjacentHTML("beforeend", `<div id="app" class="app"></div><div class="toasts" role="status" aria-live="polite" aria-label="Notifications"></div><pre id="report" class="report" hidden></pre>`);
  bootCommon(render);
  document.body.insertAdjacentHTML("afterbegin", SPRITE_M);
  document.addEventListener("click", (e) => {
    const gt = e.target.closest("[data-goto]"); if (gt) { goVoice(gt.dataset.goto, true); return; }
    const vo = e.target.closest("[data-voice]"); if (vo) { goVoice(vo.dataset.voice); const t = document.querySelector(V.tabs ? `#vt-${vo.dataset.voice}` : ".vsw"); if (t) t.focus(); return; }
    const pa = e.target.closest("[data-past]"); if (pa) {
      // A panel that covers the conversation steps aside, so the way back stays in sight.
      const over = document.querySelector(".panel.over");
      S.past = S.past === pa.dataset.past ? null : pa.dataset.past; if (over && S.past) S.panel = null; render(); return;
    }
    const op = e.target.closest("[data-open-pop]"); if (op) { S.menu = false; S.pop2 = null; S.pop = { kind: op.dataset.openPop, from: op.dataset.from || "more-btn" }; render(); const f = document.querySelector("#popm button:not([aria-disabled])"); if (f) f.focus(); return; }
    const tm = e.target.closest("[data-task-mode]"); if (tm) { if (tm.getAttribute("aria-disabled") !== "true") { S.taskMode = tm.dataset.taskMode; render(); } return; }
    const li = e.target.closest("[data-list]"); if (li) { S.pop2 = S.pop2 === li.dataset.list ? null : li.dataset.list; S.pop2from = li.id; render(); const f = document.querySelector('#popl [aria-selected="true"]'); if (f) f.focus(); return; }
    const pk = e.target.closest("[data-pick]"); if (pk) {
      const [kind, key] = S.pop2.split(":"), v = pk.dataset.pick;
      if (kind === "mode") { if (v) S.stepMode[key] = v; else delete S.stepMode[key]; }
      else if (kind === "model") S.stepModel[key] = v; else S.stageModel[key] = v;
      const back = S.pop2from; S.pop2 = null; render(); const b = document.getElementById(back); if (b) b.focus(); return;
    }
    if (S.pop2 && !e.target.closest("#popl")) { S.pop2 = null; render(); return; }
    if (S.pop && !e.target.closest("#popm")) { S.pop = null; render(); return; }
    if (e.target.closest("[data-now]")) { S.past = null; render(); return; }
    if (e.target.closest("#more-btn")) { S.menu = !S.menu; render(); if (S.menu) { const f = document.querySelector("#more-menu .mi"); if (f) f.focus(); } return; }
    if (S.menu && !e.target.closest("#more-menu")) { S.menu = false; render(); }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && S.pop2) { const b = S.pop2from; S.pop2 = null; render(); const x = document.getElementById(b); if (x) x.focus(); return; }
    if (e.key === "Escape" && S.pop) { S.pop = null; render(); return; }
    const opt = e.target.closest && e.target.closest("#popl .mi, #popm .pop-opt");
    if (opt && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); const all = [...opt.parentElement.parentElement.querySelectorAll(".mi, .pop-opt")]; const k = all.indexOf(opt); all[(k + (e.key === "ArrowDown" ? 1 : all.length - 1)) % all.length].focus(); return; }
    if (e.key === "Escape" && S.menu) { S.menu = false; render(); document.getElementById("more-btn").focus(); return; }
    if (e.key === "Escape" && S.past && !S.panel) { S.past = null; render(); return; }
    if (e.altKey && e.key === "`" && TURN) { e.preventDefault(); goVoice(curVoice() === "rev" ? "impl" : "rev"); return; }
    const tab = e.target.closest && e.target.closest(".vt");
    if (tab && (e.key === "ArrowLeft" || e.key === "ArrowRight")) { e.preventDefault(); const v = curVoice() === "rev" ? "impl" : "rev"; goVoice(v); document.getElementById(`vt-${v}`).focus(); }
    const mi = e.target.closest && e.target.closest("#more-menu .mi");
    if (mi && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); const all = [...document.querySelectorAll("#more-menu .mi")]; const k = all.indexOf(mi); all[(k + (e.key === "ArrowDown" ? 1 : all.length - 1)) % all.length].focus(); }
  });
  addEventListener("resize", () => { panelRule(); placeMenu(); });
  render();
  if (document.fonts) document.fonts.ready.then(() => { fitHeader(); markTruncated(); });
  if (Q.has("audit")) setTimeout(audit, 1200);
});
// ?meas: the widths of the header's pieces, to set the limits at which the top gives way.
if (Q.has("meas")) setTimeout(() => { const h = document.querySelector(".mh"); const pre = document.getElementById("report"); pre.hidden = false; pre.textContent = JSON.stringify({ main: document.getElementById("main").clientWidth, header: h.clientWidth, parts: [...h.children].map((c) => [c.className.split(" ")[0] || c.tagName, Math.round(c.getBoundingClientRect().width)]), gap: getComputedStyle(h).columnGap }); }, 1500);
