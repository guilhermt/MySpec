/* B · the row of the findings list and the publication dialog: the pieces b.html and the specimen share. */
const VERDICTS_B = [["Request changes", "The author addresses the findings before the merge."], ["Approve", "It can be merged as it is."], ["Comment", "Feedback without a verdict."]];
function mark(d) { return d === "ok" ? `<span class="dm ok" aria-hidden="true">${I("check")}</span>` : d === "no" ? `<span class="dm no" aria-hidden="true">${I("x")}</span>` : `<span class="dm" aria-hidden="true">${st("todo")}</span>`; }
function frow(f) {
  const d = S.dec[f.n], open = S.cur === f.n;
  const word = d === "ok" ? "approved" : d === "no" ? "discarded" : "not decided";
  return `<div class="fr ${d === "ok" ? "ok" : d === "no" ? "no-go" : ""} ${open ? "cur" : ""}" role="listitem">
    <button class="fr-h" id="frh-${f.n}" data-fnum="${f.n}" tabindex="${open ? 0 : -1}" aria-expanded="${open}" aria-controls="frb-${f.n}" aria-label="Finding ${f.n} of ${FIND.length}: ${f.title}. ${f.loc || "general"}. ${word}"><span class="no">${f.n}</span>${mark(d)}<span class="tx"><span class="ftt">${f.title}</span><span class="lc">${f.loc ? f.short : "General"}</span></span></button>
    ${open ? `<div class="frb" id="frb-${f.n}" role="group" aria-label="Finding ${f.n}">${locLink(f, true)}${findingText(f)}${decButtons(f)}</div>` : ""}</div>`;
}
// The verdict is chosen, never suggested. When GitHub takes one verdict only, that one is marked and the others are off.
function publishDialogB() {
  const ok = VLIST.filter(allowed), forced = ok.length === 1 ? ok[0] : null, v = forced || (S.verdict && allowed(S.verdict) ? S.verdict : null);
  const opts = VERDICTS_B.map(([x, d], k) => { const off = !allowed(x); return `<button class="opt" role="radio" aria-checked="${x === v}" tabindex="${x === v || (!v && k === 0) ? 0 : -1}" data-verdictb="${x}" ${off ? 'disabled aria-describedby="vd-why"' : ""}><span class="kn">${k + 1}</span><span class="ot"><span class="otl">${x}${!forced && x === suggested() ? `<span class="sug" data-tip="Suggested by your decisions: ${FIND.length ? (approved().length ? `${plural(approved().length, "finding")} approved` : "nothing approved") : "a clean pass"}">Suggested</span>` : ""}</span><small>${d}</small></span></button>`; }).join("");
  const why = S.own ? (ok.length ? "Your own pull request: GitHub takes only Comment." : "Your own pull request takes only Comment, and a comment needs the summary or an approved finding.")
    : forced ? "Without a summary and an approved finding, GitHub takes only Approve." : "";
  const disc = FIND.length - approved().length;
  const sumPrev = S.sum.length > 150 ? S.sum.slice(0, 150).replace(/\s+\S*$/, "") + "…" : S.sum;
  const sum = !S.sumOn ? `<span class="help">The review carries ${FIND.length ? "the verdict and the comments" : "the verdict"} only.</span>`
    : S.sumEdit ? `<textarea class="textarea" id="sum" rows="5" aria-label="Summary">${esc(S.sum)}</textarea>`
    : `<div class="sump"><span>${esc(sumPrev)}</span><button class="btn ghost xs" data-act="sum-edit">Edit</button></div>`;
  const pubBtn = S.publishing ? `<button class="btn primary is-loading" aria-busy="true"><span class="spin"></span>Publishing…</button>`
    : `<button class="btn primary" data-act="publish" ${v ? "" : 'disabled aria-describedby="why-pub2"'}>Publish${v ? ` · ${v}` : ""} <span class="k">Ctrl ↵</span></button>`;
  return `<div class="scrim" id="scrim"><div class="dlg pubd" role="dialog" aria-modal="true" aria-labelledby="dlg-t">
    <div class="dlg-hd"><h2 id="dlg-t">Publish the review of web#2291</h2><button class="btn ghost sm icon x" data-act="dlg-close" aria-label="Close" data-tip="Close · Esc">${I("x")}</button></div>
    <div class="dlg-bd">${staleNote()}<div class="fld"><span class="lb" id="vd-l">Verdict</span><div class="opts" role="radiogroup" aria-labelledby="vd-l">${opts}</div>${why ? `<span class="help" id="vd-why">${why}</span>` : ""}</div>
      <div class="ctxrow"><span class="w"><b>${FIND.length ? goesLine() : `A clean pass · ${goesLine().toLowerCase()}`}</b>${disc ? ` · ${plural(disc, "finding")} discarded, not published` : ""}</span></div>
      <div class="fld"><label class="cbl" for="sum-on"><input type="checkbox" class="sr" id="sum-on" ${S.sumOn ? "checked" : ""}><span class="cb ${S.sumOn ? "on" : ""}" aria-hidden="true">${I("check")}</span>Include the summary</label>${sum}</div></div>
    <div class="dlg-ft"><span class="why" id="why-pub2">${v ? "" : ok.length ? "Choose a verdict" : "Nothing GitHub takes yet"}</span><button class="btn ghost" data-act="dlg-close" ${S.publishing ? "disabled" : ""}>Cancel</button>${pubBtn}</div></div></div>`;
}
document.addEventListener("click", (e) => {
  const v = e.target.closest("[data-verdictb]"); if (!v || v.disabled || window.SPECIMEN) return;
  S.verdict = v.dataset.verdictb; S.touched = true; render(`[data-verdictb="${S.verdict}"]`);
});
