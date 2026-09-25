/* =====================================================================
   B · One draft at a time. The drafts card is a list: each draft folds to
   its kind, title, fields and state; the current one opens in place with
   its whole body and the decision. A and D decide and open the next one to
   decide; Enter, a click or ↑ ↓ open another.
   ===================================================================== */
const VB = Object.assign({}, MODEL, { key: "b", expanded: (d) => S.cur === d.n });
V = V || VB;
