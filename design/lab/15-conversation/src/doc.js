/* =====================================================================
   A · Document. The conversation reads as running text. A margin on the
   left holds who speaks and when; the text column holds what is said.
   The agent's speech has no card and no ground. The actions are a thin
   folded line between speeches; open, the sunken block of the system.
   Your messages sit on the right, on a rule, without a balloon. The
   milestones are the discreet line of components.md (no rule across the
   reading), and a stretch of the past folds behind that same line. The
   question and the permission are the only blocks with a contour.
   After the critique, two loans from B: the time is written only when it
   changes, and the arrow keys walk every entry (→ opens, ← folds), with
   one Tab stop for the whole conversation.
   ===================================================================== */
let DOC_LAST = "";
// The margin: the time, only when it changes; the exact time stays in the tooltip and the accessible name.
function dTime(at) {
  const show = at && at !== DOC_LAST; if (at) DOC_LAST = at;
  return show ? `<span class="dt" data-tip="${LONG_TIME(at)}">${at}</span>` : "";
}
const dMargin = (e, extra = "") => `<div class="dm">${extra}${dTime(e.at)}</div>`;
// A retry that went through is a fact of the turn that follows: it joins that group's line instead of
// standing as a line of its own, so milestones do not stack.
function docPrep(list) {
  const out = [];
  list.forEach((e, k) => {
    if (!e) return;
    const next = list[k + 1];
    if (e.t === "mark" && e.kind === "retry" && next && next.t === "acts") { out.push({ ...next, retried: "retried on its own · 2 attempts", retriedTip: plain(e.n) }); list[k + 1] = null; return; }
    out.push(e);
  });
  return out.filter(Boolean);
}
function docEntries(list) {
  let prev = null;
  return docPrep([...list]).map((e) => {
    const html = docEntry(e, prev);
    prev = e.t === "agent" ? e.who : e.t === "acts" ? prev : null;
    return html;
  }).join("");
}
function docEntry(e, prevWho) {
  if (e.t === "agent") {
    const same = prevWho === e.who;
    const mark = e.streaming ? `<span class="dmk">${st("run")}</span>` : `<span class="dmk ${e.who === "rev" ? "rev" : ""}" aria-hidden="true"></span>`;
    const who = same ? "" : `<span class="dn">${WHO[e.who]}</span>`;
    const t = dTime(e.at);
    return `<article class="dr d-sp ${same ? "same" : ""}" data-nav tabindex="-1" aria-label="${WHO[e.who]}, ${e.at}${e.streaming ? ", writing" : ""}${e.interrupted ? ", interrupted" : ""}">
      <div class="dm">${same ? "" : mark}${who}${t}${e.streaming ? `<span class="dt">writing</span>` : ""}</div>
      <div class="dx"><div class="prose">${speechHTML(e)}</div>${e.interrupted ? `<div class="intr">${I("ban")}Interrupted by you</div>` : ""}</div></article>`;
  }
  if (e.t === "user") {
    DOC_LAST = e.at;
    const meta = e.queued ? `<span class="dq">Queued · sends when the turn ends</span><button class="btn ghost xs" data-tip="Remove the message from the queue">Remove</button>` : `<span>You · ${e.at}${e.fromQueue ? " · from the queue" : ""}</span>`;
    return `<article class="dr d-us ${e.queued ? "queued" : ""}" data-nav tabindex="-1" aria-label="You, ${e.at}${e.queued ? ", queued" : ""}"><div class="dm"></div><div class="dx"><div class="dumeta">${meta}</div><div class="dutext">${e.text}</div></div></article>`;
  }
  if (e.t === "acts") {
    const dur = e.live ? e.live[2] : e.dur;
    const sum = `<summary data-nav tabindex="-1" aria-label="${actName(e)}${e.retried ? `, ${e.retried}` : ""}">${I("right", "i chev")}<span class="dan">${e.n} actions</span>${actRoll(e)}${dur ? `<span class="dad">· ${dur}</span>` : ""}${e.retried ? `<span class="dre" data-tip="${e.retriedTip}">${I("retry")}${e.retried}</span>` : ""}</summary>`;
    return `<div class="dr d-ac ${e.live ? "live" : ""}">${dMargin(e)}<details class="da" ${e.open ? "open" : ""}>${sum}${actRows(e)}</details></div>`;
  }
  if (e.t === "mark") {
    // The discreet line of components.md: the icon, the words, the complement; the time in the margin.
    const line = `${I(e.icon, "i dki")}<span class="dkt">${e.text}</span>${e.n ? `<span class="dkn">${e.n}</span>` : ""}`;
    if (!e.body) return `<div class="dr d-mk ${e.kind}">${dMargin(e)}<div class="dk" data-nav tabindex="-1" role="separator" aria-label="${markName(e)}">${line}</div></div>`;
    return `<div class="dr d-mk ${e.kind}">${dMargin(e)}<details class="dkd"><summary class="dk" data-nav tabindex="-1" aria-label="${markName(e)}, opens here">${line}${I("right", "i chev")}</summary>${markBody(e)}</details></div>`;
  }
  if (e.t === "question" || e.t === "permission") return `<article class="dr d-req" data-nav tabindex="-1" aria-label="${e.t === "question" ? (e.answered ? "Question, answered" : "Question") : "Permission"}, ${e.at}">${dMargin(e)}<div class="dx">${reqCard(e)}</div></article>`;
  if (e.t === "error") return `<article class="dr d-err" data-nav tabindex="-1" aria-label="Session error, ${e.at}">${dMargin(e)}<div class="dx">${errBlock(e)}</div></article>`;
  if (e.t === "activity") return `<div class="dr d-act" data-nav tabindex="-1" role="status" aria-label="${e.text}, ${e.sub}">${dMargin(e)}<div class="dx"><span class="dact">${st("run")}<b>${e.text}</b><span>· ${e.sub}</span></span></div></div>`;
  if (e.t === "findings") return `<article class="dr d-req" data-nav tabindex="-1" aria-label="Findings to decide, 17:50">${dMargin({ at: "17:50" })}<div class="dx">${findingsCard()}</div></article>`;
  if (e.t === "fold") {
    // A stretch of the past behind the same discreet line: the range in the margin, the whole label, the size.
    const range = `<div class="dm range"><span class="dt" data-tip="${LONG_TIME(e.at)} to ${e.to}">${e.at}</span><span class="dt">${e.to}</span></div>`;
    DOC_LAST = "";
    const inner = docEntries(e.entries.slice(1));
    DOC_LAST = e.to;
    return `<details class="dr-fold"><summary class="dr d-mk fold" data-nav tabindex="-1" aria-label="${plain(e.title)} ${plain(e.sub)}, folded: ${e.speeches} speeches and ${e.actions} actions, ${e.at} to ${e.to}">${range}<span class="dk">${I(e.product ? "product" : "play", "i dki")}<span class="dkt">${e.title}</span><span class="dkn">${e.sub}</span><span class="dfs">${e.speeches} speeches · ${e.actions} actions</span>${I("right", "i chev")}</span></summary><div class="dfold-in">${inner}</div></details>`;
  }
  return "";
}
V.nav = "[data-nav]";
V.key = (e, cur) => {
  const d = cur.tagName === "SUMMARY" ? cur.parentElement : null; if (!d) return;
  if (e.key === "ArrowRight" && !d.open) { e.preventDefault(); d.open = true; }
  if (e.key === "ArrowLeft" && d.open) { e.preventDefault(); d.open = false; }
};
V.conv = () => { ENTRY_N = 0; DOC_LAST = ""; return `<div class="cv doc" role="feed" aria-label="The conversation with the ${(WHO[curVoice()] || "agent").toLowerCase()}">${docEntries(convEntries())}</div>${newMessages()}`; };
V.after = afterRender;
