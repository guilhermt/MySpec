/* =====================================================================
   ROUND 12 · the specimen of the components this round adds or changes.
   Built from the same functions as a.html and b.html (review.js,
   vaparts.js, vbparts.js), with the states forced by the classes the
   system uses (is-hover, is-focus, is-active…).
   ===================================================================== */
window.SPECIMEN = true;
setR1();
const V = { key: "a", column: () => "", after: () => "", bar: () => "" };
const withS = (patch, fn) => { const keep = {}; Object.keys(patch).forEach((k) => { keep[k] = S[k]; S[k] = patch[k]; }); const h = fn(); Object.assign(S, keep); return h; };
const cls = (h, add) => h.replace(/^\s*<(\w+) class="([^"]*)"/, (m, t, c) => `<${t} class="${c} ${add}"`);
const lst = (h) => `<div class="lst" role="tree" aria-label="Specimen">${h}</div>`;
const row = (ref, add = "", patch = {}) => lst(withS(patch, () => cls(prRow(PR[ref]), add)));
const rowSwap = (ref, add, stateHtml) => lst(cls(prRow(PR[ref]), add).replace(/<span class="col rst[^"]*"[^>]*>[\s\S]*?<\/span><\/span><\/span>/, stateHtml));
const F = (n) => FIND[n - 1];
// A clean pass: the findings are taken out for the time of one render.
const cleanPass = (fn) => { const keep = FIND.splice(0); const sum = S.sum; S.sum = "The move to react-hook-form keeps every field and the submit flow. The six checks pass. Nothing to change."; const h = fn(); FIND.push(...keep); S.sum = sum; return h; };
const fA = (n, add = "", patch = {}) => `<div class="fnds">${withS(patch, () => cls(fndA(F(n)), add))}</div>`;
const fB = (n, add = "", patch = {}) => `<div class="b"><div class="flist2" role="list">${withS(patch, () => { const h = frow(F(n)); return add ? h.replace('<button class="fr-h"', `<button class="fr-h ${add}"`) : h; })}</div></div>`;
const frWrap = (n, add, patch = {}) => `<div class="b"><div class="flist2" role="list">${withS(patch, () => cls(frow(F(n)), add))}</div></div>`;
const btnState = (h, find, add) => h.replace(find, (m) => m.replace('class="', `class="${add} `));

const COMPS = [
  { name: "Pull request row", note: "The row of the board's list with the columns of a pull request: the reference, the title (with Draft or a label), the author and the one state that matters. On a narrow list the author and the state go under the title. R starts the review, or opens it.",
    states: () => [
      ["default · never reviewed", row("api#1302")], ["hover", row("api#1298", "is-hover")], ["focus · the key", row("api#1302", "is-focus")], ["active · pressed", row("api#1298", "is-active")],
      ["open · its panel beside", withS({ open: "api#1302" }, () => row("api#1302"))],
      ["disabled · a fork", rowSwap("web#2296", "is-disabled", `<span class="col rst"><span class="t">From a fork · can't be reviewed yet</span></span>`)],
      ["loading · starting the review", rowSwap("api#1302", "is-loading", `<span class="col rst"><span class="spin" aria-hidden="true"></span><span class="t">Starting the review…</span></span>`)],
      ["error · the review didn't start", rowSwap("api#1302", "is-error", `<span class="col rst"><span class="t" style="color:var(--state-error)">Couldn't start · git worktree add failed</span></span>`)],
      ["review waits for you", row("web#2291")], ["review at rest", row("ios#312")], ["new commits", row("gateway#88")], ["draft", row("web#2296")], ["the pull request of a task", row("api#1284")], ["yours", row("web#2288")],
      ["narrow · second line", `<div class="nar" style="width:calc(var(--space-16) * 8)">${row("web#2291")}</div>`],
    ] },
  { name: "Section of the list", note: "Pending, In review, Reviewed, Yours and your tasks. The two that never wait for you start folded; what you fold is remembered. A reading that fails is the strip above the list, never the section: the section has no error state.",
    states: () => {
      const sec = (x, exp = true, name = "Pending", n = 4) => lst(`<div class="sech ${x}" role="treeitem" ${exp === null ? "" : `aria-expanded="${exp}"`} tabindex="-1">${I("down", "i chev")}<span class="nm">${name}<span class="cnt">${n}</span></span><span></span></div>`);
      return [["default", sec("")], ["hover", sec("is-hover")], ["focus", sec("is-focus")], ["active", sec("is-active")], ["folded", sec("", false, "Reviewed", 1)], ["empty", sec("is-empty", null, "In review", 0)],
        ["disabled · the filters hide all", sec("is-disabled", false, "Pending", 0)], ["loading · first reading", sec("is-loading", true, "Pending", "…")]];
    } },
  { name: "Reading of the list", note: "The age of the list in the header, the strip of a repository that failed (never red: it is not a situation), the first reading and the empty list.",
    states: () => [
      ["read", withS({ reading: false }, readState)], ["reading", withS({ reading: true }, readState)],
      ["refresh · hover, focus, disabled", `<div class="row"><button class="btn ghost sm icon is-hover" aria-label="Read again">${I("refresh")}</button><button class="btn ghost sm icon is-focus" aria-label="Read again">${I("refresh")}</button><button class="btn ghost sm icon" disabled aria-label="Read again">${I("refresh")}</button></div>`],
      ["a repository failed", `<div class="readfail">${st("warn")}<span class="lines"><span class="lbl">Couldn't read <span class="rep">acme/ios</span></span><span class="det">gh can't read this repository. Run gh auth refresh -s repo. Its pull requests are from the reading of 12:10.</span></span><button class="btn sm">Try again</button></div>`],
      ["failed · trying", `<div class="readfail">${st("warn")}<span class="lines"><span class="lbl">Couldn't read <span class="rep">acme/ios</span></span><span class="det">GitHub's rate limit was reached. It resets at 14:32.</span></span><button class="btn sm is-loading" aria-busy="true"><span class="spin"></span>Reading…</button></div>`],
      ["first reading", `<div class="skel" role="status" aria-label="Reading the pull requests">${"<i></i>".repeat(4)}</div>`],
      ["empty", `<div class="bempty"><p class="t">No open pull requests.</p><p class="s">The list shows the open pull requests of your 12 repositories, from any author.</p><button class="btn sm">${I("refresh")}Read now</button></div>`],
      ["filters hide all", `<div class="bempty"><p class="t">No pull requests match the filters.</p><p class="s">9 are open; the filters hide all of them.</p><button class="btn sm">Clear filters</button></div>`],
      ["filter menu · author cycles", `<div class="menu fmenu" role="menu"><div class="menu-cap">Author · click to hide, again to keep only</div><button class="mi" data-tri="-"><span class="tri">-</span>dependabot<span class="sub">hidden</span></button><button class="mi is-hover" data-tri="+"><span class="tri">+</span>rsouza<span class="sub">only</span></button><button class="mi" data-tri=""><span class="tri">·</span>tchen</button></div>`],
    ] },
  { name: "Pull request panel", note: "What the row doesn't say: the checks by name, the branch, the card, the description. Its first block is the action.",
    states: () => {
      const acts = (ref) => withS({ open: ref }, () => { const h = prPanel(); return h.split('<div class="panel-b cd">')[1].split(/<div class="gh"|<dl class="cd-kv"/)[0].replace(/^<div class="cd-top">[\s\S]*?<\/div><\/div>/, ""); });
      const start = `<div class="cd-acts"><button class="btn primary sm">Start review <span class="k">R</span></button></div>`;
      return [["start", acts("api#1298")], ["hover · focus · active", `<div class="row">${btnState(start, 'class="btn primary sm"', "is-hover")}${btnState(start, 'class="btn primary sm"', "is-focus")}${btnState(start, 'class="btn primary sm"', "is-active")}</div>`],
        ["waiting for checks", acts("api#1302")],
        ["disabled · a fork", `<div class="cd-acts"><button class="btn primary sm" disabled aria-describedby="fk">Start review</button></div><span class="cd-why" id="fk">Pull requests from forks can't be reviewed yet.</span>`],
        ["disabled · clone missing", `<div class="cd-acts"><button class="btn primary sm" disabled aria-describedby="cm">Start review</button><button class="btn sm">Change path…</button></div><span class="cd-why" id="cm">The clone at ~/code/web is missing.</span>`],
        ["loading · cloning first", `<div class="cd-acts"><button class="btn primary sm is-loading" aria-busy="true"><span class="spin"></span>Cloning acme/docs…</button></div><span class="cd-why">The dialog opens when the clone ends.</span>`],
        ["error · the clone failed", `<div class="cd-acts"><button class="btn primary sm">Try the clone again</button></div><span class="cd-why err">git clone failed: repository not found.</span>`],
        ["a review exists", acts("web#2291")], ["the pull request of a task", acts("api#1284")],
        ["checks by name", ghBlock(PR["gateway#88"])]];
    } },
  { name: "Start dialog", note: "The pull request, the model from Defaults, and nothing else until asked: instructions, and the mode on your own pull request.",
    states: () => {
      const dlg = (patch) => withS({ dstart: Object.assign({ pr: "api#1298", ins: false, insText: "", mode: "Publish", modeOpen: false, starting: false }, patch) }, startDialog).replace('<div class="scrim" id="scrim">', '<div class="scrim static">');
      return [["default", dlg({})], ["with instructions", dlg({ ins: true, insText: "can we merge safely?" })], ["waits for the checks", dlg({ pr: "api#1302" })], ["own · mode", dlg({ pr: "web#2288", modeOpen: true })],
        ["loading · starting", dlg({ starting: true })],
        ["disabled · no longer open", dlg({}).replace(/<span class="why" id="why-start"><\/span>[\s\S]*?<\/div><\/div><\/div>$/, `<span class="why" id="why-start">api#1298 was merged at 18:02.</span><button class="btn ghost">Cancel</button><button class="btn primary" disabled aria-describedby="why-start">Start review</button></div></div></div>`)],
        ["error · the worktree", dlg({}).replace(/<span class="why" id="why-start"><\/span>/, `<span class="why err" style="color:var(--state-error)">git worktree add failed: 'pr_1298' already exists. Nothing was created.</span>`).replace(/class="btn primary" data-act="start-go">Start review <span class="k">Ctrl ↵<\/span>/, 'class="btn primary is-error">Try again')]];
    } },
  { name: "Header pill", note: "The one element of the task's stepper a review needs: the pass and its state. With a bar on screen it keeps only the glyph.",
    states: () => {
      const p = (sc, bar, extra = "") => `<header class="ih1 mh" style="position:static;box-shadow:none;background:transparent;height:auto">${withS({}, () => { const k = SCN; return pillFor(sc, bar, extra); })}</header>`;
      return [["checks", p("checks", false)], ["working", p("pass", false)], ["decide · with the bar", p("findings", true)], ["published", p("pub", false)], ["focus", p("pass", false, "is-focus")],
        ["paused", p("pass", false, "is-paused").replace("working", "paused").replace("st-run", "st-paused")], ["loading", p("pass", false, "is-loading")], ["error · session", p("pass", true).replace(/st-run/g, "st-error")]];
    } },
  { name: "Finding", note: "The card of the conversation, the same as the task's PR review. Title, place, text, decision; A and D decide and move on to the next one to decide. The place opens GitHub's Files changed at the line; VS Code is the second way. A discarded finding folds to its title.",
    states: () => [
      ["default", fA(3, "", { dec: {}, cur: 0 })], ["hover", fA(2, "is-hover", { dec: {}, cur: 0 })], ["focus · current", fA(2, "", { dec: {}, cur: 2 })],
      ["active · approved", fA(1, "", { dec: { 1: "ok" }, cur: 0 })], ["discarded", fA(3, "", { dec: { 3: "no" }, cur: 0 })],
      ["editing", fA(2, "", { dec: {}, cur: 2, edit: 2 })],
      ["disabled · published", fA(1, "is-disabled", { dec: { 1: "ok" }, cur: 0 }).replace(/<div class="fa">[\s\S]*?<\/div><\/div><\/div>/, `<div class="fa"><span class="note">Inline comment · published 13:41</span></div></div></div>`)],
      ["loading · saving the text", fA(2, "is-loading", { dec: {}, cur: 0 }).replace('<span class="grow"></span>', '<span class="note"><span class="spin" aria-hidden="true"></span> Saving…</span><span class="grow"></span>')],
      ["error · not saved", fA(2, "is-error", { dec: {}, cur: 0 }).replace('<span class="grow"></span>', `<span class="note" style="color:var(--state-error)">Couldn't save the decision · Try again</span><span class="grow"></span>`)],
      ["place · link and editor", `<div class="row">${locLink(F(1))}</div><div class="row">${btnState(locLink(F(2)), 'class="loc"', "is-hover")}</div><div class="row">${locLink(F(3))}</div>`],
    ] },
  { name: "Decision bar", note: "The ask bar of the task screen: the progress, Next to decide, and Publish review… with what is missing. It opens the publication dialog.",
    states: () => {
      const bar = (patch) => `<div class="m"><div class="ask" style="padding:0;background:transparent">${withS(Object.assign({ touched: false, own: false, sumOn: true }, patch), () => VA_BAR())}</div></div>`;
      return [["deciding", bar({ dec: { 1: "ok" } })], ["ready", bar({ dec: { 1: "ok", 2: "ok", 3: "no" } })], ["loading · publishing", bar({ dec: { 1: "ok", 2: "ok", 3: "no" }, publishing: true })],
        ["a clean pass", cleanPass(() => bar({ dec: {} }))],
        ["Apply mode · deciding", `<div class="m"><div class="ask" style="padding:0;background:transparent">${withS({ dec: { 1: "ok" } }, applyBar)}</div></div>`],
        ["Apply mode · ready", `<div class="m"><div class="ask" style="padding:0;background:transparent">${withS({ dec: { 1: "ok", 2: "ok", 3: "no" } }, applyBar)}</div></div>`],
        ["error · publish failed", `<div class="m"><div class="ask" style="padding:0;background:transparent">${ASK({ kind: "error", label: "Publish failed", place: "pass 1", s: { sev: "error", since: "1m", long: "1 minute" }, detail: "GitHub's rate limit was reached. It resets at 14:32.", actions: `<button class="btn sm primary">Publish review</button>` })}</div></div>`]];
    } },
  { name: "Publication dialog", note: "The verdict is an explicit choice, 1 to 3: your decisions suggest one, with a tag, and none is marked. The summary is optional. Your own pull request takes only Comment.",
    states: () => {
      const d = (patch) => withS(Object.assign({ dec: { 1: "ok", 2: "ok", 3: "no" }, verdict: null, own: false, stalePass: false, sumOn: true, sumEdit: false, publishing: false }, patch), publishDialogB).replace('<div class="scrim" id="scrim">', '<div class="scrim static">');
      return [["default · suggested, nothing chosen", d({})], ["a clean pass", cleanPass(() => d({ dec: {} }))], ["chosen", d({ verdict: "Request changes" })], ["hover · focus", d({}).replace('<button class="opt"', '<button class="opt is-hover"').replace(/(<button class="opt" role="radio" aria-checked="false" tabindex="-1" data-verdictb="Comment")/, '<button class="opt is-focus" role="radio" aria-checked="false" tabindex="-1" data-verdictb="Comment"')],
        ["only Approve", d({ dec: { 1: "no", 2: "no", 3: "no" }, sumOn: false })], ["editing the summary", d({ verdict: "Request changes", sumEdit: true })],
        ["your own pull request · only Comment", d({ own: true })], ["commits after the pass", d({ stalePass: true })],
        ["loading · publishing", d({ verdict: "Request changes", publishing: true })],
        ["error · publish failed", d({ verdict: "Request changes" }).replace('<span class="why" id="why-pub2"></span>', `<span class="why" id="why-pub2" style="color:var(--state-error);white-space:normal">Couldn't publish to GitHub: the pull request was closed.</span>`)]];
    } },
  { name: "Notes of the review", note: "What is not a situation: a reading of every minute that failed (a strip under the header), the commits that arrived before publishing (in the card or the dialog), and the decisions a new pass discards (in the Review again dialog).",
    states: () => [["couldn't check GitHub", checkErr()], ["couldn't check · trying", checkErr().replace('<button class="btn sm" data-act="refresh-pr">Try again</button>', '<button class="btn sm is-loading" aria-busy="true"><span class="spin"></span>Reading…</button>')],
      ["commits after the pass", withS({ stalePass: true }, staleNote)], ["commits after the pass · hover, focus", withS({ stalePass: true }, staleNote).replace('class="btn ghost xs"', 'class="btn ghost xs is-focus"')],
      ["review again · decisions discarded", withS({ dec: { 1: "ok" }, phase: "decide" }, againDialog).replace('<div class="scrim" id="scrim">', '<div class="scrim static">')],
      ["review again · disabled while a pass runs", `<div class="menu" role="menu"><button class="mi" aria-disabled="true">Review again<span class="sub">· a pass is running</span></button></div>`]] },
  { name: "Review that left while open", note: "The item left the state with the screen open: what happened, the result, and the ways on. Never an empty area.",
    states: () => [["merged", goneMain().split('<div class="leftw">')[1].replace(/<\/div><\/main>$/, "")],
      ["closed without a merge", goneMain().split('<div class="leftw">')[1].replace(/<\/div><\/main>$/, "").replace("web#2291 was merged, and its review ended", "web#2291 was closed without a merge").replace("rsouza merged it into dev at 16:20.", "rsouza closed it at 16:20.").replace(I("merge"), I("x"))]] },
];
function pillFor(sc, bar, extra) {
  const map = { checks: ["gh", "checks 4/6"], pass: ["run", "working"], findings: ["wait", "decide"], pub: ["idle", "published"] }[sc];
  return `<ol class="stepper one ${extra}" tabindex="0" aria-label="Progress · Pass 1 · ${map[1]}"><li class="sp cur" aria-current="step"><span class="pill"><span class="lb-c">Pass 1</span><span class="stw st-${map[0]}-t">${st(map[0], bar ? map[1] : "")}${bar ? "" : `<span class="long">${map[1]}</span>`}</span></span></li></ol>`;
}
document.addEventListener("DOMContentLoaded", () => {
  document.body.insertAdjacentHTML("afterbegin", SPRITE + SPRITE_R);
  document.addEventListener("click", (e) => e.stopPropagation(), true);
  document.addEventListener("keydown", (e) => e.stopPropagation(), true);
  const side = (mode, sts) => `<div class="side a" data-theme="${mode}"><div class="mode">${mode}</div>${sts.map(([l, h]) => `<div class="stt"><span class="l">${l}</span><div class="v">${h}</div></div>`).join("")}</div>`;
  const body = COMPS.filter((c, k) => !Q.has("only") || String(k) === Q.get("only")).map((c) => { const sts = c.states(); return `<section class="comp"><h2>${c.name}</h2><p>${c.note}</p><div class="pairs">${side("light", sts)}${side("dark", sts)}</div></section>`; }).join("");
  document.body.insertAdjacentHTML("beforeend", `<main class="spc"><header><h1>Reviews · components</h1><p>Each component this round adds or changes, in every state, light and dark side by side. The shared pieces come first; then the pieces of the review: the finding in its card, the decision bar and the publication dialog.</p></header>${body}</main><div class="toasts" role="status" aria-live="polite"></div><pre id="report" class="report" hidden></pre>`);
  markRows();
  if (Q.has("audit")) setTimeout(() => { const pre = document.getElementById("report"); pre.hidden = false; const unnamed = [...document.querySelectorAll("button, a[href]")].filter((b) => b.offsetParent && !(b.getAttribute("aria-label") || b.textContent.trim())).length; pre.textContent = JSON.stringify({ contrastBelow45: contrastAudit(), unnamedControls: unnamed }, null, 1); }, 1200);
});
