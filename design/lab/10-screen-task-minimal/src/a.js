/* =====================================================================
   A · The line: the variation. The line and the sentence are in line.js.
   ===================================================================== */
const V = {
  headCls: "has-line",
  center: sentence,
  below: () => pline(),
  tabs: false, swap: true, pointOther: true,
  layout: () => layoutLine(),
};
addEventListener("resize", () => layoutLine());
// A click pins the names under the line; a second click or Esc lets them go.
document.addEventListener("click", (e) => { const pl = e.target.closest(".mh .pline"); if (pl) pl.classList.toggle("is-open"); });
document.addEventListener("keydown", (e) => { const pl = e.target.closest && e.target.closest(".mh .pline"); if (pl && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); pl.classList.toggle("is-open"); } });
