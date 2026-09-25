/* =====================================================================
   A · Every draft open. The drafts card reads as a document: each draft
   with its whole body rendered, the decision under it. A and D decide and
   move to the next one to decide, which scrolls to the top of the view.
   ===================================================================== */
const VA = Object.assign({}, MODEL, { key: "a", expanded: () => true });
V = V || VA;
