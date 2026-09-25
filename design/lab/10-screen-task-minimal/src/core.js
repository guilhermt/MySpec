/* =====================================================================
   ROUND 09 · shared atoms: the sidebar of round 08, the entries of a
   conversation, the cards, the ask bar, the composer, tooltips and audits.
   Each variation (a.js, b.js) arranges them in its own model.
   ===================================================================== */
const Q = new URLSearchParams(location.search);
const SPRITE = `<svg class="sprite" aria-hidden="true">
  <symbol id="i-task" viewBox="0 0 16 16"><rect x="2.5" y="2.5" width="11" height="11" rx="3"/><path d="M5.5 6.5h5M5.5 9.5h3"/></symbol>
  <symbol id="i-oneshot" viewBox="0 0 16 16"><rect x="2.5" y="2.5" width="11" height="11" rx="3"/><path class="fill" d="M8.9 4.6 5.9 8.7h2.2l-.9 2.8 3-4.1H8z"/></symbol>
  <symbol id="i-review" viewBox="0 0 16 16"><circle cx="4.5" cy="3.8" r="1.6"/><circle cx="4.5" cy="12.2" r="1.6"/><circle cx="11.5" cy="12.2" r="1.6"/><path d="M4.5 5.4v5.2M11.5 10.6V7a2 2 0 0 0-2-2H7.4"/><path d="M8.8 3.5 7.3 5l1.5 1.5"/></symbol>
  <symbol id="i-discussion" viewBox="0 0 16 16"><path d="M3 4.4A1.4 1.4 0 0 1 4.4 3h7.2A1.4 1.4 0 0 1 13 4.4v5.2A1.4 1.4 0 0 1 11.6 11H7.2L4.2 13.3V11A1.4 1.4 0 0 1 3 9.6z"/></symbol>
  <symbol id="i-left" viewBox="0 0 16 16"><path d="M10 3.5 5.5 8l4.5 4.5"/></symbol>
  <symbol id="i-right" viewBox="0 0 16 16"><path d="M6 3.5 10.5 8 6 12.5"/></symbol>
  <symbol id="i-down" viewBox="0 0 16 16"><path d="M4 6l4 4 4-4"/></symbol>
  <symbol id="i-go" viewBox="0 0 16 16"><path d="M5.5 10.5l5-5M6.5 5.5h4v4"/></symbol>
  <symbol id="i-more" viewBox="0 0 16 16"><circle cx="3.5" cy="8" r=".9" class="fill"/><circle cx="8" cy="8" r=".9" class="fill"/><circle cx="12.5" cy="8" r=".9" class="fill"/></symbol>
  <symbol id="i-pause" viewBox="0 0 16 16"><path d="M6 4v8M10 4v8"/></symbol>
  <symbol id="i-plus" viewBox="0 0 16 16"><path d="M8 3.5v9M3.5 8h9"/></symbol>
  <symbol id="i-collapse" viewBox="0 0 16 16"><rect x="2.5" y="3" width="11" height="10" rx="2"/><path d="M6.5 3v10"/></symbol>
  <symbol id="i-history" viewBox="0 0 16 16"><path d="M2.8 8a5.2 5.2 0 1 0 1.5-3.7"/><path d="M2.6 2.8v2.4H5"/><path d="M8 5.3V8l1.8 1.3"/></symbol>
  <symbol id="i-settings" viewBox="0 0 16 16"><path d="M3 4.5h6M12 4.5h1M3 11.5h1M7 11.5h6"/><circle cx="10.5" cy="4.5" r="1.5"/><circle cx="5.5" cy="11.5" r="1.5"/></symbol>
  <symbol id="i-theme" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.2"/><path class="fill" d="M8 2.8a5.2 5.2 0 0 1 0 10.4z"/></symbol>
  <symbol id="i-check" viewBox="0 0 16 16"><path d="M3.8 8.4l2.7 2.6 5.7-6"/></symbol>
  <symbol id="i-x" viewBox="0 0 16 16"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></symbol>
  <symbol id="i-ban" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5"/><path d="M4.6 11.4l6.8-6.8"/></symbol>
  <symbol id="i-play" viewBox="0 0 16 16"><path d="M5.5 3.8v8.4L12 8z"/></symbol>
  <symbol id="i-hold" viewBox="0 0 16 16"><path d="M4.5 2.5h7M4.5 13.5h7"/><path d="M5.5 2.5c0 3 5 3.6 5 5.5s-5 2.5-5 5.5M10.5 2.5c0 3-5 3.6-5 5.5s5 2.5 5 5.5"/></symbol>
  <symbol id="i-bot" viewBox="0 0 16 16"><rect x="3" y="5" width="10" height="8" rx="2"/><path d="M8 2.5V5M6 9h.01M10 9h.01"/></symbol>
  <symbol id="i-review-s" viewBox="0 0 16 16"><path d="M2.5 8s2-4 5.5-4 5.5 4 5.5 4-2 4-5.5 4-5.5-4-5.5-4z"/><circle cx="8" cy="8" r="1.6"/></symbol>
  <symbol id="i-code" viewBox="0 0 16 16"><path d="M6 4.5 2.5 8 6 11.5M10 4.5 13.5 8 10 11.5"/></symbol>
  <symbol id="i-up" viewBox="0 0 16 16"><path d="M8 12.5v-9M4 7.5l4-4 4 4"/></symbol>
  <symbol id="i-arrow-down" viewBox="0 0 16 16"><path d="M8 3.5v9M4 8.5l4 4 4-4"/></symbol>
  <symbol id="i-file" viewBox="0 0 16 16"><path d="M4 2.5h5l3 3v8H4z"/><path d="M9 2.5v3h3"/></symbol>
  <symbol id="i-filecheck" viewBox="0 0 16 16"><path d="M4 2.5h5l3 3v8H4z"/><path d="M9 2.5v3h3"/><path d="M6 9.6l1.4 1.3L10 8.3"/></symbol>
  <symbol id="i-list" viewBox="0 0 16 16"><path d="M6.5 4.5h6M6.5 8h6M6.5 11.5h6"/><path d="M3.5 4.5h.01M3.5 8h.01M3.5 11.5h.01"/></symbol>
  <symbol id="i-commit" viewBox="0 0 16 16"><circle cx="8" cy="8" r="2.4"/><path d="M2.5 8h3.1M10.4 8h3.1"/></symbol>
  <symbol id="i-pr" viewBox="0 0 16 16"><circle cx="4.5" cy="3.8" r="1.6"/><circle cx="4.5" cy="12.2" r="1.6"/><circle cx="11.5" cy="12.2" r="1.6"/><path d="M4.5 5.4v5.2M11.5 10.6V7a2 2 0 0 0-2-2H7.4"/><path d="M8.8 3.5 7.3 5l1.5 1.5"/></symbol>
  <symbol id="i-merge" viewBox="0 0 16 16"><circle cx="4.5" cy="3.8" r="1.6"/><circle cx="4.5" cy="12.2" r="1.6"/><circle cx="11.5" cy="8" r="1.6"/><path d="M4.5 5.4v5.2M4.5 5.4c0 2.2 2.4 2.6 5.4 2.6"/></symbol>
  <symbol id="i-flag" viewBox="0 0 16 16"><path d="M4 13.5v-10M4 3.5h7.5l-1.6 2.6 1.6 2.6H4"/></symbol>
  <symbol id="i-archive" viewBox="0 0 16 16"><rect x="2.5" y="3" width="11" height="3" rx="1"/><path d="M3.5 6v6.5h9V6M6.5 8.5h3"/></symbol>
  <symbol id="i-product" viewBox="0 0 16 16"><path d="M3 5.5 8 3l5 2.5v5L8 13l-5-2.5z"/><path d="M3 5.5 8 8l5-2.5M8 8v5"/></symbol>
  <symbol id="i-mark" viewBox="0 0 16 16"><path d="M3.5 12.5h3v-3h3v-3h3"/><path d="M12.5 3.5v3"/></symbol>
  <symbol id="i-copy" viewBox="0 0 16 16"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5V4A1.5 1.5 0 0 0 9 2.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5"/></symbol>
  <symbol id="i-alert" viewBox="0 0 16 16"><path d="M8 2.5 14 13H2z"/><path d="M8 6.5v3M8 11.2h.01"/></symbol>
  <symbol id="i-models" viewBox="0 0 16 16"><circle cx="8" cy="8" r="2"/><path d="M8 2.5v2M8 11.5v2M2.5 8h2M11.5 8h2M4.1 4.1l1.4 1.4M10.5 10.5l1.4 1.4M4.1 11.9l1.4-1.4M10.5 5.5l1.4-1.4"/></symbol>
  <symbol id="i-external" viewBox="0 0 16 16"><path d="M9 3.5h3.5V7M12.5 3.5 7.5 8.5M11 9.5v3H3.5V5h3"/></symbol>
  <symbol id="i-user" viewBox="0 0 16 16"><circle cx="8" cy="5.5" r="2.5"/><path d="M3.5 13c.6-2.3 2.4-3.5 4.5-3.5s3.9 1.2 4.5 3.5"/></symbol>
  <symbol id="i-send" viewBox="0 0 16 16"><path d="M8 12.5v-9M4 7.5l4-4 4 4"/></symbol>
  <symbol id="i-compact" viewBox="0 0 16 16"><path d="M4 6.5h8M4 9.5h8M8 2.5v2.5M6.5 3.5 8 5l1.5-1.5M8 13.5V11M6.5 12.5 8 11l1.5 1.5"/></symbol>
  <symbol id="i-branch" viewBox="0 0 16 16"><circle cx="5" cy="3.8" r="1.6"/><circle cx="5" cy="12.2" r="1.6"/><circle cx="11" cy="5.5" r="1.6"/><path d="M5 5.4v5.2M11 7.1c0 2.4-2.6 2.9-6 3.5"/></symbol>
  <symbol id="i-vscode" viewBox="0 0 16 16"><path d="M11.5 2.5v11L4 8.6M11.5 2.5 4 7.4M2.5 6.2l1.5 1.2v1.2L2.5 9.8"/></symbol>
</svg>`;

// ---------------- Atoms ----------------
const I = (id, cls = "i") => `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const st = (t, label, extra = "") => `<span class="st st-${t} ${extra}" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}></span>`;
const TONE_WORD = { error: "error", wait: "waiting for you", close: "ready to close", run: "agent working", gh: "waiting on GitHub", paused: "paused", idle: "idle" };
const SEV = { error: 0, wait: 1, close: 2 };
const tipWord = (s) => s.sev === "error" ? "Error · waiting for you" : s.sev === "close" ? "Ready to close" : "Waiting for you";
const tw = (s) => `<span class="tw tw-${s.sev}" data-tip="${tipWord(s)} for ${s.long}"><span class="sr">${s.sev === "error" ? "error, " : ""}waiting for you </span>${s.since}</span>`;
const tt = (r) => `<span class="tt" data-tip="Agent working on this turn for ${r.long}"><span class="sr">agent working </span>${r.turn}</span>`;
const ctxm = (p, cls = "") => `<span class="ctx ${cls}" data-tip="Context window ${p}% used" role="meter" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100" aria-label="Context window"><span class="trk"><span class="fil" style="--p:${p}"></span></span><span class="pc">${p}%</span></span>`;
const ty = (i) => `<svg class="ty" aria-hidden="true"><use href="#i-${i.kind === "task" ? (i.oneshot ? "oneshot" : "task") : i.kind}"/></svg>`;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

// ---------------- The tree (round 08), with the open task's row from the scene ----------------
const REPOS = { api: "acme/api", web: "acme/web", ios: "acme/ios", android: "acme/android", infra: "acme/infra" };
const ITEMS = {
  t1: { kind: "task", name: "Rate limit per API key", repo: "api", card: 412 },
  t7: { kind: "task", name: "Rotate API keys without downtime", repo: "api", card: 441,
    pos: "Step 2/5 · Reviewer · pass 2", posShort: "Step 2/5 · pass 2",
    run: { who: "Reviewer", turn: "3m", long: "3 minutes 20 seconds", verb: "Running", target: "go test ./internal/keys/...", short: "go test …/keys" }, ctx: 57 },
  t3: { kind: "task", name: "Retry failed billing webhooks", repo: "api", card: 430,
    sits: [{ sev: "wait", label: "Question", place: "Tech spec", since: "12m", long: "12 minutes", min: 12 }], row: ["Question · Tech spec", "Question · Tech spec"], pos: "Tech spec" },
  t8: { kind: "task", name: "Deprecate v1 webhooks", repo: "api", card: 449,
    sits: [{ sev: "error", label: "Session error", place: "Plan", since: "7m", long: "7 minutes", min: 7 }], row: ["Session error · Plan", "Session error · Plan"], pos: "Plan" },
  d1: { kind: "discussion", name: "Usage-based pricing tiers", cards: [455, 461], pos: "Discussing · 2 cards", posShort: "Discussing",
    run: { who: "Agent", turn: "1m", long: "1 minute 5 seconds", verb: "Reading", target: "web/src/billing/plans.ts", short: "…/plans.ts" }, ctx: 17 },
  t2: { kind: "task", name: "Offline sync for drafts", repo: "ios", card: 88, oneshot: true, gh: true, pos: "PR review · checks 3/5" },
  t4: { kind: "task", name: "Haptics on complete", repo: "ios", card: 95,
    sits: [{ sev: "close", label: "Ready to close", place: "PR #1279 merged", since: "2h", long: "2 hours", min: 120 }], row: ["Ready to close · PR #1279 merged", "Ready to close · #1279"], pos: "Closing" },
  t5: { kind: "task", name: "Widget for today's tasks", repo: "ios", card: 93,
    sits: [{ sev: "error", label: "Step 2 blocked", place: "worktree not clean", since: "41m", long: "41 minutes", min: 41 }], row: ["Step 2/4 blocked · worktree not clean", "Step 2/4 blocked"], pos: "Step 2 of 4" },
  d2: { kind: "discussion", name: "Offline mode on mobile", cards: [101, 87],
    sits: [{ sev: "wait", label: "Decide drafts", place: "3 of 6 decided", since: "22m", long: "22 minutes", min: 22 }], row: ["Decide drafts · 3 of 6 decided", "Decide drafts · 3/6"], pos: "Decide drafts" },
  t6: { kind: "task", name: "Terraform 1.9 upgrade", repo: "infra", paused: true, pos: "Paused · PRD" },
  r1: { kind: "review", name: "Migrate settings page to react-hook-form", repo: "web", pr: 2291,
    sits: [{ sev: "wait", label: "Decide findings", place: "pass 1", since: "34m", long: "34 minutes", min: 34 }], row: ["Decide findings · pass 1 · 5 of 9", "Decide findings · 5/9"], pos: "Pass 1" },
  r2: { kind: "review", name: "Crash on share sheet when offline", repo: "ios", pr: 312, idle: true, pos: "Published · changes requested" },
};
const OPEN = "t1";
const TREE = [
  { id: "reviews", label: "Reviews", tip: "Open Reviews", extra: `<span class="x">4 pending</span>`, items: ["r1", "r2"] },
  { id: "plat", label: "Platform Roadmap", tip: "Open the Platform Roadmap board", epics: [{ id: "ep", label: "API hardening", tip: "API hardening · epic", items: ["t1", "t7"] }], items: ["t3", "t8", "d1"] },
  { id: "mob", label: "Mobile App", tip: "Open the Mobile App board", extra: `<span class="x warn" data-tip="Last read failed 18m ago · GitHub API rate limit"><span class="st st-warn" aria-hidden="true"></span>Read failed</span>`, items: ["t2", "t4", "t5", "d2"] },
  { id: "nob", label: "No board", tip: "Items without a board", notices: ["infra"], items: ["t6"] },
];
const sortSits = (s) => [...(s || [])].sort((a, b) => SEV[a.sev] - SEV[b.sev] || b.min - a.min);
const needsYou = (i) => !!(i.sits && i.sits.length);
const tone = (i) => needsYou(i) ? sortSits(i.sits)[0].sev : i.run ? "run" : i.gh ? "gh" : i.paused ? "paused" : "idle";
const kindWord = (i) => i.kind === "task" ? (i.oneshot ? "One-Shot task" : "task") : i.kind === "review" ? "pull request review" : "discussion";
function meta(i) {
  if (i.kind === "task") return (i.card ? `${i.repo}#${i.card}` : i.repo) + (i.oneshot ? " · One-Shot" : "");
  if (i.kind === "review") return `${i.repo}#${i.pr}`;
  return `#${i.cards.join(" #")}`;
}
function ariaFor(i) {
  const p = [`${kindWord(i)} ${i.name}`];
  if (needsYou(i)) p.push(sortSits(i.sits).map((s) => `${TONE_WORD[s.sev]}: ${s.label} · ${s.place}, for ${s.long}`).join("; "), i.pos);
  else p.push(`${TONE_WORD[tone(i)]}, ${i.pos}`);
  if (i.run) p.push(`${i.run.who} working for ${i.run.long}: ${i.run.verb} ${i.run.target}`, `context ${i.ctx}% used`);
  p.push(meta(i));
  return p.join(". ");
}
function nextJ() {
  return Object.keys(ITEMS).filter((id) => id !== OPEN && needsYou(ITEMS[id])).sort((a, b) => {
    const x = sortSits(ITEMS[a].sits)[0], y = sortSits(ITEMS[b].sits)[0];
    return SEV[x.sev] - SEV[y.sev] || y.min - x.min;
  })[0];
}
function itemRow(id, level) {
  const i = ITEMS[id], t = tone(i), sel = id === OPEN;
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
  return `<div class="it ${cls}" role="treeitem" aria-level="${level}" tabindex="${sel ? 0 : -1}" ${sel ? 'aria-current="page" aria-selected="true"' : ""} data-meta="${meta(i)}" aria-label="${ariaFor(i)}">
    <span class="c1">${ty(i)}</span><span class="nm trunc">${i.name}</span><span class="r1">${r1}</span>
    <span class="c1">${st(t)}</span><span class="l2">${l2}</span><span class="r2">${r2}</span>${l3}</div>`;
}
function nodeRow(n, level, kind, owns = "") {
  const go = kind !== "epic" ? I("go", "i go") : "";
  return `<div class="node ${kind}" role="treeitem" aria-level="${level}" aria-expanded="true" ${owns ? `aria-owns="${owns}"` : ""} tabindex="-1" data-tip="${n.tip || n.label}">${I("down", "i chev")}<span class="lbl trunc">${n.label}${go}</span>${n.extra || "<span></span>"}</div>`;
}
function noticeRow(r) {
  return `<div class="it notice" role="treeitem" aria-level="2" tabindex="-1" aria-label="acme/${r}: the clone at ~/code/${r} is missing. Enter to change the path." data-tip="The clone at ~/code/${r} is missing">
    <span class="c1">${st("warn")}</span><span class="nm plain trunc">${r} · clone missing</span><span class="r1"><span class="hint" aria-hidden="true">Change path ↵</span></span></div>`;
}
const THEME_WORD = { system: "System", light: "Light", dark: "Dark" };
let MODE = ["light", "dark"].includes(Q.get("theme")) ? Q.get("theme") : "system";
function sidebar() {
  let t = "";
  TREE.forEach((n) => {
    let g = "";
    (n.notices || []).forEach((r) => { g += noticeRow(r); });
    (n.epics || []).forEach((e) => { g += nodeRow(e, 2, "epic", `g-${e.id}`) + `<div class="grp epic-grp" role="group" id="g-${e.id}">${e.items.map((id) => itemRow(id, 3)).join("")}</div>`; });
    n.items.forEach((id) => { g += itemRow(id, 2); });
    t += `<div class="sec" role="none">${nodeRow(n, 1, n.id === "reviews" ? "reviews" : "board", `g-${n.id}`)}<div class="grp" role="group" id="g-${n.id}">${g}</div></div>`;
  });
  return `<aside class="sb" aria-label="Work">
    <div class="sb-top"><span class="brand grow"><span class="mark">${I("mark", "")}</span>MySpec</span>
      <button class="btn new sm" data-tip="New task, review or discussion · Ctrl+N" aria-haspopup="menu">${I("plus")}New${I("down", "i")}</button>
      <button class="btn ghost sm icon" data-tip="Collapse the sidebar" aria-label="Collapse the sidebar">${I("collapse")}</button></div>
    <div class="sb-filter"><label class="sr" for="repo-filter">Repository filter</label><span class="select-wrap"><select id="repo-filter" class="input"><option>All repositories</option>${Object.values(REPOS).map((r) => `<option>${r}${r === "acme/infra" ? " · clone missing" : r === "acme/android" ? " · not cloned" : ""}</option>`).join("")}</select>${I("down")}</span></div>
    <div class="sb-tree" id="tree" role="tree" aria-label="Active items">${t}<div class="sb-tree-end" role="none"></div><div class="sb-more" id="sb-more" role="none" hidden><button type="button" tabindex="-1" id="sb-more-btn">${I("arrow-down")}<span></span></button></div></div>
    <div class="sb-foot"><button class="btn ghost sm" data-tip="23 archived: 17 tasks, 4 reviews, 2 discussions">${I("history")}History <span class="cnt">23</span></button><span class="grow"></span>
      <button class="btn ghost sm icon" id="theme-btn" data-tip="Theme: ${THEME_WORD[MODE]} · click to change" aria-label="Theme: ${THEME_WORD[MODE]}">${I("theme")}</button><button class="btn ghost sm" data-tip="Settings · Ctrl+,">${I("settings")}Settings</button></div>
  </aside>`;
}

// ---------------- Header pieces shared by both variations ----------------
function crumbs() {
  return `<nav class="crumbs" aria-label="Breadcrumb"><span class="up row crumb-path">
    <button class="ellb" aria-haspopup="menu" aria-label="Show the hidden levels: Platform Roadmap, API hardening" data-tip="Platform Roadmap / API hardening">…</button>
    <span class="board row crumb-path"><a href="#">Platform Roadmap</a><span class="gt" aria-hidden="true">/</span></span>
    <span class="epicl row crumb-path"><a href="#">API hardening</a><span class="gt" aria-hidden="true">/</span></span></span></nav>`;
}
const NAVBTNS = `<div class="navbtns"><button class="btn ghost sm icon" data-tip="Back to Platform Roadmap · Alt+←" aria-label="Back to Platform Roadmap">${I("left")}</button><button class="btn ghost sm icon" disabled data-tip="Nothing ahead" aria-label="Forward">${I("right")}</button></div>`;
function tools(sc, opts = {}) {
  const P = S.panel;
  const pb = (n) => `<button class="btn ghost" aria-pressed="${P === n}" data-panel="${n}" data-tip="${n === "Details" ? "Facts of the task: repository, branch, worktree, checks" : n === "Artifacts" ? "PRD, tech spec, steps and reports" : "The card acme/api#412 on the board"}">${n}</button>`;
  const paused = sc.paused;
  return `<div class="ih-tools">${sc.ctx != null ? ctxm(sc.ctx) : `<span class="ctx is-empty" data-tip="No session is open">—</span>`}
    <button class="btn ghost sm pz" aria-label="${paused ? "Resume" : "Pause"} the task" data-tip="${paused ? "Resume the task" : "Pause the task · the session that works stops"}">${I(paused ? "play" : "pause")}<span class="lbl-long">${paused ? "Resume" : "Pause"}</span></button><span class="sep"></span>
    <button class="btn ghost sm wide" aria-haspopup="menu" data-tip="Review mode of the steps not started">${I("bot")}Agent${I("down")}</button><button class="btn ghost sm wide" aria-haspopup="menu" data-tip="Model and effort per stage">Models${I("down")}</button><span class="sep wide"></span>
    <div class="tgroup" role="group" aria-label="Panels">${pb("Details")}${pb("Artifacts")}${pb("Card")}</div>
    <button class="btn ghost sm icon" data-tip="${opts.more || "Review mode, models, back to a stage, discard step, delete the task"}" aria-label="More actions" aria-haspopup="menu">${I("more")}</button></div>`;
}

// ---------------- Conversation entries ----------------
const VOICE = {
  impl: { name: "Implementer", icon: "bot", cls: "" },
  rev: { name: "Reviewer", icon: "review-s", cls: "rev" },
  agent: { name: "Agent", icon: "bot", cls: "" },
};
function AG(v, html, at, role = "") {
  const w = VOICE[v];
  return `<div class="e-agent ${w.cls}"><div class="who"><span class="av">${I(w.icon)}</span>${w.name}${role ? `<span class="role">· ${role}</span>` : ""}<span class="t">${at}</span></div><div class="prose">${html}</div></div>`;
}
function US(html, at, to) {
  return `<div class="e-user-wrap"><div class="who">You${to ? `<span class="to">→ ${to}</span>` : ""}<span class="t">${at}</span></div><div class="e-user">${html}</div></div>`;
}
function QUEUED(html, to) {
  return `<div class="e-user-wrap"><div class="queued-meta">${I("history")}Queued${to ? ` for the ${to.toLowerCase()}` : ""} · sends when the turn ends<button class="btn ghost xs" data-tip="Remove the message from the queue">Remove</button></div><div class="e-user queued">${html}</div></div>`;
}
const MK = (icon, t, time) => `<div class="e-marker" role="separator">${I(icon)}<span>${t}</span>${time ? `<span class="t">· ${time}</span>` : ""}</div>`;
// A milestone inside a conversation: an icon tile, a strong label, the time, a line below, actions at the right.
function EV(icon, label, at, sub = "", act = "", cls = "") {
  return `<div class="ev ${cls}" role="group" aria-label="${label.replace(/<[^>]+>/g, "")}"><span class="ev-ic">${I(icon)}</span><div class="ev-tx"><span class="ev-l">${label}</span> <span class="t">· ${at}</span>${sub ? `<div class="ev-sub">${sub}</div>` : ""}</div><span class="ev-act">${act}</span></div>`;
}
// A milestone that opens in place: the document or the report is read without a panel.
function EVX(icon, label, at, sub, body, opts = {}) {
  return `<details class="evx ${opts.cls || ""}" ${opts.open ? "open" : ""}><summary class="ev" aria-label="${label.replace(/<[^>]+>/g, "")}, ${opts.readWord || "read here"}"><span class="ev-ic">${I(icon)}</span><div class="ev-tx"><span class="ev-l">${label}</span> <span class="t">· ${at}</span>${sub ? `<div class="ev-sub">${sub}</div>` : ""}</div><span class="rd">${I("right")}<span class="closed-l">${opts.readWord || "Read here"}</span><span class="open-l">Close</span></span></summary>${body}</details>`;
}
function DOC(name, at, sub, excerpt, opts = {}) {
  return EVX("filecheck", `${opts.verb || "Written"} <span class="n">${name}</span>`, at, sub,
    `<div class="docbody prose">${excerpt}</div><div class="docfoot"><button class="btn ghost xs" data-panel="Artifacts">${I("file")}Open in Artifacts</button><span>${opts.words || ""}</span></div>`, opts);
}
function REPORT(pass, clean, n, at, items, opts = {}) {
  const label = `Review ${pass} written <span class="n">· ${clean ? "clean" : `changes · ${n} finding${n === 1 ? "" : "s"}`}</span>`;
  const body = clean ? `<div class="docbody full prose"><p>${items}</p></div>` : `<div class="docbody full"><ol class="flist">${items.map((f, k) => `<li><span class="fn">${k + 1}</span><span>${f[1]}<span class="loc">${f[0]}</span></span></li>`).join("")}</ol></div>`;
  return EVX(clean ? "filecheck" : "file", label, at, opts.sub || `reviews/step-0${opts.step || 3}/review-${pass}.md`, body, opts);
}
function HAND(to, what, at, full, opts = {}) {
  return `<details class="evx hand ${opts.cls || ""}"><summary class="ev" aria-label="MySpec sent to the ${to.toLowerCase()}: ${what.replace(/<[^>]+>/g, "")}, show the message"><span class="ev-ic">${I("product")}</span><div class="ev-tx"><span class="ev-l">MySpec <span class="arrow">→</span> ${to}</span> <span class="n">${what}</span> <span class="t">· ${at}</span></div><span class="rd">${I("right")}<span class="closed-l">Show message</span><span class="open-l">Hide</span></span></summary><div class="appbody"><div class="e-app">${full}</div></div></details>`;
}
function COMMIT(sha, subject, at, sub = "") {
  return EV("commit", `Committed <span class="sha">${sha}</span> <span class="n">${subject}</span>`, at, sub, "", "commit");
}
// Action groups. rows: [label, command or target, status, note]. The label is the description the agent wrote
// for a Bash command ("Run the rate limit tests"), or the verb of another tool; the command follows in mono.
// A row whose status is "agent" is a subagent: rows[4] holds its own group, nested and collapsed.
function ACTS(g) {
  const ic = (s) => s === "done" ? `<span class="ic ok-ic">${I("check")}</span>` : s === "error" ? `<span class="ic err-ic">${I("x")}</span>` : s === "interrupted" ? `<span class="ic ok-ic">${I("ban")}</span>` : s === "wait" ? `<span class="ic hold-ic">${I("hold")}</span>` : s === "agent" ? `<span class="ic ok-ic">${I("bot")}</span>` : `<span class="ic">${st("run")}</span>`;
  const sumIcon = g.live ? `<span class="ic">${st("run")}</span>` : g.fail && !g.recovered ? `<span class="ic err-ic">${I("x")}</span>` : g.hold ? `<span class="ic hold-ic">${I("hold")}</span>` : `<span class="ic ok-ic">${I("check")}</span>`;
  const roll = g.live
    ? `<span class="now-l"><span class="v">${g.live[0]}</span><span class="mono">${g.live[1]}</span></span>`
    : `<span class="roll">${g.roll}${g.fail ? ` <span class="${g.recovered ? "" : "bad"}">· ${g.fail} failed${g.recovered ? ", then passed" : ""}</span>` : ""}${g.hold ? " · 1 on hold" : ""}</span>`;
  const earlier = g.earlier ? `<li class="more-row"><button class="earlier" type="button">${I("up")}Show ${g.earlier} earlier actions</button></li>` : "";
  const row = (r) => {
    const [k, t, s, note, sub] = r;
    if (s === "agent") return `<li class="sub-agent"><details class="acts nested"><summary>${I("right", "i chev")}${ic("agent")}<span class="lbl2">${k}</span><span class="roll trunc" data-tip="${sub.roll}">${sub.roll}</span><span class="dur">${sub.dur}</span></summary><ul>${sub.rows.map(row).join("")}</ul></details></li>`;
    return `<li class="${s === "wait" || s === "running" ? "now" : s === "error" ? "e" : ""}">${ic(s)}<span class="lbl2">${k}</span><span class="tg trunc">${t}</span><span class="s">${note || (s === "done" ? "" : s)}</span></li>`;
  };
  return `<details class="acts ${g.live ? "live" : ""} ${g.cls || ""}" ${g.open ? "open" : ""}><summary>${I("right", "i chev")}${sumIcon}<span class="n">${g.n} action${g.n === 1 ? "" : "s"}</span>${roll}<span class="dur">${g.dur || ""}</span></summary>
    <ul>${earlier}${g.rows.map(row).join("")}</ul></details>`;
}
function ACTIVITY(who, text, time) {
  return `<div class="e-activity" role="status">${st("run")}<span>${who} working · <span class="t">${time}</span> · ${text}</span></div>`;
}
const codeHead = (lang, path) => `<div class="ch">${I("code")}<span>${lang}</span><span class="grow"></span><span class="mono trunc">${path}</span><button class="btn ghost xs icon" data-tip="Copy the code" aria-label="Copy the code">${I("copy")}</button></div>`;

// ---------------- Cards (requests) ----------------
let CARDN = 0;
function QCARD(q) {
  const id = `q${++CARDN}`;
  if (q.answered) return `<fieldset class="card answered" aria-labelledby="${id}"><div class="hd">${I("check", "i")}<span class="kind">Question</span><span>${q.place}</span><span class="grow"></span><span class="faint num">answered ${q.answeredAt}</span></div>
    <div class="bd"><div class="q sm" id="${id}">${q.q}</div><div class="ans">${I("check")}${q.answer}</div></div></fieldset>`;
  return `<fieldset class="card" ${q.live ? 'id="askcard"' : ""} aria-labelledby="${id}"><div class="hd">${st("wait")}<span class="kind">Question</span><span>${q.place}</span><span class="grow"></span><span class="faint num">asked ${q.at}</span></div>
    <div class="bd"><div class="q" id="${id}">${q.q}</div>${q.note ? `<div class="desc">${q.note}</div>` : ""}
    <div class="opts" role="radiogroup" aria-labelledby="${id}">${q.opts.map((o, k) => `<button class="opt" role="radio" aria-checked="false"><span class="kn">${k + 1}</span><span class="ot">${o[0]}<small>${o[1]}</small></span></button>`).join("")}
    <button class="opt" role="radio" aria-checked="false"><span class="kn">${q.opts.length + 1}</span><span class="ot">Other…<small>Write your own answer.</small></span></button></div>
    <div class="foot">Press 1–${q.opts.length + 1} with the focus here, or reply below.</div></div></fieldset>`;
}
function PCARD(p) {
  const id = `p${++CARDN}`;
  return `<fieldset class="card" ${p.live ? 'id="askcard2"' : ""} aria-labelledby="${id}"><div class="hd">${st("wait")}<span class="kind" id="${id}">Permission</span><span class="tag">${p.tool}</span><span>${p.place}</span><span class="grow"></span><span class="faint num">asked ${p.at}</span></div>
    <div class="bd"><div class="desc">${p.desc}</div><pre class="cmd">${p.cmd}</pre><div class="foot">${p.foot}</div>
    <div class="btns"><button class="btn ${p.primary ? "primary" : ""}">Allow <span class="k">1</span></button><button class="btn">Allow for this session <span class="k">2</span></button><button class="btn ghost">Deny… <span class="k">3</span></button></div></div></fieldset>`;
}
function ERR(h, text, detail, opts = {}) {
  return `<div class="e-error" role="group" aria-label="Error"><div class="h">${st("error")}${h}</div><span>${text}</span>${detail ? `<pre>${detail}</pre>` : ""}${opts.after || ""}</div>`;
}

// ---------------- The ask bar ----------------
// kinds: quiet (a card on screen), two (two requests on screen), tinted (no card), error, other (the other conversation waits)
function ASK(a) {
  if (!a) return "";
  const born = S.born ? "born" : "";
  const chip = (s) => tw(s);
  if (a.kind === "two") return `<div class="ask-in quiet ${born}" role="region" aria-label="What this item asks"><span class="sr" role="status">${a.reqs.map((r) => `${r.label} from the ${r.place}`).join(", ")}</span>
    ${a.reqs.map((r) => `<span class="req what">${st("wait")}<span class="lbl">${r.label}</span><span class="muted">· ${r.place}</span>${chip(r.s)}<button class="btn sm" data-show="${r.card}" data-tip="Go to the card · the first option takes the focus">${I("up")}Show</button></span>`).join("")}</div>`;
  const cls = a.kind === "error" ? "err" : a.kind === "quiet" || a.kind === "other" ? "quiet" : a.sev === "close" ? "close" : "";
  const g = a.kind === "error" ? "error" : a.sev === "close" ? "close" : "wait";
  return `<div class="ask-in ${cls} ${born}" role="region" aria-label="What this item asks"><span class="sr" role="status">${a.label} · ${a.place}</span>
    <span class="what">${st(g)}<span class="lbl">${a.label}</span>${a.place ? `<span class="muted">· ${a.place}</span>` : ""}${chip(a.s)}</span>
    ${a.detail ? `<span class="adet">${a.detail}</span>` : ""}<span class="acts-r">${a.actions}</span></div>`;
}

// ---------------- The composer ----------------
function COMPOSER(c) {
  const to = c.to ? `<button class="chip to" aria-haspopup="listbox" data-tip="Who the message goes to · ${c.toTip || "the implementer or the reviewer of step 3"}">${c.to === "Reviewer" ? `<span class="av rev">${I("review-s")}</span>` : `<span class="av">${I(c.toIcon || "bot")}</span>`}To ${/^[A-Z]{2}/.test(c.to) ? c.to : c.to.toLowerCase()}${I("down")}</button>` : "";
  const model = `<button class="chip" ${c.disabled ? "disabled" : ""} data-tip="Model and effort of this session, from the next message">${c.model || "Opus · high"}${c.disabled ? "" : I("down")}</button>`;
  if (c.disabled) return `<div class="cbox is-disabled"><label class="sr" for="reply">Reply</label><textarea id="reply" rows="1" disabled placeholder="${c.ph}"></textarea>
    <div class="cfoot">${to}${model}<span class="grow"></span><span class="why" id="why-send">${c.why || ""}</span><button class="btn sm" disabled aria-describedby="why-send">Send</button></div></div>`;
  const working = c.working ? `<span class="who-l">${st("run")}${c.working}</span><button class="btn sm" data-tip="Stop the answer · the session stays">${I("x")}Stop</button>` : "";
  const send = c.working ? "" : `<button class="btn sm ${c.primary ? "primary" : ""}" data-send data-tip="Send · Enter · Shift+Enter for a new line">Send</button>`;
  return `<div class="cbox"><label class="sr" for="reply">${c.label || "Reply"}</label><textarea id="reply" rows="2" placeholder="${c.ph}">${c.text || ""}</textarea>
    <div class="cfoot">${to}${model}<span class="grow"></span>${working}${send}</div></div>`;
}

// ---------------- The panels (closed by default) ----------------
function PANEL(name, sc) {
  let b = "";
  if (name === "Details") b = `<dl class="kv"><dt>Repository</dt><dd>acme/api · ~/code/api</dd><dt>Card</dt><dd><a href="#">acme/api#412</a> · In progress</dd><dt>Epic</dt><dd>API hardening</dd><dt>Mode</dt><dd>Structured · fixed</dd><dt>Review mode</dt><dd>Agent · step 4 is Manual</dd><dt>Branch</dt><dd class="mono">rate-limit-per-api-key</dd><dt>Base</dt><dd class="mono">dev</dd><dt>Worktree</dt><dd class="mono">~/.local/share/myspec/worktrees/acme/api/rate-limit-per-api-key</dd><dt>Started</dt><dd>Today 09:14</dd><dt>Last activity</dt><dd>${sc.now || "14:56"}</dd></dl>
    <div class="pgrp"><h3>Models</h3><dl class="kv"><dt>PRD</dt><dd>Opus · high</dd><dt>Tech spec</dt><dd>Opus · high</dd><dt>Plan</dt><dd>Opus · medium</dd><dt>Implementation</dt><dd>Sonnet · high</dd><dt>Step review</dt><dd>Opus · high</dd><dt>PR</dt><dd>Sonnet · medium</dd><dt>PR review</dt><dd>Opus · high</dd></dl></div>`;
  if (name === "Artifacts") b = `<div class="pgrp"><h3>Documents</h3><ul class="plist"><li>${I("file")}<span class="grow">PRD</span><span class="m">09:41</span></li><li>${I("file")}<span class="grow">Tech spec</span><span class="m">10:22</span></li></ul></div>
    <div class="pgrp"><h3>Steps · 7</h3><ul class="plist">${STEPS.map((s, k) => `<li>${k < (sc.doneSteps || 0) ? I("check") : st("todo")}<span class="grow">${k + 1} · ${s[0]}</span><span class="m">${s[1]}</span></li>${s[2] ? s[2].map((r) => `<li class="sub"><span class="grow">${r}</span></li>`).join("") : ""}`).join("")}</ul></div>
    <div class="pgrp"><h3>Pull request</h3><ul class="plist"><li>${I("file")}<span class="grow">Draft · Rate limit requests per API key</span></li></ul></div>`;
  if (name === "Card") b = `<div class="pgrp"><h3>acme/api#412 · In progress</h3><p style="margin:0" class="muted">Rate limit per API key</p></div><div class="prose" style="font-size:var(--text-body);line-height:var(--leading-body)"><p>Today every client shares one global limit in the gateway, so one noisy integration throttles everyone.</p><p>Limit each API key with its plan's burst and refill, and answer 429 with <code>Retry-After</code>.</p></div>
    <div class="pgrp"><h3>Epic · API hardening</h3><ul class="plist"><li>${st("run")}<span class="grow">#441 Rotate API keys without downtime</span></li><li>${st("todo")}<span class="grow">#415 Audit log for key changes</span></li></ul></div>`;
  return `<aside class="panel" id="panel" aria-label="${name}"><div class="panel-h"><h2>${name}</h2><button class="btn ghost sm icon" data-panel="${name}" aria-label="Close ${name}" data-tip="Close · Esc">${I("x")}</button></div><div class="panel-b">${b}</div></aside>`;
}
const STEPS = [
  ["Config for rate limits", "Sonnet · high", ["Review 1 · changes", "Review 2 · clean"]],
  ["Key lookup cache", "Sonnet · high", ["Review 1 · clean"]],
  ["Token bucket middleware", "Sonnet · high", null],
  ["Retry-After and rate limit headers", "Manual · Sonnet", null],
  ["Per-plan limits from the plans table", "Sonnet · high", null],
  ["Metrics for throttled requests", "Sonnet · medium", null],
  ["Docs and changelog", "Haiku", null],
];

// ---------------- Tooltips and truncation (round 08) ----------------
const within = (root, sel) => [...(root.matches && root.matches(sel) ? [root] : []), ...root.querySelectorAll(sel)];
function markTruncated(root = document) {
  within(root, ".it[data-meta]").forEach((row) => {
    if (row.classList.contains("jk-row")) return;
    const nm = row.querySelector(".nm"), r1 = row.querySelector(".r1"); if (!nm || !r1) return;
    row.classList.remove("meta-fits");
    r1.style.display = "inline-flex"; const mw = r1.offsetWidth; r1.style.display = "";
    const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
    const rg = document.createRange(); rg.selectNodeContents(nm); const need = Math.ceil(rg.getBoundingClientRect().width);
    if (need + gap + mw <= nm.clientWidth) row.classList.add("meta-fits");
  });
  within(root, ".it .l3").forEach((el) => { el.classList.remove("fit-short"); if (el.scrollWidth > el.clientWidth + 0.5) el.classList.add("fit-short"); });
  within(root, ".trunc").forEach((el) => {
    const long = el.querySelector(".long"); let full = (long || el).textContent.trim().replace(/\s+/g, " ");
    const row = el.classList.contains("nm") && el.closest(".it[data-meta]:not(.meta-fits):not(.jk-row)");
    if (row) full += " · " + row.dataset.meta;
    const cut = !!row || el.scrollWidth > el.clientWidth + 0.5 || (long && getComputedStyle(long).display === "none");
    if (cut) { if (!el.dataset.tip || el.dataset.cut) { el.dataset.tip = full; el.dataset.cut = "1"; } }
    else if (el.dataset.cut) { delete el.dataset.tip; delete el.dataset.cut; }
  });
}
(function tooltips() {
  let tip = null, timer = 0, owner = null;
  const delay = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--delay-tooltip")) || 500;
  const hide = () => { clearTimeout(timer); owner = null; if (tip) { tip.remove(); tip = null; } };
  const show = (el, now) => {
    hide(); owner = el;
    timer = setTimeout(() => {
      if (owner !== el || !document.contains(el)) return;
      tip = document.createElement("div"); tip.className = "tip"; tip.setAttribute("role", "tooltip");
      const m = el.dataset.tip.match(/^(.*?) · ((?:Ctrl|Alt|Enter|Esc)\S*(?: .*)?)$/);
      tip.innerHTML = m ? `<span>${m[1]}</span><span class="k">${m[2]}</span>` : `<span>${el.dataset.tip}</span>`;
      document.body.appendChild(tip);
      const tok = (t) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(t)) * 16;
      const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight, gap = tok("--space-1-5"), edge = tok("--space-2");
      let x = Math.round(Math.min(Math.max(edge, r.left + r.width / 2 - w / 2), innerWidth - w - edge));
      let y = Math.round(r.bottom + gap); if (y + h > innerHeight - edge) y = Math.round(r.top - gap - h);
      tip.style.left = x + "px"; tip.style.top = y + "px";
    }, now ? 0 : delay());
  };
  const remeasure = (t) => { const row = t.closest && t.closest(".it"); if (row) markTruncated(row); };
  document.addEventListener("pointerover", (e) => { remeasure(e.target); const el = e.target.closest("[data-tip]"); if (el && el !== owner) show(el); else if (!el) hide(); });
  document.addEventListener("focusin", (e) => { remeasure(e.target); const el = e.target.closest("[data-tip]") || (e.target.querySelector && e.target.querySelector(".nm[data-tip]")); if (el && e.target.matches(":focus-visible")) show(el, true); else hide(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") hide(); });
  document.addEventListener("scroll", hide, true);
  document.addEventListener("pointerdown", hide);
})();
function moreBelow() {
  const tree = document.getElementById("tree"), more = document.getElementById("sb-more"); if (!tree || !more) return;
  const bottom = tree.getBoundingClientRect().bottom - 8;
  const below = [...tree.querySelectorAll('.it[role="treeitem"]')].filter((r) => r.getBoundingClientRect().top + 12 > bottom);
  more.hidden = below.length === 0;
  if (below.length) more.querySelector("span").textContent = `${below.length} more below`;
}

// ---------------- The mock's scene switcher ----------------
function mockbar(scenes, cur) {
  return `<div class="mockbar" aria-label="Mock scenes"><span>Scene</span><select id="scene-sel" aria-label="Scene">${scenes.map(([k, n]) => `<option value="${k}" ${k === cur ? "selected" : ""}>${n}</option>`).join("")}</select></div>`;
}

// ---------------- ?audit: whole pixels, truncation and the contrast of every text on its ground ----------------
function parseColor(s) {
  s = s.trim();
  let m = s.match(/^rgba?\(([^)]+)\)$/);
  if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0] / 255, p[1] / 255, p[2] / 255, p[3] == null ? 1 : p[3]]; }
  m = s.match(/^color\(srgb ([^)]+)\)$/);
  if (m) { const p = m[1].split(/[ /]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] == null ? 1 : p[3]]; }
  m = s.match(/^oklch\(([^)]+)\)$/);
  if (m) {
    const p = m[1].split(/[ /]+/).filter(Boolean); const L = parseFloat(p[0]) * (p[0].endsWith("%") ? 0.01 : 1), C = parseFloat(p[1]), H = (parseFloat(p[2]) || 0) * Math.PI / 180, A = p[3] == null ? 1 : parseFloat(p[3]);
    const a = C * Math.cos(H), b = C * Math.sin(H);
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.2914855480 * b;
    const l = l_ ** 3, mm = m_ ** 3, ss = s_ ** 3;
    const lin = [4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * ss, -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * ss, -0.0041960863 * l - 0.7034186147 * mm + 1.7076147010 * ss];
    const enc = (x) => { x = Math.min(1, Math.max(0, x)); return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055; };
    return [...lin.map(enc), A];
  }
  return null;
}
const lum = (c) => { const f = (x) => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const over = (fg, bg) => [0, 1, 2].map((k) => fg[k] * fg[3] + bg[k] * (1 - fg[3])).concat(1);
function groundOf(el) {
  const stack = []; let e = el;
  while (e && e.nodeType === 1) { const c = parseColor(getComputedStyle(e).backgroundColor); if (c && c[3] > 0) stack.push(c); if (c && c[3] >= 1) break; e = e.parentElement; }
  let bg = parseColor(getComputedStyle(document.body).backgroundColor) || [1, 1, 1, 1];
  for (let k = stack.length - 1; k >= 0; k--) bg = over(stack[k], bg);
  return bg;
}
function contrastAudit() {
  const out = []; const seen = new Set();
  document.querySelectorAll("body *").forEach((el) => {
    if (!el.offsetParent && getComputedStyle(el).position !== "fixed") return;
    if (el.closest(".sprite, .mockbar, .report, .code pre, .sr, [aria-hidden=\"true\"]")) return;
    const direct = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!direct) return;
    const cs = getComputedStyle(el); if (cs.visibility === "hidden" || parseFloat(cs.opacity) < 1) return;
    if (el.closest("[disabled], .is-disabled, [aria-disabled='true'], .cbox.is-disabled")) return;
    // Text painted by a gradient (the shimmer of a reading) is measured at its faintest stop, --ink-3.
    const clipped = cs.webkitBackgroundClip === "text" || cs.backgroundClip === "text";
    const fg = parseColor(clipped ? getComputedStyle(el).getPropertyValue("--ink-3") : cs.color); if (!fg) return;
    const bg = groundOf(el); const f = over(fg, bg);
    const L1 = lum(f), L2 = lum(bg); const r = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const key = `${cs.color}|${bg.map((x) => x.toFixed(3)).join(",")}`;
    if (r < 4.5 && !seen.has(key)) { seen.add(key); out.push(`${r.toFixed(2)} ${el.tagName.toLowerCase()}.${String(el.className).replace(/\s+/g, ".")} "${el.textContent.trim().slice(0, 40)}"`); }
  });
  return out;
}
function audit() {
  const frac = (v) => Math.abs(v - Math.round(v)) > 0.01;
  const GEO = [".sb", ".main", ".ih1", ".rail", ".colconvo", ".convo-in", ".ask-in", ".cbox", ".card", ".acts", ".ev", ".e-agent", ".panel", ".decol", ".outline", ".chap-h", ".place-h", ".rn", ".gh", ".fnd"];
  const bad = []; let n = 0;
  GEO.forEach((sel) => document.querySelectorAll(sel).forEach((el) => {
    const r = el.getBoundingClientRect(); if (!r.width && !r.height) return; n++;
    const f = ["left", "top", "width", "height"].filter((k) => frac(r[k])); if (f.length) bad.push(`${sel} ${f.map((k) => `${k}=${r[k].toFixed(2)}`).join(" ")}`);
  }));
  const cut = [...document.querySelectorAll(".trunc")].filter((el) => el.offsetParent && el.scrollWidth > el.clientWidth + 0.5 && !el.dataset.tip).map((el) => `${el.textContent.trim().slice(0, 50)}`);
  const hscroll = document.documentElement.scrollWidth > innerWidth;
  const h = document.querySelector(".ih1"); let headerOverlap = [], titleCut = null, headerSteps = "";
  if (h) {
    const kids = [...h.querySelectorAll(":scope > *, .crumbs a, .crumbs .ellb, .ih-tools > *")].filter((k) => k.offsetParent && k.getBoundingClientRect().width > 0);
    for (let a = 0; a < kids.length; a++) for (let b = a + 1; b < kids.length; b++) { if (kids[a].contains(kids[b]) || kids[b].contains(kids[a])) continue; const x = kids[a].getBoundingClientRect(), y = kids[b].getBoundingClientRect(); if (x.right > y.left + 0.5 && y.right > x.left + 0.5 && x.bottom > y.top && y.bottom > x.top) headerOverlap.push(`${kids[a].className} × ${kids[b].className}`); }
    const t = h.querySelector(".ih-title .trunc"); titleCut = t.scrollWidth > t.clientWidth + 0.5; headerSteps = [...h.classList].filter((c) => /^f\d$/.test(c)).join(" ");
    if (h.lastElementChild.getBoundingClientRect().right > h.getBoundingClientRect().right + 0.5) headerOverlap.push("header overflows");
  }
  const unnamed = [...document.querySelectorAll("button, a[href]")].filter((b) => b.offsetParent && !b.closest(".mockbar, .sprite") && !(b.getAttribute("aria-label") || b.textContent.trim().length && [...b.querySelectorAll("*")].concat([b]).some((n) => [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim() && n.offsetParent)))).map((b) => b.className || b.tagName);
  const out = { viewport: innerWidth, mode: document.documentElement.dataset.theme || "system", geometryChecked: n, geometryFractional: bad, cutWithoutTooltip: cut, pageScrollsSideways: hscroll, headerSteps, titleCut, headerOverlap, unnamedControls: unnamed, contrastBelow45: contrastAudit() };
  const pre = document.getElementById("report"); pre.hidden = false; pre.textContent = JSON.stringify(out, null, 1);
}

// ---------------- The top gives way in order; the title last ----------------
function fitHeader() {
  document.querySelectorAll(".ih1").forEach((h) => {
    const steps = ["f1", "f2", "f3", "f4", "f5", "f6"];
    h.classList.remove(...steps);
    const title = h.querySelector(".ih-title"); title.style.flexShrink = "0";
    // Overflow is read on the last piece's right edge: a flex row that overflows keeps its scrollWidth.
    const last = h.lastElementChild, pad = parseFloat(getComputedStyle(h).paddingRight) || 0;
    const over = () => last.getBoundingClientRect().right > h.getBoundingClientRect().right - pad + 0.5;
    for (const s of steps) { if (!over()) break; h.classList.add(s); }
    title.style.flexShrink = "";
  });
}
// ---------------- The keys of a request: 1–9 on a card, A and D on a finding, Alt+↓ and Alt+↑ between findings ----------------
function requestKeys(e) {
  if (e.target.closest && e.target.closest("textarea, input, select")) return;
  const card = e.target.closest && e.target.closest("fieldset.card");
  if (card && /^[1-9]$/.test(e.key)) { const b = card.querySelectorAll(".opt, .btns .btn")[+e.key - 1]; if (b) { e.preventDefault(); b.click(); b.focus(); } return; }
  const f = e.target.closest && e.target.closest(".fnd");
  if (f && (e.key === "a" || e.key === "d")) { e.preventDefault(); const b = f.querySelector(e.key === "a" ? ".dec-a" : ".dec-d"); b.click(); return; }
  if (e.altKey && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
    const all = [...document.querySelectorAll(".fnd")]; if (!all.length) return; e.preventDefault();
    const k = all.indexOf(document.activeElement.closest && document.activeElement.closest(".fnd"));
    const open = all.filter((x) => !x.classList.contains("ok") && !x.classList.contains("no-go"));
    const list = open.length ? open : all;
    const next = e.key === "ArrowDown" ? list.find((x) => all.indexOf(x) > k) || list[0] : [...list].reverse().find((x) => all.indexOf(x) < k) || list[list.length - 1];
    all.forEach((x) => { x.tabIndex = -1; x.classList.remove("cur"); }); next.tabIndex = 0; next.classList.add("cur"); next.focus(); next.scrollIntoView({ block: "nearest" });
  }
}
document.addEventListener("click", (e) => {
  const d = e.target.closest(".dec-a, .dec-d"); if (!d || d.disabled) return;
  const f = d.closest(".fnd"), on = d.getAttribute("aria-pressed") !== "true";
  f.querySelectorAll(".dec-a, .dec-d").forEach((b) => b.setAttribute("aria-pressed", "false"));
  d.setAttribute("aria-pressed", String(on));
  f.classList.toggle("ok", on && d.classList.contains("dec-a")); f.classList.toggle("no-go", on && d.classList.contains("dec-d"));
});
document.addEventListener("keydown", requestKeys);

// ---------------- Boot helpers ----------------
function bootCommon(render) {
  document.body.insertAdjacentHTML("afterbegin", SPRITE);
  if (Q.has("clean")) document.body.classList.add("noshots");
  addEventListener("resize", () => { fitHeader(); moreBelow(); markTruncated(); });
  document.addEventListener("change", (e) => {
    if (e.target.id === "scene-sel") { const u = new URLSearchParams(location.search); u.set("scene", e.target.value); location.search = u.toString(); }
  });
  document.addEventListener("click", (e) => {
    if (e.target.closest("#theme-btn")) {
      const MODES = ["system", "light", "dark"]; MODE = MODES[(MODES.indexOf(MODE) + 1) % 3];
      if (MODE === "system") document.documentElement.removeAttribute("data-theme"); else document.documentElement.dataset.theme = MODE;
      render(); document.getElementById("theme-btn").focus(); return;
    }
    const pb = e.target.closest("[data-panel]");
    if (pb) { S.panel = S.panel === pb.dataset.panel ? null : pb.dataset.panel; render(); return; }
    const sh = e.target.closest("[data-show]");
    if (sh) { const c = document.getElementById(sh.dataset.show); if (c) { c.scrollIntoView({ block: "center" }); const b = c.querySelector("button"); if (b) b.focus(); } }
  });
  // Names and the top are measured again once the fonts are in: the fallback font sets other widths.
  if (document.fonts) document.fonts.addEventListener("loadingdone", () => { fitHeader(); markTruncated(); moreBelow(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && S.panel) { S.panel = null; render(); }
  });
}
