/* =====================================================================
   ROUND 10 · the specimen: each component the minimal screen adds or
   changes, in every state, light and dark side by side.
   ?show=light|dark shows one mode.
   ===================================================================== */
const S = { panel: null, born: false };
const NOW = { g: "wait", word: "Reviewer asks you", short: "asks you", pos: "Step 3 of 7", posShort: "3/7" };
const cell = (label, html, cls = "") => `<div class="cell ${cls}"><span class="sl">${label}</span>${html}</div>`;
const C = [];
const ONESHOT = ["Planning", "Implementation", "PR", "PR review", "Closing"];

// 1. The progress line (A)
const L = (label, o) => cell(label, `<div class="linebox">${pline({ ...o, cls: `is-static ${o.cls || ""}` })}</div>`, "wide");
C.push(["Progress line · A", "The stages as segments on one thin line: done in graphite, the stage you are in in the identity, what comes faint. Inside the implementation, one tick per step. The state glyph of the place rides on the line. The names come on hover, on focus and on a click that pins them. It has no action: Back to… lives in ⋯.", () => [
  L("default · step 3 waits for you", { stage: 3, step: 3, g: "wait", word: "Reviewer asks you" }),
  L("hover · the names", { stage: 3, step: 3, g: "wait", cls: "is-open", word: "Reviewer asks you" }),
  L("focus · the names and the ring", { stage: 3, step: 3, g: "wait", cls: "is-open is-focus", word: "Reviewer asks you" }),
  L("active · names pinned by a click", { stage: 3, step: 3, g: "run", cls: "is-open", word: "Implementer working" }),
  L("disabled · task paused", { stage: 3, step: 3, g: "paused", cls: "is-paused", word: "Paused" }),
  L("loading · first reading of the task", { stage: 3, step: 3, g: "run", cls: "is-loading", word: "Reading the task" }),
  L("error · a session stopped", { stage: 3, step: 3, g: "error", word: "Reviewer stopped" }),
  L("planning · PRD asks you", { stage: 0, step: 0, g: "wait", word: "The agent asks you" }),
  L("PR review · waiting for checks", { stage: 5, step: 7, g: "gh", word: "Waiting for checks" }),
  L("closing · ready to close", { stage: 6, step: 7, g: "close", word: "Ready to close" }),
  L("One-Shot · step 2 of 4 running", { stages: ONESHOT, stage: 1, step: 2, steps: 4, g: "run", word: "Implementer working" }),
]]);
// 2. The sentence (A)
const sent = (stage, pos, posShort, g, word, short, cls = "") => `<p class="ps ${cls}"><span class="ps-stage">${stage}</span>${pos ? `<span class="dot" aria-hidden="true">·</span><span class="ps-pos">${cls ? posShort : pos}</span>` : ""}<span class="dot" aria-hidden="true">·</span><span class="ps-state st-${g}-t">${cls ? short : word}</span></p>`;
C.push(["Sentence · A", "The words of the line, next to the title: the stage, the position inside it and the state of the place in its situation's ink. It takes its short words before the title gives way. Not interactive.", () => [
  cell("waits for you", sent("Implementation", "Step 3 of 7", "3/7", "wait", "Reviewer asks you", "asks you")),
  cell("working", sent("Implementation", "Step 3 of 7", "3/7", "run", "Implementer working", "working")),
  cell("error", sent("Implementation", "Step 5 of 7", "5/7", "error", "Blocked", "blocked")),
  cell("GitHub", sent("PR review", "", "", "gh", "Waiting for checks · 3 of 5", "checks 3/5")),
  cell("ready to close", sent("Closing", "#1284 merged", "", "close", "Ready to close", "ready")),
  cell("paused", sent("Implementation", "Step 3 of 7", "3/7", "paused", "Paused since 18:02", "paused")),
  cell("short words", sent("Implementation", "Step 3 of 7", "3/7", "wait", "Reviewer asks you", "asks you", "short")),
  cell("with the ask bar · position only", `<p class="ps"><span class="ps-stage">Implementation</span><span class="dot" aria-hidden="true">·</span><span class="ps-pos">Step 3 of 7 · review pass 2</span></p>`),
]]);
// 3. The voice switch (A)
const vsw = (cls = "", on = "rev", off = "impl", g = "wait", extra = "") => `<button class="vsw ${cls}" type="button" ${cls.includes("is-disabled") ? "disabled" : ""} aria-label="Talking to the ${NAME2[on]}. Show the ${NAME2[off]}'s conversation">${`<span class="av ${on === "rev" ? "rev" : ""}">${I(on === "rev" ? "review-s" : "bot")}</span>`}<span class="on">${NAME2[on][0].toUpperCase() + NAME2[on].slice(1)}</span><span class="sw-i">${I("swap")}</span>${g === "spin" ? `<span class="spin"></span>` : st(g)}<span class="off">${extra || NAME2[off][0].toUpperCase() + NAME2[off].slice(1)}</span></button>`;
const NAME2 = { impl: "implementer", rev: "reviewer" };
C.push(["Voice switch · A", "In the composer's footer: the agent on screen, the one you write to, and the other with the glyph of its session. One click, or Alt+`, shows the other conversation. Only while the step has both agents.", () => [
  cell("default", vsw()), cell("hover", vsw("is-hover")), cell("focus", vsw("is-focus")), cell("active", vsw("is-active")),
  cell("disabled · the other has not started", vsw("is-disabled", "impl", "rev", "idle", "Reviewer · starts with pass 1")),
  cell("loading · opening the other", vsw("is-loading", "rev", "impl", "spin", "Opening…")),
  cell("error · can't open it", vsw("is-error", "rev", "impl", "error", "Implementer · can't open, try again")),
]]);
// 4. The stepper (B)
const SP = (label, o, cls = "") => cell(label, `<div class="stepbox ${cls}">${stepper(o)}</div>${cls.includes("hov") ? `<div class="tip static" role="tooltip"><span>PR review · to come</span></div>` : ""}`, "wide");
C.push(["Stepper · B", "The stages as points with names, the current one opened into a pill with the position and the state. No track and no times. One stop of Tab, with the whole progress as its name; the names of the folded points are in the tooltip. It has no action: Back to… lives in ⋯.", () => [
  SP("default · no ask bar, the state in words", { stage: 3, g: "run", pos: "3/7 · round 1", short: "working", word: "Implementer working", bar: false }),
  SP("with the ask bar · glyph and position only", { stage: 3, g: "wait", pos: "3/7 · pass 2", short: "asks you", word: "Reviewer asks you", bar: true }),
  SP("hover · a folded point shows its name", { stage: 3, g: "wait", pos: "3/7", short: "asks you", word: "Reviewer asks you" }, "fold hov"),
  SP("focus", { stage: 3, g: "run", pos: "3/7", short: "working", word: "Implementer working", cls: "is-focus" }),
  SP("active · no action on a click", { stage: 3, g: "run", pos: "3/7", short: "working", word: "Implementer working" }),
  SP("disabled · task paused", { stage: 3, g: "paused", pos: "3/7", short: "paused", word: "Paused", cls: "is-paused" }),
  SP("loading · first reading", { stage: 3, g: "run", pos: "", short: "reading…", word: "Reading the task", cls: "is-loading" }),
  SP("error", { stage: 3, g: "error", pos: "5/7", short: "blocked", word: "Blocked" }),
  SP("folded · a half monitor", { stage: 3, g: "wait", pos: "4/7", short: "your review", word: "Your review" }, "fold"),
  SP("PR review · checks", { stage: 5, g: "gh", pos: "", short: "checks 3/5", word: "Waiting for checks" }),
  SP("closing", { stage: 6, g: "close", pos: "", short: "ready", word: "Ready to close" }),
  SP("One-Shot", { stages: ONESHOT, stage: 1, g: "run", pos: "2/4", short: "working", word: "Implementer working" }),
]]);
// 5. The voice tabs (B)
const vt = (sel, g, name, word = "", cls = "", wcls = "") => `<button role="tab" class="vt ${cls}" aria-selected="${sel}" ${cls.includes("is-disabled") ? "disabled" : ""}>${g === "spin" ? `<span class="spin"></span>` : st(g)}<span>${name}</span>${word ? `<span class="vw ${wcls}">· ${word}</span>` : ""}</button>`;
const tabs = (a, b) => `<div class="vtabs-in" role="tablist" aria-label="Conversations of step 3">${a}${b}</div>`;
C.push(["Voice tabs · B", "Two small tabs above the conversation, only while the step has both agents. The glyph of each session; the word only on the other tab when it waits or failed.", () => [
  cell("default", tabs(vt(false, "wait", "Implementer", "waits"), vt(true, "wait", "Reviewer"))),
  cell("hover", tabs(vt(false, "wait", "Implementer", "waits", "is-hover"), vt(true, "wait", "Reviewer"))),
  cell("focus", tabs(vt(false, "run", "Implementer"), vt(true, "idle", "Reviewer", "", "is-focus"))),
  cell("active · selected", tabs(vt(true, "run", "Implementer"), vt(false, "idle", "Reviewer"))),
  cell("disabled · before pass 1", tabs(vt(true, "run", "Implementer"), vt(false, "todo", "Reviewer", "starts with pass 1", "is-disabled", "dis"))),
  cell("loading · starting", tabs(vt(false, "idle", "Implementer"), vt(true, "spin", "Reviewer", "starting", "is-loading", "dis"))),
  cell("error", tabs(vt(true, "idle", "Implementer"), vt(false, "error", "Reviewer", "error", "is-error", "err"))),
]]);
// 6. The marker line
const mk = (cls = "", open = false) => DOC("PRD.md", "09:41", "", PRD_EXCERPT, { open }).replace('<summary class="ev"', `<summary class="ev ${cls}"`);
C.push(["Marker line", "A document written, a step started, a report, a product message, a commit: one discreet line, the content one click away in place. Replaces the icon tile and the second line of round 09.", () => [
  cell("default", mk()), cell("hover", mk("is-hover")), cell("focus", mk("is-focus")), cell("active · open", mk("", true)),
  cell("disabled · discarded", EVX("file", "Written <span class=\"n\">PRD.md</span>", "09:41", "", "", { cls: "is-disabled" }).replace(I("right"), "<span>discarded</span>")),
  cell("loading", EVX("filecheck", "Written <span class=\"n\">tech-spec.md</span>", "10:22", "", "", { cls: "is-loading" }).replace(I("right"), `<span class="spin"></span>`)),
  cell("error", EVX("filecheck", "Written <span class=\"n\">tech-spec.md</span>", "10:22", "", "", { cls: "is-error" }).replace(I("right"), "<span>Can't read it · Try again</span>")),
]]);
// 7. The action group at rest
const ag = (o, cls = "") => ACTS({ n: 14, roll: "Read 8 · Searched 4 · git 2", dur: "1 min 50 s", rows: [["Read the step file", "cat steps/03-token-bucket.md", "done", "0.1 s"], ["Find the API key middleware", "grep -rn \"X-API-Key\" internal/http", "done", "0.2 s"]], ...o }).replace("<summary>", `<summary class="${cls}">`);
C.push(["Action group at rest", "Folded, it is a line like a marker: no block until it opens. The running one says its action in the summary.", () => [
  cell("default", ag({})), cell("hover", ag({}, "is-hover")), cell("focus", ag({}, "is-focus")), cell("active · open", ag({ open: true })),
  cell("running", ag({ live: ["Run the refill and eviction tests", "go test ./internal/ratelimit/..."] })),
  cell("failed", ag({ fail: 1 }, "")), cell("waits on a card", ag({ hold: true })),
]]);
// 8. The ⋯ menu
const mi = (t, cls = "", ex = "") => `<button class="mi ${cls}" role="menuitem" ${ex}>${t}</button>`;
C.push(["More menu", "The tools that are not the screen's: the step's, the pull request's, the task's. Destructive last, in red.", () => [
  cell("items in every state", `<div class="menu more static" role="menu"><div class="menu-cap">Step 3 · Token bucket middleware</div>${mi("Review myself")}${mi("Open in VS Code", "is-hover")}${mi("Discard step 3…", "is-focus")}${mi("Refresh PR", "is-active")}${mi('Review again<span class="sub">· a pass waits for the checks</span>', "", 'aria-disabled="true"')}${mi('<span class="spin"></span>Reading the pull request…', "is-loading")}<div class="menu-sep"></div>${mi("Delete task…", "danger")}</div>`),
  cell("error · a submenu that can't load", `<div class="menu more static" role="menu">${mi('Models<span class="sub">per stage</span>')}<div class="menu-msg err">Can't read the models of Claude Code · Try again</div></div>`),
]]);
// 9. Details: a conversation row
const pr = (cls = "", ex = "", label = "Implementer", m = "") => `<div class="pl-list"><button class="pl-row conv ${cls}" ${ex}>${I("chat")}<span class="grow trunc">${label}</span><span class="m">${m}</span></button></div>`;
C.push(["Details · earlier conversation", "Under each committed step and under Planning: the conversations and the reports. A click reads it in place of the current one, read only.", () => [
  cell("default", pr()), cell("hover", pr("is-hover")), cell("focus", pr("is-focus")), cell("active · being read", pr("is-on")),
  cell("disabled · archived", pr("", 'aria-disabled="true"', "Implementer · not kept after archive")),
  cell("loading", `<div class="pl-list"><button class="pl-row" aria-busy="true"><span class="spin"></span><span class="grow trunc">Opening the conversation…</span></button></div>`),
  cell("error", `<div class="pl-list"><button class="pl-row st-error-t">${st("error")}<span class="grow trunc">Can't read it · Try again</span></button></div>`),
]]);
// 10. The foot of an earlier conversation
const pf = (cls = "") => `<div class="pastfoot"><span>${I("history")}<b>Step 2 · Implementer</b> · an earlier conversation. It takes no more messages.</span><button class="btn sm ${cls}">Back to step 3</button></div>`;
C.push(["Earlier conversation foot", "In place of the composer while an earlier conversation is on screen: what it is, and the one way back.", () => [
  cell("default", pf()), cell("hover", pf("is-hover")), cell("focus", pf("is-focus")), cell("active", pf("is-active")),
]]);

// 11. Review mode popover
const PO = (m, cls = "", dis = false) => `<button class="pop-opt ${cls}" role="radio" aria-checked="${cls.includes("sel")}" ${dis ? 'aria-disabled="true"' : ""}>${I(m === "Manual" ? "user" : "bot")}<span class="po-t"><b>${m}</b><small>${m === "Agent" ? "An agent reviews each step with the implementer." : "You review each step in VS Code and approve."}</small></span>${I("check", "i ck")}</button>`;
const POP = (inner, note) => `<div class="pop popm static" role="dialog" aria-label="Review mode"><div class="pop-h">Review mode</div>${inner}<p class="pop-note">${note}</p></div>`;
C.push(["Review mode popover", "Opened from Review mode › in ⋯ and from Review mode in Details: the task's mode for the steps not started that follow it.", () => [
  cell("default and selected", POP(PO("Agent", "sel") + PO("Manual"), "Applies to the steps not started that follow the task: 5, 6, 7.")),
  cell("hover", POP(PO("Agent", "sel") + PO("Manual", "is-hover"), "Applies to steps 5, 6, 7.")),
  cell("focus", POP(PO("Agent", "sel") + PO("Manual", "is-focus"), "Applies to steps 5, 6, 7.")),
  cell("active", POP(PO("Agent", "sel is-active") + PO("Manual"), "Applies to steps 5, 6, 7.")),
  cell("disabled · no step left", POP(PO("Agent", "sel", true) + PO("Manual", "", true), "No step is left to start, so the mode can't change.")),
  cell("loading · saving", POP(PO("Agent") + PO("Manual", "sel").replace(I("check", "i ck"), `<span class="spin"></span>`), "Saving…")),
  cell("error", POP(PO("Agent", "sel") + PO("Manual"), `<span class="st-error-t">Couldn't save the mode · Try again</span>`)),
]]);
// 12. Models popover and the step selectors
const PMR = (n, v, how = "open", cls = "") => `<div class="pm-row"><span class="pm-n">${n}</span>${how === "open" ? `<button class="chip sm ${cls}" aria-haspopup="listbox">${v}${I("down")}</button>` : how === "err" ? `<button class="chip sm is-error" aria-haspopup="listbox" data-tip="Not in the models of the installed Claude Code">◇ ${v}${I("down")}</button>` : how === "load" ? `<button class="chip sm is-loading" aria-busy="true"><span class="spin"></span>${v}</button>` : `<span class="pm-v">${v}<span class="faint"> · started</span></span>`}</div>`;
C.push(["Models popover", "Opened from Models › in ⋯ and from Models in Details: one row per stage of the task's mode. A started stage shows its model without edit; the step review stays editable until the last step is committed.", () => [
  cell("rows in every state", `<div class="pop popm static" role="dialog" aria-label="Models"><div class="pop-h">Models</div><div class="pm">${PMR("Plan", "Opus · medium", "started")}${PMR("Step review", "Opus · high")}${PMR("PR", "Sonnet · medium", "open", "is-hover")}${PMR("PR review", "Opus · high", "open", "is-focus")}${PMR("PR review", "Opus · high", "open", "is-active")}${PMR("PR", "Sonnet · medium", "load")}${PMR("PR review", "Opus 4.1 · high", "err")}</div><p class="pop-note">A stage takes its model when it starts.</p></div>`),
]]);
const SEL = (cls = "", own = false, label = "Agent", icon = "bot") => `<span class="pl-sel"><button class="chip xs ${own ? "own" : ""} ${cls}" aria-haspopup="listbox">${I(icon)}${label}</button><button class="chip xs">Sonnet · high</button></span>`;
C.push(["Step mode and model, in Details", "Each step not started chooses its review mode and its model. A step with its own choice is in ink; one that follows the task is quiet. A started step shows them without edit.", () => [
  cell("default · follows the task", SEL()), cell("own mode", SEL("", true, "Manual", "user")), cell("hover", SEL("is-hover")), cell("focus", SEL("is-focus")), cell("active · open", SEL("is-active", true)),
  cell("disabled · started", `<span class="pl-row"><span class="m now">now · Agent</span></span>`),
  cell("loading", SEL("is-loading", false, "Saving…", "bot")),
  cell("error · unavailable model", `<span class="pl-sel"><button class="chip xs">${I("bot")}Agent</button><button class="chip xs is-error" data-tip="Not in the models of the installed Claude Code">◇ Opus 4.1</button></span>`),
]]);

function mode(t, parts) { return `<div class="mode m" data-theme="${t}"><span class="mcap">${t}</span>${parts.join("")}</div>`; }
function render() {
  const show = Q.get("show");
  const modes = show === "light" || show === "dark" ? [show] : ["light", "dark"];
  document.getElementById("app").innerHTML = `<main class="spec"><header><h1>Task screen components</h1><p>Round 10. What the minimal task screen adds or changes, in every state and both modes. They enter <code>system/components.md</code> once a variation is decided.</p></header>
    ${C.map(([h, p, f]) => `<section class="cs"><h2>${h}</h2><p>${p}</p><div class="modes">${modes.map((t) => mode(t, f())).join("")}</div></section>`).join("")}</main>`;
  layoutLine(); markTruncated();
}
document.addEventListener("DOMContentLoaded", () => {
  document.body.insertAdjacentHTML("afterbegin", SPRITE);
  document.body.insertAdjacentHTML("afterbegin", `<svg class="sprite" aria-hidden="true"><symbol id="i-swap" viewBox="0 0 16 16"><path d="M3.5 5.5h9M10 3l2.5 2.5L10 8M12.5 10.5h-9M6 8l-2.5 2.5L6 13"/></symbol><symbol id="i-chat" viewBox="0 0 16 16"><path d="M3 4.4A1.4 1.4 0 0 1 4.4 3h7.2A1.4 1.4 0 0 1 13 4.4v5.2A1.4 1.4 0 0 1 11.6 11H7.2L4.2 13.3V11A1.4 1.4 0 0 1 3 9.6z"/></symbol></svg>`);
  document.body.insertAdjacentHTML("beforeend", `<div id="app"></div><pre id="report" class="report" hidden></pre>`);
  render();
  addEventListener("resize", layoutLine);
  if (document.fonts) document.fonts.ready.then(layoutLine);
  if (Q.has("audit")) setTimeout(audit, 900);
});
