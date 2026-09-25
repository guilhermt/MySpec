/* =====================================================================
   ROUND 13 · the discussion and its drafts, shared by a and b. The shell
   of round 10 (core.js: the tree, the atoms of the conversation, the ask
   bar, the composer, tooltips, audit), the rows and fields of round 11
   (board.css) and the notes, dialogs and page of an item that left of
   round 12 (review.css, vb.css).
   The model is the same in a and b (pub.js): approving a draft publishes
   it at once, and a draft that depends on the epic or on another draft
   waits until that one is created. The variations differ in how the whole
   body is read before approving: a keeps every draft open (open.js), b
   opens one draft at a time (focus.js). V.expanded(d) says which.
   ?scene= · ?theme= · ?panel=Details|Documents · ?menu · ?edit · ?home
   ?error (talk) · ?archive · ?group (many) · ?delete · ?freeze · ?audit · ?clean
   ===================================================================== */
let V = null;
const SPRITE_D = `<svg class="sprite" aria-hidden="true">
  <symbol id="i-refresh" viewBox="0 0 16 16"><path d="M13 8a5 5 0 1 1-1.5-3.6"/><path d="M13 3v3h-3"/></symbol>
  <symbol id="i-info" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.5"/><path d="M8 7.3v3.4M8 5.3h.01"/></symbol>
  <symbol id="i-epic" viewBox="0 0 16 16"><rect x="2.5" y="2.5" width="11" height="3" rx="1"/><rect x="2.5" y="6.5" width="11" height="3" rx="1"/><rect x="2.5" y="10.5" width="7" height="3" rx="1"/></symbol>
  <symbol id="i-board" viewBox="0 0 16 16"><rect x="2.5" y="3" width="3" height="10" rx="1"/><rect x="6.5" y="3" width="3" height="7" rx="1"/><rect x="10.5" y="3" width="3" height="5" rx="1"/></symbol>
  <symbol id="i-clone" viewBox="0 0 16 16"><path d="M8 2.5v7M5 6.5l3 3 3-3"/><path d="M3 11v2.5h10V11"/></symbol>
  <symbol id="i-cards" viewBox="0 0 16 16"><rect x="2.5" y="5" width="9" height="8.5" rx="1.5"/><path d="M5 2.5h7a1.5 1.5 0 0 1 1.5 1.5v7"/></symbol>
  <symbol id="i-rewrite" viewBox="0 0 16 16"><path d="M10.5 3 13 5.5 6 12.5H3.5V10z"/><path d="M9 4.5 11.5 7"/></symbol>
  <symbol id="i-search" viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.2"/><path d="M10.2 10.2 13.5 13.5"/></symbol>
  <symbol id="i-chain" viewBox="0 0 16 16"><path d="M3 8h7M7.5 4.5 11 8l-3.5 3.5"/><path d="M13 3.5v9"/></symbol>
</svg>`;

const SCENE_LIST = [["start", "Start · from the board"], ["talk", "Talk · the agent asks"], ["unreadable", "Drafts that can't be read"], ["drafts", "Round 1 · drafts to decide"],
  ["rewrite", "Round 1 · revised on request"], ["publish", "Round 1 · approving publishes a chain"], ["published", "Round 1 · published"], ["partial-fail", "Round 1 · a publication failed"],
  ["epic", "Round 1 · the epic can't publish"], ["epic-off", "Round 1 · the epic discarded"], ["many", "Ten drafts in one round"], ["done", "Three rounds · what comes next"], ["archive-blocked", "Archive · what blocks it"]];
const SCN = SCENE_LIST.some(([k]) => k === Q.get("scene")) ? Q.get("scene") : "drafts";
const V1 = SCN === "drafts" || SCN === "many";        // the titles before the agent revised them
const FREEZE = Q.has("freeze") || Q.has("audit") || Q.has("clean");

// ---------------- The drafts ----------------
const body = (ctx, prob, inc, out) => `<h4>Context</h4><p>${ctx}</p><h4>Problem</h4><p>${prob}</p><h4>What the delivery includes</h4><ul>${inc.map((x) => `<li>${x}</li>`).join("")}</ul><h4>Out of scope</h4><ul>${out.map((x) => `<li>${x}</li>`).join("")}</ul>`;
const TITLE = V1
  ? { 2: "Tier limits and overage prices in the plans table", 3: "Charge metered overage on the monthly invoice", 4: "Plan picker shows the tiers and the overage price" }
  : { 2: "Tier limits and overage prices", 3: "Overage on the monthly invoice", 4: "Plan picker with tiers and overage" };
const B = {
  1: body("Every workspace pays a flat price per plan today, and heavy API users cost more than they pay. Card #455 asks for tiers; #461 already meters requests at the gateway.", "There is no way to sell a plan with an included volume and charge what goes over it.", ["The limits and overage prices of each tier, as data.", "The overage on the monthly invoice, from the metering events.", "The plan picker showing the tiers and what goes over costs."], ["Grandfathering current customers.", "Alerts, which #474 covers."]),
  2: body("The <code>plans</code> table in acme/billing has a flat <code>monthly_price</code> per plan and nothing about volume.", "Invoicing and the plan picker need, per tier, the requests included per month and the price of each 1,000 requests over it.", ["<code>included_requests</code> and <code>overage_per_1k</code> on each plan, with a migration that fills today's plans as unlimited.", "An admin form in Billing › Plans to edit them.", "The values in the plans API response."], ["Changing today's prices."]),
  3: body("The monthly invoice is built by <code>invoice.Build</code> from the plan's flat price. The gateway will emit one metering event per request and API key (#461).", "Requests over the tier's included volume aren't charged.", ["A line <code>Overage · N requests</code> on the invoice, priced per 1,000.", "The count from the metering events of the billing period, per workspace.", "An invoice without overage keeps its lines as today."], ["Overage per API key on the invoice: the admin report covers it."]),
  4: body("The plan picker in acme/web lists the plans with their flat price.", "A customer can't see what a tier includes or what going over costs before choosing it.", ["Each tier with its included requests and the overage price.", "An estimate from the workspace's last 30 days: <em>At your usage, about $412 a month</em>."], ["Changing the plan from the picker's estimate."]),
  5: body("The gateway counts requests per workspace in memory and flushes a total every hour.", "Overage per tier and the admin report need the count per API key, durable, per request.", ["One metering event per request, with the workspace, the API key and the route, to the <code>metering</code> topic.", "At-least-once delivery, deduplicated by request id downstream.", "The hourly total kept until the invoice reads the events."], ["Metering of websocket traffic."]),
};
const DIFF5 = [[" ", "The gateway counts requests per workspace in memory and flushes a total every hour."], ["-", "Invoicing needs the total per workspace."], ["+", "Overage per tier and the admin report need the count per API key, durable, per request."],
  [" ", "## What the delivery includes"], ["+", "- One metering event per request, with the workspace, the API key and the route."], ["+", "- At-least-once delivery, deduplicated by request id downstream."], ["+", "- The hourly total kept until the invoice reads the events."], [" ", "- Tests for a flush under load."]];
const ROUND1 = [
  { n: 1, kind: "epic", title: "Pricing tiers with metered overage", repo: "billing", kids: [2, 3, 4], out: ["created", "billing#478"], body: B[1] },
  { n: 2, kind: "new", title: TITLE[2], repo: "billing", module: "Billing", epic: 1, deps: [], out: ["created", "billing#479"], body: B[2] },
  { n: 3, kind: "new", title: TITLE[3], repo: "billing", module: "Billing", epic: 1, deps: [2, 5], out: ["created", "billing#480"], body: B[3] },
  { n: 4, kind: "new", title: TITLE[4], repo: "web", module: "Web app", epic: 1, deps: V1 ? [2] : [3], out: ["created", "web#2302"], body: B[4] },
  { n: 5, kind: "update", card: 461, cardRepo: "gateway", title: "Metering events per API key from the gateway", cur: "Metering events from the gateway", repo: "gateway", module: "Gateway", deps: [], out: ["updated", "gateway#461"], body: B[5], diff: DIFF5, size: "+4 −1" },
];
// The largest real round: ten drafts, with an epic of five cards, two updates, and two drafts with a warning.
const MANY = [
  ...ROUND1.slice(0, 5).map((d) => d.n === 1 ? { ...d, kids: [2, 3, 4, 6, 7] } : d),
  { n: 6, kind: "new", title: "Overage report per workspace for admins", repo: "web", module: "Web app", epic: 1, deps: [5], out: ["created", "web#2303"], body: body("Admins only see the invoice total.", "They can't tell which API key drove the overage.", ["A report per billing period, per API key, from the metering events.", "CSV export."], ["Alerts."]) },
  { n: 7, kind: "new", title: "Proration when a workspace changes tier mid-period", repo: "billing", module: "Billing", epic: 1, deps: [2], out: ["created", "billing#481"], body: body("A workspace can change plan any day.", "The included volume and the overage are per period, and a change mid-period has no rule.", ["The included volume prorated by days on each tier.", "The overage counted against the prorated volume."], ["Refunds."]) },
  { n: 8, kind: "update", card: 474, cardRepo: "api", title: "Usage alerts at 80% of the tier's included requests", cur: "Usage alerts at 80% of the plan", repo: "api", module: "Billing", deps: [5], out: ["updated", "api#474"], body: body("#474 alerts at 80% of the plan's monthly units.", "With tiers, the unit is the tier's included requests.", ["The threshold over the included requests, from the metering events."], ["Alerts per API key."]), diff: [[" ", "An email to the billing admins when the workspace reaches 80%"], ["-", "of the plan's monthly units, once per billing period."], ["+", "of the tier's included requests, once per billing period."]], size: "+1 −1" },
  { n: 9, kind: "new", title: "Tier names and prices on the public status page", repo: "status-page", module: "Web app", deps: [], out: ["created", "status-page#88"], warn: ["acme/status-page is no longer managed by the board."], body: body("The public status page lists the plans by name.", "The tiers need their names and included volume there.", ["The tiers and their included requests.", "A link to the pricing page."], ["Prices per region."]) },
  { n: 10, kind: "new", title: "Support view of a workspace's metered usage", repo: "web", module: "Web app", deps: [], out: ["created", "web#2304"], warn: ["The dependency on Websocket metering is no longer among the drafts."], body: body("Support answers overage questions from the invoice PDF.", "They can't see the requests behind a charge.", ["A read-only view of a workspace's metering per day and per API key."], ["Editing a charge."]) },
];
const ROUND3 = [{ n: 1, kind: "new", title: "Keep current customers on their plan for 90 days", repo: "billing", module: "Billing", epicRef: "billing#478 Pricing tiers with metered overage", deps: [], out: ["created", "billing#483"], body: body("Current customers are on flat plans.", "Moving them to tiers the day they ship changes their bill without notice.", ["90 days on the current plan from the day the tiers ship.", "An email 30 days before the move."], ["Custom deals."]) }];
const DRAFTS = SCN === "many" ? MANY : SCN === "done" ? ROUND3 : ROUND1;
const D = Object.fromEntries(DRAFTS.map((d) => [d.n, d]));
// The order of a publication: an epic before its cards, a card after what it depends on, ties by position.
function orderOf(list) {
  const by = Object.fromEntries(list.map((d) => [d.n, d])), out = [], seen = new Set();
  const visit = (n) => { if (seen.has(n) || !by[n]) return; seen.add(n); const d = by[n]; if (d.epic) visit(d.epic); (d.deps || []).forEach(visit); out.push(n); };
  list.forEach((d) => visit(d.n)); return out;
}
const ORDER = orderOf(DRAFTS);

// ---------------- The state of the scene ----------------
const S = {
  place: SCN === "start" ? (Q.has("home") ? "home" : "board") : "disc",
  dec: {}, pub: {}, log: [], cur: 1, edit: SCN === "drafts" && Q.has("edit") ? 3 : null, depPick: false,
  diff: {}, revised: SCN === "rewrite" ? { 2: "cleared", 3: "new", 4: "new" } : {}, lock: 0,
  panel: ["Details", "Documents"].includes(Q.get("panel")) ? Q.get("panel") : null, docTab: "Document",
  menu: Q.has("menu") || SCN === "archive-blocked" ? "more" : null, dialog: null, born: false, sessErr: SCN === "talk" && Q.has("error"),
  dstart: { home: Q.has("home"), title: "Usage-based pricing tiers", what: "We want to charge by usage: tiers with an included volume and a price for what goes over. The gateway already meters requests (#461). What's missing to sell it, and in which repositories?", cards: Q.has("home") ? [] : [455, 461], ctxOpen: false, boardMenu: false, starting: false },
};
const decided = () => DRAFTS.filter((d) => S.dec[d.n]).length;
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const kidsOk = (e, dec = S.dec) => e.kids.filter((k) => dec[k] === "ok").length;
const kidsOpen = (e, dec = S.dec) => e.kids.filter((k) => !dec[k]).length;
function nextOpen(from) { const o = DRAFTS.filter((d) => !S.dec[d.n]); return (o.find((d) => d.n > from) || o[0] || {}).n; }
const repoOf = (r) => `acme/${r}`;
const KIND = { new: "New card", update: "Update", epic: "Epic" };
const nameOf = (d, self) => d.n === self ? "this card" : d.kind === "epic" ? "the epic" : d.title;
const listOf = (a) => a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`;

// ---------------- The tree: round 10's, with the discussion open ----------------
let OPENID = S.place === "disc" ? "d1" : null;
Object.assign(ITEMS.d1, { name: "Usage-based pricing tiers", cards: [455, 461] });
["run", "ctx", "posShort"].forEach((k) => delete ITEMS.d1[k]);
ITEMS.d2.row = ["Decide drafts · round 1 · 3/6", "Decide drafts · 3/6"];
Object.assign(ITEMS.t1, { sits: [{ sev: "wait", label: "Question", place: "Reviewer · Step 3/7", since: "18m", long: "18 minutes", min: 18 }], row: ["Question · Reviewer · Step 3/7", "Question · Step 3/7"], pos: "Step 3/7 · Reviewer pass 2" });
ITEMS.r1.row = ["Decide findings · pass 1 · 1/3", "Decide findings · 1/3"];
const sit = (sev, label, place, since, min, row) => ({ sits: [{ sev, label, place, since, long: since.replace("m", " minutes").replace(/^1 minutes/, "1 minute"), min }], row, pos: place === "Discussing" ? "Discussing" : "Round 1" });
const SIT = {
  reply: sit("wait", "Waiting for reply", "Discussing", "2m", 2, ["Waiting for reply · Discussing", "Reply · Discussing"]),
  sesserr: sit("error", "Session error", "Discussing", "3m", 3, ["Session error · Discussing", "Session error"]),
  unreadable: sit("wait", "Waiting for the drafts", "Discussing", "1m", 1, ["Waiting for the drafts · Discussing", "Waiting for the drafts"]),
  decide: sit("wait", "Decide drafts", "round 1", "6m", 6, ["Decide drafts · round 1", "Decide drafts"]),
  epic: sit("wait", "Epic can't publish", "round 1", "1m", 1, ["Epic can't publish · round 1", "Epic can't publish"]),
  epicoff: sit("wait", "Epic discarded", "round 1", "1m", 1, ["Epic discarded · round 1", "Epic discarded"]),
  failed: sit("error", "Publish failed", "round 1", "1m", 1, ["Publish failed · round 1", "Publish failed"]),
  archive: sit("close", "Ready to archive", "round 1", "1m", 1, ["Ready to archive · 5 published", "Ready to archive"]),
  archive3: { ...sit("close", "Ready to archive", "round 3", "4m", 4, ["Ready to archive · 7 published", "Ready to archive"]), pos: "Round 3" },
  // Publishing is the app working, not the agent: the spinner and the position, no line 3.
  publishing: { run: { who: "MySpec", turn: "", long: "", verb: "Publishing", target: "", short: "" }, app: true, pos: "Publishing · round 1", posShort: "Publishing" },
};
function setD1() {
  const i = ITEMS.d1; ["sits", "row", "run", "ctx", "posShort", "idle", "app"].forEach((k) => delete i[k]);
  const s = V.situation(); Object.assign(i, JSON.parse(JSON.stringify(SIT[s] || SIT.decide)));
  if (s === "decide") i.row = [`Decide drafts · round 1 · ${decided()}/${DRAFTS.length}`, `Decide drafts · ${decided()}/${DRAFTS.length}`];
}
if (SCN === "start") TREE[1].items = TREE[1].items.filter((x) => x !== "d1");
function nextJ() {
  return Object.keys(ITEMS).filter((id) => id !== OPENID && needsYou(ITEMS[id]) && (id !== "d1" || SCN !== "start")).sort((a, b) => {
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
    if (!i.app) {
      r2 = tt(i.run);
      l3 = `<span class="c1"></span><span class="l3 trunc"><span class="long"><span class="v">${i.run.verb}</span> ${i.run.target}</span><span class="short"><span class="v">${i.run.verb}</span> ${i.run.short}</span></span><span class="r3">${i.ctx != null ? ctxm(i.ctx) : ""}</span>`;
    }
  } else {
    const word = t === "gh" ? "GitHub" : t === "idle" ? "idle" : "";
    l2 = `<span class="lbl trunc">${i.pos}</span>`;
    r2 = word ? `<span class="rw">${word}</span>` : "";
  }
  const jk = nextJ() === id;
  const r1 = jk ? `<span class="meta jk" data-tip="Ctrl+J opens this next"><kbd class="jk">Ctrl J</kbd></span>` : `<span class="meta">${meta(i)}</span>`;
  const cls = [sel ? "sel" : "", needsYou(i) ? "you" : "", t === "error" ? "err" : "", jk ? "jk-row" : ""].join(" ");
  const label = i.app ? `discussion ${i.name}. MySpec is publishing the drafts of round 1. ${meta(i)}` : ariaFor(i);
  return `<div class="it ${cls}" role="treeitem" aria-level="${level}" tabindex="${sel ? 0 : -1}" ${sel ? 'aria-current="page" aria-selected="true"' : ""} data-meta="${meta(i)}" aria-label="${label}" data-item="${id}">
    <span class="c1">${ty(i)}</span><span class="nm trunc">${i.name}</span><span class="r1">${r1}</span>
    <span class="c1">${st(t)}</span><span class="l2">${l2}</span><span class="r2">${r2}</span>${l3}</div>`;
}
function sidebarD() {
  if (S.place === "disc") setD1();
  let h = sidebar();
  if (S.place === "board") h = h.replace('class="node board" role="treeitem" aria-level="1" aria-expanded="true" aria-owns="g-plat" tabindex="-1"', 'class="node board cur" role="treeitem" aria-level="1" aria-expanded="true" aria-owns="g-plat" tabindex="0" aria-current="page"');
  if (S.place !== "disc") h = h.replace(/(<div class="it [^"]*" role="treeitem" aria-level="\d" )tabindex="0"/, '$1tabindex="-1"');
  return h;
}

// ---------------- The header: back, the board, the title, the pill, the tools ----------------
const DISC = { title: "Usage-based pricing tiers", board: "Platform Roadmap" };
function navBtnsD(back) { return `<div class="navbtns"><button class="btn ghost sm icon" data-tip="Back to ${back} · Alt+←" aria-label="Back to ${back}">${I("left")}</button></div>`; }
// The pill is the review's: the discussion has no stages, so it says the round of drafts, or Discussing before the first.
function pillState() {
  const s = V.situation(), name = ["talk", "unreadable"].includes(SCN) ? "Discussing" : SCN === "done" ? "Round 3" : "Round 1";
  const g = { reply: "wait", sesserr: "error", unreadable: "wait", decide: "wait", epic: "wait", epicoff: "wait", failed: "error", archive: "close", archive3: "close", publishing: "run" }[s] || "idle";
  const long = { reply: "Waiting for your reply", sesserr: "The session stopped", unreadable: "The drafts can't be read", decide: "Drafts to decide", epic: "The epic can't publish", epicoff: "The epic is discarded", failed: "A publication failed", archive: "Published · ready to archive", archive3: "Published · ready to archive", publishing: "Publishing" }[s] || "";
  return { name, g, long, word: s === "publishing" ? "publishing" : "published" };
}
function pill(bar) {
  const p = pillState();
  return `<ol class="stepper one" tabindex="0" aria-label="Progress · ${p.name} · ${p.long}" data-tip="${p.name} · ${p.long}"><li class="sp cur" aria-current="step"><span class="pill"><span class="lb-c">${p.name}</span><span class="stw st-${p.g}-t">${st(p.g, bar ? p.long : "")}${bar ? "" : `<span class="long">${p.word}</span>`}</span></span></li></ol>`;
}
function headerD(bar) {
  const P = S.panel;
  const pb = (n, icon, tip) => `<button class="btn ghost pbtn" aria-pressed="${P === n}" data-panel="${n}" aria-label="${n}" data-tip="${tip}">${I(icon)}<span class="pl">${n}</span></button>`;
  return `<header class="ih1 mh has-stepper">${navBtnsD(DISC.board)}<nav class="crumbs" aria-label="Breadcrumb"><span class="up row crumb-path"><button class="ellb" aria-haspopup="menu" aria-label="Show the hidden level: ${DISC.board}" data-tip="${DISC.board}">…</button><span class="board row crumb-path"><a href="#" data-act="go-board">${DISC.board}</a><span class="gt" aria-hidden="true">/</span></span></span></nav>
    <h1 class="ih-title"><span class="trunc">${DISC.title}</span></h1>${pill(bar)}<span class="grow"></span>
    <div class="ih-tools">${ctxm(SCN === "talk" ? 18 : SCN === "done" ? 46 : 31)}<button class="btn ghost sm pz" aria-label="Pause the discussion" data-tip="Pause the discussion · the session stops">${I("pause")}<span class="pl">Pause</span></button>
    <div class="tgroup" role="group" aria-label="Panels">${pb("Details", "info", "The board, the cards, the repositories read, the rounds")}${pb("Documents", "file", "Context and the document of the discussion")}</div>
    <button class="btn ghost sm icon" id="more-btn" aria-label="More actions" aria-haspopup="menu" aria-expanded="${S.menu === "more"}" data-tip="Group into an epic, archive, delete">${I("more")}</button></div></header>`;
}
const looseOpen = () => DRAFTS.filter((d) => d.kind !== "epic" && !d.epic && !S.pub[d.n] && S.dec[d.n] !== "no");
function moreMenu() {
  const why = V.menuArchive();
  const archive = why ? `<button class="mi" role="menuitem" aria-disabled="true" aria-describedby="arch-why">Archive…<span class="sub" id="arch-why">· ${why}</span></button>`
    : `<button class="mi" role="menuitem" data-act="archive" data-tip="The conversation ends; the document, the drafts and what was published go to History">Archive…</button>`;
  return `<div class="pop menu more" id="more-menu" role="menu" aria-label="More actions">
    <div class="menu-cap">Discussion</div><button class="mi" role="menuitem" data-act="go-board">Open ${DISC.board}</button>
    ${looseOpen().length >= 2 ? `<button class="mi" role="menuitem" data-act="group">Group drafts into an epic…</button>` : `<button class="mi" role="menuitem" aria-disabled="true">Group drafts into an epic…<span class="sub">· needs two loose drafts not published</span></button>`}
    ${archive}
    <div class="menu-sep" role="separator"></div><button class="mi danger" role="menuitem" data-act="delete">Delete discussion…</button></div>`;
}
function placeMenu() {
  const m = document.getElementById("more-menu"), b = document.getElementById("more-btn"), main = document.getElementById("main"); if (!m || !b) return;
  const r = b.getBoundingClientRect(), mr = main.getBoundingClientRect();
  m.style.top = Math.round(r.bottom - mr.top + 4) + "px"; m.style.right = Math.round(mr.right - r.right) + "px";
}

// ---------------- A draft: the same component in a and b ----------------
function depLinks(d) {
  if (!d.deps || !d.deps.length) return "";
  return `<span class="dep">Depends on ${d.deps.map((k) => `<a href="#drf-${k}" class="dl" data-goto="${k}">${D[k].title}</a>`).join(", ")}</span>`;
}
function tagOf(d) {
  return d.kind === "update"
    ? `<span class="dtag">Update</span><a class="ref" href="#" data-tip="Open ${d.cardRepo}#${d.card} on GitHub">${d.cardRepo}#${d.card}${I("external")}</a>`
    : `<span class="dtag">${KIND[d.kind]}</span>`;
}
// The agent's revision is said once in the card: the tag on the drafts it changed. What they were is in the marker.
const revTag = (d) => S.revised[d.n] ? `<span class="dtag rw" data-tip="The agent revised this draft at 14:32. The earlier version is in the marker Drafts revised.">${I("rewrite")}Revised</span>` : "";
function metaParts(d) {
  const parts = [repoOf(d.repo)];
  if (d.module) parts.push(d.module);
  if (d.kind === "epic") parts.push(plural(d.kids.length, "card"));
  if (d.kind === "update" && d.cur !== d.title) parts.push(`Now: ${d.cur}`);
  if (d.epicRef) parts.push(`In ${d.epicRef}`);
  return parts;
}
function draftMeta(d) {
  const dep = depLinks(d);
  return `<div class="dm">${metaParts(d).map((p) => `<span>${p}</span>`).join('<span class="ds" aria-hidden="true">·</span>')}</div>${dep ? `<div class="dm">${dep}</div>` : ""}`;
}
// Warnings that don't fail the draft, or that stop it before GitHub: said on the draft, neutral.
const warnLines = (d) => (d.warn || []).map((w) => `<div class="dwarn">${st("warn")}<span>${w}</span></div>`).join("");
function draftText(d) {
  if (S.edit === d.n) return draftEdit(d);
  const n = d.n;
  // An update reads as its new body, with the changes against the card one toggle away.
  const tog = d.kind === "update" ? `<div class="dview" role="radiogroup" aria-label="What to read"><button class="sw" role="radio" aria-checked="${!S.diff[n]}" data-act="view" data-v="body" data-n="${n}">Body</button><button class="sw" role="radio" aria-checked="${!!S.diff[n]}" data-act="view" data-v="diff" data-n="${n}" data-tip="What the draft changes in the body of ${d.cardRepo}#${d.card}">Changes <span class="dsz">${d.size}</span></button></div>` : "";
  const diff = `<div class="ddiff" role="group" aria-label="Changes to the body">${(d.diff || []).map(([k, t]) => `<div class="dl2 ${k === "+" ? "add" : k === "-" ? "del" : ""}"><span class="sg" aria-hidden="true">${k === " " ? "" : k === "-" ? "−" : "+"}</span><span class="tx"><span class="sr">${k === "+" ? "Added: " : k === "-" ? "Removed: " : ""}</span>${esc(t)}</span></div>`).join("")}</div>`;
  return `${tog}${S.diff[n] ? diff : `<div class="dbody prose">${d.body}</div>`}`;
}
// Editing is one click away and rare: 5 fields edited by hand in 28 drafts, all of them titles made shorter.
function draftEdit(d) {
  const n = d.n;
  const sel = (id, label, v, tip) => `<div class="fld"><span class="lb" id="${id}-l">${label}</span><button class="input select-trigger" id="${id}" aria-haspopup="listbox" aria-labelledby="${id}-l ${id}" data-tip="${v} · ${tip}"><span class="v">${v}</span>${I("down")}</button></div>`;
  const deps = (d.deps || []).map((k) => `<span class="chip fchip on">${D[k].title}<button class="x" aria-label="Remove the dependency on ${D[k].title}" data-tip="Remove the dependency">${I("x")}</button></span>`).join("");
  const pick = S.depPick ? `<div class="menu dpick" role="listbox" aria-label="Depend on"><div class="menu-cap">Drafts of this discussion</div>${DRAFTS.filter((x) => x.kind !== "epic" && x.n !== n).map((x) => `<button class="mi" role="option" aria-selected="${(d.deps || []).includes(x.n)}">${I("check", "i ck")}<span class="grow trunc">${x.title}</span><span class="sub">${repoOf(x.repo)}</span></button>`).join("")}
    <div class="menu-sep" role="separator"></div><div class="menu-cap">Cards of the board</div><label class="input srch dsrch" for="dsrch">${I("search")}<input id="dsrch" placeholder="#474 or a title"></label>
    <button class="mi" role="option" aria-selected="false">${I("check", "i ck")}<span class="grow trunc">#474 Usage alerts at 80% of the plan</span><span class="sub">acme/api</span></button></div>` : "";
  return `<div class="dedit" role="group" aria-label="Edit draft ${n}">
    <div class="fld"><label class="lb" for="de-t-${n}">Title</label><span class="input"><input id="de-t-${n}" value="${esc(d.title)}"></span></div>
    <div class="fld"><label class="lb" for="de-b-${n}">Body <span class="opt-l">Markdown</span></label><textarea class="textarea" id="de-b-${n}" rows="6">${esc(d.body.replace(/<h4>(.*?)<\/h4>/g, "## $1\n").replace(/<li>/g, "- ").replace(/<\/(p|li|ul)>/g, "\n").replace(/<[^>]+>/g, ""))}</textarea></div>
    <div class="dsel">${sel(`de-r-${n}`, "Repository", repoOf(d.repo), "The repositories of the board")}${sel(`de-m-${n}`, "Module", d.module || "No module", "The Module field of the board")}${sel(`de-e-${n}`, "Epic", d.epic ? D[d.epic].title : "No epic", "An epic of this discussion, or an issue that exists")}</div>
    <div class="fld"><span class="lb" id="de-d-${n}">Depends on</span><div class="ddeps" role="group" aria-labelledby="de-d-${n}">${deps}<button class="btn ghost xs" data-act="dep-add" aria-expanded="${S.depPick}" aria-haspopup="listbox">${I("plus")}Add a dependency</button></div>${pick}</div>
    <div class="row"><span class="help">Saved as you type. The agent's next revision of this draft replaces your edits.</span><button class="btn ghost xs" data-act="edit-done" data-n="${n}">Done</button></div></div>`;
}
function draftLabel(d) {
  const dec = S.dec[d.n], word = S.pub[d.n] === "done" ? "published" : dec === "ok" ? "approved" : dec === "no" ? "discarded" : "not decided";
  return `Draft ${d.n} of ${DRAFTS.length}: ${KIND[d.kind]}${d.card ? ` of ${d.cardRepo}#${d.card}` : ""}. ${d.title}. ${repoOf(d.repo)}${d.module ? `, ${d.module}` : ""}. ${word}`;
}
// Open: the whole draft. Folded (b): one line with the kind, the title and the state, and one line with the fields.
function draftItem(d, o = {}) {
  const dec = S.dec[d.n], cur = S.cur === d.n && !o.static, open = V.expanded(d) || S.edit === d.n;
  const cls = ["drf", open ? "" : "is-folded", dec === "ok" ? "ok" : dec === "no" ? "no-go" : "", cur ? "cur" : "", d.kind === "epic" ? "is-epic" : "", o.cls || "", V.itemClass ? V.itemClass(d) : ""].join(" ");
  const head = `<span class="no">${d.n}</span>`;
  if (!open) {
    const fields = [...metaParts(d), ...(d.deps && d.deps.length ? [`Depends on ${d.deps.map((k) => D[k].title).join(", ")}`] : [])].join(" · ");
    return `<div class="${cls}" id="drf-${d.n}" data-dnum="${d.n}" tabindex="${cur ? 0 : -1}" role="group" aria-label="${esc(draftLabel(d))}">${head}<div class="db">
      <div class="fr1">${tagOf(d).replace(/<a class="ref"[\s\S]*?<\/a>/, "")}${revTag(d)}<span class="dti trunc">${d.title}</span><span class="fst">${V.stateLine(d, true) || `<span class="dst off">Not decided</span>`}</span></div>
      <div class="fr2 trunc">${fields}${d.warn ? ` · <span class="w">${d.warn.length} warning</span>` : ""}</div></div></div>`;
  }
  return `<div class="${cls}" id="drf-${d.n}" data-dnum="${d.n}" tabindex="${cur ? 0 : -1}" role="group" aria-label="${esc(draftLabel(d))}">${head}<div class="db">
    <div class="dh">${tagOf(d)}${revTag(d)}</div>${S.edit === d.n ? "" : `<div class="dti" id="dt-${d.n}">${d.title}</div>`}${draftMeta(d)}${warnLines(d)}${draftText(d)}${o.static ? "" : V.decArea(d)}</div></div>`;
}
function decButtons(d, dis = false, why = "") {
  const dec = S.dec[d.n], x = dis ? `disabled ${why ? `aria-describedby="${why}"` : ""}` : "";
  return `<button class="btn sm dda" aria-pressed="${dec === "ok"}" data-dec="ok" data-n="${d.n}" ${x}>${I("check")}Approve <span class="k">A</span></button><button class="btn sm ddd" aria-pressed="${dec === "no"}" data-dec="no" data-n="${d.n}" ${x}>Discard <span class="k">D</span></button>`;
}
const editBtn = (d) => S.edit === d.n ? "" : `<button class="btn ghost xs" data-act="edit" data-n="${d.n}" data-tip="Edit the title, the body and the fields · E">Edit</button>`;
// The drafts of a round: a neutral card after the marker, the epic as a group with its cards under a guide.
function draftsCard(o = {}) {
  const items = [];
  DRAFTS.forEach((d) => {
    if (d.epic) return;
    if (d.kind === "epic") items.push(`<div class="dgrp" role="group" aria-label="Epic ${d.title} and its ${d.kids.length} cards">${draftItem(d, o)}<div class="dkids">${d.kids.map((k) => draftItem(D[k], o)).join("")}</div></div>`);
    else items.push(draftItem(d, o));
  });
  return `<fieldset class="card dec plain dcard ${o.cls || ""}" id="dcard" aria-labelledby="dc-t"><div class="hd"><span id="dc-t">${SCN === "done" ? "Round 3" : "Round 1"} · drafts</span><span class="grow"></span><span class="faint num">${DRAFTS.length}</span></div>
    <div class="bd"><div class="drfs">${items.join("")}</div></div></fieldset>`;
}
// The list of a round, read only, as it opens inside a marker.
function roundList(state, list = DRAFTS, order = ORDER) {
  const by = Object.fromEntries(list.map((d) => [d.n, d]));
  return `<ol class="rlist">${order.map((n) => { const d = by[n]; const s = state(d); return `<li class="${s.cls || ""}"><span class="c1">${s.g}</span><span class="t"><span class="tt">${d.kind === "epic" ? "Epic · " : d.kind === "update" ? `Update ${d.cardRepo}#${d.card} · ` : ""}${s.title || d.title}</span></span><span class="s">${s.txt}</span></li>`; }).join("")}</ol>`;
}
const created = (d) => { const [k, ref] = d.out; return `${k === "created" ? "Created" : "Updated"} <a href="#" data-tip="Open ${ref} on GitHub">${ref}${I("external")}</a>`; };

// ---------------- The conversation ----------------
const CONTEXT = `<div class="docbody full prose"><h4>Usage-based pricing tiers</h4><p>Board <a href="#">Platform Roadmap</a> · acme/api <code>~/code/api</code>, acme/gateway <code>~/code/gateway</code>, acme/web <code>~/code/web</code>, acme/docs <code>~/code/docs</code>, acme/billing <em>Not cloned</em>.</p>
  <h4>#455 Usage-based pricing tiers · acme/billing · Backlog</h4><p>Module Billing · epic #450 Usage-based billing. <em>Sell plans with an included volume of requests…</em></p><h4>#461 Metering events from the gateway · acme/gateway · Backlog</h4><p>Module Gateway · epic #450 Usage-based billing. <em>The gateway counts requests per workspace in memory…</em></p><p class="muted">The epic, 4 sibling cards and 1 dependency follow. 5,690 characters.</p></div>
  <div class="docfoot"><button class="btn ghost xs" data-panel="Documents" data-doc="Context">${I("file")}Open in Documents</button></div>`;
const DOCX = `<div class="docbody prose"><h4>Context</h4><p>Workspaces pay a flat price per plan. The gateway counts requests per workspace, in memory, and flushes a total every hour; the invoice reads the plan's price only.</p><h4>Problem</h4><p>Heavy API users cost more than they pay, and there is no plan with an included volume and a price for what goes over it.</p><h4>Constraints</h4><ul><li>acme/billing isn't cloned here: what the drafts say about it comes from the cards, not from its code.</li><li>Nothing changes for current customers in this round.</li></ul><h4>In scope</h4><ul><li>Tiers as data, overage on the invoice, the plan picker, metering per API key.</li></ul><h4>Out of scope</h4><ul><li>Grandfathering, alerts (#474), overage per API key on the invoice.</li></ul></div>
  <div class="docfoot"><button class="btn ghost xs" data-panel="Documents" data-doc="Document">${I("file")}Open in Documents</button><span>3,612 characters</span></div>`;
function convoTalk() {
  const e = [];
  e.push(EV("discussion", `Discussion started <span class="n">· Opus 5.5 (1M) · high · Platform Roadmap</span>`, "14:02"));
  e.push(EVX("file", `Context <span class="n">· #455, #461 and their epic · 5,690 characters</span>`, "14:02", "", CONTEXT));
  e.push(US(`<p>${esc(S.dstart.what)}</p>`, "14:02"));
  e.push(ACTS({ n: 14, roll: "Read 9 · Searched 5", dur: "1 min", earlier: 10, rows: [["Read the gateway's counter", "sed -n '1,120p' gateway/internal/meter/counter.go", "done", "0.1 s"], ["Find where the invoice is built", "rg -n \"func Build\" api/internal/invoice", "done", "0.2 s"], ["Read the plans schema", "cat api/internal/plans/schema.sql", "done", "0.1 s"], ["Look for a billing clone", "ls ~/code | rg billing", "done", "0.1 s"]] }));
  e.push(AG("agent", `<p>The gateway flushes one total per workspace every hour (<code>meter/counter.go</code>), and the invoice reads only <code>plans.monthly_price</code>. acme/billing isn't cloned, so what I say about it comes from #455.</p>`, "14:05"));
  e.push(QCARD({ answered: true, answeredAt: "14:07", place: "Agent", q: "Where should the overage be charged?", answer: "On the monthly invoice, as one line for the workspace" }));
  if (S.sessErr) {
    e.push(ACTS({ n: 2, roll: "Read 2", dur: "20 s", fail: 0, rows: [["Read the invoice builder", "sed -n '1,80p' api/internal/invoice/build.go", "done", "0.1 s"], ["Read the plans handler", "sed -n '1,60p' api/internal/plans/handler.go", "interrupted", ""]] }));
    e.push(ERR("Session error", "The session stopped unexpectedly. The conversation is kept; Retry opens it again where it stopped.", "claude exited with status 1 · claude --resume 9f2c…"));
    return e;
  }
  e.push(AG("agent", `<p>Clear. One more gap before I write anything.</p><p class="qtext">Should current customers move to the tiers in this round?</p><p>a) No. They stay on their flat plan; tiers are for new workspaces and for anyone who changes plan.<br>b) Yes, with 90 days on their current price before the overage starts.</p>`, "14:09"));
  return e;
}
function convoConfirm() {
  const many = SCN === "many";
  const e = [];
  e.push(US(`<p>a. grandfathering is another card, later</p>`, "14:21"));
  e.push(AG("agent", `<p>Here is what I understood: tiers with an included volume and an overage price per 1,000 requests, charged on the monthly invoice from per-key metering at the gateway; current customers stay on their plan for now.</p><p>${many ? "I'd write the document and ten drafts: an epic, <em>Pricing tiers with metered overage</em>, with five cards, updates of #461 and #474, and two loose cards (the status page and a support view). Shall I write them?" : "I'd write the document and five drafts: an epic, <em>Pricing tiers with metered overage</em>, with three new cards (the tier data, the invoice, the plan picker), and an update of #461 so it meters per API key. Shall I write them?"}</p>`, "14:23"));
  e.push(US(`<p>yes</p>`, "14:24"));
  e.push(ACTS({ n: 3, roll: "Wrote 2 · Read 1", dur: "2 min", rows: [["Write the document", "discussion.md", "done", ""], ["Write the drafts", "drafts.md", "done", ""], ["Check the drafts' format", "cat drafts.md", "done", "0.1 s"]] }));
  if (SCN === "unreadable") {
    e.push(AG("agent", `<p>Written. The document has the understanding; the drafts follow it.</p>`, "14:27"));
    e.push(EVX("filecheck", `Written discussion.md <span class="n">· the understanding</span>`, "14:27", "", DOCX));
    e.push(EV("alert", `drafts.md can't be read <span class="n">· line 41: Draft invoice-overage has no ### Title</span>`, "14:27"));
    return e;
  }
  e.push(AG("agent", `<p>Written. The document has the understanding; the ${many ? "ten" : "five"} drafts are below. The invoice card depends on the tier data and on #461, so it goes after both.</p>`, "14:27"));
  e.push(EVX("filecheck", `Written discussion.md <span class="n">· the understanding</span>`, "14:27", "", DOCX));
  return e;
}
function convoRevise() {
  const e = [];
  e.push(US(`<p>shorter titles, please. And the plan picker depends on the invoice card, not on the tier data.</p>`, "14:31"));
  e.push(ACTS({ n: 2, roll: "Wrote 1 · Read 1", dur: "40 s", rows: [["Read the drafts", "cat drafts.md", "done", "0.1 s"], ["Rewrite the drafts", "drafts.md", "done", ""]] }));
  e.push(AG("agent", `<p>Done. Three titles are shorter, and <em>Plan picker with tiers and overage</em> now depends on <em>Overage on the monthly invoice</em>. The epic and the update of #461 didn't change.</p>`, "14:32"));
  return e;
}
// The revision, said once in the conversation: one marker that opens the list as it was before, with what changed.
const OLD = { 2: "Tier limits and overage prices in the plans table", 3: "Charge metered overage on the monthly invoice", 4: "Plan picker shows the tiers and the overage price" };
function revisedMarker() {
  const was = { 1: "not changed · approved", 2: "title · your approval was cleared", 3: "title", 4: "title, and it depended on Tier limits…", 5: "not changed · Updated gateway#461" };
  return EVX("rewrite", `Drafts revised <span class="n">· round 1 · 3 changed</span>`, "14:32", "", `<div class="docbody full"><p class="rcap">Before the revision:</p>${roundList((d) => ({ g: OLD[d.n] ? I("rewrite") : st("todo"), title: OLD[d.n] || d.title, txt: was[d.n] }), ROUND1, [1, 2, 3, 4, 5])}</div>`);
}
function convo() {
  const e = convoTalk();
  if (SCN === "talk") return e;
  e.push(...convoConfirm());
  if (SCN === "unreadable") return e;
  if (SCN === "done") return [...e, ...convoRevise(), ...V.foldedRounds()];
  e.push(EV("cards", `Drafts written <span class="n">· round 1 · ${plural(DRAFTS.length, "draft")}</span>`, "14:27"));
  if (SCN === "drafts" || SCN === "many") { e.push(draftsCard()); if (S.log.length || V.failed()) e.push(V.roundMarker()); return e; }
  // The update of #461 was approved and published at 14:29, before the revision: the round's marker enters there.
  e.push(V.roundMarker());
  e.push(...convoRevise());
  e.push(revisedMarker());
  e.push(draftsCard());
  return e;
}

// ---------------- The composer ----------------
function composerD() {
  if (S.place !== "disc") return "";
  const s = V.situation();
  let ph = "Reply to the agent…", chip = "";
  if (s === "sesserr") ph = "Sending restarts the session…";
  else if (SCN === "talk") ph = "Answer a or b, or reply to the agent…";
  else if (s === "unreadable") { ph = "Ask the agent to fix drafts.md…"; chip = ["fix", "Ask to fix the drafts", "Starts the message: the agent rewrites drafts.md in the format MySpec reads"]; }
  else if (["archive", "archive3"].includes(s)) ph = "Ask for more cards, or reply to the agent…";
  else { ph = "Ask for changes: add, change or drop a draft…"; chip = ["changes", "Ask for changes", "Starts the message: the agent revises the drafts and keeps your decisions on the ones it doesn't change"]; }
  let h = COMPOSER({ ph, model: "Opus 5.5 · high", label: "Reply to the agent" });
  if (SCN === "talk" && !S.sessErr) h = h.replace('<div class="cbox">', `<div class="cbox"><div class="qr" role="group" aria-label="Quick replies">${[["a", "No. They stay on their flat plan…"], ["b", "Yes, with 90 days on their current price…"]].map(([k, t]) => `<button class="chip" data-tip="Sends “${k}”"><span class="kn">${k}</span>${t}</button>`).join("")}</div>`);
  // Changes go through the conversation (5 of 11 discussions did it), so the composer offers it.
  if (chip) h = h.replace('<div class="cbox">', `<div class="cbox"><div class="qr sug" role="group" aria-label="Suggestion"><button class="chip" data-act="ask-${chip[0]}" data-tip="${chip[2]}">${I("rewrite")}${chip[1]}</button></div>`);
  return h;
}

// ---------------- The panels ----------------
function panelD() {
  if (!S.panel) return "";
  let b = "";
  const rounds = SCN === "done" ? [["Round 1", "5 drafts · 4 created, 1 updated", "15:12"], ["Round 2", "1 draft · 1 created", "15:26"], ["Round 3", "1 draft · 1 created", "15:49"]]
    : [["Round 1", `${plural(DRAFTS.length, "draft")} · ${S.log.length} published · ${decided()} of ${DRAFTS.length} decided`, "14:27"]];
  if (S.panel === "Details") b = `<div class="pgrp"><h3>Discussion</h3><dl class="kv"><dt>Board</dt><dd><a href="#">Platform Roadmap</a> · acme · project 7</dd><dt>Cards</dt><dd><a href="#">#455</a> Usage-based pricing tiers<br><a href="#">#461</a> Metering events from the gateway</dd><dt>Read</dt><dd>acme/api, acme/gateway, acme/web, acme/docs</dd><dt>Not cloned</dt><dd>acme/billing · <button class="btn ghost xs">${I("clone")}Clone</button></dd><dt>Model</dt><dd>Opus 5.5 (1M) · high</dd><dt>Started</dt><dd>Today 14:02</dd></dl></div>
    <div class="pgrp"><h3>Rounds</h3><div class="pl-list">${["talk", "unreadable"].includes(SCN) ? `<div class="pl-row" aria-disabled="true"><span class="grow trunc">No drafts yet</span></div>` : rounds.map(([a, bb, c]) => `<div class="pl-row"><span class="c1">${I("cards")}</span><span class="grow trunc">${a} · ${bb}</span><span class="m">${c}</span></div>`).join("")}</div></div>
    <div class="pgrp"><h3>Documents</h3><div class="pl-list"><button class="pl-row" data-panel="Documents" data-doc="Context">${I("file")}<span class="grow trunc">Context</span><span class="m">14:02</span></button>${SCN === "talk" ? `<div class="pl-row" aria-disabled="true">${I("file")}<span class="grow trunc">Document · written with the drafts</span></div>` : `<button class="pl-row" data-panel="Documents" data-doc="Document">${I("file")}<span class="grow trunc">Document · discussion.md</span><span class="m">14:27</span></button>`}</div></div>`;
  else {
    const has = SCN !== "talk", tab = has ? S.docTab : "Context";
    b = `<div class="pgrp"><div class="pl-list"><button class="pl-row ${tab === "Context" ? "is-on" : ""}" data-doc="Context">${I("file")}<span class="grow trunc">Context</span><span class="m">14:02</span></button>${has ? `<button class="pl-row ${tab === "Document" ? "is-on" : ""}" data-doc="Document">${I("file")}<span class="grow trunc">Document</span><span class="m">14:27</span></button>` : `<div class="pl-row" aria-disabled="true">${I("file")}<span class="grow trunc">Document · written with the drafts</span></div>`}</div></div>
      <div class="prose pl-prose">${tab === "Context" ? CONTEXT.split('<div class="docfoot">')[0].replace('class="docbody full prose"', 'class=""') : DOCX.split('<div class="docfoot">')[0].replace('class="docbody prose"', 'class=""')}</div>`;
  }
  return `<aside class="panel" id="panel" aria-label="${S.panel}"><div class="panel-h"><h2>${S.panel}</h2><button class="btn ghost sm icon" data-panel="${S.panel}" aria-label="Close ${S.panel}" data-tip="Close · Esc">${I("x")}</button></div><div class="panel-b">${b}</div></aside>`;
}

// ---------------- The dialogs: start, archive, group, delete ----------------
const BOARDS_D = [["Internal Tools", "docs", "read yesterday"], ["Mobile App", "ios", "◇ read failed 18m ago · uses the last reading"], ["Platform Roadmap", "api, billing, docs, gateway, web", "read 2m ago · last used"]];
const CARDS_IN = { 455: ["Usage-based pricing tiers", "acme/billing"], 461: ["Metering events from the gateway", "acme/gateway"] };
function startDialog() {
  const Dd = S.dstart, n = Dd.title.length, ok = Dd.what.trim() || Dd.cards.length;
  const board = Dd.home
    ? `<div class="fld"><label class="lb" for="d-board">Board</label><button class="input select-trigger" id="d-board" data-act="dboard" aria-haspopup="listbox" aria-expanded="${Dd.boardMenu}" aria-controls="d-boards"><span class="v">Platform Roadmap</span>${I("down")}</button>
      ${Dd.boardMenu ? `<div class="menu dmenu" id="d-boards" role="listbox" aria-label="Boards">${BOARDS_D.map(([t, r, s]) => `<button class="mi" role="option" aria-selected="${t === "Platform Roadmap"}">${I("check", "i ck")}<span class="grow">${t}<span class="sub"> · ${r}</span></span><span class="sub">${s}</span></button>`).join("")}</div>` : ""}
      <span class="help">The discussion reads the clones of the board's repositories and publishes its cards there.</span></div>`
    : `<div class="cardsum bsum"><span class="num">${I("board")}</span><span class="t">Platform Roadmap</span><span class="s">acme · project 7 · api, billing, docs, gateway, web</span></div>`;
  const cards = Dd.cards.length ? `<div class="fld"><span class="lb">Cards <span class="opt-l">${Dd.cards.length}</span></span><ul class="cd-rel">${Dd.cards.map((x) => `<li class="rel dcrd"><span class="num">#${x}</span><span class="t">${CARDS_IN[x][0]}</span><span class="s">${CARDS_IN[x][1]}<button class="btn ghost xs icon" data-act="rm-card" data-c="${x}" aria-label="Remove #${x} from the discussion" data-tip="Remove from the discussion">${I("x")}</button></span></li>`).join("")}</ul></div>` : "";
  const ctxLine = Dd.refreshing ? `<span class="w"><span class="rd">Refreshing the cards…</span></span>`
    : Dd.refreshFail ? `<span class="w"><span class="st-gap">${st("warn")}</span>Couldn't refresh the cards: GitHub's rate limit was reached. The discussion will use the last reading.</span>`
    : `<span class="w"><b>From the cards:</b> ${Dd.cards.map((x) => `#${x}`).join(", ")}, the epic Usage-based billing, 4 cards of the epic and 1 dependency · 5,690 characters</span>`;
  const ctx = Dd.cards.length ? `<div class="ctxrow">${ctxLine}<button class="btn ghost xs" data-act="dctx" aria-expanded="${Dd.ctxOpen}" ${Dd.refreshing ? "disabled" : ""}>${Dd.ctxOpen ? "Hide" : "Show"}</button></div>${Dd.ctxOpen ? `<div class="ctxprev prose">${CONTEXT.split('<div class="docfoot">')[0].replace('class="docbody full prose"', 'class=""')}</div>` : ""}` : "";
  const why = ok ? (Dd.title.trim() ? "" : "Name the discussion to start it.") : "Write what to discuss or select at least one card.";
  const go = Dd.starting ? `<button class="btn primary is-loading" aria-busy="true"><span class="spin"></span>Starting…</button>` : `<button class="btn primary" data-act="start-disc" ${why ? 'disabled aria-describedby="why-disc"' : ""}>Start discussion <span class="k">Ctrl ↵</span></button>`;
  return `<div class="scrim" id="scrim"><div class="dlg wide" role="dialog" aria-modal="true" aria-labelledby="dlg-t">
    <div class="dlg-hd"><h2 id="dlg-t">New discussion</h2><button class="btn ghost sm icon x" data-act="dlg-close" aria-label="Close" data-tip="Close · Esc">${I("x")}</button></div>
    <div class="dlg-bd">${board}
      <div class="fld"><label class="lb" for="d-title">Title</label><span class="input"><input id="d-title" value="${esc(Dd.title)}" aria-describedby="d-title-h"></span><span class="help" id="d-title-h" ${n >= 100 ? "" : "hidden"}>${n} of 120</span></div>
      <div class="fld"><label class="lb" for="d-what">What to discuss <span class="opt-l">${Dd.cards.length ? "optional with cards" : "or pick cards on the board"}</span></label><textarea class="textarea" id="d-what" rows="3">${esc(Dd.what)}</textarea></div>
      ${cards}${ctx}
      <div class="ctxrow"><span class="w"><span class="st-gap">${st("warn")}</span>acme/billing isn't cloned. The conversation reads the code of the cloned repositories only.</span><button class="btn ghost xs">${I("clone")}Clone</button></div>
      <div class="mdl"><div class="mdl-sum" role="group" aria-label="Model"><span class="l">Model</span><button class="chip" aria-haspopup="listbox" aria-describedby="m-d">Opus 5.5 (1M) · high${I("down")}</button><span class="v" id="m-d">From Defaults</span></div></div></div>
    <div class="dlg-ft"><span class="why ${Dd.err ? "err" : ""}" id="why-disc">${Dd.err || (Dd.starting ? "Starting the conversation…" : why)}</span><button class="btn ghost" data-act="dlg-close" ${Dd.starting ? "disabled" : ""}>Cancel</button>${go}</div></div></div>`;
}
function publishedCount() { return SCN === "done" ? "7 issues in 3 rounds: 6 created, 1 updated" : `${S.log.length} in round 1`; }
function archiveDialog() {
  const left = DRAFTS.filter((d) => S.pub[d.n] !== "done");
  return `<div class="scrim" id="scrim"><div class="dlg agd" role="dialog" aria-modal="true" aria-labelledby="dlg-t">
    <div class="dlg-hd"><h2 id="dlg-t">Archive “${DISC.title}”?</h2><button class="btn ghost sm icon x" data-act="dlg-close" aria-label="Close" data-tip="Close · Esc">${I("x")}</button></div>
    <div class="dlg-bd"><p class="dp">The conversation ends. The document, the drafts and what was published stay in History.</p>
      <div class="ctxrow"><span class="w"><b>Published:</b> ${publishedCount()}${left.length && SCN !== "done" ? ` · <b>Not published:</b> ${left.map((d) => nameOf(d)).join(", ")}` : ""}</span></div>
      <p class="dp faint">A task started from one of these cards gets the document in its context, also after the archive.</p></div>
    <div class="dlg-ft"><button class="btn ghost" data-act="dlg-close">Cancel</button><button class="btn primary" data-act="archive-go">Archive <span class="k">Ctrl ↵</span></button></div></div></div>`;
}
function deleteDialog() {
  return `<div class="scrim" id="scrim"><div class="dlg agd" role="dialog" aria-modal="true" aria-labelledby="dlg-t">
    <div class="dlg-hd"><h2 id="dlg-t">Delete “${DISC.title}”?</h2><button class="btn ghost sm icon x" data-act="dlg-close" aria-label="Close" data-tip="Close · Esc">${I("x")}</button></div>
    <div class="dlg-bd"><p class="dp">The conversation, the document and the drafts go away, and the discussion doesn't go to History. What was published on GitHub stays${S.log.length ? `: ${plural(S.log.length, "issue")} of round 1` : ""}.</p>
      <p class="dp faint">A task started from one of its cards loses the document in its context.</p></div>
    <div class="dlg-ft"><button class="btn ghost" data-act="dlg-close">Cancel</button><button class="btn danger" data-act="delete-go">Delete discussion</button></div></div></div>`;
}
function groupDialog(list = looseOpen()) {
  return `<div class="scrim" id="scrim"><div class="dlg agd" role="dialog" aria-modal="true" aria-labelledby="dlg-t">
    <div class="dlg-hd"><h2 id="dlg-t">Group drafts into an epic</h2><button class="btn ghost sm icon x" data-act="dlg-close" aria-label="Close" data-tip="Close · Esc">${I("x")}</button></div>
    <div class="dlg-bd"><div class="fld"><label class="lb" for="g-t">Title of the epic</label><span class="input"><input id="g-t" value="" placeholder="What the cards deliver together"></span></div>
      <div class="fld"><span class="lb" id="g-l">Drafts <span class="opt-l">two or more, loose and not published</span></span><div class="glist" role="group" aria-labelledby="g-l">${list.map((d, k) => `<label class="cbl" for="g-${d.n}"><input type="checkbox" class="sr" id="g-${d.n}" ${k < 2 ? "checked" : ""}><span class="cb ${k < 2 ? "on" : ""}" aria-hidden="true">${I("check")}</span><span class="grow">${d.title}</span><span class="sub">${repoOf(d.repo)}</span></label>`).join("")}</div></div>
      <div class="fld"><span class="lb" id="g-r">Repository of the epic</span><button class="input select-trigger" aria-labelledby="g-r" aria-haspopup="listbox"><span class="v">acme/web</span>${I("down")}</button></div></div>
    <div class="dlg-ft"><span class="why" id="why-g">Name the epic to group the drafts.</span><button class="btn ghost" data-act="dlg-close">Cancel</button><button class="btn primary" disabled aria-describedby="why-g">Group 2 drafts</button></div></div></div>`;
}
// ---------------- The places behind the start dialog: the board, or Home ----------------
function boardBehind() {
  const cb = (on) => `<span class="lead"><span class="cb ${on ? "on" : ""}" aria-hidden="true">${I("check")}</span></span>`;
  const row = (n, t, epic, task, on) => `<div class="cr has2" role="treeitem" aria-level="2" tabindex="-1" aria-checked="${on}" aria-label="#${n} ${t}">${cb(on)}<span class="num">#${n}</span><span class="tl">${t}</span><span class="meta"><span class="col epc"><span class="t">${epic}</span></span><span class="col dep"></span>${task}</span><span class="keys" aria-hidden="true"></span></div>`;
  const none = `<span class="col tsk"></span>`;
  const sec = (name, n) => `<div class="sech" role="treeitem" aria-level="1" aria-expanded="true" tabindex="-1">${I("down", "i chev")}<span class="nm">${name}<span class="cnt">${n}</span></span><span></span></div>`;
  return `<main class="main" id="main"><header class="ih1 bh">${navBtnsD("Rate limit per API key")}<h1 class="ih-title"><span class="trunc">Platform Roadmap</span></h1><span class="grow"></span>
    <div class="ih-tools"><span class="rs">Read 2m ago</span><button class="btn ghost sm icon" aria-label="Read the board again">${I("refresh")}</button><span class="sep"></span><button class="btn sm">${I("discussion")}New discussion <span class="k">N</span></button><button class="btn ghost sm icon" aria-label="More actions">${I("more")}</button></div></header>
    <div class="bbody bgb"><div class="lstw"><div class="lst-in"><div class="fbar" role="toolbar" aria-label="Selected cards"><div class="selbar"><span class="n">2 selected</span><span class="which trunc">#455 #461</span><button class="btn primary sm">Discuss 2 cards <span class="k">D</span></button><button class="btn ghost sm">Cancel</button></div></div>
    <div class="lst" role="tree" aria-label="Cards of Platform Roadmap" aria-multiselectable="true">${sec("Backlog", 5)}<div class="grpb" role="group">
      ${row(455, "Usage-based pricing tiers", "Usage-based billing", none, true)}${row(461, "Metering events from the gateway", "Usage-based billing", none, true)}${row(463, "Export the audit log as CSV", "", none, false)}${row(468, "SSO with Okta for enterprise workspaces", "", none, false)}${row(470, "Webhook signing secrets per endpoint", "API hardening", none, false)}</div>
      ${sec("Ready", 3)}<div class="grpb" role="group">${row(471, "Invoice PDF with line items per API key", "Usage-based billing", none, false)}${row(474, "Usage alerts at 80% of the plan", "Usage-based billing", none, false)}${row(412, "Rate limit per API key", "API hardening", `<span class="col tsk wait">${st("wait")}<span class="t">Question · Step 3/7</span></span>`, false)}</div></div></div></div></div>
    ${startDialog()}</main>`;
}
function homeBehind() {
  return `<main class="main" id="main"><header class="ih1 bh">${navBtnsD("Rate limit per API key")}<h1 class="ih-title"><span class="trunc">Home</span></h1><span class="grow"></span></header>
  <div class="homew"><div class="home"><section aria-labelledby="h-start"><h2 id="h-start">Start</h2><ul class="hl">
      <li><button class="hr">${I("plus")}<span class="tx"><span class="l">New task</span><span class="s">From scratch. A card starts its task on its board.</span></span><span class="r"><kbd>Ctrl N</kbd></span></button></li>
      <li><button class="hr">${I("discussion")}<span class="tx"><span class="l">New discussion</span><span class="s">About the demand of one board</span></span><span class="r"></span></button></li></ul></section></div></div>
    ${startDialog()}</main>`;
}

// ---------------- The discussion that left while open ----------------
function goneMain() {
  const res = SCN === "done" ? [["Round 1", "4 created, 1 updated · billing#478 and its 3 cards, gateway#461", "15:12"], ["Round 2", "1 created · web#2305", "15:26"], ["Round 3", "1 created · billing#483", "15:49"]]
    : [["Round 1", `${plural(S.log.length, "issue")} published`, S.log.length ? "15:12" : "—"]];
  const del = S.deleted;
  return `<main class="main" id="main"><header class="ih1 bh">${navBtnsD(DISC.board)}<h1 class="ih-title"><span class="trunc">${DISC.title}</span></h1><span class="grow"></span></header>
  <div class="leftw"><div class="left" role="status"><div class="hd"><span class="ic">${I(del ? "x" : "archive")}</span><h2>${DISC.title} was ${del ? "deleted" : "archived"}</h2>
    <p>${del ? "The conversation, the document and the drafts are gone. What was published on GitHub stays." : `The conversation ended at ${SCN === "done" ? "15:53" : "15:15"}. The document, the drafts and what was published are in History; a task started from these cards gets the document in its context.`}</p></div>
    <div class="res" aria-label="What was published"><ul>${res.map(([a, bb, c]) => `<li><span class="p">${a}</span><span>${bb}</span><span class="t">${c}</span></li>`).join("")}</ul></div>
    <div class="acts2"><button class="btn primary" id="gone-next" data-tip="Widget for today's tasks · Ctrl+J">Next that needs you <span class="k">Ctrl J</span></button><button class="btn" data-act="go-board">Open ${DISC.board}</button>${del ? "" : `<button class="btn ghost">Open in History</button>`}</div></div></div></main>`;
}

// ---------------- Render ----------------
function discMain() {
  const ask = V.bar(), comp = composerD();
  return `<main class="main m" id="main">${headerD(!!ask)}<div class="body" id="body"><div class="colconvo">
    <div class="convo-wrap"><div class="convo" id="convo" tabindex="-1" aria-label="The discussion's conversation"><div class="convo-in"><div class="stream">${convo().join("")}</div></div></div></div>
    ${ask ? `<div class="ask">${ask}</div>` : ""}${comp ? `<div class="composer"><div class="composer-in">${comp}</div></div>` : `<div class="composer-end"></div>`}</div>${panelD()}</div>
    ${S.menu === "more" ? moreMenu() : ""}${S.dialog === "archive" ? archiveDialog() : S.dialog === "group" ? groupDialog() : S.dialog === "delete" ? deleteDialog() : ""}</main>`;
}
function toast(text, sub) {
  const box = document.querySelector(".toasts"); if (!box) return;
  const t = document.createElement("div"); t.className = "toast"; t.innerHTML = `<span class="tx"><span>${text}</span>${sub ? `<span class="sub">${sub}</span>` : ""}</span>`;
  box.appendChild(t); setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 200); }, 3200);
}
function layout() {
  const m = document.getElementById("main");
  const rp = document.querySelector(".m .panel");
  if (rp && m) { const w = m.getBoundingClientRect().width, pw = Math.min(480, Math.max(360, Math.round(w * 0.28))); rp.classList.toggle("over", w - pw < 760); }
  placeMenu();
}
function fitHeader() {}
function render(focusSel) {
  const cv0 = document.getElementById("convo"), atEnd = !cv0 || cv0.scrollHeight - cv0.scrollTop - cv0.clientHeight < 40, keepC = cv0 ? cv0.scrollTop : 0;
  OPENID = S.place === "disc" ? "d1" : null;
  const main = S.place === "board" ? boardBehind() : S.place === "home" ? homeBehind() : S.place === "gone" ? goneMain() : discMain();
  document.getElementById("app").innerHTML = sidebarD() + main + mockbar(SCENE_LIST, SCN);
  const tree = document.getElementById("tree"); if (tree) tree.addEventListener("scroll", moreBelow);
  const cv = document.getElementById("convo"); if (cv) cv.scrollTop = atEnd || !cv0 ? cv.scrollHeight : keepC;
  layout(); markTruncated();
  requestAnimationFrame(() => { layout(); moreBelow(); markTruncated(); });
  if (focusSel) { const f = document.querySelector(focusSel); if (f) { f.focus({ preventScroll: true }); if (f.scrollIntoView) f.scrollIntoView({ block: "nearest" }); } }
}
function focusDialog() { const f = document.querySelector('.dlg [data-act="dlg-close"]:not(.x)') || document.querySelector(".dlg button"); if (f) f.focus(); }
// A and D decide the draft in focus and move on to the next one to decide; E edits; Enter shows the body.
function decide(n, d) {
  if (S.pub[n]) return [];
  const chain = d !== S.dec[n] ? V.chain(n, d) : [];
  S.dec[n] = S.dec[n] === d ? null : d; if (!S.dec[n]) delete S.dec[n];
  delete S.revised[n];
  if (V.afterDecide) V.afterDecide(n);
  return chain;
}
// A gesture that publishes keeps the focus on its draft, so its effect is seen and a repeated key can't publish the next one.
// A gesture that publishes nothing moves on to the next one to decide, and the keys wait a moment before they act there.
const LOCK_MS = 900;
function act2decide(n, d) {
  const was = S.dec[n], chain = decide(n, d);
  if (chain.length || !S.dec[n] || was) { S.cur = n; render(`#drf-${n}`); return; }
  S.lock = Date.now() + LOCK_MS; goNext(n);
}
function goNext(from, center = true) {
  const nx = nextOpen(from); if (!nx) return render(`#drf-${S.cur}`);
  S.cur = nx; render(`#drf-${nx}`); const el = document.getElementById(`drf-${nx}`); if (el && center) el.scrollIntoView({ block: "center" });
}

document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-act]"), act = a && a.dataset.act;
  if (S.menu === "more" && !e.target.closest("#more-menu") && !e.target.closest("#more-btn")) { S.menu = null; render(); if (!act) return; }
  if (e.target.closest("#more-btn")) { S.menu = S.menu === "more" ? null : "more"; render(); if (S.menu) { const f = document.querySelector("#more-menu .mi"); if (f) f.focus(); } return; }
  const dd = e.target.closest("[data-dec]");
  if (dd && !dd.disabled) { e.preventDefault(); if (Date.now() < S.lock) return; act2decide(+dd.dataset.n, dd.dataset.dec); return; }
  const go = e.target.closest("[data-goto]");
  if (go) { e.preventDefault(); const n = +go.dataset.goto; S.cur = n; render(`#drf-${n}`); document.getElementById(`drf-${n}`).scrollIntoView({ block: "center" }); return; }
  const fold = e.target.closest(".drf.is-folded");
  if (fold && !e.target.closest("button, a")) { S.cur = +fold.dataset.dnum; render(`#drf-${S.cur}`); document.getElementById(`drf-${S.cur}`).scrollIntoView({ block: "nearest" }); return; }
  const doc = e.target.closest("[data-doc]");
  if (doc) { S.docTab = doc.dataset.doc; if (!doc.dataset.panel) { render(); return; } }
  if (!act) return;
  e.preventDefault();
  switch (act) {
    case "view": { const n = +a.dataset.n; S.diff[n] = a.dataset.v === "diff"; S.cur = n; return render(`[data-act="view"][data-n="${n}"][data-v="${a.dataset.v}"]`); }
    case "edit": { const n = +a.dataset.n; S.edit = n; S.cur = n; render(); const t = document.getElementById(`de-t-${n}`); if (t) t.focus(); return; }
    case "edit-done": { const n = +a.dataset.n; S.edit = null; S.depPick = false; return render(`#drf-${n}`); }
    case "dep-add": S.depPick = !S.depPick; return render('[data-act="dep-add"]');
    case "next": { const nx = nextOpen(S.cur); if (nx) { S.cur = nx; render(`#drf-${nx}`); document.getElementById(`drf-${nx}`).scrollIntoView({ block: "center" }); } return; }
    case "ask-changes": { const r = document.getElementById("reply"); if (r) { r.value = "Change the drafts: "; r.focus(); } return; }
    case "dlg-close": S.dialog = null; return render();
    case "archive": S.menu = null; S.dialog = "archive"; render(); focusDialog(); return;
    case "archive-go": S.dialog = null; S.place = "gone"; render(); document.getElementById("gone-next").focus(); return;
    case "delete": S.menu = null; S.dialog = "delete"; render(); focusDialog(); return;
    case "delete-go": S.dialog = null; S.place = "gone"; S.deleted = true; render(); document.getElementById("gone-next").focus(); return;
    case "ask-fix": { const r = document.getElementById("reply"); if (r) { r.value = "drafts.md can't be read: "; r.focus(); } return; }
    case "group": S.menu = null; S.dialog = "group"; render(); focusDialog(); return;
    case "go-board": return;
    case "dboard": S.dstart.boardMenu = !S.dstart.boardMenu; return render("#d-board");
    case "dctx": S.dstart.ctxOpen = !S.dstart.ctxOpen; return render('[data-act="dctx"]');
    case "rm-card": S.dstart.cards = S.dstart.cards.filter((x) => x !== +a.dataset.c); return render("#d-what");
    case "start-disc": S.dstart.starting = true; render(); setTimeout(() => { location.search = "?scene=talk"; }, 1400); return;
    default: if (V.onAct) V.onAct(act, a);
  }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "d-title") S.dstart.title = e.target.value;
  if (e.target.id === "d-what") S.dstart.what = e.target.value;
});
document.addEventListener("focusin", (e) => { const f = e.target.closest && e.target.closest("[data-dnum]"); if (f) S.cur = +f.dataset.dnum; });
document.addEventListener("keydown", (e) => {
  const inField = e.target.closest && e.target.closest("input, textarea, select");
  if (S.dialog || (S.place !== "disc" && document.querySelector(".dlg"))) {
    if (e.key === "Escape") { e.preventDefault(); if (S.place === "disc") { S.dialog = null; render(); } return; }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { const b = document.querySelector('.dlg .btn.primary:not(:disabled)'); if (b) b.click(); return; }
    if (e.key === "Tab") { const f = [...document.querySelectorAll(".dlg button:not(:disabled), .dlg input, .dlg textarea, .dlg a[href]")].filter((x) => x.offsetParent); const k = f.indexOf(document.activeElement); if (e.shiftKey && k <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && k === f.length - 1) { e.preventDefault(); f[0].focus(); } }
    return;
  }
  if (S.menu) {
    if (e.key === "Escape") { S.menu = null; render(); document.getElementById("more-btn").focus(); return; }
    const mi = e.target.closest && e.target.closest("#more-menu .mi");
    if (mi && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); const all = [...mi.parentElement.querySelectorAll(".mi")]; const k = all.indexOf(mi); all[(k + (e.key === "ArrowDown" ? 1 : all.length - 1)) % all.length].focus(); }
    return;
  }
  if (e.key === "Escape" && S.edit) { const n = S.edit; S.edit = null; S.depPick = false; render(`#drf-${n}`); return; }
  if (inField) return;
  if (e.key === "Escape" && S.panel) { S.panel = null; render(); return; }
  if (V.onKey && V.onKey(e)) return;
  if (e.altKey && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
    e.preventDefault(); const o = DRAFTS.filter((d) => !S.dec[d.n]); if (!o.length) return;
    const nx = e.key === "ArrowDown" ? (o.find((d) => d.n > S.cur) || o[0]).n : ([...o].reverse().find((d) => d.n < S.cur) || o[o.length - 1]).n;
    S.cur = nx; render(`#drf-${nx}`); document.getElementById(`drf-${nx}`).scrollIntoView({ block: "center" }); return;
  }
  const f = e.target.closest && e.target.closest(".drf[data-dnum]"); if (!f || e.target !== f) return;
  const n = +f.dataset.dnum;
  if ((e.key === "a" || e.key === "d") && !e.ctrlKey && !S.pub[n]) { e.preventDefault(); if (e.repeat || Date.now() < S.lock) return; const b = f.querySelector(e.key === "a" ? ".dda" : ".ddd"); if (b && !b.disabled) b.click(); return; }
  if (e.key === "e" && !e.ctrlKey) { e.preventDefault(); f.querySelector('[data-act="edit"]')?.click(); return; }
  if (e.key === "Enter") { e.preventDefault(); S.cur = n; render(`#drf-${n}`); return; }
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault(); const all = [...document.querySelectorAll(".drf[data-dnum]")]; const k = all.indexOf(f); const to = all[k + (e.key === "ArrowDown" ? 1 : -1)];
    if (to) { S.cur = +to.dataset.dnum; render(`#drf-${S.cur}`); document.getElementById(`drf-${S.cur}`).scrollIntoView({ block: "nearest" }); }
  }
});

// ---------------- ?audit: round 10's, with this round's geometry ----------------
function auditD() {
  audit();
  const pre = document.getElementById("report"), out = JSON.parse(pre.textContent);
  const frac = (v) => Math.abs(v - Math.round(v)) > 0.01; const bad = []; let n = 0;
  [".drf", ".dcard", ".dkids", ".dgrp", ".rlist", ".dlg", ".left", ".ask-in", ".cbox", ".panel", ".cr", ".fr1", ".fr2"].forEach((sel) => document.querySelectorAll(sel).forEach((el) => {
    const r = el.getBoundingClientRect(); if (!r.width && !r.height) return; n++;
    const f = ["left", "top", "width", "height"].filter((k) => frac(r[k])); if (f.length) bad.push(`${sel} ${f.map((k) => `${k}=${r[k].toFixed(2)}`).join(" ")}`);
  }));
  const cut = [...document.querySelectorAll(".rlist .tt, .dti, .cr .tl, .fr2, .select-trigger .v")].filter((el) => el.offsetParent && el.scrollWidth > el.clientWidth + 0.5 && !el.dataset.tip).map((el) => el.textContent.trim().slice(0, 40));
  Object.assign(out, { scene: SCN, variation: V.key, roundGeometryChecked: n, roundGeometryFractional: bad, roundCutWithoutTooltip: cut });
  pre.textContent = JSON.stringify(out, null, 1);
}
function markRows() {
  document.querySelectorAll(".rlist .tt, .cr .tl, .fr2, .fr1 .dti, .select-trigger .v").forEach((el) => { if (el.scrollWidth > el.clientWidth + 0.5) el.dataset.tip = el.textContent.trim(); });
}
const _markTruncated = markTruncated;
markTruncated = function (root) { _markTruncated(root); markRows(); };
function bootD() {
  if (window.SPECIMEN) return;
  document.body.insertAdjacentHTML("beforeend", `<div id="app" class="app ${V.key}"></div><div class="toasts" role="status" aria-live="polite" aria-label="Notifications"></div><pre id="report" class="report" hidden></pre>`);
  bootCommon(() => render());
  document.body.insertAdjacentHTML("afterbegin", SPRITE_D);
  addEventListener("resize", layout);
  if (V.init) V.init();
  if (Q.has("archive") && ["done", "published"].includes(SCN)) S.dialog = "archive";
  if (Q.has("group") && looseOpen().length >= 2) S.dialog = "group";
  if (Q.has("delete") && S.place === "disc") S.dialog = "delete";
  render();
  if (S.dialog || S.place !== "disc" && S.place !== "gone") focusDialog();
  else if (S.menu) { const f = document.querySelector("#more-menu .mi"); if (f) f.focus(); }
  else { const f = document.getElementById(`drf-${S.cur}`); if (f && ["drafts", "rewrite", "epic", "epic-off", "many", "publish"].includes(SCN)) { f.focus({ preventScroll: true }); f.scrollIntoView({ block: "center" }); } }
  if (V.afterBoot) V.afterBoot();
  if (document.fonts) document.fonts.ready.then(() => { layout(); markTruncated(); });
  if (Q.has("audit")) setTimeout(auditD, 1400);
}
document.addEventListener("DOMContentLoaded", () => bootD());
