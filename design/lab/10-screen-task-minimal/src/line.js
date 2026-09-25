/* =====================================================================
   A · The line. The progress is one thin line under the header: the stages
   as segments (done, current, to come), the steps as ticks inside the
   implementation, and the state glyph riding on the line where the task is.
   The words are one sentence next to the title. One conversation on screen,
   the one whose turn it is; a quiet switch in the composer shows the other.
   This file holds the line and the sentence; a.js holds the variation.
   ===================================================================== */
// The weight of each stage on the line: the implementation holds the steps, so it is longer.
const WEIGHT = (n) => n === "Implementation" ? 3.5 : 1;
function stageState(k) { return k < SC.stage ? "done" : k === SC.stage ? "cur" : "todo"; }
function knob(g = NOW.g) { return `<span class="knob" aria-hidden="true">${st(g)}</span>`; }
function pline(opts = {}) {
  const stage = opts.stage ?? SC.stage, step = opts.step ?? SC.step, g = opts.g ?? NOW.g, stages = opts.stages || STAGES, steps = opts.steps ?? 7;
  const segs = stages.map((n, k) => {
    const s = k < stage ? "done" : k === stage ? "cur" : "todo";
    let inner = "";
    if (n === "Implementation") {
      inner = `<span class="tks">${Array.from({ length: steps }, (_, j) => {
        const t = s !== "cur" ? s : j < step - 1 ? "done" : j === step - 1 ? "now" : "todo";
        return `<i class="tk ${t}">${t === "now" ? knob(g) : ""}</i>`;
      }).join("")}</span>`;
    } else inner = `<span class="bar">${s === "cur" ? knob(g) : ""}</span>`;
    const lab = n === "Implementation" && s === "cur" ? `${n} · ${step}/${steps}` : n;
    return `<span class="sg ${s} ${n === "Implementation" ? "impl" : ""}" data-w="${WEIGHT(n)}">${inner}<span class="lb">${s === "done" ? I("check") : ""}${lab}</span></span>`;
  }).join("");
  const words = stages.map((n, k) => `${n} ${k < stage ? "done" : k === stage ? `now${n === "Implementation" ? `, step ${step} of ${steps}` : ""}` : "to come"}`).join(", ");
  return `<div class="pline ${opts.cls || ""} ${Q.has("legend") && !opts.cls ? "is-open" : ""}" tabindex="0" role="img" aria-label="Progress: ${words}. ${opts.word || NOW.word}.">${segs}</div>`;
}
// Whole pixels: the segments and the ticks get integer widths from the line's width.
function layoutLine(root = document) {
  root.querySelectorAll(".pline").forEach((pl) => {
    const segs = [...pl.querySelectorAll(":scope > .sg")]; if (!segs.length) return;
    const gap = parseFloat(getComputedStyle(pl).columnGap) || 0;
    const W = Math.floor(pl.clientWidth - gap * (segs.length - 1));
    const units = segs.reduce((a, s) => a + +s.dataset.w, 0);
    let used = 0;
    segs.forEach((s, k) => { const w = k === segs.length - 1 ? W - used : Math.floor(W * +s.dataset.w / units); used += w; s.style.width = w + "px"; s.style.flex = "none"; });
    pl.querySelectorAll(".tks").forEach((t) => {
      const ticks = [...t.children], tg = parseFloat(getComputedStyle(t).columnGap) || 0, tw0 = Math.floor(t.parentElement.getBoundingClientRect().width - tg * (ticks.length - 1));
      let u = 0; ticks.forEach((x, k) => { const w = k === ticks.length - 1 ? tw0 - u : Math.floor(tw0 / ticks.length); u += w; x.style.width = w + "px"; x.style.flex = "none"; });
    });
  });
}
// The sentence: the stage, the position inside it, and the state of the place, in words.
function sentence() {
  const stg = STAGES[SC.stage];
  const pos = NOW.pos ? `<span class="ps-pos"><span class="long">${NOW.pos}</span><span class="short">${NOW.posShort}</span></span>` : "";
  return `<p class="ps"><span class="ps-stage">${stg}</span>${pos ? `<span class="dot" aria-hidden="true">·</span>${pos}` : ""}${S.hasBar ? "" : `<span class="dot" aria-hidden="true">·</span><span class="ps-state st-${NOW.g}-t"><span class="long">${NOW.word}</span><span class="short">${NOW.short}</span></span>`}</p>`;
}
