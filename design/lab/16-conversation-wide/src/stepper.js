/* =====================================================================
   B · The stepper. The progress is a compact stepper in the header: the
   stages as points with their names, the current one opened into a pill
   with the position (3/7) and the state of the place. No full track, no
   times. The two agents are two small tabs above the conversation, only
   while the step has both.
   ===================================================================== */
function stepper(opts = {}) {
  const stage = opts.stage ?? SC.stage, stages = opts.stages || STAGES, g = opts.g ?? NOW.g;
  const bar = opts.bar ?? (typeof S !== "undefined" && S.hasBar); opts.bar = bar;
  const pos = opts.pos ?? NOW.posShort, word = opts.short ?? NOW.short, long = opts.word ?? NOW.word;
  const items = stages.map((n, k) => {
    const s = k < stage ? "done" : k === stage ? "cur" : "todo";
    if (s === "cur") return `<li class="sp cur" aria-current="step"><span class="pill"><span class="lb-c">${n}</span>${pos ? `<span class="pos">${pos.replace(/ · (.*)$/, `<span class="lp"> · $1</span>`)}</span>` : ""}<span class="stw st-${g}-t">${st(g, opts.bar ? long : "")}${opts.bar ? "" : `<span class="long">${word}</span>`}</span></span></li>`;
    const mark = s === "done" ? `<span class="mk">${I("check")}</span>` : `<span class="mk">${st("todo")}</span>`;
    return `<li class="sp ${s}" data-tip="${n} · ${s === "done" ? "done" : "to come"}">${mark}<span class="lb">${n}<span class="sr"> · ${s === "done" ? "done" : "to come"}</span></span></li>`;
  });
  const tip = stages.map((n, k) => `${k < stage ? "✓" : k === stage ? "●" : "○"} ${n}`).join("  ");
  return `<ol class="stepper ${opts.cls || ""}" tabindex="0" data-tip="${tip}" aria-label="Progress · ${stages[stage]}${pos ? ` ${pos}` : ""} · ${long}">${items.join(`<li class="cn" aria-hidden="true"></li>`)}</ol>`;
}
