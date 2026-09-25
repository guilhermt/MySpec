/* =====================================================================
   ROUND 14 · the shell of the scenes: the state, the sidebar of round 10
   with the place in the footer, the header of a place, the task screen
   behind the dialogs, the dialog frame and the helpers. Read with core.js
   and stepper.js of round 10, unchanged.
   ?scene= · ?v= (the variation of a scene) · ?theme= · ?audit · ?clean
   ===================================================================== */
const SCENES = [
  ["settings-defaults", "Settings · Defaults", [["", "Models and review mode"], ["list", "A model's listbox open"], ["saving", "Saving, and a save that failed"], ["reading", "The catalog is being read"], ["failed", "No reading of the catalog"]]],
  ["settings-boards", "Settings · Boards", [["", "The boards"], ["add-1", "Add board · 1 of 3, the project"], ["add-1-reading", "Add board · reading the project"], ["add-1-error", "Add board · the project can't be read"], ["add-2", "Add board · 2 of 3, the statuses"], ["add-3", "Add board · 3 of 3, the repositories"], ["add-nostatus", "Add board · no Status field, 2 of 2"], ["edit-reading", "Edit board · reading the board"], ["edit-1", "Edit board · 1 of 2, the statuses changed"], ["edit-2", "Edit board · 2 of 2, two unchecked"], ["remove", "Remove a board"]]],
  ["settings-repos", "Settings · Repositories", [["", "The repositories"], ["add", "Add repository · the scan"], ["add-scanning", "Add repository · scanning"], ["add-refused", "Add repository · Browse refused"], ["instructions", "Review instructions open"], ["menu", "A row's menu"], ["change-path", "Change path refused"], ["remove", "Remove a repository"], ["empty", "Nothing registered here"]]],
  ["settings-prompts", "Settings · Prompts", [["", "The prompts"], ["view", "A prompt, edited"], ["edit", "Editing a prompt"], ["reset", "Reset to default"], ["discard", "Leaving with unsaved changes"]]],
  ["history", "History", [["", "By date"], ["fresh", "Arriving from a closed task"], ["filtered", "The sidebar's filter on acme/web"], ["no-match", "A search without results"], ["empty", "Nothing archived yet"]]],
  ["archived-task", "History · a task", [["", "PRD"], ["steps", "Steps and their reports"], ["pr", "The pull request"], ["oneshot", "A One-Shot task"], ["delete", "Delete the archived task"]]],
  ["archived-review", "History · a review", [["", "Passes and what was published"]]],
  ["archived-discussion", "History · a discussion", [["", "What it published"]]],
  ["starting", "Starting MySpec", [["", "Starting"], ["slow", "A slow step"], ["failed", "Couldn't start"]]],
  ["welcome", "Welcome", [["", "Nothing registered"], ["no-login", "The GitHub CLI isn't signed in"], ["no-gh", "The GitHub CLI isn't installed"], ["no-claude", "Claude Code isn't found"]]],
  ["migration", "Migration refused", [["", "Three kinds of cases"]]],
  ["notice", "Notices", [["", "Something went wrong"], ["toast", "Items that left without being open"]]],
  ["gone", "The open item left", [["", "Task closed and archived"], ["deleted", "Task deleted, files stayed"], ["review", "Review ended by the merge"], ["discussion", "Discussion archived"], ["nothing", "Nothing else needs you"]]],
  ["delete-task", "Dialog · Delete task", [["", "What will be destroyed"], ["loading", "Reading what will be destroyed"], ["failed", "The preview failed"], ["merged", "With the PR merged"], ["deleting", "Deleting"]]],
  ["discard-step", "Dialog · Discard step", [["", "Also clean the worktree"], ["keep", "Keep the worktree as it is"]]],
  ["back-to-stage", "Dialog · Back to a stage", [["", "Back to the Tech spec"], ["pr", "Back to the PRD, from the PR review"], ["discard", "Discard the Plan and start over"]]],
  ["pause", "Paused", [["", "The task paused"], ["pausing", "Pausing"], ["blocked", "Pause with a session error"]]],
  ["notifications", "Notifications", [["", "Text and click, per situation"]]],
];
const SCN = SCENES.some(([k]) => k === Q.get("scene")) ? Q.get("scene") : "settings-defaults";
const VARS = SCENES.find(([k]) => k === SCN)[2];
const VAR = VARS.some(([k]) => k === (Q.get("v") || "")) ? (Q.get("v") || "") : "";
const S = { panel: null, menu: null, dialog: null, list: null, check: {}, filter: "", open: {} };
let OPENID = null;
const plural = (n, w, ws) => `${n} ${n === 1 ? w : ws || w + "s"}`;
const listOf = (a) => a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`;

// ---------------- The tree: round 10's, with the open item of the scene ----------------
Object.assign(ITEMS.t1, { pos: "Step 3/7 · Reviewer pass 2", posShort: "Step 3/7 · pass 2",
  run: { who: "Reviewer", turn: "3m", long: "3 minutes 20 seconds", verb: "Running", target: "go test ./internal/ratelimit/...", short: "go test …/ratelimit" }, ctx: 41 });
function nextJ() {
  return Object.keys(ITEMS).filter((id) => id !== OPENID && needsYou(ITEMS[id])).sort((a, b) => {
    const x = sortSits(ITEMS[a].sits)[0], y = sortSits(ITEMS[b].sits)[0];
    return SEV[x.sev] - SEV[y.sev] || y.min - x.min;
  })[0];
}
function itemRow(id, level) {
  const i = ITEMS[id], t = tone(i), sel = id === OPENID;
  let l2 = "", r2 = "", l3 = "";
  if (needsYou(i)) {
    const s = sortSits(i.sits)[0];
    const more = i.sits.length > 1 ? `<span class="more">+${i.sits.length - 1}</span>` : "";
    l2 = `<span class="lbl trunc"><span class="long">${i.row[0]}</span><span class="short">${i.row[1]}</span></span>${more}`;
    r2 = tw(s);
  } else if (i.run) {
    l2 = `<span class="lbl trunc"><span class="long">${i.pos}</span><span class="short">${i.posShort || i.pos}</span></span>`;
    r2 = tt(i.run);
    l3 = `<span class="c1"></span><span class="l3 trunc"><span class="long"><span class="v">${i.run.verb}</span> ${i.run.target}</span><span class="short"><span class="v">${i.run.verb}</span> ${i.run.short}</span></span><span class="r3">${ctxm(i.ctx)}</span>`;
  } else {
    const word = t === "gh" ? "GitHub" : t === "idle" ? "idle" : "";
    l2 = `<span class="lbl trunc">${i.pos}</span>`;
    r2 = word ? `<span class="rw">${word}</span>` : "";
  }
  const jk = nextJ() === id;
  const r1 = jk ? `<span class="meta jk" data-tip="Ctrl+J opens this next"><kbd class="jk">Ctrl J</kbd></span>` : `<span class="meta">${meta(i)}</span>`;
  const cls = [sel ? "sel" : "", needsYou(i) ? "you" : "", t === "error" ? "err" : "", jk ? "jk-row" : ""].join(" ");
  return `<div class="it ${cls}" role="treeitem" aria-level="${level}" tabindex="${sel ? 0 : -1}" ${sel ? 'aria-current="page" aria-selected="true"' : ""} data-meta="${meta(i)}" aria-label="${ariaFor(i)}">
    <span class="c1">${ty(i)}</span><span class="nm trunc">${i.name}</span><span class="r1">${r1}</span>
    <span class="c1">${st(t)}</span><span class="l2">${l2}</span><span class="r2">${r2}</span>${l3}</div>`;
}
// The footer says the place that is open: History or Settings, pressed like a panel's button.
function footer(place, bare = false) {
  const hist = bare ? `<button class="btn ghost sm" disabled aria-describedby="why-nohist" data-tip="Nothing archived yet">${I("history")}History</button><span class="sr" id="why-nohist">Nothing archived yet</span>`
    : `<button class="btn ghost sm fbtn" ${place === "history" ? 'aria-current="page"' : ""} data-go="history" data-tip="44 archived: 22 tasks, 12 reviews, 10 discussions">${I("history")}History <span class="cnt">44</span></button>`;
  return `<div class="sb-foot">${hist}<span class="grow"></span>
    <button class="btn ghost sm icon" id="theme-btn" data-tip="Theme: ${THEME_WORD[MODE]} · click to change" aria-label="Theme: ${THEME_WORD[MODE]}">${I("theme")}</button><button class="btn ghost sm fbtn" ${place === "settings" ? 'aria-current="page"' : ""} data-go="settings-defaults" data-tip="Settings · Ctrl+,">${I("settings")}Settings</button></div>`;
}
function sidebar14(place) {
  let h = sidebar();
  h = h.replace(/<div class="sb-foot">[\s\S]*<\/div>\s*<\/aside>$/, `${footer(place)}</aside>`);
  if (Q.get("scene") === "history" && VAR === "filtered") h = h.replace("<option>acme/web</option>", "<option selected>acme/web</option>");
  return h;
}
// Welcome: the top and the footer, nothing to list yet.
function sidebarBare() {
  return `<aside class="sb" aria-label="Work"><div class="sb-top"><span class="brand grow"><span class="mark">${I("mark", "")}</span>MySpec</span>
    <button class="btn new sm" disabled aria-describedby="why-new" data-tip="Register a board or a repository first">${I("plus")}New${I("down", "i")}</button><span class="sr" id="why-new">Register a board or a repository first</span></div>
    <div class="sb-tree sb-none"></div>${footer("", true)}</aside>`;
}
// Starting: the sidebar in skeleton, nothing clickable yet but the theme.
function sidebarSkeleton() {
  const row = (w) => `<div class="sk-row"><i class="sk-g"></i><span class="sk-l"><i style="width:${w}%"></i><i style="width:${Math.max(30, w - 28)}%"></i></span></div>`;
  return `<aside class="sb" aria-label="Work" aria-busy="true"><div class="sb-top"><span class="brand grow"><span class="mark">${I("mark", "")}</span>MySpec</span></div>
    <div class="sb-tree skel-tree ${VAR === "failed" ? "is-still" : ""}" ${VAR === "failed" ? "" : 'role="status" aria-label="Loading your work"'}>${["Reviews", "Mobile App", "Platform Roadmap"].map((n, k) => `<div class="sk-node"><i style="width:${[34, 40, 52][k]}%"></i></div>${row([70, 58, 76][k])}${row([62, 80, 55][k])}`).join("")}</div>
    <div class="sb-foot"><span class="grow"></span><button class="btn ghost sm icon" id="theme-btn" data-tip="Theme: ${THEME_WORD[MODE]} · click to change" aria-label="Theme: ${THEME_WORD[MODE]}">${I("theme")}</button></div></aside>`;
}

// ---------------- The header of a place that is not an item ----------------
const navBack = (to) => `<div class="navbtns"><button class="btn ghost sm icon" data-tip="Back to ${to} · Alt+←" aria-label="Back to ${to}">${I("left")}</button></div>`;
function placeHead(title, tools = "", back = "Rate limit per API key", cls = "") {
  return `<header class="ih1 bh ${cls}">${navBack(back)}<h1 class="ih-title"><span class="trunc">${title}</span></h1><span class="grow"></span><div class="ih-tools">${tools}</div></header>`;
}

// ---------------- The task screen behind the dialogs, the notice and the pause ----------------
const TSTAGES = ["PRD", "Tech spec", "Plan", "Implementation", "PR", "PR review", "Closing"];
function taskHeader(o = {}) {
  const paused = !!o.paused;
  const pz = paused ? `<button class="btn ghost sm pz" aria-label="Resume the task" data-tip="Resume the task · the session starts again where it stopped">${I("play")}<span class="pl">Resume</span></button>`
    : o.pausing ? `<button class="btn ghost sm pz is-loading" aria-busy="true" aria-label="Pausing the task"><span class="spin"></span><span class="pl">Pausing…</span></button>`
    : o.pauseOff ? `<button class="btn ghost sm pz" disabled aria-describedby="why-pz" aria-label="Pause the task" data-tip="Nothing is running to pause: the reviewer's session stopped with an error. Retry it, or discard the step.">${I("pause")}<span class="pl">Pause</span><span class="sr" id="why-pz">Nothing is running to pause: the reviewer's session stopped with an error.</span></button>`
    : `<button class="btn ghost sm pz" aria-label="Pause the task" data-tip="Pause the task · the session that works stops, and nothing notifies until you resume">${I("pause")}<span class="pl">Pause</span></button>`;
  const pb = (n, icon, tip) => `<button class="btn ghost pbtn" aria-pressed="false" aria-label="${n}" data-tip="${tip}">${I(icon)}<span class="pl">${n}</span></button>`;
  const step = stepper({ stage: o.pr ? 5 : 3, stages: TSTAGES, g: o.g || "run", pos: o.pr ? "pass 1" : "3/7 · pass 2", short: o.short || "working", word: o.word || "The reviewer is working", bar: !!o.bar, cls: paused ? "is-paused" : "" });
  return `<header class="ih1 mh has-stepper">${navBack("Platform Roadmap")}<nav class="crumbs" aria-label="Breadcrumb"><span class="up row crumb-path"><button class="ellb" aria-haspopup="menu" aria-label="Show the hidden levels: Platform Roadmap, API hardening" data-tip="Platform Roadmap / API hardening">…</button><span class="board row crumb-path"><a href="#">Platform Roadmap</a><span class="gt" aria-hidden="true">/</span></span><span class="epicl row crumb-path"><a href="#">API hardening</a><span class="gt" aria-hidden="true">/</span></span></span></nav>
    <h1 class="ih-title"><span class="trunc">Rate limit per API key</span></h1>${step}<span class="grow"></span>
    <div class="ih-tools">${paused ? `<span class="ctx is-empty" data-tip="The session is paused">—</span>` : ctxm(41)}${pz}
    <div class="tgroup" role="group" aria-label="Panels">${pb("Details", "info", "Steps, earlier conversations, reports and the facts of the task")}${pb("Artifacts", "file", "PRD, tech spec, step files and the pull request draft")}${pb("Card", "card", "The card acme/api#412 on the board")}</div>
    <button class="btn ghost sm icon" id="more-btn" aria-label="More actions" aria-haspopup="menu" data-tip="More actions">${I("more")}</button></div></header>`;
}
function taskConvo(o = {}) {
  if (o.pr) return [EV("pr", `Opened <span class="n">PR #1284 · Rate limit requests per API key</span>`, "15:40"), EV("play", `PR review started <span class="n">· pass 1 · checks 5/5 passed</span>`, "15:52"),
    AG("rev", `<p>Reading the diff against dev: 23 files, the middleware, the plan lookup and the docs. The e2e suite covers the 429 path; I'm checking the headers next.</p>`, "15:53", "PR review"),
    ACTIVITY("PR reviewer", `Running <span class="mono">go test ./internal/ratelimit/...</span>`, "2m 10s")].join("");
  const e = [
    EV("play", `Step 3 started <span class="n">· Token bucket middleware</span>`, "14:21"),
    AG("impl", `<p>I'll put the token bucket in <code>internal/ratelimit</code> as a middleware, keyed by the API key's id, with the burst and the refill read from the plan. The limiter keeps its buckets in Redis so every gateway instance sees the same count.</p>`, "14:21"),
    ACTS({ n: 14, roll: "Edited 5 files, ran the tests", dur: "7m 12s", rows: [["Edit", "internal/ratelimit/bucket.go", "done"], ["Run the rate limit tests", "go test ./internal/ratelimit/...", "done"]] }),
    AG("impl", `<p>The middleware answers <code>429</code> with <code>Retry-After</code> when the bucket is empty, and the tests cover the burst, the refill and two keys of the same workspace.</p>`, "14:29"),
    REPORT(1, false, 2, "14:36", [["internal/ratelimit/bucket.go:58", "The refill uses the wall clock; a clock step backwards empties the bucket."], ["internal/ratelimit/middleware.go:31", "A missing plan panics instead of falling back to the default limit."]], { step: 3 }),
    AG("impl", `<p>Both fixed: the refill reads the monotonic clock, and a key without a plan gets the default limit of 60 requests per minute.</p>`, "14:44"),
  ];
  if (o.paused) e.push(EV("pause", `Paused by you <span class="n">· the reviewer's pass 2 stopped; Resume or a message starts it again</span>`, "14:52"));
  else if (o.error) e.push(ERR("Session error", "The reviewer's session stopped unexpectedly. The conversation is kept; Retry opens it again where it stopped.", "claude exited with status 1 · claude --resume 5b1e…"));
  else e.push(ACTIVITY("Reviewer", `Running <span class="mono">go test ./internal/ratelimit/...</span>`, "3m 20s"));
  return e.join("");
}
function taskMain(o = {}) {
  const tabs = o.pr ? "" : `<div class="vtabs"><div class="vtabs-in" role="tablist" aria-label="Conversations of step 3"><button role="tab" class="vt" aria-selected="true" tabindex="0">${st("idle")}<span>Implementer</span></button><button role="tab" class="vt" aria-selected="false" tabindex="-1">${st(o.paused ? "paused" : o.error ? "error" : "run")}<span>Reviewer</span>${o.error ? `<span class="vw err">· error</span>` : ""}</button></div></div>`;
  const ask = o.error ? `<div class="ask">${ASK({ kind: "error", label: "Session error", place: "Reviewer", s: { sev: "error", since: "2m", long: "2 minutes" }, detail: "", actions: `<button class="btn sm primary">Retry reviewer</button>` })}</div>` : "";
  const comp = o.pr ? COMPOSER({ ph: "Reply to the PR reviewer…", label: "Reply to the PR reviewer", model: "Opus 5.5 (1M) · high" }) : o.paused ? COMPOSER({ ph: "Sending resumes the task…", label: "Reply to the implementer", model: "Opus 5.5 (1M) · medium" })
    : COMPOSER({ ph: o.error ? "Sending restarts the reviewer's session…" : "Reply to the implementer…", label: "Reply to the implementer", model: "Opus 5.5 (1M) · medium" });
  return `<main class="main m" id="main">${o.notice || ""}${taskHeader(o)}<div class="body" id="body"><div class="colconvo">${tabs}
    <div class="convo-wrap"><div class="convo" id="convo" tabindex="-1" aria-label="The conversation"><div class="convo-in"><div class="stream">${taskConvo(o)}</div></div></div></div>
    ${ask}<div class="composer"><div class="composer-in">${comp}</div></div></div></div>${o.over || ""}</main>`;
}

// ---------------- The dialog frame ----------------
// o: { title, sub, body, back, why, whyErr, cancel, primary, kind: "wide" | "min", danger, busy }
function dialog(o) {
  const cancel = `<button class="btn ghost" data-act="dlg-close" ${o.busy ? "disabled" : ""}>${o.cancel || "Cancel"}</button>`;
  const back = o.back ? `<button class="btn ghost bk" data-act="dlg-back" ${o.busy ? "disabled" : ""}>${I("left")}Back</button>` : "";
  const prim = o.primary || "";
  return `<div class="scrim" id="scrim"><div class="dlg ${o.kind === "wide" ? "wide" : "agd"} ${o.cls || ""}" role="${o.alert ? "alertdialog" : "dialog"}" aria-modal="true" aria-labelledby="dlg-t" ${o.sub ? 'aria-describedby="dlg-s"' : ""}>
    <div class="dlg-hd"><div class="dlg-ht"><h2 id="dlg-t">${o.title}</h2>${o.sub ? `<p class="dlg-sub" id="dlg-s">${o.sub}</p>` : ""}</div><button class="btn ghost sm icon x" data-act="dlg-close" aria-label="Close" data-tip="Close · Esc" ${o.busy ? "disabled" : ""}>${I("x")}</button></div>
    <div class="dlg-bd">${o.body}</div>
    <div class="dlg-ft">${back}<span class="why ${o.whyErr ? "err" : ""}" id="why-dlg" ${o.whyErr ? 'role="alert"' : ""}>${o.why || ""}</span>${cancel}${prim}</div></div></div>`;
}
const pbtn = (label, o = {}) => o.busy ? `<button class="btn ${o.danger ? "danger" : "primary"} is-loading" aria-busy="true"><span class="spin"></span>${o.busy}</button>`
  : `<button class="btn ${o.danger ? "danger" : "primary"}" data-act="${o.act || "dlg-go"}" ${o.off ? 'disabled aria-describedby="why-dlg"' : ""}>${label}${o.danger ? "" : ` <span class="k">Ctrl ↵</span>`}</button>`;
const cbx = (on, cls = "") => `<span class="cb ${on ? "on" : ""} ${cls}" aria-hidden="true">${I("check")}</span>`;
const note = (html, icon = "") => `<div class="stale" role="note">${icon}<span class="l">${html}</span></div>`;

function toast14(icon, text, sub, act) {
  return `<div class="toast" role="status">${icon ? `<span class="ic">${I(icon)}</span>` : ""}<span class="tx"><span>${text}</span>${sub ? `<span class="sub">${sub}</span>` : ""}${act ? `<span class="tact">${act}</span>` : ""}</span><button class="btn ghost xs icon" aria-label="Dismiss" data-tip="Dismiss">${I("x")}</button></div>`;
}
