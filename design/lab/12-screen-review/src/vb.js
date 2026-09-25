/* =====================================================================
   B · A list of findings. The conversation stays quiet: only the agent's
   session and its one-line markers. The findings live in the decision
   column beside it, one per line, decided by key (A, D) with the focus
   moving on to the next one to decide; the focused finding opens to its
   text, its place (GitHub first) and the decision. Publishing is a small dialog where the
   verdict is an explicit choice and the summary is optional.
   ===================================================================== */
if ((SCN === "publish" || CLEAN) && !APPLY) S.dialog = "publish";
const V = {
  key: "b",
  after: () => "",
  column() {
    if (!["findings", "publish"].includes(SCN) || S.phase !== "decide" || !S.col) return "";
    return `<aside class="fcol" id="fcol" aria-label="Findings of pass 1"><div class="fcol-h"><span class="t"><b>Findings</b> · pass 1</span><span class="prog" role="status">${decided()} of ${FIND.length} decided</span></div>
      <div class="flist2" role="list" aria-label="Findings of pass 1">${FIND.map(frow).join("")}</div>
      <p class="fcol-k"><kbd>A</kbd> approve <kbd>D</kbd> discard <kbd>↑↓</kbd> move</p></aside>`;
  },
  bar() {
    const tog = `<button class="btn ghost sm icon" data-act="col" aria-pressed="${S.col}" aria-controls="fcol" aria-label="${S.col ? "Hide" : "Show"} the findings" data-tip="${S.col ? "Hide" : "Show"} the findings">${I("list")}</button>`;
    if (!allDecided()) return ASK({ kind: "tinted", label: "Decide findings", place: "pass 1", s: { sev: "wait", since: "34m", long: "34 minutes" }, detail: `${decided()} of ${FIND.length} decided`,
      actions: `${tog}<button class="btn sm" data-act="next" data-tip="The next finding to decide · Alt+↓">${I("arrow-down")}Next to decide <span class="k">Alt ↓</span></button><span class="why" id="why-pub">Decide ${FIND.length - decided()} more</span><button class="btn sm primary" disabled aria-describedby="why-pub">Publish review…</button>` });
    const a = approved().length;
    return ASK({ kind: "tinted", label: "Ready to publish", place: "pass 1", s: { sev: "wait", since: "41m", long: "41 minutes" }, detail: FIND.length ? `${a} approved · ${FIND.length - a} discarded` : "A clean pass",
      actions: `${FIND.length ? tog : ""}<button class="btn sm primary" data-act="publish" data-tip="Choose the verdict and publish · Ctrl+Enter">Publish review… <span class="k">Ctrl ↵</span></button>` });
  },
  publishDialog: () => publishDialogB(),
  dialogKey(e) {
    if (S.dialog !== "publish") return false;
    if (/^[1-3]$/.test(e.key) && !(e.target.closest && e.target.closest("textarea"))) { const b = document.querySelectorAll(".pubd .opt")[+e.key - 1]; if (b && !b.disabled) { e.preventDefault(); b.click(); } return true; }
    const o = e.target.closest && e.target.closest(".pubd .opt");
    if (o && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); const all = [...document.querySelectorAll(".pubd .opt:not(:disabled)")], k = all.indexOf(o); const to = all[(k + (e.key === "ArrowDown" ? 1 : all.length - 1)) % all.length]; to.click(); return true; }
    return false;
  },
  next() { const n = nextOpen(S.cur); if (n) goF(n); },
  afterDecide(n) { const nx = S.dec[n] ? nextOpen(n) : null; if (nx) S.cur = nx; render(`#frh-${S.cur}`); },
  onKey(e) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && allDecided() && S.phase === "decide" && !APPLY) { e.preventDefault(); S.dialog = "publish"; render(); focusDialog(); return true; }
    if (e.altKey && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); const n = e.key === "ArrowDown" ? nextOpen(S.cur) : prevOpen(S.cur); if (n) goF(n); return true; }
    const h = e.target.closest && e.target.closest(".fr-h, .frb");
    if (!h) return false;
    const n = h.classList.contains("fr-h") ? +h.dataset.fnum : S.cur;
    if (h.classList.contains("fr-h") && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); const to = n + (e.key === "ArrowDown" ? 1 : -1); if (to >= 1 && to <= 3) goF(to); return true; }
    if (e.key === "a" || e.key === "d") { e.preventDefault(); decide(n, e.key === "a" ? "ok" : "no"); V.afterDecide(n); return true; }
    if (e.key === "e" && !e.ctrlKey) { e.preventDefault(); S.edit = n; render(); document.getElementById(`fe-${n}`).focus(); return true; }
    if (e.key === "o") { e.preventDefault(); openLine(n, "gh"); return true; }
    if (e.key.toLowerCase() === "e" && e.ctrlKey) { e.preventDefault(); openLine(n, "ed"); return true; }
    return false;
  },
  initFocus() {
    if (SCN === "findings") { const f = document.getElementById(`frh-${S.cur}`); if (f) f.focus({ preventScroll: true }); }
  },
};
function nextOpen(from) { const o = FIND.filter((f) => !S.dec[f.n]); return (o.find((f) => f.n > from) || o[0] || {}).n; }
function prevOpen(from) { const o = FIND.filter((f) => !S.dec[f.n]).reverse(); return (o.find((f) => f.n < from) || o[0] || {}).n; }
function goF(n) { S.cur = n; render(`#frh-${n}`); }
// A decision in the list: taken before the bubbling listeners of round 10, which know only the card's finding.
window.addEventListener("click", (e) => {
  const d = e.target.closest && e.target.closest(".frb [data-dec]"); if (!d) return;
  e.stopPropagation(); e.preventDefault(); const n = +d.dataset.f; decide(n, d.dataset.dec); V.afterDecide(n);
}, true);
document.addEventListener("click", (e) => {
  const h = e.target.closest(".fr-h"); if (h) { goF(+h.dataset.fnum); return; }
});
