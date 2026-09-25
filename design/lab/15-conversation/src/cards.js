/* =====================================================================
   C · Light cards. Each speech of the agent and each message of yours
   sits on a card of a subtle surface, with who and when in its head.
   The actions and the milestones stay outside the cards, as compact
   lines between them. The question and the permission are cards with
   the wait ring. The rhythm is tighter than A and B. In a long session
   the earlier speeches collapse to one-line cards you skim by their
   first words; the actions of that stretch fold into its heading.
   The arrow keys go card to card; Enter opens a collapsed one.
   ===================================================================== */
const cAv = (who, streaming) => `<span class="cav ${who === "rev" ? "rev" : ""}" aria-hidden="true">${streaming ? st("run") : I(WHO_ICON[who])}</span>`;
function cEntries(list, min = false) { return list.map((e, k) => cEntry(e, min, list[k - 1])).join(""); }
function firstWords(h) { const t = plain(h); return t.length > 150 ? t.slice(0, 150) + "…" : t; }
function cEntry(e, min, prev) {
  if (e.t === "agent") {
    const head = `<div class="cch">${cAv(e.who, e.streaming)}<span class="ccn">${WHO[e.who]}</span><span class="cct" data-tip="${LONG_TIME(e.at)}">${e.at}${e.streaming ? " · writing" : ""}</span></div>`;
    if (min) return `<article class="cc min" data-nav tabindex="-1" aria-expanded="false" aria-label="${WHO[e.who]}, ${e.at}, collapsed: ${firstWords(e.html)}"><div class="cch">${cAv(e.who)}<span class="ccn">${WHO[e.who]}</span><span class="cct">${e.at}</span><span class="ccp" data-tip="${firstWords(e.html)}">${firstWords(e.html)}</span>${I("expand", "i cx")}</div><div class="ccb prose">${e.html}</div></article>`;
    return `<article class="cc" data-nav tabindex="-1" aria-label="${WHO[e.who]}, ${e.at}${e.streaming ? ", writing" : ""}${e.interrupted ? ", interrupted" : ""}">${head}<div class="ccb prose">${speechHTML(e)}</div>${e.interrupted ? `<div class="intr">${I("ban")}Interrupted by you</div>` : ""}</article>`;
  }
  if (e.t === "user") {
    if (min) return `<article class="cu min" data-nav tabindex="-1" aria-label="You, ${e.at}: ${e.text}"><div class="cuh"><span class="ccn">You</span><span class="cct">${e.at}</span><span class="ccp">${e.text}</span></div></article>`;
    const head = e.queued ? `<div class="cuh"><span class="ccn">Queued</span><span class="cct">sends when the turn ends</span><button class="btn ghost xs" data-tip="Remove the message from the queue">Remove</button></div>` : `<div class="cuh"><span class="ccn">You</span><span class="cct">${e.at}${e.fromQueue ? " · from the queue" : ""}</span></div>`;
    return `<article class="cu ${e.queued ? "queued" : ""}" data-nav tabindex="-1" aria-label="You, ${e.at}${e.queued ? ", queued" : ""}">${head}<div class="cut">${e.text}</div></article>`;
  }
  if (e.t === "acts") {
    if (min) return "";
    return `<details class="cact ${e.live ? "live" : ""}" ${e.open ? "open" : ""}><summary aria-label="${actName(e)}">${I("right", "i chev")}<span class="can">${e.n} actions</span>${actRoll(e)}<span class="cad">${e.live ? e.live[2] : e.dur || ""}</span><span class="cat">${e.at}</span></summary><div class="cab">${actRows(e)}</div></details>`;
  }
  if (e.t === "mark") {
    const line = `${I(e.icon)}<span class="cmt">${e.text}</span>${e.n ? `<span class="cmn" data-tip="${plain(e.n)}">${e.n}</span>` : ""}<span class="cat">${e.at}</span>`;
    if (!e.body) return `<div class="cmk ${e.kind}" role="separator" aria-label="${markName(e)}">${line}</div>`;
    return `<details class="cmkd"><summary class="cmk ${e.kind}" aria-label="${markName(e)}, show">${line}${I("right", "i chev")}</summary>${markBody(e)}</details>`;
  }
  if (e.t === "question" || e.t === "permission") {
    const who = e.t === "question" && CONV[SCENE] && (CONV[SCENE].rev || []).includes(e) ? "rev" : curVoice() === "rev" ? "rev" : SCENE === "planning" ? "agent" : "impl";
    // The head says who and when, unless the speech right above already does.
    const said = prev && prev.t === "agent" && prev.at === e.at;
    const head = said ? "" : `<div class="cch rq">${cAv(who)}<span class="ccn">${WHO[who]}</span><span class="cct">${e.at}${e.answered ? ` · answered ${e.answeredAt}` : ""}</span></div>`;
    return `<article class="crq" data-nav tabindex="-1" aria-label="${e.t === "question" ? (e.answered ? "Question, answered" : "Question") : "Permission"}, ${e.at}">${reqCard(e).replace('<div class="bd">', `<div class="bd">${e.answered ? "" : head}`)}</article>`;
  }
  if (e.t === "findings") return `<article class="crq" data-nav tabindex="-1" aria-label="Findings to decide">${findingsCard()}</article>`;
  if (e.t === "error") return `<article class="crq" data-nav tabindex="-1" aria-label="Session error, ${e.at}">${errBlock({ ...e, detail: `${e.detail} · ${e.at}` })}</article>`;
  if (e.t === "activity") return `<div class="cacty" role="status">${st("run")}<b>${e.text}</b><span>· ${e.sub}</span><span class="cat">${e.at}</span></div>`;
  if (e.t === "fold") {
    // A stretch of the past: its heading carries the actions; each speech is a one-line card.
    const acts = e.entries.filter((x) => x.t === "acts").reduce((n, x) => n + x.n, 0);
    return `<section class="cfold" aria-label="${plain(e.title)} ${plain(e.sub)}, ${e.at} to ${e.to}"><div class="cmk fold">${I(e.product ? "product" : "play")}<span class="cmt">${e.title}</span><span class="cmn" data-tip="${plain(e.sub)}">${e.sub}</span><span class="cfs">${e.speeches} speeches · ${acts} actions · ${e.at}–${e.to}</span><button class="btn ghost xs" type="button" data-expand-fold>Open all</button></div><div class="cfold-in">${cEntries(e.entries.slice(1), true)}</div></section>`;
  }
  return "";
}
V.nav = "[data-nav]";
V.key = (e, cur) => {
  if ((e.key === "Enter" || e.key === " ") && cur.classList.contains("min")) { e.preventDefault(); cur.classList.toggle("is-open"); cur.setAttribute("aria-expanded", String(cur.classList.contains("is-open"))); }
};
document.addEventListener("click", (e) => {
  const m = e.target.closest(".cc.min"); if (m && !e.target.closest(".ccb")) { m.classList.toggle("is-open"); m.setAttribute("aria-expanded", String(m.classList.contains("is-open"))); return; }
  const f = e.target.closest("[data-expand-fold]"); if (f) { const s = f.closest(".cfold"); const on = !s.classList.contains("is-open"); s.classList.toggle("is-open", on); f.textContent = on ? "Collapse all" : "Open all"; s.querySelectorAll(".cc.min").forEach((c) => { c.classList.toggle("is-open", on); c.setAttribute("aria-expanded", String(on)); }); }
});
V.conv = () => { ENTRY_N = 0; return `<div class="cv cards" role="feed" aria-label="The conversation with the ${(WHO[curVoice()] || "agent").toLowerCase()}">${cEntries(convEntries())}</div>${newMessages()}`; };
V.after = afterRender;
