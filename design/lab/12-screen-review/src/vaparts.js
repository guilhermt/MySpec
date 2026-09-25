/* A · the finding in the card and the decision bar: the pieces a.html and the specimen share. */
function fndA(f) {
  const d = S.dec[f.n], cur = S.cur === f.n;
  const word = d === "ok" ? "approved" : d === "no" ? "discarded" : "not decided";
  return `<div class="fnd ${d === "ok" ? "ok" : d === "no" ? "no-go" : ""} ${cur ? "cur" : ""}" id="fnd-${f.n}" data-fnum="${f.n}" tabindex="${cur ? 0 : -1}" role="group" aria-label="Finding ${f.n} of ${FIND.length}: ${f.title}. ${word}">
    <span class="no">${f.n}</span><div class="fb"><div class="fh"><span class="fti">${f.title}</span></div>${locLink(f)}${findingText(f)}${decButtons(f)}</div></div>`;
}
function VA_BAR() {
  const next = `<button class="btn sm" data-act="next" data-tip="The next finding to decide · Alt+↓">${I("arrow-down")}Next to decide <span class="k">Alt ↓</span></button>`;
  if (!allDecided()) return ASK({ kind: "tinted", label: "Decide findings", place: "pass 1", s: { sev: "wait", since: "34m", long: "34 minutes" }, detail: `${decided()} of ${FIND.length} decided`,
    actions: `${next}<span class="why" id="why-pub">Decide ${FIND.length - decided()} more</span><button class="btn sm primary" disabled aria-describedby="why-pub">Publish review</button>` });
  const a = approved().length;
  const pub = S.publishing ? `<button class="btn sm primary is-loading" aria-busy="true"><span class="spin"></span>Publishing…</button>`
    : `<button class="btn sm primary" data-act="publish" data-tip="Choose the verdict and publish · Ctrl+Enter">Publish review… <span class="k">Ctrl ↵</span></button>`;
  return ASK({ kind: "tinted", label: "Ready to publish", place: "pass 1", s: { sev: "wait", since: "41m", long: "41 minutes" }, detail: FIND.length ? `${a} approved · ${FIND.length - a} discarded` : "A clean pass", actions: pub });
}
