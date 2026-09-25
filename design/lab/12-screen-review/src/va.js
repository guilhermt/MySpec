if ((SCN === "publish" || CLEAN) && !APPLY) S.dialog = "publish";
/* =====================================================================
   A · Cards in the conversation. As in the task screen: the report is a
   marker, and the findings are one card in the conversation with the ask
   bar as the decision bar (Next to decide, Publish review). When every
   finding is decided, a second card is born at the end: the publication,
   with the verdict already chosen by the decisions and the summary to edit.
   The publication is the dialog of b: the verdict chosen by you,
   suggested by the decisions and never marked, the summary optional.
   ===================================================================== */
const V = {
  key: "a",
  after() {
    const card = FIND.length ? `<fieldset class="card dec plain" id="fcard" aria-labelledby="fc-t"><div class="hd"><span id="fc-t">Findings</span><span class="grow"></span><span class="faint num">${FIND.length}</span></div>
      <div class="bd"><div class="fnds">${FIND.map(fndA).join("")}</div></div></fieldset>` : "";
    return card;
  },
  column: () => "",
  publishDialog: () => publishDialogB(),
  bar: () => VA_BAR(),
  next() {
    const open = FIND.filter((f) => !S.dec[f.n]); const after = open.find((f) => f.n > S.cur) || open[0];
    const to = after ? after.n : S.cur; S.cur = to; render(`#fnd-${to}`); document.getElementById(`fnd-${to}`).scrollIntoView({ block: "center" });
  },
  afterDecide(n) {
    const nx = S.dec[n] ? nextOpen(n) : null; if (nx) S.cur = nx;
    render(`#fnd-${S.cur}`); const f = document.getElementById(`fnd-${S.cur}`); if (f && nx) f.scrollIntoView({ block: "center" });
  },
  onKey(e) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && allDecided() && S.phase === "decide" && !APPLY) { e.preventDefault(); S.dialog = "publish"; render(); focusDialog(); return true; }
    const f = e.target.closest && e.target.closest(".fnd");
    if (f && e.key === "e" && !e.ctrlKey) { e.preventDefault(); S.edit = +f.dataset.fnum; render(); document.getElementById(`fe-${f.dataset.fnum}`).focus(); return true; }
    if (f && e.key === "o") { e.preventDefault(); openLine(+f.dataset.fnum, "gh"); return true; }
    if (f && e.key.toLowerCase() === "e" && e.ctrlKey) { e.preventDefault(); openLine(+f.dataset.fnum, "ed"); return true; }
    return false;
  },
  initFocus() {
    if (SCN === "findings") { const f = document.getElementById(`fnd-${S.cur}`); if (f) { f.focus({ preventScroll: true }); f.scrollIntoView({ block: "center" }); } }

  },
};
