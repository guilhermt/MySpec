/* =====================================================================
   B · The stepper: the variation. The stepper is in stepper.js.
   ===================================================================== */
const V = {
  headCls: "has-stepper",
  center: () => stepper(),
  tabs: true, swap: false, pointOther: false,
  // The top gives way by width alone: see the container queries at the end of b.css.
};
