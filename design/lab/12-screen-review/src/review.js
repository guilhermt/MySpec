/* =====================================================================
   ROUND 12 · the review center and the screen of a review, shared by a
   and b. The shell of round 10 (core.js: the tree, the atoms of the
   conversation, the ask bar, the composer, tooltips, audit) and the list
   pattern of round 11 (board.css: the row, the section, the panel).
   Each variation gives V:
     V.key; V.after() (what follows the report in the conversation);
     V.column() (a column beside the conversation, or ""); V.bar() (the ask
     bar while the pass is decided); V.publishDialog() (b only);
     V.onKey(e) (the keys of its findings).
   ?scene= · ?theme= · ?open=<ref>|none · ?panel=Details|Reports · ?own
   ?menu · ?audit · ?clean
   ===================================================================== */
const SPRITE_R = `<svg class="sprite" aria-hidden="true">
  <symbol id="i-refresh" viewBox="0 0 16 16"><path d="M13 8a5 5 0 1 1-1.5-3.6"/><path d="M13 3v3h-3"/></symbol>
  <symbol id="i-filter" viewBox="0 0 16 16"><path d="M2.5 4h11M4.5 8h7M6.5 12h3"/></symbol>
  <symbol id="i-info" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.5"/><path d="M8 7.3v3.4M8 5.3h.01"/></symbol>
  <symbol id="i-chat" viewBox="0 0 16 16"><path d="M3 4.4A1.4 1.4 0 0 1 4.4 3h7.2A1.4 1.4 0 0 1 13 4.4v5.2A1.4 1.4 0 0 1 11.6 11H7.2L4.2 13.3V11A1.4 1.4 0 0 1 3 9.6z"/></symbol>
  <symbol id="i-cardp" viewBox="0 0 16 16"><rect x="2.5" y="3.5" width="11" height="9" rx="1.5"/><path d="M5 6.5h6M5 9.5h3.5"/></symbol>
</svg>`;

const SCENE_LIST = [["list", "Reviews · the list"], ["list-empty", "Reviews · nothing open"], ["list-failed", "Reviews · a reading failed"], ["start", "Start a review"],
  ["checks", "Review · waiting for checks"], ["pass", "Review · the pass runs"], ["findings", "Review · findings to decide"], ["publish", "Review · publish"], ["clean", "Review · a clean pass"],
  ["again", "Review · new commits"], ["merged", "Review · ended by the merge"]];
const SCN = SCENE_LIST.some(([k]) => k === Q.get("scene")) ? Q.get("scene") : "findings";
const LISTY = ["list", "list-empty", "list-failed", "start"].includes(SCN);
const CLEAN = SCN === "clean";
// Flags of the review scenes: your own pull request (Comment only), the Apply mode, commits after the pass, a failed reading.
const OWN = Q.has("own") && !LISTY, APPLY = Q.has("apply") && !LISTY, STALE = Q.has("stale"), CHECKERR = Q.has("checkerr");
const DECIDING = ["findings", "publish", "clean"];

// ---------------- The pull requests: the nine open ones of the twelve repositories ----------------
const ME = "gmartins";
const PRS = [
  { ref: "web#2291", repo: "web", n: 2291, t: "Migrate settings page to react-hook-form", by: "rsouza", sec: "review", review: "r1", age: "12m", ageL: "12 minutes ago",
    checks: { s: "pass", n: 6, of: 6 }, head: "settings-rhf", card: [437, "Settings forms on react-hook-form", "In progress"], size: "+612 −540 · 18 files · 7 commits", opened: "Yesterday 16:40" },
  { ref: "ios#312", repo: "ios", n: 312, t: "Crash on share sheet when offline", by: "tchen", sec: "review", review: "r2", age: "3h", ageL: "3 hours ago",
    checks: { s: "pass", n: 4, of: 4 }, head: "share-offline", size: "+38 −6 · 3 files · 2 commits", opened: "Monday 10:12" },
  { ref: "gateway#88", repo: "gateway", n: 88, t: "Stream request bodies over 1 MB", by: "apatel", sec: "pending", why: "new", newc: 3, age: "25m", ageL: "25 minutes ago",
    checks: { s: "fail", n: 3, of: 4, failed: ["e2e / large-upload"] }, head: "stream-bodies", card: [466, "Uploads over 1 MB time out at the gateway", "Code review"], size: "+288 −71 · 9 files · 11 commits", opened: "Tuesday 09:30", reviewed: "You requested changes on Tuesday" },
  { ref: "api#1302", repo: "api", n: 1302, t: "Idempotency keys for payment retries", by: "lnakamura", sec: "pending", why: "never", age: "2h", ageL: "2 hours ago",
    checks: { s: "run", n: 3, of: 5 }, head: "idempotency-keys", card: [452, "Retries must not charge twice", "Code review"], size: "+412 −88 · 14 files · 6 commits", opened: "Today 11:05" },
  { ref: "api#1298", repo: "api", n: 1298, t: "Bump golang.org/x/net from 0.29.0 to 0.33.0", by: "dependabot", labels: ["dependabot"], sec: "pending", why: "never", age: "5h", ageL: "5 hours ago",
    checks: { s: "pass", n: 5, of: 5 }, head: "dependabot/go_modules/golang.org/x/net-0.33.0", size: "+3 −3 · 2 files · 1 commit", opened: "Today 08:14" },
  { ref: "web#2296", repo: "web", n: 2296, t: "Empty state for the audit log", by: "rsouza", draft: true, sec: "pending", why: "never", age: "1d", ageL: "1 day ago",
    checks: { s: "pass", n: 6, of: 6 }, head: "audit-empty", size: "+140 −12 · 5 files · 3 commits", opened: "Yesterday 18:02" },
  { ref: "docs#140", repo: "docs", n: 140, t: "Rate limit tables per plan", by: "lnakamura", sec: "reviewed", age: "4h", ageL: "4 hours ago",
    checks: { s: "pass", n: 2, of: 2 }, head: "rate-limit-docs", size: "+96 −4 · 2 files · 1 commit", opened: "Yesterday 14:20", reviewed: "You approved it today at 10:02" },
  { ref: "api#1284", repo: "api", n: 1284, t: "Rate limit requests per API key", by: ME, sec: "mine", task: "t1", age: "40m", ageL: "40 minutes ago",
    checks: { s: "pass", n: 5, of: 5 }, head: "rate-limit-per-api-key", card: [412, "Rate limit per API key", "In progress"], size: "+1,204 −96 · 31 files · 9 commits", opened: "Today 17:32" },
  { ref: "web#2288", repo: "web", n: 2288, t: "Keyboard shortcuts sheet", by: ME, own: true, sec: "mine", age: "2d", ageL: "2 days ago",
    checks: { s: "pass", n: 6, of: 6 }, head: "shortcuts-sheet", size: "+220 −18 · 6 files · 4 commits", opened: "Monday 15:44" },
];
const PR = Object.fromEntries(PRS.map((p) => [p.ref, p]));
const BOARD_OF = { api: "Platform Roadmap", web: "Platform Roadmap", gateway: "Platform Roadmap", docs: "Platform Roadmap", ios: "Mobile App" };
const SECS = [["pending", "Pending"], ["review", "In review"], ["reviewed", "Reviewed"], ["mine", "Yours and your tasks"]];
const SEC_TIP = { review: "Pull requests with a review in MySpec", pending: "Never reviewed by you, or with commits after your last review", reviewed: "Reviewed by you, with nothing new since", mine: "Yours and the pull requests of your tasks: never pending" };

// ---------------- The findings of pass 1 of web#2291 ----------------
const FIND = CLEAN ? [] : [
  { n: 1, title: "The time zone field is no longer required", loc: "web/src/settings/GeneralForm.tsx:84", short: "GeneralForm.tsx:84",
    text: `The old form rejected an empty time zone on blur. The new schema declares <code>timezone</code> as <code>z.string()</code> without <code>.min(1)</code>, and the API answers 422 for an empty value (<code>internal/settings/handler.go:57</code>), so the user sees a generic error only after submitting. Add <code>.min(1, "Choose a time zone")</code>.`,
    diff: [[82, " ", "const schema = z.object({"], [83, " ", '  name: z.string().min(1, "Name the workspace"),'], [84, "+", "  timezone: z.string(),", 1], [85, " ", "  locale: z.enum(LOCALES),"], [86, " ", '  weekStart: z.enum(["monday", "sunday"]),']] },
  { n: 2, title: "Settings asks about unsaved changes as soon as it opens", loc: "web/src/settings/useSettingsForm.ts:31", short: "useSettingsForm.ts:31",
    text: `<code>reset(defaults)</code> runs in an effect after the first render, so <code>isDirty</code> is true for one render and the router guard registers. Opening Settings and leaving at once asks “Discard unsaved changes?”. Pass <code>values: defaults</code> to <code>useForm</code> and drop the effect.`,
    diff: [[28, " ", "  const form = useForm<Settings>({ resolver: zodResolver(schema) });"], [29, " ", ""], [30, " ", "  useEffect(() => {"], [31, "+", "    form.reset(defaults);", 1], [32, " ", "  }, [defaults]);"]] },
  { n: 3, title: "An end-to-end test still looks for the old field ids", loc: null, short: "General",
    text: `<code>e2e/settings.spec.ts</code> queries <code>#settings-name</code> and <code>#settings-tz</code>, which this pull request renames. The e2e job passes only because the spec is on the <code>testIgnore</code> list of <code>playwright.config.ts</code>. Update the selectors and take the spec off the list.` },
];
const SUMMARY = CLEAN ? "The move to react-hook-form keeps every field, the validation the old page did on blur and the submit flow. The six checks pass and the branch merges clean into dev. Nothing to change." : "The move to react-hook-form keeps every field and the submit flow, and the six checks pass. Two things to fix before merging: the time zone lost its required rule, and Settings asks about unsaved changes as soon as it opens. The e2e selectors are out of date too, but the spec is skipped, so that can wait.";

// ---------------- The state of the scene ----------------
const S = {
  place: LISTY ? "list" : SCN === "merged" ? "gone" : "review",
  open: SCN === "list" ? (Q.get("open") === "none" ? null : (PR[Q.get("open")] ? Q.get("open") : "api#1302")) : SCN === "start" ? null : null,
  none: SCN === "list-empty", failed: SCN === "list-failed", reading: false, readAgo: "2m",
  f: { board: null, repo: null, author: {}, label: {} }, fold: {}, menu: Q.has("menu") ? "more" : null,
  dialog: SCN === "start" ? "start" : null,
  dstart: { pr: Q.has("own") ? "web#2288" : "api#1302", ins: Q.has("ins"), insText: "", mode: "Publish", modeOpen: false, starting: false },
  dagain: { ins: false },
  panel: ["Details", "Reports"].includes(Q.get("panel")) ? Q.get("panel") : null,
  dec: SCN === "findings" || LISTY ? { 1: "ok" } : { 1: "ok", 2: "ok", 3: "no" },
  cur: SCN === "findings" ? 2 : 3, edit: null,
  verdict: null, touched: false, own: OWN, stalePass: STALE, sum: SUMMARY, sumOn: true, sumEdit: false,
  phase: SCN === "again" ? "again" : "decide",   // decide · published · again
  publishing: false, col: true, focusId: null, born: false,
};
const decided = () => FIND.filter((f) => S.dec[f.n]).length;
const approved = () => FIND.filter((f) => S.dec[f.n] === "ok");
const allDecided = () => decided() === FIND.length;
const inlineN = () => approved().filter((f) => f.loc).length, bodyN = () => approved().filter((f) => !f.loc).length;
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
function goesLine() {
  const i = inlineN(), b = bodyN();
  if (!i && !b) return S.sumOn && S.sum.trim() ? "The summary and the verdict" : "The verdict only";
  return [i ? plural(i, "inline comment") : "", b ? `${b} in the body` : "nothing in the body"].filter(Boolean).join(" · ");
}
const suggested = () => S.own ? "Comment" : approved().length ? "Request changes" : "Approve";
// The verdict follows the decisions until you choose one; from then on it is yours.
const verdict = () => S.touched ? S.verdict : suggested();
// What GitHub takes: your own pull request only Comment; without a summary and an approved finding, only Approve (never on your own).
function allowed(v) {
  const bare = !approved().length && !(S.sumOn && S.sum.trim());
  if (S.own) return v === "Comment" && !bare;
  return bare ? v === "Approve" : true;
}
const VLIST = ["Request changes", "Approve", "Comment"];
// The verdict that would go: the chosen or suggested one when GitHub takes it, else the one it takes; none on your own bare pass.
function effVerdict() { const v = verdict(); return v && allowed(v) ? v : VLIST.find(allowed) || null; }
const nothingToPublish = () => S.own && !approved().length && !(S.sumOn && S.sum.trim());
function nextOpen(from) { const o = FIND.filter((f) => !S.dec[f.n]); return (o.find((f) => f.n > from) || o[0] || {}).n; }
function prevOpen(from) { const o = FIND.filter((f) => !S.dec[f.n]).reverse(); return (o.find((f) => f.n < from) || o[0] || {}).n; }

// ---------------- The tree: round 10's, with this round's reviews and the open place ----------------
let OPENID = S.place === "review" ? "r1" : null;
Object.assign(ITEMS.t1, { sits: [{ sev: "wait", label: "Question", place: "Reviewer · Step 3/7", since: "18m", long: "18 minutes", min: 18 }], row: ["Question · Reviewer · Step 3/7", "Question · Step 3/7"], pos: "Step 3/7 · Reviewer pass 2" });
ITEMS.r2.pos = "Published · changes requested";
const R1 = {
  checks: { gh: true, pos: "Pass 1 · checks 4/6", posShort: "checks 4/6" },
  pass: { run: { who: "Reviewer", turn: "2m", long: "2 minutes 10 seconds", verb: "Reading", target: "web/src/settings/GeneralForm.tsx", short: "…/GeneralForm.tsx" }, ctx: 22, pos: "Pass 1", posShort: "Pass 1" },
  findings: { sits: [{ sev: "wait", label: "Decide findings", place: "pass 1", since: "34m", long: "34 minutes", min: 34 }], row: ["Decide findings · pass 1 · 1/3", "Decide findings · 1/3"], pos: "Pass 1" },
  publish: { sits: [{ sev: "wait", label: "Ready to publish", place: "pass 1", since: "41m", long: "41 minutes", min: 41 }], row: ["Ready to publish · pass 1", "Ready to publish"], pos: "Pass 1" },
  again: { sits: [{ sev: "wait", label: "New commits", place: "3 since pass 1", since: "12m", long: "12 minutes", min: 12 }], row: ["New commits · 3 since pass 1", "New commits · 3"], pos: "Pass 1 · published" },
  published: { sits: null, idle: true, pos: "Published · changes requested" },
};
function setR1() {
  const i = ITEMS.r1; ["sits", "row", "run", "gh", "idle", "ctx", "posShort"].forEach((k) => delete i[k]);
  const key = S.phase === "published" ? S.phase : LISTY ? "findings" : CLEAN ? "publish" : SCN === "findings" && allDecided() ? "publish" : SCN;
  Object.assign(i, R1[key] || R1.findings);
  if (key === "findings") i.row = [`Decide findings · pass 1 · ${decided()}/${FIND.length}`, `Decide findings · ${decided()}/${FIND.length}`];
  if (APPLY && key === "publish") { i.sits = [{ ...R1.publish.sits[0], label: "Ready to apply" }]; i.row = ["Ready to apply · pass 1", "Ready to apply"]; }
}
if (SCN === "merged") TREE[0].items = ["r2"];
if (SCN === "list-empty") TREE[0].items = [];
// The row that is open, and the next that Ctrl+J opens: round 10's, with the open item of this round.
function nextJ() {
  return Object.keys(ITEMS).filter((id) => id !== OPENID && needsYou(ITEMS[id]) && (id !== "r1" || SCN !== "merged")).sort((a, b) => {
    const x = sortSits(ITEMS[a].sits)[0], y = sortSits(ITEMS[b].sits)[0];
    return SEV[x.sev] - SEV[y.sev] || y.min - x.min;
  })[0];
}
function itemRow(id, level) {
  const i = ITEMS[id], t = tone(i), sel = id === OPENID;
  let l2 = "", r2 = "", l3 = "";
  if (needsYou(i)) {
    const s = sortSits(i.sits)[0];
    const more = i.sits.length > 1 ? `<span class="more" data-tip="${sortSits(i.sits).slice(1).map((x) => `${x.label} · ${x.place} · ${x.since}`).join(", ")}">+${i.sits.length - 1}</span>` : "";
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
  return `<div class="it ${cls}" role="treeitem" aria-level="${level}" tabindex="${sel ? 0 : -1}" ${sel ? 'aria-current="page" aria-selected="true"' : ""} data-meta="${meta(i)}" aria-label="${ariaFor(i)}" data-item="${id}">
    <span class="c1">${ty(i)}</span><span class="nm trunc">${i.name}</span><span class="r1">${r1}</span>
    <span class="c1">${st(t)}</span><span class="l2">${l2}</span><span class="r2">${r2}</span>${l3}</div>`;
}
function sidebarR() {
  setR1();
  const pend = visiblePRs().filter((p) => p.sec === "pending").length;
  TREE[0].extra = S.none ? "" : `<span class="x" data-tip="${pend} pull requests wait for your review">${pend} pending</span>`;
  let h = sidebar();
  if (!TREE[0].items.length) h = h.replace(/id="g-reviews"><\/div>/, 'id="g-reviews"><div class="sb-empty" role="none">No review in progress.</div></div>');
  if (S.place === "list") h = h.replace('class="node reviews"', 'class="node reviews cur"').replace('tabindex="-1" data-tip="Open Reviews"', 'tabindex="0" aria-current="page" data-tip="Reviews · open"');
  if (S.place !== "review") h = h.replace(/(<div class="it [^"]*" role="treeitem" aria-level="\d" )tabindex="0"/, '$1tabindex="-1"');
  return h;
}

// ---------------- Filters ----------------
function passes(p) {
  if (S.none) return false;
  if (S.f.board && (BOARD_OF[p.repo] || "No board") !== S.f.board) return false;
  if (S.f.repo && p.repo !== S.f.repo) return false;
  const inc = (m) => Object.keys(m).filter((k) => m[k] === "+"), exc = (m) => Object.keys(m).filter((k) => m[k] === "-");
  if (inc(S.f.author).length && !inc(S.f.author).includes(p.by)) return false;
  if (exc(S.f.author).includes(p.by)) return false;
  const lb = p.labels || [];
  if (inc(S.f.label).length && !lb.some((l) => inc(S.f.label).includes(l))) return false;
  if (lb.some((l) => exc(S.f.label).includes(l))) return false;
  return true;
}
const visiblePRs = () => PRS.filter(passes);
function filterMenu() {
  const it = (grp, v, label, on) => `<button class="mi" role="menuitemcheckbox" aria-checked="${on}" data-filter="${grp}" data-v="${v}">${I("check", "i ck")}${label}</button>`;
  const tri = (grp, v, label) => { const s = S.f[grp][v] || ""; return `<button class="mi" role="menuitem" data-tri="${s}" data-cycle="${grp}" data-v="${v}" aria-label="${label}: ${s === "-" ? "hidden" : s === "+" ? "only these" : "no filter"}. Click to cycle.">${`<span class="tri" aria-hidden="true">${s || "·"}</span>`}${label}<span class="sub">${s === "-" ? "hidden" : s === "+" ? "only" : ""}</span></button>`; };
  const authors = [...new Set(PRS.map((p) => p.by))].sort();
  return `<div class="menu pop-menu fmenu" id="menu" role="menu" aria-label="Filters">
    <div class="menu-cap">Board</div>${["Mobile App", "Platform Roadmap", "No board"].map((b) => it("board", b, b, S.f.board === b)).join("")}
    <div class="menu-sep" role="separator"></div><div class="menu-cap">Repository</div>${["api", "docs", "gateway", "ios", "web"].map((r) => it("repo", r, `acme/${r}`, S.f.repo === r)).join("")}
    <div class="menu-sep" role="separator"></div><div class="menu-cap">Author · click to hide, again to keep only</div>${authors.map((a) => tri("author", a, a === ME ? `${a} · you` : a)).join("")}
    <div class="menu-sep" role="separator"></div><div class="menu-cap">Label</div>${tri("label", "dependabot", "dependabot")}</div>`;
}
function fbar() {
  const act = [];
  if (S.f.board) act.push(["board", "", `Board: ${S.f.board}`]);
  if (S.f.repo) act.push(["repo", "", `acme/${S.f.repo}`]);
  ["author", "label"].forEach((g) => Object.entries(S.f[g]).forEach(([v, s]) => act.push([g, v, `${g === "author" ? "Author" : "Label"} ${s === "-" ? "−" : "+"}${v}`])));
  return `<div class="fbar" role="search" aria-label="Filter the pull requests">
    ${act.map(([k, v, l]) => `<span class="chip fchip on">${l}<button class="x" data-act="unfilter" data-k="${k}" data-v="${v}" aria-label="Remove the filter ${l}">${I("x")}</button></span>`).join("")}
    <button class="chip fchip" id="fmenu-btn" data-act="fmenu" aria-haspopup="menu" aria-expanded="${S.menu === "filter"}" data-tip="Board, repository, author, label">${I("filter")}Filter</button>
    ${act.length ? `<button class="btn ghost sm" data-act="clear">Clear filters</button>` : ""}</div>`;
}

// ---------------- The pull request row ----------------
function prState(p) {
  if (p.review) {
    const i = ITEMS[p.review], t = tone(i);
    if (needsYou(i)) { const s = sortSits(i.sits)[0]; return { cls: t, g: st(t), txt: i.row[0], short: i.row[1], tip: `Review: ${i.row[0]} · waiting for you for ${s.long}`, aria: `review: ${i.row[0]}, waiting for you for ${s.long}` }; }
    return { cls: t, g: st(t), txt: i.pos, tip: `Review: ${i.pos}`, aria: `review: ${i.pos}` };
  }
  if (p.task) return { cls: "task", g: ty({ kind: "task" }), txt: "Task · Rate limit per API key", tip: "Its review happens in the task", aria: "the pull request of the task Rate limit per API key" };
  if (p.own) return { cls: "own", g: "", txt: "Yours", aria: "your pull request" };
  if (p.why === "new") return { cls: "new", g: "", txt: `${p.newc} new commits`, tip: `${p.newc} commits after your last review`, aria: `pending: ${p.newc} new commits after your review` };
  if (p.why === "never") return { cls: "never", g: "", txt: "Never reviewed", aria: "pending: never reviewed" };
  return { cls: "done", g: "", txt: "Reviewed", tip: p.reviewed, aria: p.reviewed };
}
function prKeys(p) {
  const k = p.task ? "open task" : p.review ? "open" : "review";
  return `<span class="keys" aria-hidden="true"><span><kbd>R</kbd>${k}</span></span>`;
}
function prRow(p, extra = "") {
  const s = prState(p), open = S.open === p.ref;
  const tags = `${p.draft ? `<span class="dtag">Draft</span>` : ""}${(p.labels || []).filter((l) => l !== p.by).map((l) => `<span class="dtag">${l}</span>`).join("")}`;
  const label = [`${p.ref} ${p.t}`, `by ${p.by === ME ? "you" : p.by}`, p.draft ? "draft" : "", s.aria].filter(Boolean).join(". ");
  return `<div class="cr prr has2 ${open ? "open" : ""} ${extra}" role="treeitem" aria-level="2" aria-selected="${open}" tabindex="-1" data-nav data-pr="${p.ref}" id="p-${p.ref.replace("#", "-")}" aria-label="${esc(label)}">
    <span class="ref">${p.ref}</span><span class="tlw"><span class="tl">${p.t}</span>${tags}</span>
    <span class="meta"><span class="col aut"><span class="t">${p.by === ME ? "you" : p.by}</span></span>
    <span class="col rst ${s.cls}" ${s.tip ? `data-tip="${s.tip}"` : ""}>${s.g}<span class="t"><span class="long">${s.txt}</span><span class="short">${s.short || s.txt}</span></span></span>
</span>${prKeys(p)}</div>`;
}
function prList() {
  const vis = visiblePRs();
  const secs = SECS.map(([k, name]) => {
    const rows = vis.filter((p) => p.sec === k);
    const shut = k in S.fold ? S.fold[k] : k === "reviewed" || k === "mine";
    const empty = !rows.length;
    const head = `<div class="sech ${empty ? "is-empty" : ""}" role="treeitem" aria-level="1" ${empty ? "" : `aria-expanded="${!shut}"`} tabindex="-1" data-nav data-grp="${k}" id="h-${k}" aria-label="${name}, ${plural(rows.length, "pull request")}" data-tip="${SEC_TIP[k]}">${I("down", "i chev")}<span class="nm">${name}<span class="cnt">${rows.length}</span></span><span></span></div>`;
    return head + (!empty && !shut ? `<div class="grpb" role="group" aria-labelledby="h-${k}">${rows.map((p) => prRow(p)).join("")}</div>` : "");
  }).join("");
  return `<div class="lst" id="lst" role="tree" aria-label="Open pull requests, by what they wait for">${secs}</div>`;
}

// ---------------- The panel of a pull request ----------------
function ghBlock(p, opts = {}) {
  const c = p.checks;
  const rows = {
    "api#1302": [["pass", "build", "passed", "2m 04s"], ["pass", "lint", "passed", "51s"], ["pass", "unit", "passed", "3m 40s"], ["run", "integration / ledger", "running", "6m 12s"], ["todo", "e2e / checkout", "queued", "—"]],
    "gateway#88": [["fail", "e2e / large-upload", "failed", "7m 31s"], ["pass", "build", "passed", "1m 20s"], ["pass", "lint", "passed", "34s"], ["pass", "unit", "passed", "2m 02s"]],
    "web#2291": opts.live ? [["pass", "build", "passed", "1m 52s"], ["pass", "lint", "passed", "48s"], ["pass", "typecheck", "passed", "1m 06s"], ["pass", "unit", "passed", "2m 31s"], ["run", "e2e / chromium", "running", "5m 40s"], ["todo", "preview-deploy", "queued", "—"]]
      : [["pass", "build", "passed", "1m 52s"], ["pass", "lint", "passed", "48s"], ["pass", "typecheck", "passed", "1m 06s"], ["pass", "unit", "passed", "2m 31s"], ["pass", "e2e / chromium", "passed", "6m 58s"], ["pass", "preview-deploy", "passed", "2m 10s"]],
  }[p.ref] || Array.from({ length: c ? c.of : 0 }, (_, k) => ["pass", ["build", "lint", "unit", "e2e", "docs", "typecheck"][k], "passed", `${k + 1}m 0${k}s`]);
  const g = (s) => s === "pass" ? I("check") : s === "fail" ? I("x") : s === "run" ? st("run") : st("todo");
  const head = opts.live ? `${st("gh")}<span><b>Waiting for checks</b> · 4 of 6 passed</span>`
    : `${c.s === "run" ? st("gh") : I("check", "i")}<span><b>Checks</b> · ${c.s === "fail" ? `${c.failed.length} failed · ${c.n} of ${c.of} passed` : c.s === "run" ? `${c.n} of ${c.of} passed · ${c.of - c.n} not finished` : `all ${c.of} passed`}</span>`;
  return `<div class="gh" role="group" aria-label="GitHub checks"><div class="gh-h">${head}<span class="t" data-tip="MySpec reads the pull request every minute">${opts.live ? "checked 40s ago" : `read ${S.readAgo === "just now" ? "just now" : `${S.readAgo} ago`}`}</span>${opts.live ? `<button class="btn ghost xs" data-act="refresh-pr" data-tip="Read the pull request now">Refresh</button>` : ""}</div>
    <ul class="checks">${rows.map(([s, n, w, d]) => `<li class="chk ${s}"><span class="c1">${g(s)}</span><span class="nm">${n}</span><span class="w">${w}</span><span class="d">${d}</span></li>`).join("")}</ul>${opts.note ? `<div class="gh-note">${opts.note}</div>` : ""}</div>`;
}
const BODY = {
  "api#1302": `<p>Payment retries from the job queue can run twice when a worker dies after the charge and before the ack. This adds an idempotency key per charge attempt, stored with a unique index in the ledger.</p><ul><li>The key is <code>sha256(invoice_id, attempt)</code>, set by the scheduler, not by the worker.</li><li>A second charge with the same key returns the first result instead of calling the provider.</li><li>Keys expire after 7 days, with the attempt window.</li></ul><p><strong>Testing.</strong> A new integration test kills the worker between the charge and the ack and checks there is one charge.</p>`,
  "gateway#88": `<p>Bodies over 1 MB are read into memory before the upstream call, and uploads time out at 30 s. The gateway now streams them with a 256 KB buffer.</p><p>Since your review: the buffer is pooled, the timeout counts from the last byte, and there is a test for a 40 MB upload.</p>`,
};
function prPanel() {
  if (!S.open) return "";
  const p = PR[S.open], s = prState(p);
  let acts;
  if (p.review) { const i = ITEMS[p.review]; acts = `<div class="cd-rev">${ty({ kind: "review" })}<span class="nm">Review of ${p.ref}</span><button class="btn ${needsYou(i) ? "primary" : ""} sm" data-act="open-review" data-pr="${p.ref}" data-tip="Open the review · R">Open review <span class="k">R</span></button><span class="l2">${st(tone(i))}${needsYou(i) ? i.row[0] : i.pos}${needsYou(i) ? tw(sortSits(i.sits)[0]) : ""}</span></div>`; }
  else if (p.task) acts = `<div class="cd-task">${ty({ kind: "task" })}<span class="nm">Rate limit per API key</span><button class="btn sm" data-act="open-task" data-tip="Open the task">Open task</button><span class="l2">${st("wait")}Question · Reviewer · Step 3/7${tw({ sev: "wait", since: "18m", long: "18 minutes" })}</span></div><span class="cd-why">The review of this pull request happens in its task.</span>`;
  else acts = `<div class="cd-acts"><button class="btn primary sm" data-act="start" data-pr="${p.ref}" data-tip="Start a review · R">Start review <span class="k">R</span></button></div>${p.checks && p.checks.s === "run" ? `<span class="cd-why">The first pass waits for the checks: ${p.checks.of - p.checks.n} not finished.</span>` : p.own ? `<span class="cd-why">Your own pull request: the review can publish a comment, or apply its findings.</span>` : ""}`;
  const kv = [["Branch", `<span class="mono">${p.head}</span> → dev`], p.card ? ["Card", `<a href="#">#${p.card[0]}</a> ${p.card[1]} · ${p.card[2]}`] : null, p.labels ? ["Labels", p.labels.join(", ")] : null, p.reviewed ? ["Your review", p.reviewed] : null].filter(Boolean);
  return `<aside class="panel cardp prp" id="panel" aria-label="Pull request ${p.ref}">
    <div class="panel-h"><span class="cd-ref"><span class="mono">${p.ref}</span><span aria-hidden="true">·</span><span class="trunc">acme/${p.repo}</span></span><span class="grow"></span>
      <a class="btn ghost sm icon" href="#" aria-label="Open ${p.ref} on GitHub" data-tip="Open on GitHub · O">${I("external")}</a>
      <button class="btn ghost sm icon" data-act="close-pr" aria-label="Close the pull request" data-tip="Close · Esc">${I("x")}</button></div>
    <div class="panel-b cd"><div class="cd-top"><h2 class="cd-title">${p.t}</h2><div class="cd-sub"><b>${p.by === ME ? "you" : p.by}</b>${p.review ? "" : ` · ${s.txt}`}${p.draft ? " · Draft" : ""} · updated ${p.ageL}</div></div>
      ${acts}${p.checks ? ghBlock(p) : ""}<dl class="cd-kv">${kv.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>
      <div class="cbody prose">${BODY[p.ref] || `<p>${p.t}.</p><p>No more description.</p>`}</div></div></aside>`;
}

// ---------------- The list place ----------------
function readState() {
  if (S.reading) return `<span class="rs is-reading" role="status"><span class="spin" aria-hidden="true"></span>Reading…</span>`;
  return `<span class="rs" data-tip="Read at 17:58 · every 5 minutes">Read ${S.readAgo === "just now" ? "just now" : `${S.readAgo} ago`}</span>`;
}
function listMain() {
  const vis = visiblePRs();
  let content;
  if (S.none) content = `<div class="bempty"><p class="t">No open pull requests.</p><p class="s">The list shows the open pull requests of your 12 repositories, from any author. MySpec reads them every 5 minutes and when you open Reviews.</p><button class="btn sm" data-act="refresh">${I("refresh")}Read now</button></div>`;
  else if (!vis.length) content = fbar() + `<div class="bempty"><p class="t">No pull requests match the filters.</p><p class="s">${PRS.length} are open; the filters hide all of them.</p><button class="btn sm" data-act="clear">Clear filters</button></div>`;
  else content = fbar() + prList();
  const fail = S.failed ? `<div class="readfail" role="alert">${st("warn")}<span class="lines"><span><span class="lbl">Couldn't read <span class="rep">acme/ios</span> · 4m ago</span></span><span class="det">gh can't read this repository. Run gh auth refresh -s repo. Its pull requests stay as the last reading had them.</span></span><button class="btn sm" data-act="retry">Try again</button></div>` : "";
  return `<main class="main" id="main"><header class="ih1 bh">${navBtnsR("Rate limit per API key")}<h1 class="ih-title"><span class="trunc">Reviews</span></h1><span class="grow"></span>
    <div class="ih-tools">${readState()}<button class="btn ghost sm icon" data-act="refresh" ${S.reading ? 'disabled aria-describedby="rs-why"' : ""} aria-label="Read the pull requests again" data-tip="${S.reading ? "A reading is running" : "Read the pull requests again"}">${I("refresh")}</button><span id="rs-why" hidden>A reading is running.</span></div></header>
    <div class="bbody"><div class="lstw" id="lstw"><div class="lst-in">${fail}${content}</div></div>${prPanel()}</div>
    ${S.menu === "filter" ? filterMenu() : ""}${S.dialog === "start" ? startDialog() : ""}</main>`;
}
function navBtnsR(back) { return `<div class="navbtns"><button class="btn ghost sm icon" data-tip="Back to ${back} · Alt+←" aria-label="Back to ${back}">${I("left")}</button></div>`; }

// ---------------- The start dialog: good defaults, the rest on request ----------------
function startDialog() {
  const D = S.dstart, p = PR[D.pr];
  const wait = p.checks && p.checks.s === "run" ? `<div class="ctxrow" role="note">${st("gh")}<span class="w">The first pass starts when the checks finish: ${p.checks.n} of ${p.checks.of} passed. You can leave meanwhile.</span></div>` : "";
  const mode = p.own ? (D.modeOpen
    ? `<div class="fld"><span class="lb" id="mode-l">Mode</span><div class="switch" role="radiogroup" aria-labelledby="mode-l">${["Publish", "Apply"].map((v) => `<button class="sw" role="radio" aria-checked="${v === D.mode}" tabindex="${v === D.mode ? 0 : -1}" data-smode="${v}">${v}</button>`).join("")}</div><span class="desc">${D.mode === "Publish" ? "Publish posts the approved findings as a review on GitHub." : "Apply has the agent fix the approved findings and push them to the pull request."} Fixed once the review starts.</span></div>`
    : "") : "";
  const ins = D.ins ? `<div class="fld"><label class="lb" for="s-ins">Instructions <span class="opt-l">optional</span></label><textarea class="textarea" id="s-ins" rows="3" placeholder="What to look at in this pass.">${esc(D.insText)}</textarea><span class="help">They go to the agent with the pull request, and show as your first message.</span></div>` : "";
  const more = [!D.ins ? `<button class="btn ghost xs" data-act="s-ins">${I("plus")}Add instructions</button>` : "", p.own && !D.modeOpen ? `<button class="btn ghost xs" data-act="s-mode" data-tip="Publish, or Apply: the agent fixes what you approve">Mode · Publish${I("down")}</button>` : ""].join("");
  return `<div class="scrim" id="scrim"><div class="dlg wide" role="dialog" aria-modal="true" aria-labelledby="dlg-t">
    <div class="dlg-hd"><h2 id="dlg-t">Review ${p.ref}</h2><button class="btn ghost sm icon x" data-act="dlg-close" aria-label="Close" data-tip="Close · Esc">${I("x")}</button></div>
    <div class="dlg-bd"><div class="cardsum" aria-label="Pull request"><span class="num">${p.ref}</span><span class="t">${p.t}</span><span class="s">${p.by === ME ? "you" : p.by} · ${p.head} → dev${p.card ? ` · card #${p.card[0]}` : ""}</span></div>${wait}
      <div class="fld"><span class="lb" id="m-l">Model</span><div class="modelrow"><button class="chip" aria-haspopup="listbox" aria-labelledby="m-l" aria-describedby="m-d">Opus 5.5 (1M) · high${I("down")}</button><span class="desc" id="m-d">From Defaults. It can change in the conversation.</span></div></div>
      ${mode}${ins}${more ? `<div class="morebtns">${more}</div>` : ""}</div>
    <div class="dlg-ft"><span class="why" id="why-start">${D.starting ? "Creating the worktree…" : ""}</span><button class="btn ghost" data-act="dlg-close" ${D.starting ? "disabled" : ""}>Cancel</button>
      ${D.starting ? `<button class="btn primary is-loading" aria-busy="true"><span class="spin"></span>Starting…</button>` : `<button class="btn primary" data-act="start-go">Start review <span class="k">Ctrl ↵</span></button>`}</div></div></div>`;
}

// ---------------- The review screen ----------------
const REV = { title: "Migrate settings page to react-hook-form", ref: "web#2291" };
// What the header's pill says: the pass, the state glyph, and the word when no bar says it.
function pillState() {
  if (S.phase === "published") return { name: "Pass 1", g: "idle", word: "published", long: "Published · Request changes" };
  return {
    checks: { name: "Pass 1", g: "gh", word: "checks 4/6", long: "Waiting for checks · 4 of 6 passed" },
    pass: { name: "Pass 1", g: "run", word: "working", long: "The reviewer works" },
    findings: { name: "Pass 1", g: "wait", word: "decide", long: "Findings to decide" },
    publish: { name: "Pass 1", g: "wait", word: "publish", long: APPLY ? "Ready to apply" : "Ready to publish" },
    clean: { name: "Pass 1", g: "wait", word: "publish", long: "Clean · ready to publish" },
    again: { name: "Pass 1", g: "wait", word: "new commits", long: "New commits since pass 1" },
  }[SCN];
}
function pill(bar) {
  const p = pillState();
  return `<ol class="stepper one" tabindex="0" aria-label="Progress · ${p.name} · ${p.long}" data-tip="${p.name} · ${p.long}"><li class="sp cur" aria-current="step"><span class="pill"><span class="lb-c">${p.name}</span><span class="stw st-${p.g}-t">${st(p.g, bar ? p.long : "")}${bar ? "" : `<span class="long">${p.word}</span>`}</span></span></li></ol>`;
}
function headerR(bar) {
  const P = S.panel, ctx = SCN === "checks" ? null : SCN === "pass" ? 22 : 31;
  const pb = (n, icon, tip) => `<button class="btn ghost pbtn" aria-pressed="${P === n}" data-panel="${n}" aria-label="${n}" data-tip="${tip}">${I(icon)}<span class="pl">${n}</span></button>`;
  return `<header class="ih1 mh has-stepper">${navBtnsR("Reviews")}<nav class="crumbs" aria-label="Breadcrumb"><span class="up row crumb-path"><button class="ellb" aria-haspopup="menu" aria-label="Show the hidden level: Reviews" data-tip="Reviews">…</button><span class="board row crumb-path"><a href="#" data-act="go-list">Reviews</a><span class="gt" aria-hidden="true">/</span></span></span></nav>
    <h1 class="ih-title"><span class="trunc">${REV.title}</span></h1>${pill(bar)}<span class="grow"></span>
    <div class="ih-tools">${ctx != null ? ctxm(ctx) : ""}<button class="btn ghost sm pz" aria-label="Pause the review" data-tip="Pause the review · the session stops">${I("pause")}<span class="pl">Pause</span></button>
    <div class="tgroup" role="group" aria-label="Panels">${pb("Details", "info", "The pull request, its checks, the passes and the conversation's facts")}${pb("Reports", "file", "Context and the report of every pass")}</div>
    <button class="btn ghost sm icon" id="more-btn" aria-label="More actions" aria-haspopup="menu" aria-expanded="${S.menu === "more"}" data-tip="More actions">${I("more")}</button></div></header>`;
}
function moreMenu() {
  const it = (label, tip, extra = "", key = "") => `<button class="mi" role="menuitem" data-tip="${tip}" ${extra}>${label}${key ? `<span class="k">${key}</span>` : ""}</button>`;
  const dis = (label, why) => `<button class="mi" role="menuitem" aria-disabled="true" data-tip="${why}">${label}<span class="sub">· ${why}</span></button>`;
  const busy = SCN === "checks" ? "a pass waits for the checks" : SCN === "pass" ? "a pass is running" : "";
  return `<div class="pop menu more" id="more-menu" role="menu" aria-label="More actions">
    <div class="menu-cap">Pull request ${REV.ref}</div>${it("Open PR", "Open web#2291 on GitHub")}${it("Refresh PR", "Read the pull request now · checked 40s ago")}${it("Open in VS Code", "Open the worktree of the review", "", "Ctrl+E")}
    <div class="menu-sep" role="separator"></div><div class="menu-cap">Review</div>${busy ? dis("Review again", busy) : it("Review again…", "Ask for another pass now", 'data-act="again"')}
    <div class="menu-sep" role="separator"></div><button class="mi danger" role="menuitem" data-tip="The worktree, the conversation and the reports go away. What was published on GitHub stays.">Delete review…</button></div>`;
}
function placeMenu() {
  const m = document.getElementById("more-menu"), b = document.getElementById("more-btn"), main = document.getElementById("main"); if (!m || !b) return;
  const r = b.getBoundingClientRect(), mr = main.getBoundingClientRect();
  m.style.top = Math.round(r.bottom - mr.top + 4) + "px"; m.style.right = Math.round(mr.right - r.right) + "px";
}

// The conversation of the review: the agent's session and the review's events as one-line markers.
function reportEvx() {
  if (CLEAN) return EVX("filecheck", `Review 1 written <span class="n">· clean</span>`, "13:19", "reviews/web-2291/review-1.md", `<div class="docbody full prose"><p>${SUMMARY}</p></div><div class="docfoot"><button class="btn ghost xs" data-panel="Reports">${I("file")}Open in Reports</button></div>`);
  return EVX("file", `Review 1 written <span class="n">· changes · 3 findings</span>`, "13:19", "reviews/web-2291/review-1.md",
    `<div class="docbody full"><ol class="flist">${FIND.map((f) => `<li><span class="fn">${f.n}</span><span>${f.title}<span class="loc">${f.loc || "General"}</span></span></li>`).join("")}</ol></div><div class="docfoot"><button class="btn ghost xs" data-panel="Reports">${I("file")}Open in Reports</button></div>`);
}
function convoEntries() {
  const e = [];
  e.push(EV("review", `Review started <span class="n">· Opus 5.5 (1M) · high · Publish</span>`, "13:08"));
  e.push(US(`can we merge safely? The old page validated on blur, and the API rejects an empty time zone.`, "13:08"));
  if (SCN === "checks") { e.push(ghBlock(PR["web#2291"], { live: true, note: "The first pass starts when e2e / chromium and preview-deploy finish. MySpec reads web#2291 every minute; you can leave meanwhile." })); return e; }
  e.push(EV("check", `Checks read before pass 1 <span class="n">· 6 of 6 passed · merges clean into dev</span>`, "13:12"));
  if (SCN === "pass") {
    e.push(ACTS({ n: 9, roll: "git 3 · Read 6", dur: "40 s", rows: [["List the commits of the pull request", "git log --oneline origin/dev..HEAD", "done", "0.1 s"], ["Measure the diff", "git diff origin/dev...HEAD --stat", "done", "0.2 s"], ["Read the context", "cat .myspec/reviews/web-2291/context.md", "done", "0.1 s"]] }));
    e.push(AG("rev", `<p>18 files change, most of them the three settings forms. I'll compare each schema with the validation the old page did on blur, then run the settings tests.</p>`, "13:13"));
    e.push(ACTS({ n: 17, live: ["Read the new schema", "sed -n '60,110p' web/src/settings/GeneralForm.tsx"], rows: [["Read the old validation", "git show origin/dev:web/src/settings/GeneralForm.jsx", "done", "0.1 s"], ["Read the new schema", "sed -n '60,110p' web/src/settings/GeneralForm.tsx", "running", ""]] }));
    return e;
  }
  e.push(ACTS({ n: 24, roll: "Read 14 · Searched 6 · Tests 3 · git 1", dur: "6 min", earlier: 18, rows: [["Read the old validation", "git show origin/dev:web/src/settings/GeneralForm.jsx", "done", "0.1 s"], ["Find where the API checks the time zone", "rg -n \"timezone\" internal/settings", "done", "0.2 s"], ["Run the settings tests", "pnpm vitest run src/settings", "done", "14 s"], ["Look for skipped end-to-end specs", "rg -n testIgnore playwright.config.ts", "done", "0.1 s"]] }));
  if (CLEAN) e.push(AG("rev", `<p>Yes. The migration keeps every field, the time zone stays required through the shared schema, and the settings tests and the six checks pass. Nothing to change.</p>`, "13:19"));
  else e.push(AG("rev", `<p>Not yet. The migration keeps every field and the submit flow, but the time zone lost its required rule and Settings asks about unsaved changes as soon as it opens. Three findings in the report.</p>`, "13:19"));
  e.push(reportEvx());
  return e;
}
function publishedMarkers() {
  const h = [];
  if (!FIND.length) { h.push(EV("pr", `Published pass 1 <span class="n">· ${effVerdict()} · ${goesLine()}</span>`, "13:41", "", `<a class="btn ghost xs" href="#" data-tip="Open the review on GitHub">${I("external")}GitHub</a>`)); return h; }
  const list = FIND.map((f) => `<li><span class="fn">${f.n}</span><span>${f.title}<span class="loc">${S.dec[f.n] === "ok" ? (f.loc ? "Inline comment" : "In the review body") : "Discarded · not published"}</span></span></li>`).join("");
  h.push(EVX("check", `You decided <span class="n">· ${approved().length} approved, ${FIND.length - approved().length} discarded</span>`, "13:40", "", `<div class="docbody full"><ol class="flist">${list}</ol></div>`));
  h.push(EV("pr", `${APPLY ? "Sent to the agent" : "Published pass 1"} <span class="n">· ${APPLY ? `${plural(approved().length, "approved finding")} to apply` : `${effVerdict()} · ${goesLine()}`}</span>`, "13:41", "", `<a class="btn ghost xs" href="#" data-tip="Open the review on GitHub">${I("external")}GitHub</a>`));
  return h;
}
function againMarkers() {
  return [EVX("commit", `3 new commits <span class="n">· by rsouza</span>`, "15:02", "", `<div class="docbody full"><ol class="flist"><li><span class="fn mono">a41c9e2</span><span>Require a time zone in the general settings</span></li><li><span class="fn mono">7be0d13</span><span>Set the form's values instead of resetting them on mount</span></li><li><span class="fn mono">c19f02e</span><span>Update the settings e2e selectors</span></li></ol></div>`)];
}
function convo() {
  let h = convoEntries().join("");
  if (DECIDING.includes(SCN)) h += S.phase === "decide" ? V.after() : publishedMarkers().join("");
  if (SCN === "again") h += publishedMarkers().join("") + againMarkers().join("");
  return `<div class="stream">${h}</div>`;
}
// The ask bar. The variations give the one of a pass being decided; the rest is the same in both.
function askR() {
  if (DECIDING.includes(SCN) && S.phase === "decide") return APPLY ? applyBar() : V.bar();
  if (SCN === "again") return ASK({ kind: "tinted", label: "New commits", place: "3 since pass 1", s: { sev: "wait", since: "12m", long: "12 minutes" }, detail: "Checks 6 of 6 passed · merges clean", actions: `<button class="btn sm primary" data-act="again" data-tip="A new pass reads the new commits and says which published findings they fix">Review again…</button>` });
  return "";
}
function composerR() {
  if (SCN === "checks") return "";
  const ph = SCN === "pass" ? "Queue a message for the reviewer…" : DECIDING.includes(SCN) && S.phase === "decide" && FIND.length ? "Ask the reviewer to add, change or drop a finding…" : "Reply to the reviewer…";
  return COMPOSER({ ph, model: "Opus 5.5 · high", working: SCN === "pass" ? "Working · 2m 10s" : null, label: "Reply to the reviewer" });
}
function panelR() {
  if (!S.panel) return "";
  let b = "";
  if (S.panel === "Details") b = `<div class="pgrp"><h3>Pull request</h3><dl class="kv"><dt>Pull request</dt><dd><a href="#">acme/web#2291</a></dd><dt>Author</dt><dd>rsouza</dd><dt>Branch</dt><dd class="mono">settings-rhf → dev</dd><dt>Card</dt><dd><a href="#">#437</a> Settings forms on react-hook-form · In progress</dd><dt>Labels</dt><dd>None</dd></dl></div>
    <div class="pgrp"><h3>Checks read before pass 1 · 13:12</h3>${ghBlock(PR["web#2291"]).replace('class="gh"', 'class="gh pchk"')}</div>
    <div class="pgrp"><h3>Passes</h3><div class="pl-list"><button class="pl-row" data-panel="Reports">${I("file")}<span class="grow trunc">Pass 1 · ${CLEAN ? "clean" : "changes · 3 findings"}</span><span class="m">${S.phase === "published" || SCN === "again" ? "published" : "13:19"}</span></button></div></div>
    <div class="pgrp"><h3>Review</h3><dl class="kv"><dt>Mode</dt><dd>Publish · fixed</dd><dt>Model</dt><dd>Opus 5.5 (1M) · high</dd><dt>Worktree</dt><dd class="mono">~/.local/share/myspec/worktrees/acme/web/pr_2291</dd><dt>Started</dt><dd>Today 13:08</dd></dl></div>`;
  else b = `<div class="pgrp"><h3>Reports</h3><div class="pl-list"><button class="pl-row">${I("file")}<span class="grow trunc">Context</span><span class="m">13:08</span></button><button class="pl-row is-on">${I("file")}<span class="grow trunc">Review 1 · changes</span><span class="m">13:19</span></button></div></div><div class="prose pl-prose"><h4>Review 1 · changes</h4><p>${SUMMARY}</p><ol>${FIND.map((f) => `<li><strong>${f.title}</strong> · <code>${f.loc || "general"}</code></li>`).join("")}</ol></div>`;
  return `<aside class="panel" id="panel" aria-label="${S.panel}"><div class="panel-h"><h2>${S.panel}</h2><button class="btn ghost sm icon" data-panel="${S.panel}" aria-label="Close ${S.panel}" data-tip="Close · Esc">${I("x")}</button></div><div class="panel-b">${b}</div></aside>`;
}
function reviewMain() {
  const ask = askR(), comp = composerR(), col = V.column();
  const warn = CHECKERR ? `<div class="warnstrip" role="status">${checkErr()}</div>` : "";
  return `<main class="main m" id="main">${headerR(!!ask)}${warn}<div class="body" id="body"><div class="colconvo">
    <div class="convo-wrap"><div class="convo" id="convo" tabindex="-1" aria-label="The review conversation"><div class="convo-in">${convo()}</div></div></div>
    ${ask ? `<div class="ask">${ask}</div>` : ""}${comp ? `<div class="composer"><div class="composer-in">${comp}</div></div>` : `<div class="composer-end"></div>`}</div>${col}${panelR()}</div>
    ${S.menu === "more" ? moreMenu() : ""}${S.dialog === "publish" && V.publishDialog ? V.publishDialog() : ""}${S.dialog === "again" ? againDialog() : ""}</main>`;
}
// A reading of every minute that failed: not a situation (it neither notifies nor waits for you), so it is a strip
// under the header, like the clone that is missing in the task, sunken and never red. It goes when a reading works.
function checkErr() { return `<div class="readfail">${st("warn")}<span class="lines"><span class="lbl">Couldn't check GitHub · 3m ago</span><span class="det">GitHub's rate limit was reached. It resets at 14:32. New commits, checks and the merge show after the next reading.</span></span><button class="btn sm" data-act="refresh-pr">Try again</button></div>`; }
// The commits that arrived after the pass, before it is published: where the findings go changes, and a new pass is offered.
function staleNote() { return S.stalePass ? `<div class="stale" role="note">${st("warn")}<span class="l"><b>2 commits arrived after this pass.</b> Findings on lines that left the diff go in the review body.</span><button class="btn ghost xs" data-act="again">Review again instead</button></div>` : ""; }
// The Apply mode, on your own pull request: the approved findings go to the agent; no verdict, no publication.
function applyBar() {
  if (!allDecided()) return ASK({ kind: "tinted", label: "Decide findings", place: "pass 1", s: { sev: "wait", since: "34m", long: "34 minutes" }, detail: `${decided()} of ${FIND.length} decided`,
    actions: `<button class="btn sm" data-act="next" data-tip="The next finding to decide · Alt+↓">${I("arrow-down")}Next to decide <span class="k">Alt ↓</span></button><span class="why" id="why-pub">Decide ${FIND.length - decided()} more</span><button class="btn sm primary" disabled aria-describedby="why-pub">Apply approved</button>` });
  const a = approved().length;
  return ASK({ kind: "tinted", label: "Ready to apply", place: "pass 1", s: { sev: "wait", since: "41m", long: "41 minutes" }, detail: a ? `${plural(a, "approved finding")} go to the agent` : "Nothing approved · ready to merge",
    actions: `<button class="btn sm primary" data-act="apply" data-tip="The agent fixes the approved findings; you review the changes as in a Manual step">Apply approved</button>` });
}
function againDialog() {
  const D = S.dagain;
  return `<div class="scrim" id="scrim"><div class="dlg agd" role="dialog" aria-modal="true" aria-labelledby="dlg-t">
    <div class="dlg-hd"><h2 id="dlg-t">Review web#2291 again</h2><button class="btn ghost sm icon x" data-act="dlg-close" aria-label="Close" data-tip="Close · Esc">${I("x")}</button></div>
    <div class="dlg-bd">${S.phase === "decide" && decided() ? `<div class="stale" role="note">${st("warn")}<span class="l">The decisions and edits of review 1 will be discarded.</span></div>` : ""}<p class="dp">${S.phase === "decide" ? "Pass 2 reads the pull request and the checks again, and writes a new report." : `Pass 2 reads the 3 new commits and the checks, and says which of the ${plural(approved().length, "published finding")} they fix.`}</p>
      ${D.ins ? `<div class="fld"><label class="lb" for="a-ins">Instructions <span class="opt-l">optional</span></label><textarea class="textarea" id="a-ins" rows="3" placeholder="What to look at in this pass."></textarea></div>` : `<div class="morebtns"><button class="btn ghost xs" data-act="a-ins">${I("plus")}Add instructions</button></div>`}</div>
    <div class="dlg-ft"><button class="btn ghost" data-act="dlg-close">Cancel</button><button class="btn primary" data-act="again-go">Review again <span class="k">Ctrl ↵</span></button></div></div></div>`;
}

// ---------------- The review that left while open ----------------
function goneMain() {
  return `<main class="main" id="main"><header class="ih1 bh">${navBtnsR("Reviews")}<h1 class="ih-title"><span class="trunc">${REV.title}</span></h1><span class="grow"></span></header>
  <div class="leftw"><div class="left" role="status"><div class="hd"><span class="ic">${I("merge")}</span><h2>web#2291 was merged, and its review ended</h2>
    <p>rsouza merged it into dev at 16:20. MySpec stopped the session and removed the worktree. The reports and the verdicts are in History; the conversation isn't kept.</p></div>
    <div class="res" aria-label="The review"><ul><li><span class="p">Pass 1</span><span>Request changes · 2 inline comments</span><span class="t">13:41</span></li><li><span class="p">Pass 2</span><span>Approve · the 2 findings fixed</span><span class="t">15:48</span></li></ul></div>
    <div class="acts2"><button class="btn primary" id="gone-next" data-tip="Widget for today's tasks · Ctrl+J">Next that needs you <span class="k">Ctrl J</span></button><button class="btn" data-tip="The archived review, with every pass">Open in History</button><button class="btn ghost" data-act="go-list">Back to Reviews</button></div></div></div></main>`;
}

// ---------------- The finding: shared by the card (a) and the list (b) ----------------
const plainText = (h) => h.replace(/<code>(.*?)<\/code>/g, "`$1`").replace(/<[^>]+>/g, "").replace(/&lt;/g, "<");
function findingText(f) {
  if (S.edit === f.n) return `<div class="fedit"><label class="sr" for="fe-${f.n}">Text of finding ${f.n}</label><textarea class="textarea" id="fe-${f.n}" rows="5">${esc(plainText(f.text))}</textarea><div class="row"><span class="help">Saved as you type. It goes to GitHub as you leave it.</span><button class="btn ghost xs" data-act="edit-done" data-f="${f.n}">Done</button></div></div>`;
  return `<div class="ft">${f.text}</div>`;
}
// The place of a finding opens the pull request on GitHub, in Files changed, at that line; the editor is the second way.
function locLink(f, short) {
  if (!f.loc) return `<span class="locrow"><span class="loc gen">General · not on a line of the diff</span></span>`;
  const [path, line] = f.loc.split(":");
  return `<span class="locrow"><a class="loc" href="#" data-act="gh-line" data-f="${f.n}" data-tip="${short ? `${f.loc} · ` : ""}Open on GitHub, in Files changed, at line ${line} · O">${short ? f.short : f.loc}${I("external")}</a><button class="btn ghost xs icon" data-act="ed-line" data-f="${f.n}" aria-label="Open line ${line} of ${path.split("/").pop()} in VS Code" data-tip="Open in VS Code at this line · Ctrl+E">${I("code")}</button></span>`;
}
function openLine(n, where) { const f = FIND[n - 1]; if (!f || !f.loc) return; toast(where === "gh" ? "Opens web#2291 on GitHub" : "Opens VS Code", where === "gh" ? `Files changed, at ${f.loc}` : `${f.loc}, in the worktree of the review`); }
function decButtons(f) {
  const d = S.dec[f.n];
  return `<div class="fa"><button class="btn sm dec-a" aria-pressed="${d === "ok"}" data-dec="ok" data-f="${f.n}">${I("check")}Approve <span class="k">A</span></button><button class="btn sm dec-d" aria-pressed="${d === "no"}" data-dec="no" data-f="${f.n}">Discard <span class="k">D</span></button>${d ? `<span class="note">${d === "ok" ? "Approved" : "Discarded"} · click again to undo</span>` : ""}<span class="grow"></span>${S.edit === f.n ? "" : `<button class="btn ghost xs" data-act="edit" data-f="${f.n}" data-tip="Edit the text that goes to GitHub · E">Edit</button>`}</div>`;
}

// ---------------- Render ----------------
function toast(text, sub) {
  const box = document.querySelector(".toasts"); if (!box) return;
  const t = document.createElement("div"); t.className = "toast"; t.innerHTML = `<span class="tx"><span>${text}</span>${sub ? `<span class="sub">${sub}</span>` : ""}</span>`;
  box.appendChild(t); setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 200); }, 3200);
}
function layout() {
  const m = document.getElementById("main");
  const p = document.querySelector(".panel.cardp");
  if (p && m) { p.style.width = ""; p.classList.remove("over"); const w = Math.floor(p.getBoundingClientRect().width); p.style.width = w + "px"; p.classList.toggle("over", m.getBoundingClientRect().width - w < 440); }
  const rp = document.querySelector(".m .panel");
  if (rp && m) { const w = m.getBoundingClientRect().width, pw = Math.min(480, Math.max(360, Math.round(w * 0.28))), col = document.querySelector(".fcol"); rp.classList.toggle("over", w - pw - (col ? col.getBoundingClientRect().width : 0) < 760); }
  const menu = document.getElementById("menu"), btn = document.getElementById("fmenu-btn");
  if (menu && btn && m) { const r = btn.getBoundingClientRect(), mr = m.getBoundingClientRect(); menu.style.top = Math.round(r.bottom - mr.top + 4) + "px"; menu.style.left = Math.round(r.left - mr.left) + "px"; }
  placeMenu();
}
function markRows() {
  document.querySelectorAll(".cr .tl, .cr .col .t, .rel .t, .fr .ftt, .cd-rev .nm").forEach((el) => {
    if (el.scrollWidth > el.clientWidth + 0.5) el.dataset.tip = el.textContent.trim(); else if (el.dataset.tip && !el.closest("[data-keeptip]")) delete el.dataset.tip;
  });
}
const _markTruncated = markTruncated;
markTruncated = function (root) { _markTruncated(root); markRows(); };
function navs() { return [...document.querySelectorAll("#lst [data-nav]")]; }
function render(focusId) {
  const lw = document.getElementById("lstw"), keep = lw ? lw.scrollTop : null;
  const cv0 = document.getElementById("convo"), atEnd = !cv0 || cv0.scrollHeight - cv0.scrollTop - cv0.clientHeight < 40, keepC = cv0 ? cv0.scrollTop : 0;
  OPENID = S.place === "review" ? "r1" : null; setR1();
  const main = S.place === "list" ? listMain() : S.place === "gone" ? goneMain() : reviewMain();
  document.getElementById("app").innerHTML = sidebarR() + main + mockbar(SCENE_LIST, SCN);
  const tree = document.getElementById("tree"); if (tree) tree.addEventListener("scroll", moreBelow);
  const lw2 = document.getElementById("lstw"); if (lw2 && keep != null) lw2.scrollTop = keep;
  const all = navs(); const fid = focusId || S.focusId;
  const home = (fid && document.getElementById(fid)) || (S.open && document.getElementById(`p-${S.open.replace("#", "-")}`)) || all.find((x) => x.classList.contains("cr")) || all[0];
  if (home) home.tabIndex = 0;
  const cv = document.getElementById("convo"); if (cv) cv.scrollTop = atEnd || !cv0 ? cv.scrollHeight : keepC;
  layout(); fitHeader(); markTruncated();
  requestAnimationFrame(() => { layout(); moreBelow(); markTruncated(); });
  if (focusId) { const f = document.getElementById(focusId) || document.querySelector(focusId); if (f) { f.focus({ preventScroll: true }); if (f.scrollIntoView) f.scrollIntoView({ block: "nearest" }); } }
}
function fitHeader() {}

// ---------------- Acting ----------------
function openPR(ref) { S.open = S.open === ref ? null : ref; S.menu = null; render(`p-${ref.replace("#", "-")}`); }
function startFrom(ref) {
  const p = PR[ref];
  if (p.review) return goReview();
  if (p.task) return toast("Opens the task Rate limit per API key", "Its review happens in the task.");
  S.dialog = "start"; S.dstart = { pr: ref, ins: false, insText: "", mode: "Publish", modeOpen: false, starting: false }; render(); focusDialog();
}
function focusDialog() { const f = document.querySelector("#s-ins") || document.querySelector(".pubd .opt[aria-checked='true']") || document.querySelector('.pubd .dlg-ft [data-act="dlg-close"]') || document.querySelector(".dlg .btn.primary:not(:disabled)") || document.querySelector(".dlg button"); if (f) f.focus(); }
function goReview() { toast("Opens the review of web#2291", "The review screen: see the scenes Review · …"); }
function decide(n, d) {
  S.dec[n] = S.dec[n] === d ? null : d;
  if (!S.dec[n]) delete S.dec[n];
  const was = S.bornPub; S.bornPub = allDecided();
  if (S.bornPub && !was) { S.born = true; setTimeout(() => { S.born = false; }, 800); }
}
function publish() {
  S.publishing = true; render();
  setTimeout(() => { S.publishing = false; S.dialog = null; S.phase = "published"; render(); toast("Published to GitHub", `${effVerdict()} · ${goesLine()} · web#2291`); }, 1200);
}

document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-act]"), act = a && a.dataset.act;
  if (S.menu === "filter" && !e.target.closest("#menu") && act !== "fmenu") { S.menu = null; render(); if (!act) return; }
  if (S.menu === "more" && !e.target.closest("#more-menu") && !e.target.closest("#more-btn")) { S.menu = null; render(); if (!act) return; }
  if (e.target.closest("#more-btn")) { S.menu = S.menu === "more" ? null : "more"; render(); if (S.menu) { const f = document.querySelector("#more-menu .mi"); if (f) f.focus(); } return; }
  const dd = e.target.closest("[data-dec]");
  if (dd) { e.preventDefault(); const n = +dd.dataset.f; decide(n, dd.dataset.dec); if (V.afterDecide) V.afterDecide(n); else render(`#fnd-${n}`); return; }
  if (act) {
    e.preventDefault();
    switch (act) {
      case "fmenu": S.menu = S.menu === "filter" ? null : "filter"; render(); { const f = document.querySelector("#menu .mi"); if (f && S.menu) f.focus(); } return;
      case "unfilter": { const k = a.dataset.k; if (k === "board" || k === "repo") S.f[k] = null; else delete S.f[k][a.dataset.v]; render(); return; }
      case "clear": S.f = { board: null, repo: null, author: {}, label: {} }; render(); return;
      case "refresh": case "retry": S.failed = false; S.none = false; S.reading = true; render(); setTimeout(() => { S.reading = false; S.readAgo = "just now"; render(); }, 1600); return;
      case "close-pr": { const r = S.open; S.open = null; render(r ? `p-${r.replace("#", "-")}` : null); return; }
      case "start": return startFrom(a.dataset.pr);
      case "open-review": return goReview();
      case "open-task": return toast("Opens the task Rate limit per API key", "Its review happens in the task.");
      case "dlg-close": S.dialog = null; render(S.open ? `p-${S.open.replace("#", "-")}` : null); return;
      case "s-ins": S.dstart.ins = true; render(); document.getElementById("s-ins").focus(); return;
      case "s-mode": S.dstart.modeOpen = true; render(); document.querySelector("[data-smode][aria-checked='true']").focus(); return;
      case "start-go": S.dstart.starting = true; render(); setTimeout(() => { S.dialog = null; S.dstart.starting = false; render(); toast(`Started the review of ${S.dstart.pr}`, "It waits for the checks, then the first pass runs."); }, 1400); return;
      case "go-list": return toast("Opens Reviews", "The list of pull requests: see the scene Reviews · the list.");
      case "gh-line": return openLine(+a.dataset.f, "gh");
      case "ed-line": return openLine(+a.dataset.f, "ed");
      case "edit": S.edit = +a.dataset.f; render(); { const t = document.getElementById(`fe-${a.dataset.f}`); if (t) t.focus(); } return;
      case "edit-done": S.edit = null; render(V.key === "b" ? `#frh-${a.dataset.f}` : `#fnd-${a.dataset.f}`); return;
      case "again": S.menu = null; S.dialog = "again"; S.dagain = { ins: false }; render(); { const b = document.querySelector('[data-act="again-go"]'); if (b) b.focus(); } return;
      case "a-ins": S.dagain.ins = true; render(); document.getElementById("a-ins").focus(); return;
      case "again-go": S.dialog = null; render(); toast("Pass 2 asked", "It waits for the checks of the new head, then runs."); return;
      case "publish": if (a.disabled) return; if (S.dialog !== "publish") { S.dialog = "publish"; render(); focusDialog(); return; } return publish();
      case "next": return V.next && V.next();
      case "apply": S.phase = "published"; render(); toast("Sent to the agent", "It fixes the approved findings; then you review the changes."); return;
      case "refresh-pr": return toast("Reading web#2291…");
      case "col": S.col = !S.col; render('[data-act="col"]'); return;
      case "sum-clear": S.sumOn = !S.sumOn; render(); return;
      case "sum-edit": S.sumEdit = true; render(); { const t = document.getElementById("sum"); if (t) t.focus(); } return;
    }
    return;
  }
  const fl = e.target.closest("[data-filter]");
  if (fl) { const k = fl.dataset.filter; S.f[k] = S.f[k] === fl.dataset.v ? null : fl.dataset.v; S.menu = null; render(); return; }
  const cy = e.target.closest("[data-cycle]");
  if (cy) { const g = cy.dataset.cycle, v = cy.dataset.v, s = S.f[g][v] || ""; const nx = s === "" ? "-" : s === "-" ? "+" : ""; if (nx) S.f[g][v] = nx; else delete S.f[g][v]; render(); const b = document.querySelector(`[data-cycle="${g}"][data-v="${v}"]`); if (b) b.focus(); return; }
  const sm = e.target.closest("[data-smode]");
  if (sm) { S.dstart.mode = sm.dataset.smode; render(); document.querySelector(`[data-smode="${sm.dataset.smode}"]`).focus(); return; }
  const row = e.target.closest("[data-nav][data-pr]");
  if (row && !e.target.closest("button, a")) return openPR(row.dataset.pr);
  const hd = e.target.closest("[data-grp]");
  if (hd && !hd.classList.contains("is-empty")) { S.fold[hd.dataset.grp] = hd.getAttribute("aria-expanded") === "true"; render(hd.id); }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "s-ins") S.dstart.insText = e.target.value;
  if (e.target.id === "sum") S.sum = e.target.value;
  if (e.target.id === "sum-on") { S.sumOn = e.target.checked; render("#sum-on"); }
});
document.addEventListener("focusin", (e) => { const f = e.target.closest && e.target.closest("[data-fnum]"); if (f) S.cur = +f.dataset.fnum; });
document.addEventListener("keydown", (e) => {
  const inField = e.target.closest && e.target.closest("input, textarea, select");
  if (S.dialog) {
    if (e.key === "Escape") { e.preventDefault(); S.dialog = null; render(S.open ? `p-${S.open.replace("#", "-")}` : null); return; }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { const b = document.querySelector('.dlg [data-act="start-go"], .dlg [data-act="again-go"], .dlg [data-act="publish"]'); if (b && !b.disabled) b.click(); return; }
    if (V.dialogKey && V.dialogKey(e)) return;
    const sw = e.target.closest && e.target.closest(".sw");
    if (sw && (e.key === "ArrowLeft" || e.key === "ArrowRight")) { e.preventDefault(); const sib = [...sw.parentElement.children], k = sib.indexOf(sw); sib[(k + 1) % sib.length].click(); return; }
    if (e.key === "Tab") { const f = [...document.querySelectorAll(".dlg button:not(:disabled), .dlg input, .dlg textarea, .dlg a[href], .dlg [tabindex='0']")].filter((x) => x.offsetParent); const k = f.indexOf(document.activeElement); if (e.shiftKey && k <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && k === f.length - 1) { e.preventDefault(); f[0].focus(); } }
    return;
  }
  if (S.menu) {
    if (e.key === "Escape") { const b = S.menu === "more" ? "more-btn" : "fmenu-btn"; S.menu = null; render(); document.getElementById(b).focus(); return; }
    const mi = e.target.closest && e.target.closest("#menu .mi, #more-menu .mi");
    if (mi && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); const all = [...mi.parentElement.querySelectorAll(".mi")]; const k = all.indexOf(mi); all[(k + (e.key === "ArrowDown" ? 1 : all.length - 1)) % all.length].focus(); }
    return;
  }
  if (inField) return;
  if (S.place === "review") {
    if (e.key === "Escape" && S.panel) { S.panel = null; render(); return; }
    if (e.key === "Escape" && S.edit) { const n = S.edit; S.edit = null; render(V.key === "b" ? `#frh-${n}` : `#fnd-${n}`); return; }
    if (V.onKey && V.onKey(e)) return;
    return;
  }
  if (e.key === "Escape" && S.open) { const r = S.open; S.open = null; render(`p-${r.replace("#", "-")}`); return; }
  const el = e.target.closest && e.target.closest("#lst [data-nav]"); if (!el) return;
  const all = navs(), k = all.indexOf(el), ref = el.dataset.pr;
  const move = (to) => { if (!to) return; all.forEach((x) => { x.tabIndex = -1; }); to.tabIndex = 0; to.focus(); to.scrollIntoView({ block: "nearest" }); S.focusId = to.id; };
  if (e.key === "ArrowDown") { e.preventDefault(); move(all[k + 1]); }
  else if (e.key === "ArrowUp") { e.preventDefault(); move(all[k - 1]); }
  else if (e.key === "Home") { e.preventDefault(); move(all[0]); }
  else if (e.key === "End") { e.preventDefault(); move(all[all.length - 1]); }
  else if ((e.key === "ArrowRight" || e.key === "ArrowLeft")) {
    e.preventDefault(); const exp = e.key === "ArrowRight";
    if (el.dataset.grp && el.hasAttribute("aria-expanded")) { S.fold[el.dataset.grp] = !exp; render(el.id); }
    else if (!exp) { let h = el; while (h && !h.dataset.grp) h = all[all.indexOf(h) - 1]; if (h) { S.fold[h.dataset.grp] = true; render(h.id); } }
  }
  else if (e.key === "Enter") { e.preventDefault(); if (ref) openPR(ref); else if (el.hasAttribute("aria-expanded")) { S.fold[el.dataset.grp] = el.getAttribute("aria-expanded") === "true"; render(el.id); } }
  else if (e.key.toLowerCase() === "r" && ref && !e.ctrlKey) { e.preventDefault(); startFrom(ref); }
  else if (e.key.toLowerCase() === "o" && ref && !e.ctrlKey) { e.preventDefault(); toast(`Opens ${ref} on GitHub`); }
});

// ---------------- ?audit: round 10's, with this round's geometry ----------------
function auditR() {
  audit();
  const pre = document.getElementById("report"), out = JSON.parse(pre.textContent);
  const frac = (v) => Math.abs(v - Math.round(v)) > 0.01; const bad = []; let n = 0;
  [".cr", ".sech", ".fbar", ".lst-in", ".cardp", ".dlg", ".readfail", ".fcol", ".fr", ".fnd", ".pubc", ".left", ".warnstrip", ".stale"].forEach((sel) => document.querySelectorAll(sel).forEach((el) => {
    const r = el.getBoundingClientRect(); if (!r.width && !r.height) return; n++;
    const f = ["left", "top", "width", "height"].filter((k) => frac(r[k])); if (f.length) bad.push(`${sel} ${f.map((k) => `${k}=${r[k].toFixed(2)}`).join(" ")}`);
  }));
  const cutRows = [...document.querySelectorAll(".cr .tl, .cr .col .t, .fr .ftt, .cd-rev .nm")].filter((el) => el.offsetParent && el.scrollWidth > el.clientWidth + 0.5 && !el.dataset.tip).map((el) => el.textContent.trim().slice(0, 40));
  const narrow = [...document.querySelectorAll(".prr .tlw")].filter((el) => el.offsetParent && el.clientWidth < el.closest(".cr").clientWidth / 3).length;
  Object.assign(out, { scene: SCN, variation: V.key, roundGeometryChecked: n, roundGeometryFractional: bad, roundCutWithoutTooltip: cutRows, rowsWithTitleUnderAThird: narrow });
  pre.textContent = JSON.stringify(out, null, 1);
}
document.addEventListener("DOMContentLoaded", () => {
  if (window.SPECIMEN) return;
  document.body.insertAdjacentHTML("beforeend", `<div id="app" class="app ${V.key}"></div><div class="toasts" role="status" aria-live="polite" aria-label="Notifications"></div><pre id="report" class="report" hidden></pre>`);
  bootCommon(() => render());
  document.body.insertAdjacentHTML("afterbegin", SPRITE_R);
  addEventListener("resize", layout);
  if (SCN === "publish" || CLEAN) S.bornPub = true;
  if (SCN === "findings") S.bornPub = false;
  render();
  if (S.dialog) focusDialog();
  else if (S.place === "gone") document.getElementById("gone-next").focus();
  else if (S.place === "list") { const r = document.querySelector('#lst [tabindex="0"]'); if (r) r.focus({ preventScroll: true }); }
  else if (V.initFocus) V.initFocus();
  if (document.fonts) document.fonts.ready.then(() => { layout(); markTruncated(); });
  if (Q.has("audit")) setTimeout(auditR, 1400);
});
