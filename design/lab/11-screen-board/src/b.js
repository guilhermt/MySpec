/* =====================================================================
   B · By epic. The cards of an epic together, under the epic's own card
   as the header, with its progress; the status as a word on the row; the
   cards without an epic after them. The finished cards of each group fold
   into one line, and the finished epics into one line at the end. The card
   opens in place: the row grows into the card.
   The list is not a tree: each row is a disclosure button, and the card it
   opens is a region right after it (WAI-ARIA disclosure), so no region ever
   sits inside a tree. The arrows still move between the rows.
   ===================================================================== */
S.full = false;
const byOrder = (x, y) => x.s - y.s || CARDS.indexOf(x) - CARDS.indexOf(y);
// The status word shows on the first card of each run: the rest of the run is quiet, the name says it.
let RUN = null;
function rowOrCard(c) { const quiet = RUN === c.s && S.open !== c.n; RUN = S.open === c.n ? null : c.s; return cardRow(c, 2, { quiet }) + (S.open === c.n ? inlineCard(c) : ""); }
const runs = (list) => { RUN = null; const h = list.map(rowOrCard).join(""); RUN = null; return h; };
function finRow(key, fin, shut, label) {
  if (!fin.length) return "";
  const tip = STATUSES.filter((s) => s.final).map((s) => `${s.name} ${fin.filter((c) => STATUSES[c.s] === s).length}`).filter((x) => !/ 0$/.test(x)).join(" · ");
  return `<div class="fin" role="button" aria-expanded="${!shut}" tabindex="-1" data-nav data-grp="${key}" id="h-${key}" data-tip="${label ? "Epics whose cards are all finished" : tip}" aria-label="${label || `${fin.length} finished cards: ${tip}`}">${I("down", "i chev")}<span>${label || `${fin.length} finished`}</span></div>`
    + (shut ? "" : runs(fin.sort(byOrder)));
}
function inlineCard(c) {
  return `<div class="cx" role="region" id="cx${c.n}" aria-label="Card #${c.n} ${esc(c.t)}">
    <button class="btn ghost sm icon cx-x" data-act="close-card" aria-label="Close the card" data-tip="Close · Esc">${I("x")}</button>
    <div class="cx-main">${S.stale === c.n ? cardNotes(c) : ""}
      <div class="cx-bar">${cardActions(c)}<span class="grow"></span><span class="cd-ref"><span>${repoOf(c.repo)}</span><a href="#" data-tip="Open on GitHub">GitHub</a></span></div>
      ${S.stale === c.n ? "" : cardNotes(c)}${cardTask(c)}
      <div class="cx-body ${S.full ? "" : "clamp"}" id="cxb${c.n}">${cardBody(c)}</div>
      <button class="btn ghost xs cx-more" data-act="full" aria-expanded="${S.full}" aria-controls="cxb${c.n}">${S.full ? "Show less" : "Show the whole card"}</button></div>
    <div class="cx-side">${cardFacts(c)}${cardRelations(c)}</div></div>`;
}
// The epic's header is the epic's card: one target. A click or Enter opens the card, S and D act on it.
function epicHead(e) {
  const done = epicDone(e.n), all = e.kids.length, pct = Math.round((done / all) * 100), open = S.open === e.n;
  const lead = S.selMode ? `<span class="lead"><span class="cb ${S.sel.has(e.n) ? "on" : ""}" aria-hidden="true">${I("check")}</span></span>` : `<span class="lead">${I("epic")}</span>`;
  return `<div class="eh ${open ? "open" : ""}" role="button" aria-expanded="${open}" ${open ? `aria-controls="cx${e.n}"` : ""} ${S.selMode ? `aria-pressed="${S.sel.has(e.n)}"` : ""} tabindex="-1" data-nav data-card="${e.n}" id="c${e.n}"
    aria-label="Epic #${e.n} ${e.t}, ${STATUSES[e.s].name}, ${done} of ${all} cards finished">${lead}
    <span class="nm"><span class="t">${e.t}</span><span class="cnt">#${e.n}</span></span>
    <span class="prog"><span class="pt">${done} of ${all} finished</span><span class="bar" aria-hidden="true"><i style="--p:${pct}"></i></span><span class="keys" aria-hidden="true"><span><kbd>S</kbd>start</span><span><kbd>D</kbd>discuss</span></span></span></div>`
    + (open ? inlineCard(e) : "");
}
const V = {
  key: "b", inline: true,
  cols: ["lead", "status", "num", "title", ["dep", "task"], "keys"],
  list(cards) {
    const ids = new Set(cards.map((c) => c.n));
    // A card that left the reading while open stays in place, struck, until it is closed.
    if (S.stale && S.open === S.stale) ids.add(S.stale);
    const openEpics = CARDS.filter((c) => c.epicOf && c.kids.some((k) => !isFinal(CARD[k])));
    const doneEpics = CARDS.filter((c) => c.epicOf && !openEpics.includes(c));
    let h = "";
    openEpics.forEach((e) => {
      const kids = e.kids.map((k) => CARD[k]).filter((c) => ids.has(c.n));
      if (!kids.length && !ids.has(e.n)) return;
      const open = kids.filter((c) => !isFinal(c)).sort(byOrder), fin = kids.filter(isFinal), key = `e${e.n}`;
      h += `<section class="egrp" aria-labelledby="c${e.n}">${epicHead(e)}<div class="grpb">${runs(open)}${finRow(`f-${key}`, fin, folded(`f-${key}`, true))}</div></section>`;
    });
    const none = cards.filter((c) => !c.epic && !c.epicOf), nOpen = none.filter((c) => !isFinal(c)).sort(byOrder), nFin = none.filter(isFinal);
    if (none.length) h += `<section class="egrp" aria-labelledby="h-none"><h3 class="eh plain" id="h-none"><span class="lead"></span><span class="nm"><span class="t">No epic</span></span><span class="prog"><span class="pt">${nOpen.length} open</span></span></h3><div class="grpb">${runs(nOpen)}${finRow("f-none", nFin, folded("f-none", true))}</div></section>`;
    const de = doneEpics.filter((e) => ids.has(e.n) || e.kids.some((k) => ids.has(k)));
    if (de.length) h += `<section class="egrp done" aria-label="Finished epics"><div class="grpb">${finRow("done-epics", de, folded("done-epics", true), `${de.length} finished epics`)}</div></section>`;
    return `<div class="lst" id="lst" role="group" aria-label="Cards of ${BOARD.title}, by epic">${h}</div>`;
  },
  panel: null,
};
document.addEventListener("click", (e) => { const f = e.target.closest('[data-act="full"]'); if (f) { S.full = !S.full; render(); const b = document.querySelector('[data-act="full"]'); if (b) b.focus(); } }, true);
