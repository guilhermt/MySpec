/* =====================================================================
   ROUND 11 · the specimen of the components this round adds or changes.
   Built from the same functions as a.html and b.html (shell.js), with the
   states forced by the classes the system uses (is-hover, is-focus…).
   ===================================================================== */
window.SPECIMEN = true;
const A_COLS = ["lead", "num", "title", ["epic", "dep", "task"], "keys"], B_COLS = ["lead", "status", "num", "title", ["dep", "task"], "keys"];
const withS = (patch, fn) => { const keep = {}; Object.keys(patch).forEach((k) => { keep[k] = S[k]; S[k] = patch[k]; }); const h = fn(); Object.assign(S, keep); return h; };
const cls = (h, add) => h.replace(/^<(\w+) class="([^"]*)"/, (m, t, c) => `<${t} class="${c} ${add}"`);
const row = (n, add = "", o = {}) => { const kc = V.cols, ki = V.inline; V.cols = o.b ? B_COLS : A_COLS; V.inline = !!o.b; const h = cls(cardRow(CARD[n], 2, o), add); V.cols = kc; V.inline = ki; return o.b ? `<div class="b">${h}</div>` : h; };
const rowT = (n, add, tsk) => row(n, add).replace('<span class="col tsk"></span>', tsk).replace('class="cr ', 'class="cr has2 ');

const COMPS = [
  { name: "Card row", note: "Only what decides the choice. a: number, title, epic, dependency, task. b: the status word first (only on the first card of a run), no epic. The keys S and D show on the focused row.",
    states: () => [
      ["default", row(467)], ["hover", row(467, "is-hover")], ["focus · keys", row(474, "is-focus")], ["active · pressed", row(467, "is-active")],
      ["open", withS({ open: 474 }, () => row(474))],
      ["disabled · select mode, not selectable", withS({ selMode: true }, () => row(104, "is-disabled"))],
      ["loading · cloning its repository", rowT(471, "is-loading", `<span class="col tsk"><span class="spin" aria-hidden="true"></span><span class="t">Cloning acme/billing…</span></span>`)],
      ["error · the clone failed", rowT(471, "is-error", `<span class="col tsk"><span class="t" style="color:var(--state-error)">Clone failed</span></span>`)],
      ["task waits for you", row(412)], ["task working", row(441)], ["task error", row(449)], ["in discussion", row(455)],
      ["unsatisfied dependency", row(471)], ["epic card (a)", row(402)], ["b · status run", row(415, "", { b: true }) + row(471, "", { b: true, quiet: true }) + row(474, "", { b: true, quiet: true })], ["narrow · second line", `<div style="width:calc(var(--space-16) * 8)" class="nar">${row(412) + row(455) + row(474, "is-focus") + row(467)}</div>`],
      ["select mode · on / off", withS({ selMode: true, sel: new Set([455]) }, () => row(455) + row(466))],
      ["left the reading", withS({ stale: 466, open: 466 }, () => row(466))],
    ] },
  { name: "Group header", note: "a: a status section with its count; the final ones start folded. b: an epic with its progress, No epic, the finished line and the finished epics.",
    states: () => {
      const sec = (extra, exp = true, name = "Ready", n = 9) => `<div class="sech ${extra}" role="treeitem" aria-expanded="${exp}" tabindex="-1">${I("down", "i chev")}<span class="nm">${name}<span class="cnt">${n}</span></span><span></span></div>`;
      const eh = (extra, exp = true) => `<div class="eh ${extra}" role="treeitem" aria-expanded="${exp}" tabindex="-1">${I("down", "i chev")}<span class="nm"><span class="t">API hardening</span><span class="cnt">#402</span></span><span class="prog"><span class="pt">2 of 8 finished</span><span class="bar"><i style="--p:25"></i></span></span></div>`;
      return [["default", sec("") + eh("")], ["hover", sec("is-hover") + eh("is-hover")], ["focus", sec("is-focus") + eh("is-focus")], ["active", sec("is-active") + eh("is-active")],
        ["folded · final", sec("", false, "Done", 70)], ["empty", sec("is-empty", true, "Changes requested", 0)], ["disabled · filter hides all", sec("is-disabled", false, "Ready", 0)],
        ["loading · first reading", sec("is-loading", true, "Ready", "…")], ["error · count unreadable", sec("is-error", true, "Ready", "?")],
        ["b · the epic's card as header", (() => { const h = epicHead(CARD[402]).split('<div class="cx"')[0]; return `<div class="b">${h}${cls(h, "is-hover")}${cls(h, "is-focus")}${withS({ open: 402 }, () => epicHead(CARD[402]).split('<div class="cx"')[0])}</div>`; })()], ["b · finished line", `<div class="fin" aria-expanded="false">${I("down", "i chev")}<span>2 finished</span></div><div class="fin is-hover" aria-expanded="true">${I("down", "i chev")}<span>47 finished</span></div>`]];
    } },
  { name: "Checkbox", note: "Only in the select mode. The row is the target; the box is its sign.",
    states: () => { const cb = (c) => `<span class="cb ${c}">${I("check")}</span>`; return [["off", cb("")], ["on", cb("on")], ["hover", cb("is-hover")], ["focus", cb("is-focus on")], ["active", cb("is-active")], ["disabled · not selectable", cb("off-limits")], ["loading", cb("is-loading")], ["error", cb("is-error")]].map(([l, h]) => [l, `<div class="row">${h}</div>`]); } },
  { name: "Filter bar", note: "Search, one toggle, one menu for repository, assignee and status, and the select mode. An active filter is a chip with its ×.",
    states: () => [
      ["default", withS({ selMode: false, q: "", f: { repo: null, status: null, assignee: null, mine: false } }, fbar)],
      ["hover · focus · active", `<div class="row"><label class="input srch is-focus">${I("search")}<input placeholder="Search cards"><kbd>/</kbd></label><button class="chip fchip is-hover">Assigned to me</button><button class="chip fchip is-focus">${I("filter")}Filter</button><button class="chip fchip" aria-pressed="true">Assigned to me</button></div>`],
      ["filters on", withS({ selMode: false, q: "alerts", f: { repo: "api", status: null, assignee: "tchen", mine: true } }, fbar)],
      ["disabled · no gh viewer", `<div class="row"><button class="chip fchip" disabled aria-describedby="nv">Assigned to me</button><span class="why" id="nv">gh didn't say who you are</span></div>`],
      ["loading · statuses unread", `<div class="row"><button class="chip fchip is-loading" aria-busy="true"><span class="spin"></span>Filter</button></div>`],
      ["error · filter by a removed repository", `<div class="row"><span class="chip fchip is-error">acme/legacy · no longer on the board<button class="x" aria-label="Remove">${I("x")}</button></span></div>`],
      ["select mode · none", withS({ selMode: true, sel: new Set() }, fbar)], ["select mode · three", withS({ selMode: true, sel: new Set([455, 461, 475]) }, fbar)],
      ["select mode · opening", `<div class="fbar"><div class="selbar"><span class="n">3 selected</span><span class="which">#455 #461 #475</span><button class="btn primary sm is-loading" aria-busy="true"><span class="spin"></span>Opening…</button><button class="btn ghost sm">Cancel</button></div></div>`],
    ] },
  { name: "Reading of the board", note: "The header says the age of the list on screen. A reading keeps the list; a failure is a strip with Try again, never red.",
    states: () => [
      ["read", withS({ reading: false, failed: false }, readState)], ["reading", withS({ reading: true }, readState)], ["refresh · hover, focus, disabled", `<div class="row"><button class="btn ghost sm icon is-hover" aria-label="Read again">${I("refresh")}</button><button class="btn ghost sm icon is-focus" aria-label="Read again">${I("refresh")}</button><button class="btn ghost sm icon" disabled aria-label="Read again">${I("refresh")}</button></div>`],
      ["failed", `<div class="readfail">${st("warn")}<span class="lbl">Couldn't read the board</span><span class="det">gh can't read projects. Run gh auth refresh -s read:project.</span><button class="btn sm">Try again</button></div>`],
      ["failed · trying", `<div class="readfail">${st("warn")}<span class="lbl">Couldn't read the board</span><span class="det">GitHub's rate limit was reached. It resets at 14:32.</span><button class="btn sm is-loading" aria-busy="true"><span class="spin"></span>Reading…</button></div>`],
      ["never read · reading", `<div class="skel" role="status" aria-label="Reading the board">${"<i></i>".repeat(4)}</div>`],
      ["never read · failed", `<div class="bempty"><p class="t">Couldn't read the board</p><p class="s">The board doesn't exist or this account can't read it.</p><button class="btn sm">Try again</button></div>`],
      ["empty", `<div class="bempty"><p class="t">This board has no issues.</p><p class="s">A discussion publishes new cards here.</p><button class="btn sm">New discussion</button></div>`],
    ] },
  { name: "Card actions", note: "The first block of the open card. The action is by what the card allows, with the reason beside it.",
    states: () => [
      ["start", cardActions(CARD[474])], ["hover · focus · active", `<div class="cd-acts"><button class="btn primary sm is-hover">Start task <span class="k">S</span></button><button class="btn sm is-focus">Discuss <span class="k">D</span></button><button class="btn sm is-active">Discuss <span class="k">D</span></button></div>`],
      ["not cloned", cardActions(CARD[471])], ["loading · cloning", withS({ cloning: "billing" }, () => cardActions(CARD[471]))],
      ["error · clone failed", `<div class="cd-acts"><button class="btn primary sm is-error">${I("clone")}Try the clone again</button><button class="btn sm">Discuss <span class="k">D</span></button></div><span class="cd-why err">gh: repository not found: acme/billing. Nothing was left in ~/code/billing.</span>`],
      ["disabled · clone missing", cardActions(Object.assign({}, CARD[474], { missing: true }))], ["other board", cardActions(CARD[104])], ["not on this board", cardActions(CARD[12])],
      ["has a task", cardActions(CARD[412]) + cardTask(CARD[412])], ["closed", cardActions(CARD[410])], ["left the reading", withS({ stale: 466 }, () => cardNotes(CARD[466]) + cardActions(CARD[466]))],
      ["dependency", cardNotes(CARD[474])],
    ] },
  { name: "Continue and the rows of Home", note: "Continue takes the focus when Home opens; Enter opens the last item where it waits.",
    states: () => {
      const c = (x) => homeMainSnippet(x);
      const hr = (x, dis) => `<button class="hr ${x}" ${dis ? "disabled" : ""}>${I("plus")}<span class="tx"><span class="l">New task</span><span class="s">From a card or from scratch</span></span><span class="r"><kbd>Ctrl N</kbd></span></button>`;
      return [["default", c("")], ["hover", c("is-hover")], ["focus", c("is-focus")], ["active", c("is-active")], ["disabled · archived meanwhile", c("is-disabled")], ["loading · opening", c("is-loading")], ["error · can't open", c("is-error")],
        ["row · default, hover, focus, active", hr("") + hr("is-hover") + hr("is-focus") + hr("is-active")], ["row · disabled", hr("", true)],
        ["board · reading", `<div class="hr">${I("board")}<span class="tx"><span class="l">Platform Roadmap</span><span class="s">46 open cards</span></span><span class="r"><span class="rd">reading…</span></span></div>`],
        ["board · failed", `<div class="hr">${I("board")}<span class="tx"><span class="l">Mobile App</span><span class="s">31 open cards · ios</span></span><span class="r warn">${st("warn")}Read failed 18m ago</span></div>`]];
    } },
  { name: "Creation dialog fields", note: "Few fields with the defaults of Settings; the context of a card and the models are one click away.",
    states: () => {
      const seg = (c1, c2) => `<div class="fld"><div class="switch" role="radiogroup"><button class="sw ${c1}" role="radio" aria-checked="true" aria-selected="true">Structured</button><button class="sw ${c2}" role="radio" aria-checked="false">One-Shot</button></div></div>`;
      const name = (v, repo = "api") => { const D = { name: v }; return `<div class="fld"><span class="input mono ${nameProblem(v, repo) ? "is-error" : ""}"><input value="${v}" aria-label="Name"></span>${nameHelp(D, repo)}</div>`; };
      const ctx = (w, btns) => `<div class="ctxrow"><span class="w">${w}</span>${btns}</div>`;
      return [["segmented · default", seg("", "")], ["segmented · hover, focus", seg("is-focus", "is-hover")], ["segmented · disabled", `<div class="switch"><button class="sw" aria-selected="true">Agent</button><button class="sw" disabled>Manual</button></div>`],
        ["name · default", name("474-usage-alerts-at-80-of-the-plan")], ["name · characters", name("Rate-limit v2")], ["name · too long", name("474-usage-alerts-at-80-of-the-plan-per-workspace-and-per-api-key-v2")], ["name · taken", name("rate-limit-per-api-key")],
        ["context · default", ctx(`From the card: <b>#474</b>, the epic <b>Usage-based billing</b>, 6 cards and 1 dependency`, `<button class="btn ghost xs">Show</button><button class="btn ghost xs">${I("plus")}Add to it</button>`)],
        ["context · refreshing", ctx(`<span class="rd">Refreshing the card…</span>`, `<button class="btn ghost xs" disabled>Show</button>`)],
        ["context · refresh failed", ctx(`${st("warn")} Couldn't refresh the card: GitHub's rate limit was reached. The task will use the last reading.`, `<button class="btn ghost xs">Show</button>`)],
        ["models · folded", `<div class="mdl"><button class="mdl-sum" aria-expanded="false">${I("down", "i chev")}<span class="l">Models</span><span class="v">Defaults</span></button></div>`],
        ["models · own, unavailable", `<div class="mdl"><button class="mdl-sum" aria-expanded="true">${I("down", "i chev")}<span class="l">Models</span><span class="v">PRD: Fable 5.1 · xhigh +1 · the rest from Defaults</span></button><div class="mdl-list"><span class="st-l">PRD</span><button class="chip own">Fable 5.1 · xhigh${I("down")}</button><span class="st-l">Plan</span><button class="chip is-error" data-tip="Opus 4.1 isn't in the catalog of this Claude Code">${st("warn")}Opus 4.1 · unavailable${I("down")}</button><span class="st-l">Tech spec</span><button class="chip is-loading"><span class="spin"></span>Reading models…</button></div></div>`],
        ["repository menu", `<div class="menu" role="listbox"><button class="mi" aria-selected="true">${I("check", "i ck")}acme/api</button><div class="mi" aria-disabled="true">${I("check", "i ck")}acme/billing <span class="sub">Not cloned</span><button class="btn ghost xs" style="margin-left:auto">${I("clone")}Clone</button></div><div class="mi" aria-disabled="true">${I("check", "i ck")}acme/gateway <span class="sub">Cloning…</span></div><div class="mi" aria-disabled="true">${I("check", "i ck")}acme/infra <span class="sub">The clone at ~/code/infra is missing.</span></div></div>`]];
    } },
  { name: "Creation dialog", note: "Its states at the footer. Create is the one primary; Ctrl+Enter confirms.",
    states: () => {
      const ft = (why, create, cancel = "") => `<div class="dlg"><div class="dlg-ft"><span class="why ${why.err ? "err" : ""}">${why.t || ""}</span><button class="btn ghost" ${cancel}>Cancel</button>${create}</div></div>`;
      return [["ready", ft({}, `<button class="btn primary">Create <span class="k">Ctrl ↵</span></button>`)], ["hover · focus", ft({}, `<button class="btn primary is-hover">Create <span class="k">Ctrl ↵</span></button>`, 'class="btn ghost is-focus"')],
        ["disabled", ft({ t: "Say what you want to build." }, `<button class="btn primary" disabled>Create <span class="k">Ctrl ↵</span></button>`)],
        ["creating", ft({ t: "Starting the first session…" }, `<button class="btn primary is-loading" aria-busy="true"><span class="spin"></span>Creating…</button>`, "disabled")],
        ["error · card taken", ft({ t: "Card #474 already has an active task: usage-alerts.", err: true }, `<button class="btn primary" disabled>Create</button>`)],
        ["error · session", ft({ t: "Claude Code isn't logged in. The task was undone.", err: true }, `<button class="btn primary is-error">Try again</button>`)],
        ["card left the reading", `<div class="dlg"><div class="dlg-bd"><div class="stalebox">${st("warn")}<span>This card isn't in the last reading of the board.</span></div></div><div class="dlg-ft"><button class="btn">Cancel</button></div></div>`]];
    } },
];
function homeMainSnippet(x) {
  const t = TASKS.t1;
  return `<button class="cont ${x}" ${x === "is-disabled" ? "disabled" : ""} ${x === "is-loading" ? 'aria-busy="true"' : ""}><span class="c1">${x === "is-loading" ? '<span class="spin"></span>' : ty({ kind: "task" })}</span><span class="nm">${t.title}</span><kbd>Enter</kbd>
    <span class="l2">${x === "is-disabled" ? "Archived at 13:52 · Open in History" : x === "is-error" ? `<span style="color:var(--state-error)">Couldn't open it: the task was deleted.</span>` : `${st("wait")}<span>${t.long}</span>${tw({ sev: "wait", since: t.since, long: t.sinceLong })}`}</span></button>`;
}
document.addEventListener("DOMContentLoaded", () => {
  document.body.insertAdjacentHTML("afterbegin", SPRITE + SPRITE_B);
  document.addEventListener("click", (e) => e.stopPropagation(), true);
  document.addEventListener("keydown", (e) => e.stopPropagation(), true);
  const side = (mode, sts, sunk) => `<div class="side a ${sunk ? "sunk" : ""}" data-theme="${mode}"><div class="mode">${mode}</div>${sts.map(([l, h]) => `<div class="stt"><span class="l">${l}</span><div class="v">${h}</div></div>`).join("")}</div>`;
  const body = COMPS.map((c) => { const sts = c.states(); return `<section class="comp"><h2>${c.name}</h2><p>${c.note}</p><div class="pairs">${side("light", sts)}${side("dark", sts)}</div></section>`; }).join("");
  document.body.insertAdjacentHTML("beforeend", `<main class="spc"><header><h1>Board, Home and New task · components</h1><p>Each component this round adds or changes, in every state, light and dark side by side. At a narrow column the card row takes its short forms, which are states too.</p></header>${body}</main><pre id="report" class="report" hidden></pre>`);
  markRows();
  if (Q.has("audit")) setTimeout(() => { const pre = document.getElementById("report"); pre.hidden = false; const unnamed = [...document.querySelectorAll("button, a[href]")].filter((b) => b.offsetParent && !(b.getAttribute("aria-label") || b.textContent.trim())).length; pre.textContent = JSON.stringify({ contrastBelow45: contrastAudit(), unnamedControls: unnamed }, null, 1); }, 1200);
});
