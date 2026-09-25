/* =====================================================================
   A · By status. The list grouped by the board's status sections, in the
   board's order, the final ones folded; the epic as a label on the row.
   The card opens as the Card panel beside the list, without leaving it.
   ===================================================================== */
if (SCN === "board" && !Q.get("v")) S.focusId = "c467";
const V = {
  key: "a", inline: false,
  cols: ["lead", "num", "title", ["epic", "dep", "task"], "keys"],
  list(cards) {
    const secs = STATUSES.map((s, i) => {
      const rows = cards.filter((c) => c.s === i).sort((x, y) => (x.closed - y.closed));
      const key = `s${i}`, empty = !rows.length, shut = folded(key, !!s.final);
      const head = `<div class="sech ${empty ? "is-empty" : ""}" role="treeitem" aria-level="1" ${empty ? "" : `aria-expanded="${!shut}"`} tabindex="-1" data-nav data-grp="${key}" id="h-${key}"
        aria-label="${s.name}, ${rows.length} card${rows.length === 1 ? "" : "s"}${s.final ? ", final status" : ""}" ${s.final ? 'data-tip="A final status: folded when the board opens"' : ""}>${I("down", "i chev")}<span class="nm">${s.name}<span class="cnt">${rows.length}</span></span><span></span></div>`;
      return head + (!empty && !shut ? `<div class="grpb" role="group" aria-labelledby="h-${key}">${rows.map((c) => cardRow(c)).join("")}</div>` : "");
    }).join("");
    return `<div class="lst" id="lst" role="tree" aria-label="Cards of ${BOARD.title}, by status" ${S.selMode ? 'aria-multiselectable="true"' : ""}>${secs}</div>`;
  },
  panel() {
    if (!S.open) return "";
    const c = CARD[S.open];
    return `<aside class="panel cardp" id="panel" aria-label="Card #${c.n}">
      <div class="panel-h"><span class="cd-ref"><span class="mono">#${c.n}</span><span aria-hidden="true">·</span><span class="trunc">${repoOf(c.repo)}</span></span><span class="grow"></span>
        <a class="btn ghost sm icon" href="#" aria-label="Open #${c.n} on GitHub" data-tip="Open on GitHub">${I("external")}</a>
        <button class="btn ghost sm icon" data-act="close-card" aria-label="Close the card" data-tip="Close · Esc">${I("x")}</button></div>
      <div class="panel-b cd">${S.stale === c.n ? cardNotes(c) : ""}
        <div class="cd-top"><h2 class="cd-title">${c.t}</h2>${cardSub(c)}</div>
        ${cardActions(c)}${S.stale === c.n ? "" : cardNotes(c)}${cardTask(c)}${cardFacts(c)}${cardBody(c)}${cardRelations(c)}</div></aside>`;
  },
};
