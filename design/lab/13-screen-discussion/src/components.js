/* =====================================================================
   ROUND 13 · the specimen of the components this round adds or changes.
   Built from the same functions as a.html and b.html (disc.js, pub.js),
   with the states forced by the classes the system uses. The folded
   draft is shown inside the scope of b, as on its screen.
   ===================================================================== */
window.SPECIMEN = true;
V = Object.assign({}, MODEL, { key: "a", expanded: () => true });
const withS = (patch, fn) => { const keep = {}; Object.keys(patch).forEach((k) => { keep[k] = S[k]; S[k] = patch[k]; }); const h = fn(); Object.assign(S, keep); return h; };
const cls = (h, add) => h.replace(/^\s*<(\w+) class="([^"]*)"/, (m, t, c) => `<${t} class="${c} ${add}"`);
const base = { dec: {}, pub: {}, log: [], cur: 0, edit: null, revised: {}, diff: {}, depPick: false };
// The body is cut to its first section here, so the states fit; on the screens it is whole.
const cut = (h) => h.replace(/(<div class="dbody prose"><h4>Context<\/h4><p>.*?<\/p>)[\s\S]*?<\/div>(?=<p class="dcons|<div class="fa)/, '$1<p class="faint">… Problem, What the delivery includes, Out of scope</p></div>');
function dr(d, patch = {}, add = "", open = true) {
  const keepV = V; V = Object.assign({}, MODEL, { key: open ? "a" : "b", expanded: () => open });
  const h = withS(Object.assign({}, base, patch), () => cls(draftItem(typeof d === "number" ? D[d] : d), add)); V = keepV;
  return open ? `<div class="drfs">${cut(h)}</div>` : `<div class="b"><div class="drfs">${h}</div></div>`;
}
const warnD = (warn, extra = {}) => ({ ...D[2], n: 9, title: "Tier names and prices on the public status page", repo: "status-page", epic: null, deps: [], warn, ...extra });
const bar = (html) => `<div class="m"><div class="ask" style="padding:0;background:transparent">${html}</div></div>`;
const staticDlg = (h) => h.replace('<div class="scrim" id="scrim">', '<div class="scrim static">');
const chainS = { dec: { 1: "ok", 2: "ok", 3: "ok", 5: "ok" }, pub: { 5: "done" }, cur: 4 };
const doneS = { dec: { 1: "ok", 2: "ok", 3: "ok", 4: "ok", 5: "ok" }, pub: { 1: "done", 2: "done", 3: "done", 4: "done", 5: "done" }, log: [5, 1, 2, 3, 4] };
const COMPS = [
  { name: "Draft", note: "Kind, title, fields, dependencies by title, the whole body rendered, and the decision. Before the gesture, the draft says exactly what Approve (and Discard) publish now, or what it waits for. A gesture that publishes keeps the focus on its draft.",
    states: () => [
      ["default · publishes nothing yet", dr(3, { dec: { 1: "ok", 2: "ok" } })], ["hover", dr(3, { dec: { 1: "ok", 2: "ok" } }, "is-hover")], ["focus · current", dr(3, { dec: { 1: "ok", 2: "ok" }, cur: 3 })],
      ["the gesture publishes a chain", dr(4, chainS)],
      ["active · approved, waits for the epic", dr(2, { dec: { 2: "ok" } })],
      ["loading · publishing", dr(2, { dec: { 1: "ok", 2: "ok" }, pub: { 1: "done", 2: "run" } })],
      ["published · how to take it back", dr(2, doneS)],
      ["discarded · the text stays legible", dr(4, { dec: { 4: "no" } })],
      ["disabled · a publication runs", dr(4, { dec: { 1: "ok", 2: "ok", 3: "ok" }, pub: { 1: "done", 2: "run" } })],
      ["disabled · being edited", dr(3, { edit: 3 }).replace(/<div class="dedit"[\s\S]*?<\/div><\/div>(?=<div class="fa">)/, '<div class="dedit"><p class="faint">… the fields of Edit, below</p></div>')],
      ["error · the publication failed", dr(3, { dec: { 1: "ok", 2: "ok", 3: "ok" }, pub: { 1: "done", 2: "done", 5: "done", 3: "fail" } }, "is-error")],
      ["revised · approval cleared", dr(2, { revised: { 2: "cleared" }, dec: { 1: "ok" } })],
      ["epic · can't publish", dr(1, { dec: { 1: "ok", 2: "ok", 3: "no", 4: "no" } }).replace(/<div class="dbody prose">[\s\S]*?<\/div>(?=<div class="fa)/, "")],
      ["card of a discarded epic", dr(2, { dec: { 1: "no", 2: "ok" } })],
    ] },
  { name: "Warnings of a draft", note: "Neutral, with the ◇ of what blocks without being a situation. A repository that left the board stops the draft before GitHub; the others don't fail it.",
    states: () => [
      ["repository no longer on the board", dr(warnD(["acme/status-page is no longer managed by the board."]))],
      ["dependency no longer among the drafts", dr(warnD(["The dependency on Websocket metering is no longer among the drafts."], { repo: "web" }))],
      ["module no longer on the board", dr(warnD(["The module Pricing is no longer an option of the board. The card goes without a module."], { repo: "web", module: "Pricing" }))],
      ["update · card out of the last reading", dr({ ...D[5], warn: ["This card isn't in the last reading of the board."] })],
      ["update · refreshing the card", dr({ ...D[5], warn: [`<span class="rd">Refreshing the card…</span>`] })],
      ["update · couldn't refresh", dr({ ...D[5], warn: ["Couldn't refresh the card: GitHub's rate limit was reached. The draft shows the last reading."] })],
    ] },
  { name: "Update draft", note: "The update of a card reads as its new body; Changes shows the lines against the card on GitHub, neutral: added lines on a veil, removed ones struck.",
    states: () => [["body", dr(5)], ["changes", dr(5, { diff: { 5: true } })], ["published", dr(5, { dec: { 5: "ok" }, pub: { 5: "done" }, diff: { 5: true } })]] },
  { name: "Folded draft (b)", note: "The drafts of variation b that are not open: two lines, the kind, the title and the state, then the fields. A click, Enter or ↑ ↓ open it; A and D act only on the open draft.",
    states: () => [["not decided", dr(4, {}, "", false)], ["hover", dr(4, {}, "is-hover", false)], ["focus", dr(4, {}, "is-focus", false)], ["active · pressed", dr(4, {}, "is-active", false)],
      ["waits", dr(3, { dec: { 3: "ok" } }, "", false)], ["publishing", dr(2, { dec: { 2: "ok" }, pub: { 2: "run", 1: "done" } }, "", false)], ["published", dr(5, { dec: { 5: "ok" }, pub: { 5: "done" } }, "", false)],
      ["discarded", dr(4, { dec: { 4: "no" } }, "", false)], ["card of a discarded epic", dr(2, { dec: { 1: "no", 2: "ok" } }, "", false)],
      ["blocked by a warning", dr(warnD(["acme/status-page is no longer managed by the board."]), {}, "", false)],
      ["error · failed", dr(3, { dec: { 3: "ok" }, pub: { 3: "fail" } }, "is-error", false)]] },
  { name: "Editing a draft", note: "Behind Edit or E: the title, the Markdown body, the repository, the module, the epic, and the dependencies chosen by title, never by id. The decision waits while editing.",
    states: () => [["editing", `<div class="drfs">${withS(Object.assign({}, base, { edit: 3 }), () => draftItem(D[3]))}</div>`], ["adding a dependency", `<div class="drfs">${withS(Object.assign({}, base, { edit: 3, depPick: true }), () => draftItem(D[3]))}</div>`]] },
  { name: "Markers of a round", note: "The revision, said once; the publication of a round, one marker kept up to date with the state of each draft; a past round folded into one marker when the next round arrives.",
    states: () => [
      ["drafts revised", `<div class="m">${revisedMarker().replace("<details ", "<details open ")}</div>`],
      ["published · so far", `<div class="m">${withS(Object.assign({}, base, chainS, { log: [5] }), () => MODEL.roundMarker(true))}</div>`],
      ["published · the round", `<div class="m">${withS(Object.assign({}, base, doneS), () => MODEL.roundMarker(true))}</div>`],
      ["error · stopped", `<div class="m">${withS(Object.assign({}, base, { dec: doneS.dec, pub: { 1: "done", 2: "done", 5: "done", 3: "fail" }, log: [5, 1, 2] }), () => MODEL.roundMarker(true))}</div>`],
      ["a past round, folded", `<div class="m">${EVX("cards", `Round 1 <span class="n">· 5 drafts, revised once · 4 created, 1 updated</span>`, "14:29 – 15:12", "")}</div>`],
      ["drafts can't be read", `<div class="m">${EV("alert", `drafts.md can't be read <span class="n">· line 41: Draft invoice-overage has no ### Title</span>`, "14:27")}</div>`]] },
  { name: "Ask bar of a discussion", note: "What is really missing, with the way out written in the bar: drafts to decide, an epic that can't publish, a discarded epic, a failure, the drafts that can't be read, a session error, the end of the round.",
    states: () => {
      const b = (patch) => withS(Object.assign({}, base, patch), () => MODEL.bar());
      return [["decide", bar(b({ dec: { 1: "ok", 2: "ok" } }))], ["epic can't publish", bar(b({ dec: { 1: "ok", 2: "ok", 3: "no", 4: "no", 5: "ok" }, pub: { 5: "done" } }))],
        ["epic discarded", bar(b({ dec: { 1: "no", 2: "ok", 3: "ok", 4: "no", 5: "ok" }, pub: { 5: "done" } }))],
        ["error · publish failed", bar(b({ dec: doneS.dec, pub: { 1: "done", 2: "done", 5: "done", 3: "fail" } }))],
        ["waiting for the drafts", bar(ASK({ kind: "tinted", label: "Waiting for the drafts", place: "Discussing", s: { sev: "wait", since: "1m", long: "1 minute" }, detail: "ask the agent to fix drafts.md below", actions: "" }))],
        ["error · session", bar(ASK({ kind: "error", label: "Session error", place: "Discussing", s: { sev: "error", since: "3m", long: "3 minutes" }, detail: "", actions: `<button class="btn sm primary">Retry</button>` })) + `<div class="m">${ERR("Session error", "The session stopped unexpectedly. The conversation is kept; Retry opens it again where it stopped.", "claude exited with status 1 · claude --resume 9f2c…")}</div>`],
        ["error · retrying", bar(ASK({ kind: "error", label: "Session error", place: "Discussing", s: { sev: "error", since: "3m", long: "3 minutes" }, detail: "", actions: `<button class="btn sm primary is-loading" aria-busy="true"><span class="spin"></span>Retrying…</button>` }))],
        ["ready to archive", bar(b(doneS))],
        ["hover · focus · disabled", `<div class="row"><button class="btn sm is-hover">${I("up")}Show</button><button class="btn sm primary is-focus">Archive…</button><button class="btn sm primary" disabled>Archive…</button></div>`]];
    } },
  { name: "New discussion dialog", note: "From the board with the selected cards, or from Home with the board to choose. The context of the cards is one line, with Show, and says when it is being read again.",
    states: () => {
      const d = (patch) => staticDlg(withS({ dstart: Object.assign({ home: false, title: "Usage-based pricing tiers", what: "Tiers with an included volume and a price for what goes over.", cards: [455, 461], ctxOpen: false, boardMenu: false, starting: false }, patch) }, startDialog));
      return [["from the board", d({})], ["from Home · the board list", d({ home: true, cards: [], boardMenu: true })], ["refreshing the cards", d({ refreshing: true })], ["couldn't refresh the cards", d({ refreshFail: true })],
        ["disabled · nothing to discuss", d({ what: "", cards: [] })], ["loading · starting", d({ starting: true })],
        ["error · the session didn't start", d({ err: "Claude Code isn't logged in. The discussion was undone." })]];
    } },
  { name: "Archive, delete and group dialogs", note: "Archive says what stays and what isn't published; Delete says what goes and what stays on GitHub; Group asks for the epic's title, so an epic is never named by its id.",
    states: () => [["archive", staticDlg(withS(Object.assign({}, base, { dec: { 1: "no", 2: "ok", 3: "ok", 5: "ok" }, pub: { 5: "done" }, log: [5] }), archiveDialog))],
      ["archiving", staticDlg(withS(Object.assign({}, base, doneS), archiveDialog)).replace(/<button class="btn primary" data-act="archive-go">Archive <span class="k">Ctrl ↵<\/span><\/button>/, '<button class="btn primary is-loading" aria-busy="true"><span class="spin"></span>Archiving…</button>')],
      ["delete", staticDlg(withS(Object.assign({}, base, doneS), deleteDialog))],
      ["group · the title missing", staticDlg(groupDialog([{ n: 9, title: "Tier names and prices on the public status page", repo: "docs" }, { n: 10, title: "Support view of a workspace's metered usage", repo: "web" }]))]] },
  { name: "Discussion that left while open", note: "Archived or deleted with the screen open: what happened, what was published, and the ways on.",
    states: () => [["archived", withS(Object.assign({}, base, doneS), goneMain).split('<div class="leftw">')[1].replace(/<\/div><\/main>$/, "")],
      ["deleted", withS(Object.assign({}, base, doneS, { deleted: true }), goneMain).split('<div class="leftw">')[1].replace(/<\/div><\/main>$/, "")]] },
];
document.addEventListener("DOMContentLoaded", () => {
  document.body.insertAdjacentHTML("afterbegin", SPRITE + SPRITE_D);
  document.addEventListener("click", (e) => e.stopPropagation(), true);
  document.addEventListener("keydown", (e) => e.stopPropagation(), true);
  const side = (mode, sts) => `<div class="side" data-theme="${mode}"><div class="mode">${mode}</div>${sts.map(([l, h]) => `<div class="stt"><span class="l">${l}</span><div class="v">${h}</div></div>`).join("")}</div>`;
  const body = COMPS.filter((c, k) => !Q.has("only") || String(k) === Q.get("only")).map((c) => { const sts = c.states(); return `<section class="comp"><h2>${c.name}</h2><p>${c.note}</p><div class="pairs">${side("light", sts)}${side("dark", sts)}</div></section>`; }).join("");
  document.body.insertAdjacentHTML("beforeend", `<main class="spc"><header><h1>Discussion · components</h1><p>Each component this round adds or changes, in every state, light and dark side by side.</p></header>${body}</main><pre id="report" class="report" hidden></pre>`);
  if (Q.has("audit")) setTimeout(() => { const pre = document.getElementById("report"); pre.hidden = false; const unnamed = [...document.querySelectorAll("button, a[href]")].filter((b) => b.offsetParent && !(b.getAttribute("aria-label") || b.textContent.trim())).length; pre.textContent = JSON.stringify({ contrastBelow45: contrastAudit(), unnamedControls: unnamed }, null, 1); }, 1200);
});
