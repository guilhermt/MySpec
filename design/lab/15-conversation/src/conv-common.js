/* =====================================================================
   ROUND 15 · pieces the three variations share: the request cards, the
   error block, an action row, the findings card, the way back to the end,
   and the keyboard path between entries. Each variation sets:
     V.conv()       the conversation's HTML
     V.after(cv)    where the conversation opens (the end, or the top in `long`)
     V.nav          the selector of the entries the arrow keys walk
   ===================================================================== */
let ENTRY_N = 0;
const eid = () => `e${++ENTRY_N}`;
const plain = (h) => String(h).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const WHO = { impl: "Implementer", rev: "Reviewer", agent: "PRD agent" };
const WHO_ICON = { impl: "bot", rev: "review-s", agent: "bot" };
const LONG_TIME = (at) => `Today at ${at}`;

// An action row: the description the agent wrote, the command dimmed, the status or the duration.
// A subagent opens its own actions, indented, with its own summary.
function actIcon(s) {
  if (s === "done") return `<span class="ai ok">${I("check")}</span>`;
  if (s === "error") return `<span class="ai bad">${I("x")}</span>`;
  if (s === "interrupted") return `<span class="ai">${I("ban")}</span>`;
  if (s === "wait") return `<span class="ai">${I("hold")}</span>`;
  if (s === "agent") return `<span class="ai">${I("bot")}</span>`;
  return `<span class="ai">${st("run")}</span>`;
}
function actRow(r) {
  const [label, cmd, s, note, sub] = r;
  if (s === "agent") return `<li class="ar sub"><details class="subag"><summary aria-label="${label}, ${sub.roll}, ${sub.dur}">${I("right", "i chev")}${actIcon("agent")}<span class="al">${label}</span><span class="sroll">${sub.roll}</span><span class="ad">${sub.dur}</span></summary><ul class="subrows">${sub.rows.map(actRow).join("")}</ul></details></li>`;
  const cls = s === "error" ? "is-err" : s === "running" ? "is-now" : s === "wait" ? "is-hold" : s === "interrupted" ? "is-int" : "";
  return `<li class="ar ${cls}">${actIcon(s)}<span class="al">${label}</span><span class="ac" data-tip="${esc(cmd)}">${esc(cmd)}</span><span class="ad">${note || s}</span></li>`;
}
function actRows(g) {
  const earlier = g.earlier ? `<li class="ar more"><button class="earlier" type="button">${I("up")}Show ${g.earlier} earlier actions</button></li>` : "";
  return `<ul class="arows">${earlier}${g.rows.map(actRow).join("")}</ul>`;
}
// The summary of a group, in words: what it did, what failed, what waits.
function actRoll(g) {
  if (g.live) return `<span class="now">${st("run")}<span class="nl">${g.live[0]}</span><span class="nc">${esc(g.live[1])}</span></span>`;
  const fail = g.fail ? ` <span class="${g.recovered ? "rec" : "bad"}">· ${g.fail} failed${g.recovered ? ", then passed" : ""}</span>` : "";
  return `<span class="roll">${g.roll}${fail}${g.hold ? " · 1 waits for your permission" : ""}</span>`;
}
const actName = (g) => `${g.n} actions, ${g.live ? `running: ${g.live[0]}` : plain(g.roll)}${g.fail ? `, ${g.fail} failed${g.recovered ? " then passed" : ""}` : ""}${g.dur ? `, ${g.dur}` : ""}`;

// The request cards: no header band, the ask bar already says what and whose.
function reqCard(e) {
  const id = eid();
  if (e.t === "question" && e.answered) return `<fieldset class="card cv-ans" aria-labelledby="${id}"><div class="bd"><div class="aq" id="${id}">${I("check")}<span>${e.q}</span><span class="t">answered ${e.answeredAt}</span></div><div class="aa">${e.answer}</div></div></fieldset>`;
  if (e.t === "question") return `<fieldset class="card cv-req" ${e.live ? 'id="askcard"' : ""} aria-labelledby="${id}"><div class="bd"><div class="q" id="${id}">${e.q}</div>
    <div class="opts" role="radiogroup" aria-labelledby="${id}">${e.opts.map((o, k) => `<button class="opt" role="radio" aria-checked="false"><span class="kn">${k + 1}</span><span class="ot">${o[0]}<small>${o[1]}</small></span></button>`).join("")}
    <button class="opt" role="radio" aria-checked="false"><span class="kn">${e.opts.length + 1}</span><span class="ot">Other…<small>Write your own answer.</small></span></button></div></div></fieldset>`;
  return `<fieldset class="card cv-req" ${e.live ? 'id="askcard2"' : ""} aria-labelledby="${id}"><div class="bd"><div class="pd" id="${id}"><span class="tag">${e.tool}</span><span>${e.desc}</span></div><pre class="cmd">${e.cmd}</pre><div class="foot">${e.foot}</div>
    <div class="btns"><button class="btn primary">Allow <span class="k">1</span></button><button class="btn">Allow for this session <span class="k">2</span></button><button class="btn ghost">Deny… <span class="k">3</span></button></div></div></fieldset>`;
}
// The error: the explanation and the detail; the title and Retry live in the ask bar.
const errBlock = (e) => `<div class="cv-err" role="group" aria-label="Session error">${e.text}${e.detail ? `<pre>${e.detail}</pre>` : ""}</div>`;
// The findings of the PR review: the decision card of screens/task.md §9, as round 10 left it.
function findingsCard() {
  return FINDCARD(false).replace(/<fieldset class="card dec" id="askcard" aria-labelledby="dec-t"><div class="hd">[\s\S]*?<\/div>/, '<fieldset class="card dec plain" id="askcard" aria-labelledby="dec-t"><div class="hd"><span id="dec-t">Findings</span><span class="grow"></span><span class="faint num">4</span></div>').replace(/<div class="foot">[\s\S]*?<\/div><\/div><\/fieldset>$/, "</div></fieldset>");
}
// The body of a milestone that opens: a document, a report, the product's message.
function markBody(e) {
  if (!e.body) return "";
  const foot = e.kind === "product" ? "" : `<div class="mfoot"><button class="btn ghost xs" data-panel="Artifacts">${I("file")}${e.foot || "Open in Artifacts"}</button></div>`;
  return `<div class="mbody"><div class="prose sm">${e.body}</div>${foot}</div>`;
}
const markName = (e) => `${e.text}${e.n ? ` · ${plain(e.n)}` : ""}, ${e.at}`;
const caret = `<span class="caret" aria-hidden="true"></span>`;
// A streaming speech ends on a still caret: the spinner, beside the speaker, is what moves.
function speechHTML(e) {
  if (!e.streaming) return e.html;
  return e.html.replace(/(<\/(?:p|li)>)(?![\s\S]*<\/(?:p|li)>)/, `${caret}$1`);
}

// ---------------- The way back to the end ----------------
function newMessages() {
  if (SCENE !== "long") return "";
  return `<div class="tomsg"><button class="newmsg2" type="button" data-toend aria-label="New messages: 2. Go to the end. The implementer is writing.">${I("arrow-down")}<span class="nm-l">New messages</span><span class="nm-n">2</span><span class="nm-sep" aria-hidden="true"></span>${st("run")}<span class="nm-w">Implementer writing</span></button></div>`;
}

// ---------------- The keyboard path ----------------
// With the focus in the conversation, ↑ and ↓ (or Page Up and Page Down) move between entries; Home and End go
// to the first and the last. Tab still walks the controls inside an entry. Esc returns to the composer.
const shown = (x) => x.getClientRects().length && !x.parentElement.closest("details:not([open]) > :not(summary)");
function navList() { return [...document.querySelectorAll(`#convo ${V.nav}`)].filter(shown); }
// One Tab stop for the whole conversation: the current entry. The controls inside the current entry (an open
// group's rows, a card's options, Copy) take Tab too; everything else in the conversation waits for the arrows.
const FOCUSABLE = 'a[href], button, summary, [tabindex], input, textarea';
const boxOf = (nav) => nav.tagName === "SUMMARY" ? nav.parentElement : nav;
function rove(cur) {
  const cv = document.getElementById("convo"); if (!cv || !cur) return;
  cv.querySelectorAll(FOCUSABLE).forEach((el) => { if (!el.matches(V.nav)) el.tabIndex = -1; });
  navList().forEach((x) => { x.tabIndex = -1; });
  cur.tabIndex = 0;
  const box = boxOf(cur);
  box.querySelectorAll(FOCUSABLE).forEach((el) => {
    if (el === cur || el.matches(V.nav)) return;
    const owner = el.closest(V.nav); if (owner && owner !== cur) return;
    if (el.closest("[role=radiogroup]")) return;
    el.tabIndex = 0;
  });
  // A radiogroup is one stop: the chosen option, or the first.
  box.querySelectorAll("[role=radiogroup]").forEach((g) => { const opts = [...g.querySelectorAll("[role=radio]")]; const on = opts.find((o) => o.getAttribute("aria-checked") === "true") || opts[0]; opts.forEach((o) => { o.tabIndex = o === on ? 0 : -1; }); });
}
function focusEntry(el) {
  if (!el) return;
  rove(el); el.focus({ preventScroll: true }); el.scrollIntoView({ block: "nearest" });
}
// The option cards: 1–9 choose, ↑ ↓ move inside the radiogroup, Enter sends the chosen answer.
function choose(opt) {
  const g = opt.closest("[role=radiogroup]"); if (!g || opt.getAttribute("aria-disabled") === "true") return;
  g.querySelectorAll("[role=radio]").forEach((o) => { o.setAttribute("aria-checked", String(o === opt)); o.tabIndex = o === opt ? 0 : -1; });
  opt.focus();
}
function sendAnswer(card) {
  const opt = card.querySelector('[role=radio][aria-checked="true"]'); if (!opt) return;
  if (/Other…/.test(opt.textContent)) { const r = document.getElementById("reply"); if (r) { r.placeholder = "Write your answer and press Enter…"; r.focus(); } return; }
  card.setAttribute("aria-busy", "true");
  card.querySelectorAll("[role=radio]").forEach((o) => { o.setAttribute("aria-disabled", "true"); if (o !== opt) o.classList.add("is-disabled"); });
  const bd = card.querySelector(".bd");
  bd.insertAdjacentHTML("beforeend", `<div class="qsend" role="status">${st("run")}Sending “${opt.querySelector(".ot").firstChild.textContent.trim()}”…</div>`);
}
document.addEventListener("click", (e) => {
  const opt = e.target.closest(".cv [role=radio]"); if (opt) { choose(opt); return; }
  const pb = e.target.closest(".cv .card.cv-req .btns .btn");
  if (pb && !pb.closest("[aria-busy]")) { const card = pb.closest(".card"); card.setAttribute("aria-busy", "true"); card.querySelector(".bd").insertAdjacentHTML("beforeend", `<div class="qsend" role="status">${st("run")}${pb.textContent.replace(/\s*\d$/, "").trim().replace(/…$/, "")}…</div>`); }
});
document.addEventListener("keydown", (e) => {
  const cv = document.getElementById("convo"); if (!cv || !cv.contains(document.activeElement)) return;
  if (e.target.closest("textarea, input")) return;
  // Inside a request card the card keeps its keys: the arrows walk the options, never the conversation.
  const card = e.target.closest(".card.cv-req, .card.dec");
  const opt = e.target.closest("[role=radio]");
  if (opt && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "ArrowRight" || e.key === "ArrowLeft")) {
    e.preventDefault(); const opts = [...opt.closest("[role=radiogroup]").querySelectorAll("[role=radio]")]; const k = opts.indexOf(opt);
    choose(opts[(k + (e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : opts.length - 1)) % opts.length]); return;
  }
  if (opt && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); if (e.key === " ") choose(opt); else sendAnswer(opt.closest(".card")); return; }
  if (card && /^[1-9]$/.test(e.key)) {
    const opts = card.querySelectorAll("[role=radio]"); if (opts.length) { e.preventDefault(); e.stopImmediatePropagation(); const o = opts[+e.key - 1]; if (o) choose(o); return; }
    return;
  }
  if (card && ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"].includes(e.key) && e.target !== card.closest("[data-nav]")) return;
  const list = navList(); if (!list.length) return;
  const cur = document.activeElement.closest(V.nav);
  // On the entry of a card, 1–9 answer too.
  if (cur && /^[1-9]$/.test(e.key)) { const opts = cur.querySelectorAll("[role=radio]"); if (opts.length) { e.preventDefault(); const o = opts[+e.key - 1]; if (o) choose(o); return; } }
  const k = list.indexOf(cur);
  const go = { ArrowDown: 1, PageDown: 1, ArrowUp: -1, PageUp: -1 }[e.key];
  if (go && !e.altKey) { e.preventDefault(); focusEntry(list[Math.max(0, Math.min(list.length - 1, (k < 0 ? (go > 0 ? -1 : list.length) : k) + go))]); return; }
  if (e.key === "Home") { e.preventDefault(); focusEntry(list[0]); return; }
  if (e.key === "End") { e.preventDefault(); focusEntry(list[list.length - 1]); return; }
  if (e.key === "Escape") { const r = document.getElementById("reply"); if (r) { e.preventDefault(); r.focus(); } return; }
  if (V.key && cur) V.key(e, cur);
}, true);
// Focus that lands in the conversation by a click or by Show makes that entry the current one.
document.addEventListener("focusin", (e) => {
  const cv = document.getElementById("convo"); if (!cv || !cv.contains(e.target)) return;
  const cur = e.target.closest(V.nav); if (cur && cur.tabIndex !== 0) rove(cur);
});
// The last entry is the one Tab lands on; ?focus=N shows the focus on the Nth entry.
function armNav() {
  const list = navList(); if (!list.length) return;
  const req = list.find((x) => x.querySelector("#askcard, #askcard2"));
  rove(req || list[list.length - 1]);
  if (Q.has("focus")) { const n = +Q.get("focus"); const el = list[n < 0 ? list.length + n : n]; if (el) { rove(el); el.classList.add("is-focus"); el.addEventListener("blur", () => el.classList.remove("is-focus"), { once: true }); el.focus({ preventScroll: true }); el.scrollIntoView({ block: "center" }); } }
}
// ?tabs: the Tab stops of the conversation, measured, in the report.
function tabStops() {
  const cv = document.getElementById("convo"); if (!cv) return 0;
  return [...cv.querySelectorAll(FOCUSABLE)].filter((el) => el.tabIndex >= 0 && el.getClientRects().length && !el.closest("details:not([open]) > :not(summary)")).length;
}
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-toend]")) { const cv = document.getElementById("convo"); cv.scrollTop = cv.scrollHeight; const t = document.querySelector(".tomsg"); if (t) t.hidden = true; }
});
// Where the conversation opens: at the end, where it follows what arrives; the long scene opens scrolled up,
// the way a reader leaves it, so the folds and the way back to the end are both in sight.
// Pieces that shrink to their text land on whole pixels: WebKitGTK blurs half pixels (principle 10).
function snapWidths() {
  document.querySelectorAll(".cu, .newmsg2, .tut, .dutext, .cv-ans").forEach((el) => {
    el.style.width = ""; let w = Math.ceil(el.getBoundingClientRect().width);
    // A centred piece takes the parity of its container, so its left edge is whole too.
    if (el.classList.contains("newmsg2")) { const cw = Math.round(el.parentElement.getBoundingClientRect().width); if ((cw - w) % 2) w += 1; }
    el.style.width = w + "px";
  });
}
addEventListener("resize", snapWidths);
if (document.fonts) document.fonts.ready.then(snapWidths);
function afterRender(cv) {
  snapWidths();
  if (SCENE === "long") cv.scrollTop = 0;
  if (Q.has("open")) document.querySelectorAll(Q.get("open") === "all" ? "#convo details" : "#convo details.is-first").forEach((d) => d.open = true);
  requestAnimationFrame(armNav);
  const tm = document.querySelector(".tomsg"); if (!tm) return;
  // It exists only out of the end: at the end, or with everything in sight, there is nothing to go back to.
  const upd = () => { tm.hidden = cv.scrollHeight - cv.scrollTop - cv.clientHeight < 8; };
  upd(); cv.addEventListener("scroll", upd); addEventListener("resize", upd); if (document.fonts) document.fonts.ready.then(upd);
}
document.addEventListener("DOMContentLoaded", () => document.body.insertAdjacentHTML("afterbegin", SPRITE_15));
// ?kbtest: a scripted walk of the keyboard, written to the report (keys dispatched as the browser would).
if (Q.has("kbtest")) setTimeout(() => {
  const key = (k) => document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
  const name = () => { const a = document.activeElement; return (a.getAttribute("aria-label") || a.textContent || a.tagName).trim().replace(/\s+/g, " ").slice(0, 60); };
  const out = { scene: SCENE, voice: curVoice(), tabStopsConvo: tabStops() };
  const show = document.querySelector("[data-show]");
  if (show && document.querySelector("#askcard [role=radio]")) {
    show.click(); out.afterShow = name();
    key("ArrowDown"); out.afterDown = name(); out.checkedAfterDown = [...document.querySelectorAll("#askcard [role=radio]")].map((o) => o.getAttribute("aria-checked"));
    key("ArrowDown"); key("ArrowDown"); out.wrapsTo = name();
    key("1"); out.after1 = name(); out.checkedAfter1 = [...document.querySelectorAll("#askcard [role=radio]")].map((o) => o.getAttribute("aria-checked"));
    key("Enter"); out.afterEnter = (document.querySelector("#askcard .qsend") || {}).textContent || "nothing";
  }
  const list = navList(); focusEntry(list[list.length - 1]); out.start = name();
  const walk = []; for (let i = 0; i < 4; i++) { key("ArrowUp"); walk.push(name()); } out.up4 = walk;
  const grp = list.find((x) => x.tagName === "SUMMARY" && x.parentElement.matches(".da, .t-grp"));
  if (grp) { focusEntry(grp); out.grp = name(); out.grpWasOpen = grp.parentElement.open; key("ArrowRight"); out.rightOpens = grp.parentElement.open; key("ArrowLeft"); out.leftFolds = !grp.parentElement.open; }
  out.tabStopsAfter = tabStops();
  const pre = document.getElementById("report"); pre.hidden = false; pre.textContent = JSON.stringify(out, null, 1);
}, 1500);
