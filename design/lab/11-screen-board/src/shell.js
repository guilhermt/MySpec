/* =====================================================================
   ROUND 11 · the shell shared by a and b: the state of a scene, the tree
   of round 10 with nothing open, the header of a place, the filter bar,
   the card row and the card's content, Home, the creation dialog, the
   keyboard of the list and the audit. Each variation gives V:
     V.key, V.inline (the card opens in place) or V.panel() (beside the list),
     V.cols (the columns of the row), V.list(cards) (the grouped list).
   ?scene= · ?theme= · ?audit · ?clean · ?home=none
   ===================================================================== */
const SPRITE_B = `<svg class="sprite" aria-hidden="true">
  <symbol id="i-epic" viewBox="0 0 16 16"><rect x="2.5" y="2.5" width="11" height="3" rx="1"/><rect x="2.5" y="6.5" width="11" height="3" rx="1"/><rect x="2.5" y="10.5" width="7" height="3" rx="1"/></symbol>
  <symbol id="i-search" viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.2"/><path d="M10.2 10.2 13.5 13.5"/></symbol>
  <symbol id="i-refresh" viewBox="0 0 16 16"><path d="M13 8a5 5 0 1 1-1.5-3.6"/><path d="M13 3v3h-3"/></symbol>
  <symbol id="i-filter" viewBox="0 0 16 16"><path d="M2.5 4h11M4.5 8h7M6.5 12h3"/></symbol>
  <symbol id="i-board" viewBox="0 0 16 16"><rect x="2.5" y="3" width="3" height="10" rx="1"/><rect x="6.5" y="3" width="3" height="7" rx="1"/><rect x="10.5" y="3" width="3" height="5" rx="1"/></symbol>
  <symbol id="i-clone" viewBox="0 0 16 16"><path d="M8 2.5v7M5 6.5l3 3 3-3"/><path d="M3 11v2.5h10V11"/></symbol>
  <symbol id="i-selectm" viewBox="0 0 16 16"><rect x="2.5" y="2.5" width="11" height="11" rx="2"/><path d="M5.3 8.2l1.9 1.8 3.6-4"/></symbol>
  <symbol id="i-folder" viewBox="0 0 16 16"><path d="M2.5 4.5v8h11V6H8L6.5 4.5z"/></symbol>
  <symbol id="i-cardp" viewBox="0 0 16 16"><rect x="2.5" y="3.5" width="11" height="9" rx="1.5"/><path d="M5 6.5h6M5 9.5h3.5"/></symbol>
</svg>`;

const SCENE_LIST = [["home", "Home"], ["board", "Board"], ["card", "Card open"], ["reading", "Reading over the last one"], ["failed", "Reading failed"], ["empty", "Empty board"],
  ["filtered", "Filter without result"], ["stale-card", "Card out of the reading"], ["no-clone", "Repository without a clone"], ["create", "New task"], ["create-card", "New task from a card"], ["select", "Select to discuss"], ["home-disc", "New discussion from Home"]];
const SCN = SCENE_LIST.some(([k]) => k === Q.get("scene")) ? Q.get("scene") : "board";

// ---------------- The state of the scene ----------------
const S = {
  place: SCN === "home" || SCN === "home-disc" ? "home" : "board",
  board: SCN === "empty" ? "tools" : "plat",
  open: { card: 474, "create-card": 474, "no-clone": 471, "stale-card": 466 }[SCN] || null,
  stale: SCN === "stale-card" ? 466 : null,
  reading: SCN === "reading", failed: SCN === "failed",
  q: SCN === "filtered" ? "refund" : "",
  f: { repo: null, status: null, assignee: SCN === "filtered" ? "tchen" : null, mine: false },
  selMode: SCN === "select", sel: new Set(SCN === "select" ? [455, 461, 475] : []),
  dialog: SCN === "create" ? "free" : SCN === "create-card" ? "card" : SCN === "home-disc" ? "disc" : null,
  ddlg: { board: "Platform Roadmap", pick: SCN === "home-disc", menu: SCN === "home-disc", cards: [], title: "", what: "" },
  fold: {}, menu: null, focusId: SCN === "board" ? (Q.get("v") || "c474") : null, panel: null, cloning: null,
  readAgo: BOARD.readAgo,
  dlg: SCN === "create"
    ? { repo: "api", name: "Rate-limit v2", ctx: "Add a daily cap per workspace on top of the rate limit per key. At the cap, answer 429 with a message that names the cap, and email the billing admins once a day.", mode: "One-Shot", review: "Agent", models: true, own: { "One-Shot planning": "Fable 5.1 · xhigh" }, ctxShow: false, addCtx: false }
    : { name: "474-usage-alerts-at-80-of-the-plan", mode: "Structured", review: "Agent", models: false, own: {}, ctxShow: false, addCtx: false, extra: "" },
};
if (Q.get("home") === "none") S.none = true;

// ---------------- The tree of round 10, with this round's boards and nothing open ----------------
Object.assign(ITEMS.t1, { sits: [{ sev: "wait", label: "Question", place: "Reviewer · Step 3/7", since: "18m", long: "18 minutes", min: 18 }], row: ["Question · Reviewer · Step 3/7", "Question · Step 3/7"], pos: "Step 3/7 · Reviewer pass 2" });
(function reshapeTree() {
  const [rv, , mob, nob] = TREE;
  TREE.length = 0;
  TREE.push(rv,
    { id: "tools", label: "Internal Tools", tip: "Open the Internal Tools board", items: [] },
    mob,
    { id: "plat", label: "Platform Roadmap", tip: "Open the Platform Roadmap board", epics: [{ id: "ep", label: "API hardening", tip: "API hardening · epic", items: ["t1", "t7"] }, { id: "ep2", label: "Usage-based billing", tip: "Usage-based billing · epic", items: ["t3"] }], items: ["t8", "d1"] },
    nob);
  Object.keys(REPOS).forEach((k) => delete REPOS[k]);
  ["api", "billing", "docs", "gateway", "infra", "ios", "web"].forEach((k) => { REPOS[k] = `acme/${k}`; });
})();
function sidebarB() {
  const plat = TREE[3];
  plat.extra = S.reading ? `<span class="x is-reading">reading…</span>` : S.failed ? `<span class="x warn" data-tip="Last read failed 4m ago · GitHub's rate limit was reached"><span class="st st-warn" aria-hidden="true"></span>Read failed</span>` : "";
  // With nothing in progress the tree has only its nodes: each board says it has no active items.
  let h;
  if (S.none) {
    const keep = TREE.map((n) => ({ items: n.items, epics: n.epics }));
    TREE.forEach((n) => { n.items = []; n.epics = []; });
    h = sidebar().replace(/id="g-(tools|mob|plat)"><\/div>/g, 'id="g-$1"><div class="sb-empty" role="none">No active items.</div></div>').replace(/id="g-reviews"><\/div>/, 'id="g-reviews"><div class="sb-empty" role="none">No review in progress.</div></div>');
    TREE.forEach((n, k) => Object.assign(n, keep[k]));
  } else h = sidebar();
  h = h.replace(/ aria-current="page" aria-selected="true"/, "").replace(/class="it sel /, 'class="it ').replace(/tabindex="0"/, 'tabindex="-1"');
  h = h.replace(`id="g-tools"></div>`, `id="g-tools"><div class="sb-empty" role="none">No active items.</div></div>`);
  h = h.replace("<option>acme/billing</option>", "<option>acme/billing · not cloned</option>").replace("<option>acme/infra</option>", "<option>acme/infra · clone missing</option>");
  if (S.place === "board") {
    const id = S.board === "tools" ? "Internal Tools" : "Platform Roadmap";
    h = h.replace(new RegExp(`<div class="node board"([^>]*?)tabindex="-1" data-tip="Open the ${id} board">`), `<div class="node board cur"$1tabindex="0" aria-current="page" data-tip="${id} · open">`);
  }
  return h;
}

// ---------------- Helpers of the card ----------------
const norm = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const isFinal = (c) => !!STATUSES[c.s].final;
function matches(c) {
  if (S.stale === c.n) return false;
  if (S.q) { const q = norm(S.q.trim()).replace(/^#/, ""); if (!(norm(c.t).includes(q) || String(c.n).startsWith(q))) return false; }
  if (S.f.repo && c.repo !== S.f.repo) return false;
  if (S.f.status != null && c.s !== S.f.status) return false;
  if (S.f.assignee && !c.asg.includes(S.f.assignee)) return false;
  if (S.f.mine && !c.asg.includes(BOARD.viewer)) return false;
  return true;
}
const boardCards = () => (S.board === "tools" ? [] : CARDS);
function actionOf(c) {
  if (c.task) return "has_task"; if (c.closed) return "closed"; if (c.unmanaged) return "add_to_board"; if (c.other) return "other_board";
  if (NOCLONE[c.repo] && S.cloning !== "done") return "clone"; if (c.missing) return "clone_missing"; return "start";
}
const markable = (c) => !c.unmanaged && !c.other;
const unsat = (c) => (c.dep || []).filter((d) => DEPS[d] && !DEPS[d].sat);
const taskShort = (t) => t.row.replace(/^Question · |^Session error · /, "").replace(" · Reviewer pass 2", "");
const folded = (key, dflt) => (key in S.fold ? S.fold[key] : dflt);

// The columns a row may carry. A variation picks its own.
const COLS = {
  lead: (c) => S.selMode
    ? `<span class="lead"><span class="cb ${S.sel.has(c.n) ? "on" : ""} ${markable(c) ? "" : "off-limits"}" aria-hidden="true">${I("check")}</span></span>`
    : `<span class="lead">${c.epicOf ? I("epic") : ""}</span>`,
  num: (c) => `<span class="num">#${c.n}</span>`,
  title: (c) => `<span class="tl ${c.epicOf ? "is-epic" : ""}">${c.t}</span>`,
  epic: (c) => c.epicOf ? `<span class="col epc"><span class="t">Epic · ${epicDone(c.n)} of ${CARD[c.n].kids.length} finished</span></span>`
    : c.epic ? `<span class="col epc"><span class="t">${CARD[c.epic].t}</span></span>` : `<span class="col epc"></span>`,
  dep: (c) => { const u = unsat(c); return u.length ? `<span class="col dep" data-tip="Depends on #${u[0]} ${DEPS[u[0]].title} · open, ${DEPS[u[0]].status}. A warning: it never blocks.">${st("warn")}<span class="t">#${u[0]}</span></span>` : `<span class="col dep"></span>`; },
  task: (c) => {
    if (c.task) { const t = TASKS[c.task]; return `<span class="col tsk ${t.g}" data-tip="Task ${t.title} · ${t.long}">${st(t.g)}<span class="t"><span class="long">${t.row}</span><span class="short">${taskShort(t)}</span></span></span>`; }
    if (c.disc) return `<span class="col tsk disc" data-tip="In the discussion ${DISCS[c.disc].title}">${ty({ kind: "discussion" })}<span class="t">In discussion</span></span>`;
    return `<span class="col tsk"></span>`;
  },
  // The keys of the row, in their own column: they show on the focused row, and only the ones that act.
  keys: (c) => {
    const k = [];
    if (["start", "clone", "add_to_board"].includes(actionOf(c)) && S.stale !== c.n) k.push(`<span><kbd>S</kbd>start</span>`);
    if (markable(c) && !c.closed && S.stale !== c.n) k.push(`<span><kbd>D</kbd>discuss</span>`);
    return `<span class="keys" aria-hidden="true">${k.join("")}</span>`;
  },
  status: (c, o = {}) => o.quiet ? `<span class="col st-word" aria-hidden="true"></span>` : `<span class="col st-word">${isFinal(c) ? I("check") : ""}<span class="t">${STATUSES[c.s].name}</span></span>`,
};
function rowLabel(c) {
  const p = [`#${c.n} ${c.t}`, repoOf(c.repo), STATUSES[c.s].name];
  if (c.epicOf) p.push(`epic, ${epicDone(c.n)} of ${c.kids.length} cards finished`); else if (c.epic) p.push(`epic ${CARD[c.epic].t}`);
  unsat(c).forEach((d) => p.push(`depends on #${d}, not satisfied`));
  if (c.task) p.push(`task: ${TASKS[c.task].long}${TASKS[c.task].since ? `, waiting for you for ${TASKS[c.task].sinceLong}` : ""}`);
  if (c.disc) p.push(`in a discussion`);
  if (S.selMode) p.push(markable(c) ? (S.sel.has(c.n) ? "selected" : "not selected") : "can't be selected");
  return p.join(". ");
}
// A column list may hold an array: those columns sit in .meta, which is one column each on a wide list and a
// second line under the title on a narrow one, so the row keeps what decides the choice at any width.
function cardRow(c, level = 2, o = {}) {
  const open = S.open === c.n;
  const cols = V.cols.map((k) => Array.isArray(k) ? `<span class="meta">${k.map((x) => COLS[x](c, o)).join("")}</span>` : COLS[k](c, o)).join("");
  const has2 = /<span class="meta">[\s\S]*?<span class="col [^"]*"[^>]*>(?!<\/span>)/.test(cols);
  const cls = ["cr", o.cls || "", open ? "open" : "", has2 ? "has2" : "", c.closed && !isFinal(c) ? "closed" : "", S.stale === c.n ? "gone" : ""].join(" ");
  // a is a tree of rows; b is a list of disclosure buttons, so the card that opens under a row is not inside a tree.
  const role = V.inline ? `role="button" aria-expanded="${open}" ${open ? `aria-controls="cx${c.n}"` : ""}` : `role="treeitem" aria-level="${level}" aria-selected="${open}"`;
  const sel = S.selMode && markable(c) ? (V.inline ? `aria-pressed="${S.sel.has(c.n)}"` : `aria-checked="${S.sel.has(c.n)}"`) : "";
  return `<div class="${cls}" ${role} tabindex="-1" data-nav data-card="${c.n}" id="c${c.n}" ${sel} aria-label="${esc(rowLabel(c))}">${cols}</div>`;
}

// ---------------- The card's content, for the panel (a) and in place (b) ----------------
function cardActions(c) {
  if (S.stale === c.n) return `<div class="cd-acts"><button class="btn sm" disabled aria-describedby="stale-why">Start task</button><button class="btn sm" disabled aria-describedby="stale-why">Discuss</button></div>`;
  const a = actionOf(c);
  const disc = (on = markable(c)) => on ? `<button class="btn sm" data-act="discuss" data-card="${c.n}" data-tip="New discussion with this card · D">Discuss <span class="k">D</span></button>`
    : `<button class="btn sm" disabled aria-describedby="why-${c.n}">Discuss</button>`;
  if (a === "has_task") return `<div class="cd-acts">${disc()}</div>`;
  if (a === "closed") return `<div class="cd-acts">${disc()}<span class="cd-why">The issue is closed.</span></div>`;
  if (a === "clone") {
    if (S.cloning === c.repo) return `<div class="cd-acts"><button class="btn primary sm is-loading" aria-busy="true"><span class="spin"></span>Cloning ${repoOf(c.repo)}…</button>${disc()}</div><span class="cd-why">The dialog opens when the clone ends. You can leave the board meanwhile.</span>`;
    return `<div class="cd-acts"><button class="btn primary sm" data-act="clone" data-card="${c.n}" data-tip="Clone into ~/code, then open New task · S">${I("clone")}Clone and continue <span class="k">S</span></button>${disc()}</div><span class="cd-why" id="why-${c.n}">${repoOf(c.repo)} isn't cloned yet. A task needs a clone.</span>`;
  }
  if (a === "clone_missing") return `<div class="cd-acts"><button class="btn primary sm" disabled aria-describedby="why-${c.n}">Start task</button><button class="btn sm">Change path…</button>${disc()}</div><span class="cd-why" id="why-${c.n}">The clone at ~/code/${c.repo} is missing.</span>`;
  if (a === "add_to_board") return `<div class="cd-acts"><button class="btn primary sm" data-act="add-board" data-card="${c.n}">Start task <span class="k">S</span></button>${disc(false)}</div><span class="cd-why" id="why-${c.n}">${repoOf(c.repo)} isn't managed by this board. Start task adds it first.</span>`;
  if (a === "other_board") return `<div class="cd-acts"><button class="btn primary sm" disabled aria-describedby="why-${c.n}">Start task</button>${disc(false)}</div><span class="cd-why" id="why-${c.n}">${repoOf(c.repo)} belongs to the board ${c.other}.</span>`;
  return `<div class="cd-acts"><button class="btn primary sm" data-act="start" data-card="${c.n}" data-tip="New task from this card · S">Start task <span class="k">S</span></button>${disc()}</div>`;
}
function cardNotes(c) {
  const u = unsat(c).map((d) => `<div class="cd-note">${st("warn")}<span class="l"><span><b>Depends on #${d}</b> ${DEPS[d].title}</span><span>${repoOf(DEPS[d].repo)} · ${DEPS[d].state} · ${DEPS[d].status} · no pull request. A warning only: it never blocks.</span></span></div>`).join("");
  const stale = S.stale === c.n ? `<div class="cd-stale" role="status"><span class="lbl">${st("warn")}This card isn't in the last reading of the board.</span><span class="det" id="stale-why">It left the board, or its issue closed more than 14 days ago. The reading of 14:08 doesn't have it, so a task or a discussion can't start from it.</span><span><button class="btn sm" data-act="close-card">Close</button></span></div>` : "";
  return stale + u;
}
function cardTask(c) {
  if (c.task) { const t = TASKS[c.task];
    return `<div class="cd-task">${ty({ kind: "task" })}<span class="nm">${t.title}</span><button class="btn sm" data-act="open-task" data-tip="Open the task">Open</button><span class="l2">${st(t.g)}${t.long}${t.since ? tw({ sev: t.g === "error" ? "error" : "wait", since: t.since, long: t.sinceLong }) : ""}</span></div>`; }
  if (c.archived) return `<div class="cd-sub">Archived task: <a href="#">${c.archived}</a></div>`;
  if (c.disc) return `<div class="cd-sub">${ty({ kind: "discussion" })} In the discussion <a href="#">${DISCS[c.disc].title}</a></div>`;
  return "";
}
function cardFacts(c) {
  const kv = [["Module", c.module], ["Estimate", c.est], ["Assignees", (c.asg || []).join(", ")], ["Start", c.start]].filter((x) => x[1]);
  return kv.length ? `<dl class="cd-kv">${kv.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>` : "";
}
const statusWord = (n) => { const x = CARD[n]; return `${isFinal(x) ? I("check") : ""}${STATUSES[x.s].name}`; };
function cardRelations(c) {
  let h = "";
  if (c.epic) { const e = CARD[c.epic], sib = SIBL(c);
    h += `<section><h3 class="cd-h">Epic</h3><ul class="cd-rel"><li><button class="rel" data-goto="${e.n}"><span class="num">#${e.n}</span><span class="t">${e.t}</span><span class="s">${epicDone(e.n)} of ${e.kids.length} finished</span></button></li></ul></section>
      <section><h3 class="cd-h">Cards of the epic · ${sib.length}</h3><ul class="cd-rel">${sib.map((n) => `<li><button class="rel" data-goto="${n}"><span class="num">#${n}</span><span class="t">${CARD[n].t}</span><span class="s">${statusWord(n)}</span></button></li>`).join("")}</ul></section>`; }
  if (c.epicOf) h += `<section><h3 class="cd-h">Cards · ${c.kids.length}</h3><ul class="cd-rel">${c.kids.map((n) => `<li><button class="rel" data-goto="${n}"><span class="num">#${n}</span><span class="t">${CARD[n].t}</span><span class="s">${statusWord(n)}</span></button></li>`).join("")}</ul></section>`;
  if (c.dep) h += `<section><h3 class="cd-h">Dependencies</h3><ul class="cd-rel">${c.dep.map((d) => `<li><button class="rel" data-goto="${d}"><span class="num">#${d}</span><span class="t">${DEPS[d].title}</span><span class="s">${st("warn")}Not satisfied</span></button></li>`).join("")}</ul></section>`;
  const prs = c.prOpen ? [`${repoOf(c.repo)}#${c.prOpen} · Open`] : (c.pr || []).map((p) => `${repoOf(c.repo)}#${p.n} · Merged`);
  if (prs.length) h += `<section><h3 class="cd-h">Pull requests</h3><ul class="cd-rel">${prs.map((p) => `<li><a class="rel" href="#"><span class="t">${p}</span></a></li>`).join("")}</ul></section>`;
  return h;
}
function cardBody(c) {
  const b = c.rich ? BODIES[c.rich] : c.epicOf ? `<p>The epic groups the cards of ${c.t}. Each card is one delivery.</p>` : BODIES.plain(c);
  return `<div class="cbody prose">${b}</div>`;
}
function cardSub(c) {
  return `<div class="cd-sub"><b>${STATUSES[c.s].name}</b>${c.closed ? " · Closed" : ""}${c.epic ? ` · ${CARD[c.epic].t}` : ""}</div>`;
}

// ---------------- The header of a place that is not an item ----------------
function navBtns(back) {
  return `<div class="navbtns"><button class="btn ghost sm icon" data-tip="Back to ${back} · Alt+←" aria-label="Back to ${back}">${I("left")}</button></div>`;
}
function readState() {
  if (S.reading) return `<span class="rs is-reading" role="status"><span class="spin" aria-hidden="true"></span>Reading…</span>`;
  // A failed reading keeps the age of the reading on screen; the strip under the header says it failed.
  if (S.failed) return `<span class="rs" data-tip="The last reading that worked, at 12:10">Read 2h ago</span>`;
  if (S.board === "tools") return `<span class="rs" data-tip="Last read yesterday at 17:40">Read yesterday</span>`;
  return `<span class="rs" data-tip="Last read ${S.readAgo === "just now" ? "just now" : BOARD.readLong}">Read ${S.readAgo === "just now" ? "just now" : S.readAgo + " ago"}</span>`;
}
function boardHeader() {
  const title = S.board === "tools" ? "Internal Tools" : BOARD.title;
  return `<header class="ih1 bh">${navBtns("Rate limit per API key")}<h1 class="ih-title"><span class="trunc">${title}</span></h1><span class="grow"></span>
    <div class="ih-tools">${readState()}<button class="btn ghost sm icon" data-act="refresh" ${S.reading ? 'disabled aria-describedby="rs-why"' : ""} aria-label="Read the board again" data-tip="${S.reading ? "A reading is running" : "Read the board again"}">${I("refresh")}</button><span id="rs-why" hidden>A reading is running.</span>
    <span class="sep"></span><button class="btn sm" data-act="new-disc" data-tip="New discussion on ${title}, without cards · N">${I("discussion")}<span class="nd">New discussion</span> <span class="k">N</span></button>
    <button class="btn ghost sm icon" id="bmenu-btn" data-act="bmenu" aria-haspopup="menu" aria-expanded="${S.menu === "board"}" aria-label="More actions" data-tip="Select cards, open on GitHub, edit the board">${I("more")}</button></div></header>`;
}
function boardMenu() {
  return `<div class="menu pop-menu" id="menu" role="menu" aria-label="Board actions">
    <button class="mi" role="menuitem" data-act="sel-mode">${I("selectm")}Select cards to discuss<span class="k">Space</span></button>
    <button class="mi" role="menuitem">${I("external")}Open on GitHub</button>
    <div class="menu-sep" role="separator"></div>
    <button class="mi" role="menuitem">${I("settings")}Edit the board in Settings…</button></div>`;
}
function filterMenu() {
  const it = (grp, v, label, on) => `<button class="mi" role="menuitemcheckbox" aria-checked="${on}" data-filter="${grp}" data-v="${v}">${I("check", "i ck")}${label}</button>`;
  return `<div class="menu pop-menu fmenu" id="menu" role="menu" aria-label="Filters">
    <div class="menu-cap">Repository</div>${BOARD.repos.map((r) => it("repo", r, repoOf(r), S.f.repo === r)).join("")}
    <div class="menu-sep" role="separator"></div><div class="menu-cap">Assignee</div>${PEOPLE.map((p) => it("assignee", p, p === BOARD.viewer ? `${p} · you` : p, S.f.assignee === p)).join("")}
    <div class="menu-sep" role="separator"></div><div class="menu-cap">Status</div>${STATUSES.map((s, k) => it("status", k, s.name, S.f.status === k)).join("")}${it("status", -1, "No status", false)}</div>`;
}

// ---------------- The filter bar, or the bar of the select mode ----------------
function fbar() {
  if (S.selMode) {
    const n = S.sel.size;
    return `<div class="fbar" role="toolbar" aria-label="Selected cards"><div class="selbar"><span class="n" role="status">${n} selected</span><span class="which trunc">${[...S.sel].map((x) => `#${x}`).join(" ")}</span>
      <button class="btn primary sm" data-act="sel-discuss" ${n ? "" : 'disabled aria-describedby="sel-why"'} data-tip="New discussion with the selected cards · D">Discuss ${n || ""} card${n === 1 ? "" : "s"} <span class="k">D</span></button>
      ${n ? "" : `<span class="why" id="sel-why">Select a card with Space</span>`}
      <button class="btn ghost sm" data-act="sel-cancel" data-tip="Leave the select mode · Esc">Cancel</button></div></div>`;
  }
  const active = [];
  if (S.f.repo) active.push(["repo", repoOf(S.f.repo)]);
  if (S.f.assignee) active.push(["assignee", `Assignee: ${S.f.assignee}`]);
  if (S.f.status != null) active.push(["status", `Status: ${STATUSES[S.f.status].name}`]);
  const any = active.length || S.q || S.f.mine;
  return `<div class="fbar" role="search" aria-label="Filter the cards">
    <label class="input srch" for="q">${I("search")}<input id="q" type="search" placeholder="Search cards" value="${esc(S.q)}" aria-keyshortcuts="/">${S.q ? `<button class="clr" data-act="q-clear" aria-label="Clear the search" data-tip="Clear the search">${I("x")}</button>` : `<kbd aria-hidden="true">/</kbd>`}</label>
    <button class="chip fchip" aria-pressed="${S.f.mine}" data-act="mine" data-tip="Only the cards assigned to ${BOARD.viewer}">Assigned to me</button>
    ${active.map(([k, l]) => `<span class="chip fchip on">${l}<button class="x" data-act="unfilter" data-k="${k}" aria-label="Remove the filter ${l}">${I("x")}</button></span>`).join("")}
    <button class="chip fchip" id="fmenu-btn" data-act="fmenu" aria-haspopup="menu" aria-expanded="${S.menu === "filter"}" data-tip="Repository, assignee, status">${I("filter")}Filter</button>
    ${any ? `<button class="btn ghost sm" data-act="clear">Clear filters</button>` : ""}
</div>`;
}

// ---------------- The board place ----------------
function boardMain() {
  const all = boardCards(), cards = all.filter(matches);
  let content;
  if (!all.length) content = `<div class="bempty"><p class="t">This board has no issues.</p><p class="s">Cards appear after a reading finds open issues, or issues closed in the last 14 days. A discussion publishes new cards here.</p><button class="btn sm" data-act="new-disc">${I("discussion")}New discussion</button></div>`;
  else if (!cards.filter((c) => !c.epicOf || V.key === "a").length) content = fbar() + `<div class="bempty"><p class="t">No cards match the filters.</p><p class="s">${S.q ? `Nothing on the board has “${esc(S.q)}” in the title or the number` : "Nothing matches"}${S.f.assignee ? `, assigned to ${S.f.assignee}` : ""}.</p><button class="btn sm" data-act="clear">Clear filters</button></div>`;
  else content = fbar() + V.list(cards);
  const fail = S.failed ? `<div class="readfail" role="alert">${st("warn")}<span class="lbl">Couldn't read the board</span><span class="det">GitHub's rate limit was reached. It resets at 14:32. The list is the reading of 12:10.</span><button class="btn sm" data-act="retry">Try again</button></div>` : "";
  return `<main class="main" id="main">${boardHeader()}<div class="bbody"><div class="lstw" id="lstw"><div class="lst-in">${fail}${content}</div></div>${V.panel ? V.panel() : ""}</div>
    ${S.menu === "board" ? boardMenu() : S.menu === "filter" ? filterMenu() : ""}${S.dialog ? dialog() : ""}</main>`;
}

// ---------------- Home ----------------
function homeMain() {
  const t = TASKS.t1;
  const cont = S.none ? `<div class="nothing"><p class="t">Nothing in progress</p><p class="s">No task, review or discussion is active. Start one from a card, a pull request or a board.</p></div>`
    : `<section aria-labelledby="h-cont"><h2 id="h-cont">Continue</h2>
      <button class="cont" id="cont" data-act="continue" aria-label="Continue the task Rate limit per API key. Waiting for you: question in the reviewer, step 3 of 7, for 18 minutes. Platform Roadmap, API hardening.">
        <span class="c1">${ty({ kind: "task" })}</span><span class="nm">${t.title}</span><kbd aria-hidden="true">Enter</kbd>
        <span class="l2">${st("wait")}<span>${t.long}</span>${tw({ sev: "wait", since: t.since, long: t.sinceLong })}<span class="wh">· Platform Roadmap / API hardening</span></span></button></section>`;
  return `<main class="main" id="main"><header class="ih1 bh">${navBtns("Rate limit per API key")}<h1 class="ih-title"><span class="trunc">Home</span></h1><span class="grow"></span></header>
  <div class="homew"><div class="home">${cont}
    <section aria-labelledby="h-start"><h2 id="h-start">Start</h2><ul class="hl">
      <li><button class="hr" data-act="new-task">${I("plus")}<span class="tx"><span class="l">New task</span><span class="s">From a card or from scratch</span></span><span class="r"><kbd>Ctrl N</kbd></span></button></li>
      <li><button class="hr">${I("review")}<span class="tx"><span class="l">Review a pull request</span><span class="s">4 pending in 3 repositories</span></span><span class="r"></span></button></li>
      <li><button class="hr" data-act="new-disc">${I("discussion")}<span class="tx"><span class="l">New discussion</span><span class="s">About the demand of one board</span></span><span class="r"></span></button></li></ul></section>
    <section aria-labelledby="h-boards"><h2 id="h-boards">Boards</h2><ul class="hl">
      <li><button class="hr" data-act="go-board" data-b="tools">${I("board")}<span class="tx"><span class="l">Internal Tools</span><span class="s">No open cards · docs</span></span><span class="r">read yesterday</span></button></li>
      <li><button class="hr" data-act="go-board" data-b="mob">${I("board")}<span class="tx"><span class="l">Mobile App</span><span class="s">31 open cards · ios</span></span><span class="r warn">${st("warn")}Read failed 18m ago</span></button>
        <div class="hr-sub"><span class="grow">GitHub's rate limit was reached. It resets at 14:32.</span><button class="btn ghost xs" data-act="home-retry">Try again</button></div></li>
      <li><button class="hr" data-act="go-board" data-b="plat">${I("board")}<span class="tx"><span class="l">Platform Roadmap</span><span class="s">46 open cards · api, web, gateway, docs, billing</span></span><span class="r">read 2m ago</span></button>
        <div class="hr-sub">${st("warn")}<span class="grow">acme/billing isn't cloned. Its cards can't start a task yet.</span><button class="btn ghost xs">${I("clone")}Clone</button></div></li>
      <li><div class="hr" role="group" aria-label="Repositories without a board">${I("folder")}<span class="tx"><span class="l">No board</span><span class="s">infra</span></span><span class="r"></span></div>
        <div class="hr-sub">${st("warn")}<span class="grow">The clone at ~/code/infra is missing.</span><button class="btn ghost xs">Change path…</button></div></li></ul></section>
    <p class="keysline" aria-label="Shortcuts"><span><kbd>Ctrl J</kbd>Next that needs you</span><span><kbd>Ctrl N</kbd>New task</span><span><kbd>Alt ←</kbd>Back</span><span><kbd>Ctrl ,</kbd>Settings</span></p>
  </div></div>${S.dialog ? dialog() : ""}</main>`;
}

// ---------------- The creation dialog ----------------
const MODEL_DEFAULT = { PRD: "Opus 5.5 (1M) · high", "Tech spec": "Opus 5.5 (1M) · high", Plan: "Opus 5.5 (1M) · medium", "One-Shot planning": "Opus 5.5 (1M) · high", Implementation: "Sonnet 5 · high", "Step review": "Opus 5.5 (1M) · high", PR: "Sonnet 5 · medium", "PR review": "Opus 5.5 (1M) · high" };
const STAGES_OF = { Structured: ["PRD", "Tech spec", "Plan", "Implementation", "Step review", "PR", "PR review"], "One-Shot": ["One-Shot planning", "Implementation", "Step review", "PR", "PR review"] };
const MODE_LINE = { Structured: "A PRD, a tech spec and a plan of steps, each step its own commit.", "One-Shot": "One planning conversation writes a single document, implemented in one commit." };
const REVIEW_LINE = { Manual: "You review each step in VS Code before its commit.", Agent: "An agent reviews each step, and the task runs to the pull request on its own." };
function nameProblem(v, repo) {
  if (!v) return null;
  if (v.length > 64) return "long";
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v)) return "chars";
  if (v === "rate-limit-per-api-key" && repo === "api") return "taken";
  return null;
}
const suggestName = (v) => norm(v).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64).replace(/-+$/, "");
function nameHelp(D, repo) {
  const p = nameProblem(D.name, repo);
  if (p === "chars") return `<span class="help err" id="t-name-h">Use lowercase letters, digits and single hyphens. <a href="#" data-act="use-name">Use “${suggestName(D.name)}”</a></span>`;
  if (p === "long") return `<span class="help err" id="t-name-h">Use at most 64 characters. <a href="#" data-act="use-name">Use “${suggestName(D.name)}”</a></span>`;
  if (p === "taken") return `<span class="help err" id="t-name-h">A task named ${D.name} already exists in acme/${repo}.</span>`;
  return `<span class="help" id="t-name-h">Lowercase letters, digits and hyphens. It names the branch and the worktree.</span>`;
}
function modelsSummary(D) {
  const st = STAGES_OF[D.mode].filter((k) => D.own[k]);
  return st.length ? `${st[0]}: ${D.own[st[0]]}${st.length > 1 ? ` +${st.length - 1}` : ""} · the rest from Defaults` : "Defaults";
}
function dialog() {
  if (S.dialog === "disc") return discDialog();
  const D = S.dlg, c = S.dialog === "card" ? CARD[S.open] : null, repo = c ? c.repo : D.repo;
  const prob = nameProblem(D.name, repo), ctxOk = c || (D.ctx || "").trim();
  const why = !D.name ? "Name the task to create it." : prob ? "Fix the name to create the task." : !ctxOk ? "Say what you want to build." : "";
  const top = c ? `<div class="cardsum" aria-label="Card"><span class="num">#${c.n}</span><span class="t">${c.t}</span><span class="s">${repoOf(c.repo)} · ${STATUSES[c.s].name}${c.epic ? ` · ${CARD[c.epic].t}` : ""}</span></div>`
    : `<div class="fld"><label class="lb" for="t-repo">Repository</label><button class="input select-trigger" id="t-repo" aria-haspopup="listbox" aria-expanded="false">acme/${repo}${I("down")}</button></div>`;
  const name = `<div class="fld"><label class="lb" for="t-name">Name</label><span class="input mono ${prob ? "is-error" : ""}"><input id="t-name" value="${esc(D.name)}" spellcheck="false" autocomplete="off" aria-invalid="${!!prob}" aria-describedby="t-name-h"></span>${nameHelp(D, repo)}</div>`;
  const ctx = c
    ? `<div class="fld"><span class="lb" id="ctx-l">Context</span><div class="ctxrow" role="group" aria-labelledby="ctx-l"><span class="w">From the card: <b>#${c.n}</b>, the epic <b>${CARD[c.epic].t}</b>, ${SIBL(c).length} cards of the epic and ${(c.dep || []).length} dependency · 5,690 characters</span>
        <button class="btn ghost xs" data-act="ctx-show" aria-expanded="${D.ctxShow}" aria-controls="ctxprev">${D.ctxShow ? "Hide" : "Show"}</button>${D.addCtx ? "" : `<button class="btn ghost xs" data-act="ctx-add">${I("plus")}Add to it</button>`}</div>
        ${D.ctxShow ? `<div class="ctxprev cbody prose" id="ctxprev" tabindex="0" aria-label="The context from the card">${`<h4>#${c.n} · ${c.t}</h4>` + BODIES[c.rich || "invoice"]}</div>` : ""}
        ${D.addCtx ? `<label class="sr" for="t-extra">Additional context</label><textarea class="textarea" id="t-extra" rows="3" placeholder="Anything the card doesn't say. It goes at the end of the context."></textarea>` : ""}</div>
       ${unsat(c).map((d) => `<div class="cd-note">${st("warn")}<span class="l"><span><b>Depends on #${d}</b> ${DEPS[d].title}</span><span>${repoOf(DEPS[d].repo)} · ${DEPS[d].state} · ${DEPS[d].status} · no pull request. A warning only: the task can start.</span></span></div>`).join("")}`
    : `<div class="fld"><label class="lb" for="t-ctx">Context</label><textarea class="textarea" id="t-ctx" rows="4" aria-describedby="t-ctx-h">${esc(D.ctx || "")}</textarea><span class="help" id="t-ctx-h">What you want to build, in your own words. High level or detailed.</span></div>`;
  const seg = (grp, vals, cur, icons) => `<div class="switch" role="radiogroup" aria-labelledby="${grp}-l">${vals.map((v) => `<button class="sw" role="radio" aria-checked="${v === cur}" aria-selected="${v === cur}" tabindex="${v === cur ? 0 : -1}" data-seg="${grp}" data-v="${v}">${icons ? I(icons[v]) : ""}${v}</button>`).join("")}</div>`;
  const modes = `<div class="pair"><div class="fld"><span class="lb" id="mode-l">Mode</span>${seg("mode", ["Structured", "One-Shot"], D.mode)}<span class="desc">${MODE_LINE[D.mode]} Fixed once the task exists.</span></div>
    <div class="fld"><span class="lb" id="review-l">Review of each step</span>${seg("review", ["Agent", "Manual"], D.review, { Agent: "bot", Manual: "user" })}<span class="desc">${REVIEW_LINE[D.review]}</span></div></div>`;
  const models = `<div class="mdl"><button class="mdl-sum" data-act="models" aria-expanded="${D.models}" aria-controls="mdl-list">${I("down", "i chev")}<span class="l">Models</span><span class="v">${modelsSummary(D)}</span></button>
    ${D.models ? `<div class="mdl-list" id="mdl-list">${STAGES_OF[D.mode].map((k) => `<span class="st-l" id="m-${k.replace(/\W/g, "")}">${k}</span><button class="chip ${D.own[k] ? "own" : ""}" aria-haspopup="listbox" aria-labelledby="m-${k.replace(/\W/g, "")}" aria-describedby="m-${k.replace(/\W/g, "")}-v"><span id="m-${k.replace(/\W/g, "")}-v">${D.own[k] || MODEL_DEFAULT[k]}</span>${I("down")}</button>`).join("")}</div>` : ""}</div>`;
  const create = `<button class="btn primary" data-act="create" ${why ? 'disabled aria-describedby="why-create"' : ""}>Create <span class="k">Ctrl ↵</span></button>`;
  return `<div class="scrim" id="scrim"><div class="dlg wide" role="dialog" aria-modal="true" aria-labelledby="dlg-t">
    <div class="dlg-hd"><h2 id="dlg-t">New task</h2><button class="btn ghost sm icon x" data-act="dlg-close" aria-label="Close" data-tip="Close · Esc">${I("x")}</button></div>
    <div class="dlg-bd">${top}${name}${ctx}${modes}${models}</div>
    <div class="dlg-ft"><span class="why" id="why-create">${why}</span><button class="btn ghost" data-act="dlg-close">Cancel</button>${create}</div></div></div>`;
}

// ---------------- The discussion dialog: only as far as this round needs it ----------------
// The dialog is the fourth screen's. Here it gains the one thing Home needs: the board, chosen when there is more than one.
const BOARDS_D = [["Internal Tools", "docs", "read yesterday"], ["Mobile App", "ios", "◇ read failed 18m ago · uses the last reading"], ["Platform Roadmap", "api, billing, docs, gateway, web", "read 2m ago · last used"]];
function discDialog() {
  const D = S.ddlg, n = D.title.length, ok = D.what.trim() || D.cards.length;
  const board = D.pick
    ? `<div class="fld"><label class="lb" for="d-board">Board</label><button class="input select-trigger" id="d-board" data-act="dboard" aria-haspopup="listbox" aria-expanded="${D.menu}" aria-controls="d-boards">${D.board}${I("down")}</button>
      ${D.menu ? `<div class="menu dmenu" id="d-boards" role="listbox" aria-label="Boards">${BOARDS_D.map(([t, r, s]) => `<button class="mi" role="option" aria-selected="${t === D.board}" data-dboard="${t}">${I("check", "i ck")}<span class="grow">${t}<span class="sub"> · ${r}</span></span><span class="sub">${s}</span></button>`).join("")}</div>` : ""}
      <span class="help">The discussion reads the clones of the board's repositories and publishes its cards there.</span></div>`
    : `<div class="cardsum"><span class="num">${I("board")}</span><span class="t">${D.board}</span><span class="s">acme · project 7 · api, billing, docs, gateway, web</span></div>`;
  const cards = D.cards.length ? `<div class="fld"><span class="lb">Cards · ${D.cards.length}</span><ul class="cd-rel">${D.cards.map((x) => `<li class="rel"><span class="num">#${x}</span><span class="t">${CARD[x].t}</span><span class="s">${repoOf(CARD[x].repo)}</span></li>`).join("")}</ul></div>` : "";
  const why = ok ? "" : "Write what to discuss or select at least one card.";
  return `<div class="scrim" id="scrim"><div class="dlg wide" role="dialog" aria-modal="true" aria-labelledby="dlg-t">
    <div class="dlg-hd"><h2 id="dlg-t">New discussion</h2><button class="btn ghost sm icon x" data-act="dlg-close" aria-label="Close" data-tip="Close · Esc">${I("x")}</button></div>
    <div class="dlg-bd">${board}
      <div class="fld"><label class="lb" for="d-title">Title</label><span class="input"><input id="d-title" value="${esc(D.title)}" aria-describedby="d-title-h"></span>${n >= 100 ? `<span class="help" id="d-title-h">${n} of 120</span>` : `<span class="help" id="d-title-h" hidden></span>`}</div>
      <div class="fld"><label class="lb" for="d-what">What to discuss <span class="opt-l">optional with cards</span></label><textarea class="textarea" id="d-what" rows="4">${esc(D.what)}</textarea></div>
      ${cards}
      <div class="ctxrow"><span class="w"><span class="st-gap">${st("warn")}</span>acme/billing isn't cloned. The conversation reads the code of the cloned repositories.</span><button class="btn ghost xs">${I("clone")}Clone</button></div>
      <div class="mdl"><div class="mdl-sum" role="group" aria-label="Model"><span class="l">Model</span><button class="chip" aria-haspopup="listbox">Opus 5.5 (1M) · high${I("down")}</button></div></div></div>
    <div class="dlg-ft"><span class="why" id="why-disc">${why}</span><button class="btn ghost" data-act="dlg-close">Cancel</button><button class="btn primary" data-act="start-disc" ${why ? 'disabled aria-describedby="why-disc"' : ""}>Start discussion <span class="k">Ctrl ↵</span></button></div></div></div>`;
}

// ---------------- Render and layout ----------------
function toast(text, sub) {
  const box = document.querySelector(".toasts"); if (!box) return;
  const t = document.createElement("div"); t.className = "toast"; t.innerHTML = `<span class="tx"><span>${text}</span>${sub ? `<span class="sub">${sub}</span>` : ""}</span>`;
  box.appendChild(t); setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 200); }, 3200);
}
function layout() {
  const p = document.querySelector(".panel.cardp"), m = document.getElementById("main");
  if (p && m) {
    p.style.width = ""; p.classList.remove("over");
    const w = Math.floor(p.getBoundingClientRect().width); p.style.width = w + "px";
    // The list stays beside the card while it keeps a readable row: 440px of list.
    p.classList.toggle("over", m.getBoundingClientRect().width - w < 440);
  }
  const menu = document.getElementById("menu"), btn = document.getElementById(S.menu === "board" ? "bmenu-btn" : "fmenu-btn");
  if (menu && btn && m) {
    const r = btn.getBoundingClientRect(), mr = m.getBoundingClientRect();
    menu.style.top = Math.round(r.bottom - mr.top + 4) + "px";
    if (S.menu === "board") menu.style.right = Math.round(mr.right - r.right) + "px"; else menu.style.left = Math.round(r.left - mr.left) + "px";
  }
}
function navs() { return [...document.querySelectorAll("#lst [data-nav]")]; }
function render(focusId) {
  const lw = document.getElementById("lstw"), keep = lw ? lw.scrollTop : null;
  document.getElementById("app").innerHTML = sidebarB() + (S.place === "home" ? homeMain() : boardMain()) + mockbar(SCENE_LIST, SCN);
  const tree = document.getElementById("tree"); if (tree) tree.addEventListener("scroll", moreBelow);
  const lw2 = document.getElementById("lstw"); if (lw2 && keep != null) lw2.scrollTop = keep;
  // The list is one Tab stop: the last focused row, the open card, or the first row.
  const all = navs(); const fid = focusId || S.focusId;
  const home = (fid && document.getElementById(fid)) || (S.open && document.getElementById(`c${S.open}`)) || all.find((x) => x.classList.contains("cr")) || all[0];
  if (home) home.tabIndex = 0;
  layout(); markTruncated();
  requestAnimationFrame(() => { layout(); moreBelow(); markTruncated(); });
  if (focusId) { const f = document.getElementById(focusId); if (f) { f.focus({ preventScroll: true }); f.scrollIntoView({ block: "nearest" }); } }
}
function markRows() {
  // A cut title keeps its whole text in the tooltip, and the epic column too.
  document.querySelectorAll(".cr .tl, .cr .col .t, .rel .t, .cont .nm, .hr .tx .s").forEach((el) => {
    if (el.scrollWidth > el.clientWidth + 0.5) el.dataset.tip = el.textContent.trim(); else if (el.dataset.tip && !el.closest(".dep")) delete el.dataset.tip;
  });
}
const _markTruncated = markTruncated;
markTruncated = function (root) { _markTruncated(root); markRows(); };

// ---------------- Acting ----------------
function openCard(n, focusRow = true) { S.open = S.open === n ? null : n; S.menu = null; render(focusRow ? `c${n}` : null); if (!V.inline && S.open) { const b = document.querySelector(".cardp .cd-acts .btn:not(:disabled)"); if (b && !focusRow) b.focus(); } }
function startFrom(c) {
  const a = actionOf(c);
  if (a === "start") { S.open = c.n; S.dialog = "card"; S.dlg = { name: `${c.n}-${suggestName(c.t)}`.slice(0, 64).replace(/-+$/, ""), mode: "Structured", review: "Agent", models: false, own: {}, ctxShow: false, addCtx: false }; render(); focusDialog(); return; }
  if (a === "clone") { S.open = c.n; render(`c${c.n}`); const b = document.querySelector('[data-act="clone"]'); if (b) b.focus(); return; }
  if (a === "add_to_board") { toast(`Add ${repoOf(c.repo)} to the board`, "The dialog of the board's repositories opens here."); return; }
  const why = { has_task: `#${c.n} already has a task: ${c.task && TASKS[c.task].title}.`, closed: `The issue #${c.n} is closed.`, other_board: `${repoOf(c.repo)} belongs to the board ${c.other}.`, clone_missing: `The clone at ~/code/${c.repo} is missing.` }[a];
  if (why) toast(`No task from #${c.n}`, why);
}
function discuss(list, pick = false) {
  S.menu = null; S.dialog = "disc";
  S.ddlg = { board: S.board === "tools" ? "Internal Tools" : "Platform Roadmap", pick, menu: false, cards: list, title: list.length === 1 ? CARD[list[0]].t : "", what: "" };
  render(); const f = document.querySelector(pick ? "#d-board" : "#d-title"); if (f) f.focus();
}
function focusDialog() { const f = document.querySelector("#d-board") || document.querySelector("#d-title") || document.querySelector("#t-name") || document.querySelector(".dlg .btn"); if (f) { f.focus(); if (f.select && S.dialog === "card") f.setSelectionRange(f.value.length, f.value.length); } }
function closeDialog() { S.dialog = null; render(S.open ? `c${S.open}` : null); }

document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-act]"), act = a && a.dataset.act;
  if (S.menu && !e.target.closest("#menu") && act !== "bmenu" && act !== "fmenu") { S.menu = null; render(); if (!act) return; }
  if (act) {
    e.preventDefault();
    const c = a.dataset.card ? CARD[a.dataset.card] : null;
    switch (act) {
      case "start": return startFrom(c);
      case "discuss": return discuss([c.n]);
      case "clone": S.cloning = c.repo; render(); setTimeout(() => { S.cloning = "done"; startFrom(c); toast(`Cloned ${repoOf(c.repo)}`, "~/code/billing"); }, 1600); return;
      case "add-board": return startFrom(c);
      case "close-card": { const n = S.open; S.open = null; if (S.stale === n) S.stale = null; render(n && document.getElementById(`c${n}`) ? `c${n}` : null); return; }
      case "open-task": return toast("Opens the task", "The task screen of round 10.");
      case "bmenu": S.menu = S.menu === "board" ? null : "board"; render(); { const f = document.querySelector("#menu .mi"); if (f && S.menu) f.focus(); } return;
      case "fmenu": S.menu = S.menu === "filter" ? null : "filter"; render(); { const f = document.querySelector("#menu .mi"); if (f && S.menu) f.focus(); } return;
      case "refresh": case "retry": S.failed = false; S.reading = true; render(); setTimeout(() => { S.reading = false; S.readAgo = "just now"; render(); }, 1800); return;
      case "home-retry": return toast("Reading Mobile App…");
      case "mine": S.f.mine = !S.f.mine; render(); document.querySelector('[data-act="mine"]').focus(); return;
      case "unfilter": S.f[a.dataset.k] = null; render(); return;
      case "clear": S.q = ""; S.f = { repo: null, status: null, assignee: null, mine: false }; render(); return;
      case "q-clear": S.q = ""; render(); document.getElementById("q").focus(); return;
      case "sel-mode": S.menu = null; S.selMode = true; S.open = V.inline ? S.open : null; render(); { const r = document.querySelector('#lst [tabindex="0"]'); if (r) r.focus(); } return;
      case "sel-cancel": S.selMode = false; S.sel.clear(); render(); return;
      case "sel-discuss": return discuss([...S.sel]);
      case "new-disc": return discuss([], S.place === "home");
      case "dboard": S.ddlg.menu = !S.ddlg.menu; render(); { const f = document.querySelector('#d-boards [aria-selected="true"]') || document.getElementById("d-board"); f.focus(); } return;
      case "start-disc": return toast("Starting the discussion…", "The conversation opens with the first message.");
      case "new-task": S.dialog = "free"; S.dlg = { repo: "api", name: "", ctx: "", mode: "Structured", review: "Agent", models: false, own: {} }; render(); focusDialog(); return;
      case "go-board": if (a.dataset.b === "mob") return toast("Opens Mobile App"); S.place = "board"; S.board = a.dataset.b; S.open = null; render(); return;
      case "continue": return toast("Opens Rate limit per API key", "In the reviewer, on the question card.");
      case "dlg-close": return closeDialog();
      case "create": return toast("Creating the task…", "The first question of the agent opens the task.");
      case "models": S.dlg.models = !S.dlg.models; render(); document.querySelector('[data-act="models"]').focus(); return;
      case "ctx-show": S.dlg.ctxShow = !S.dlg.ctxShow; render(); document.querySelector('[data-act="ctx-show"]').focus(); return;
      case "ctx-add": S.dlg.addCtx = true; render(); document.getElementById("t-extra").focus(); return;
      case "use-name": S.dlg.name = suggestName(S.dlg.name); render(); document.getElementById("t-name").focus(); return;
    }
    return;
  }
  const db = e.target.closest("[data-dboard]");
  if (db) { S.ddlg.board = db.dataset.dboard; S.ddlg.menu = false; render(); document.getElementById("d-board").focus(); return; }
  const sg = e.target.closest("[data-seg]");
  if (sg) { S.dlg[sg.dataset.seg] = sg.dataset.v; render(); document.querySelector(`[data-seg="${sg.dataset.seg}"][data-v="${sg.dataset.v}"]`).focus(); return; }
  const fl = e.target.closest("[data-filter]");
  if (fl) { const k = fl.dataset.filter, v = k === "status" ? +fl.dataset.v : fl.dataset.v; S.f[k] = S.f[k] === v ? null : v; S.menu = null; render(); return; }
  const go = e.target.closest("[data-goto]");
  if (go) { const n = +go.dataset.goto; if (!CARD[n] || S.stale === n) return; S.open = n; const c = CARD[n]; if (c.epic) S.fold[V.key === "a" ? `s${c.s}` : `e${c.epic}`] = false; if (isFinal(c)) S.fold[V.key === "a" ? `s${c.s}` : `f-${c.epic ? "e" + c.epic : "none"}`] = false; render(`c${n}`); return; }
  const row = e.target.closest("[data-nav][data-card]");
  if (row && !e.target.closest(".cx, button, a")) {
    const n = +row.dataset.card;
    if (S.selMode) { const c = CARD[n]; if (!markable(c)) return; S.sel.has(n) ? S.sel.delete(n) : S.sel.add(n); render(`c${n}`); return; }
    return openCard(n);
  }
  const hd = e.target.closest("[data-grp]");
  if (hd && !hd.classList.contains("is-empty")) { if (V.onHeader && V.onHeader(hd, e)) return; const k = hd.dataset.grp; S.fold[k] = hd.getAttribute("aria-expanded") === "true"; render(hd.id); }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "q") { S.q = e.target.value; const pos = e.target.selectionStart; render(); const q = document.getElementById("q"); if (q) { q.focus(); q.setSelectionRange(pos, pos); } }
  if (e.target.id === "t-name") { S.dlg.name = e.target.value; const pos = e.target.selectionStart; render(); const f = document.getElementById("t-name"); f.focus(); f.setSelectionRange(pos, pos); }
  if (e.target.id === "d-what" || e.target.id === "d-title") { S.ddlg[e.target.id === "d-what" ? "what" : "title"] = e.target.value; const b = document.querySelector('[data-act="start-disc"]'), ok = S.ddlg.what.trim() || S.ddlg.cards.length; b.disabled = !ok; document.getElementById("why-disc").textContent = ok ? "" : "Write what to discuss or select at least one card."; }
  if (e.target.id === "t-ctx") { S.dlg.ctx = e.target.value; const why = document.getElementById("why-create"); const ok = e.target.value.trim() && S.dlg.name && !nameProblem(S.dlg.name, S.dlg.repo); const b = document.querySelector('[data-act="create"]'); b.disabled = !ok; why.textContent = ok ? "" : !e.target.value.trim() ? "Say what you want to build." : why.textContent; }
});
document.addEventListener("keydown", (e) => {
  const inField = e.target.closest && e.target.closest("input, textarea, select");
  if (S.dialog) {
    if (e.key === "Escape" && S.dialog === "disc" && S.ddlg.menu) { e.preventDefault(); S.ddlg.menu = false; render(); document.getElementById("d-board").focus(); return; }
    if (e.key === "Escape") { e.preventDefault(); return closeDialog(); }
    const opt = e.target.closest && e.target.closest("#d-boards .mi");
    if (opt && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); const all = [...document.querySelectorAll("#d-boards .mi")]; const k = all.indexOf(opt); all[(k + (e.key === "ArrowDown" ? 1 : all.length - 1)) % all.length].focus(); return; }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { const b = document.querySelector('[data-act="create"], [data-act="start-disc"]'); if (b && !b.disabled) b.click(); return; }
    const sw = e.target.closest && e.target.closest(".sw");
    if (sw && (e.key === "ArrowLeft" || e.key === "ArrowRight")) { e.preventDefault(); const sib = [...sw.parentElement.children], k = sib.indexOf(sw); sib[(k + 1) % sib.length].click(); return; }
    if (e.key === "Tab") { const f = [...document.querySelectorAll(".dlg button:not(:disabled), .dlg input, .dlg textarea, .dlg a[href], .dlg [tabindex='0']")].filter((x) => x.offsetParent); const k = f.indexOf(document.activeElement); if (e.shiftKey && k <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && k === f.length - 1) { e.preventDefault(); f[0].focus(); } }
    return;
  }
  if (S.menu) {
    if (e.key === "Escape") { const b = S.menu === "board" ? "bmenu-btn" : "fmenu-btn"; S.menu = null; render(); document.getElementById(b).focus(); return; }
    const mi = e.target.closest && e.target.closest("#menu .mi");
    if (mi && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); const all = [...document.querySelectorAll("#menu .mi")]; const k = all.indexOf(mi); all[(k + (e.key === "ArrowDown" ? 1 : all.length - 1)) % all.length].focus(); }
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") { e.preventDefault(); document.querySelector('[data-act="new-task"]') ? document.querySelector('[data-act="new-task"]').click() : (S.dialog = "free", S.dlg = { repo: "api", name: "", ctx: "", mode: "Structured", review: "Agent", models: false, own: {} }, render(), focusDialog()); return; }
  if (inField) { if (e.key === "Escape" && e.target.id === "q") { e.target.blur(); const r = document.querySelector('#lst [tabindex="0"]'); if (r) r.focus(); } if (e.key === "ArrowDown" && e.target.id === "q") { e.preventDefault(); const r = document.querySelector('#lst [tabindex="0"]'); if (r) r.focus(); } return; }
  if (e.key.toLowerCase() === "n" && !e.ctrlKey && !e.metaKey && !e.altKey && S.place === "board") { e.preventDefault(); return discuss([]); }
  if (e.key === "/" && S.place === "board") { e.preventDefault(); const q = document.getElementById("q"); if (q) q.focus(); return; }
  if (e.key === "Escape") {
    if (S.open) { const n = S.open; S.open = null; if (S.stale === n) S.stale = null; render(document.getElementById(`c${n}`) ? `c${n}` : null); return; }
    if (S.selMode) { S.selMode = false; S.sel.clear(); render(); return; }
  }
  const el = e.target.closest && e.target.closest("#lst [data-nav]"); if (!el) return;
  const all = navs(), k = all.indexOf(el), n = el.dataset.card ? +el.dataset.card : null, c = n ? CARD[n] : null;
  const move = (to) => { if (!to) return; all.forEach((x) => { x.tabIndex = -1; }); to.tabIndex = 0; to.focus(); to.scrollIntoView({ block: "nearest" }); S.focusId = to.id; };
  if (e.key === "ArrowDown") { e.preventDefault(); move(all[k + 1]); }
  else if (e.key === "ArrowUp") { e.preventDefault(); move(all[k - 1]); }
  else if (e.key === "Home") { e.preventDefault(); move(all[0]); }
  else if (e.key === "End") { e.preventDefault(); move(all[all.length - 1]); }
  else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    e.preventDefault();
    const exp = e.key === "ArrowRight";
    if (el.dataset.grp && el.hasAttribute("aria-expanded")) { S.fold[el.dataset.grp] = !exp; render(el.id); }
    else if (!exp && V.key === "a") { let h = el; while (h && !h.dataset.grp) h = all[all.indexOf(h) - 1]; if (h) { S.fold[h.dataset.grp] = true; render(h.id); } }
  }
  else if (e.key === "Enter") { e.preventDefault(); if (c) openCard(n); else if (V.onHeaderKey) V.onHeaderKey(el); else if (el.hasAttribute("aria-expanded")) { S.fold[el.dataset.grp] = el.getAttribute("aria-expanded") === "true"; render(el.id); } }
  else if (e.key === " " && c) { e.preventDefault(); if (!markable(c)) { toast(`#${c.n} can't go into a discussion`, `${repoOf(c.repo)} isn't a repository of this board.`); return; } if (!S.selMode) S.selMode = true; S.sel.has(n) ? S.sel.delete(n) : S.sel.add(n); render(el.id); }
  else if (e.key.toLowerCase() === "s" && c && !e.ctrlKey) { e.preventDefault(); startFrom(c); }
  else if (e.key.toLowerCase() === "d" && !e.ctrlKey) { e.preventDefault(); if (S.selMode && S.sel.size) discuss([...S.sel]); else if (c && markable(c) && !c.closed) discuss([n]); }
});

// ---------------- ?audit: the audit of round 10, with this round's geometry ----------------
function auditB() {
  audit();
  const pre = document.getElementById("report"), out = JSON.parse(pre.textContent);
  const frac = (v) => Math.abs(v - Math.round(v)) > 0.01; const bad = []; let n = 0;
  [".cr", ".sech", ".eh", ".fin", ".fbar", ".srch", ".lst-in", ".cardp", ".cx", ".dlg", ".cont", ".hr", ".home", ".readfail", ".selbar"].forEach((sel) => document.querySelectorAll(sel).forEach((el) => {
    const r = el.getBoundingClientRect(); if (!r.width && !r.height) return; n++;
    const f = ["left", "top", "width", "height"].filter((k) => frac(r[k])); if (f.length) bad.push(`${sel} ${f.map((k) => `${k}=${r[k].toFixed(2)}`).join(" ")}`);
  }));
  const cutRows = [...document.querySelectorAll(".cr .tl, .cr .col .t, .rel .t, .cont .nm, .hr .tx .s")].filter((el) => el.offsetParent && el.scrollWidth > el.clientWidth + 0.5 && !el.dataset.tip).map((el) => el.textContent.trim().slice(0, 40));
  // A row's title must keep at least a third of the row.
  const narrow = [...document.querySelectorAll(".cr .tl")].filter((el) => el.offsetParent && el.clientWidth < el.closest(".cr").clientWidth / 3).length;
  Object.assign(out, { roundGeometryChecked: n, roundGeometryFractional: bad, roundCutWithoutTooltip: cutRows, rowsWithTitleUnderAThird: narrow, rows: document.querySelectorAll(".cr").length });
  pre.textContent = JSON.stringify(out, null, 1);
}
document.addEventListener("DOMContentLoaded", () => {
  if (window.SPECIMEN) return;
  document.body.insertAdjacentHTML("beforeend", `<div id="app" class="app ${V.key}"></div><div class="toasts" role="status" aria-live="polite" aria-label="Notifications"></div><pre id="report" class="report" hidden></pre>`);
  bootCommon(() => render());
  document.body.insertAdjacentHTML("afterbegin", SPRITE_B);
  addEventListener("resize", layout);
  render(S.focusId);
  if (S.place === "home" && !S.dialog) { const c = document.getElementById("cont"); if (c) c.focus(); }
  if (S.dialog) focusDialog();
  if (S.open) { const r = document.getElementById(`c${S.open}`) || document.querySelector(".cardp .btn"); if (r) r.scrollIntoView({ block: "center" }); }
  if (document.fonts) document.fonts.ready.then(() => { layout(); markTruncated(); });
  if (Q.has("audit")) setTimeout(auditB, 1400);
});
