/* =====================================================================
   ROUND 14 · render, the scene switcher, the keys and the audit.
   ===================================================================== */
function mainOf() {
  if (SCN.startsWith("settings")) return settingsScene();
  if (SCN === "history") return historyMain();
  if (SCN === "archived-task") return archivedTask();
  if (SCN === "archived-review") return archivedReview();
  if (SCN === "archived-discussion") return archivedDiscussion();
  if (SCN === "starting") return startingMain();
  if (SCN === "welcome") return welcomeMain();
  if (SCN === "notice") return noticeMain();
  if (SCN === "gone") return goneMain();
  if (SCN === "delete-task") return taskMain({ over: deleteTaskDialog() });
  if (SCN === "discard-step") return taskMain({ over: discardStepDialog() });
  if (SCN === "back-to-stage") return taskMain({ over: backDialog(), pr: VAR === "pr", word: VAR === "pr" ? "The PR reviewer is working" : undefined });
  if (SCN === "pause") return pauseMain();
  if (SCN === "notifications") return notificationsMain();
  return "";
}
function sideOf() {
  if (SCN === "starting") return sidebarSkeleton();
  if (SCN === "welcome") return sidebarBare();
  if (SCN.startsWith("settings")) return sidebar14("settings");
  if (SCN === "history" || SCN.startsWith("archived")) return sidebar14("history");
  return sidebar14("");
}
function mockbar14() {
  const sc = `<select id="scene-sel" aria-label="Scene">${SCENES.map(([k, n]) => `<option value="${k}" ${k === SCN ? "selected" : ""}>${n}</option>`).join("")}</select>`;
  const vs = VARS.length > 1 ? `<select id="var-sel" aria-label="Variation of the scene">${VARS.map(([k, n]) => `<option value="${k}" ${k === VAR ? "selected" : ""}>${n}</option>`).join("")}</select>` : "";
  return `<div class="mockbar" aria-label="Mock scenes"><span>Scene</span>${sc}${vs}</div>`;
}
function render() {
  OPENID = ["delete-task", "discard-step", "back-to-stage", "pause", "notice"].includes(SCN) ? "t1" : null;
  if (SCN === "pause") Object.assign(ITEMS.t1, VAR === "blocked" ? { run: null, sits: [{ sev: "error", label: "Session error", place: "Reviewer · Step 3/7", since: "2m", long: "2 minutes", min: 2 }], row: ["Session error · Reviewer · Step 3/7", "Session error · Step 3/7"] } : VAR === "pausing" ? {} : { run: null, paused: true, pos: "Paused · Step 3/7" });
  if (SCN === "pause" && VAR === "blocked") delete ITEMS.t1.run;
  if (SCN === "pause" && VAR === "") delete ITEMS.t1.run;
  if (SCN === "back-to-stage" && VAR === "pr") Object.assign(ITEMS.t1, { pos: "PR review · pass 1", posShort: "PR review · pass 1", run: Object.assign({}, ITEMS.t1.run, { who: "PR reviewer" }) });
  const app = SCN === "migration" ? migrationMain() : `<div id="app" class="app">${sideOf()}${mainOf()}</div>`;
  document.getElementById("root").innerHTML = app + mockbar14();
  document.querySelector(".toasts").innerHTML = toasts();
  const tree = document.getElementById("tree"); if (tree) tree.addEventListener("scroll", moreBelow);
  markTruncated(); moreBelow();
  requestAnimationFrame(() => { markTruncated(); moreBelow(); });
}
function fitHeader() {}
// A creation dialog starts on its first field; a confirmation starts on Cancel.
function focusFirst() {
  const wide = document.querySelector(".dlg.wide");
  const field = wide && wide.querySelector(".dlg-bd input:not([disabled]):not([type=hidden]), .dlg-bd textarea, .dlg-bd .lr-l input");
  const f = field || document.querySelector('.dlg [data-act="dlg-close"]:not(.x)') || document.getElementById("gone-next")
    || (SCN === "history" && VAR !== "fresh" ? document.getElementById("h-q") : document.querySelector(".hrow[tabindex='0']")) || document.querySelector(".bt .btn.primary") || document.getElementById("w-board");
  if (f) f.focus({ preventScroll: true });
}
document.addEventListener("change", (e) => {
  if (e.target.id === "var-sel") { const u = new URLSearchParams(location.search); u.set("scene", SCN); if (e.target.value) u.set("v", e.target.value); else u.delete("v"); location.search = u.toString(); }
  if (e.target.id === "scene-sel") { const u = new URLSearchParams(location.search); u.set("scene", e.target.value); u.delete("v"); location.search = u.toString(); e.stopImmediatePropagation(); }
}, true);
document.addEventListener("click", (e) => {
  if (e.target.closest("#theme-btn")) {
    const MODES = ["system", "light", "dark"]; MODE = MODES[(MODES.indexOf(MODE) + 1) % 3];
    if (MODE === "system") document.documentElement.removeAttribute("data-theme"); else document.documentElement.dataset.theme = MODE;
    render(); document.getElementById("theme-btn").focus(); return;
  }
  const go = e.target.closest("[data-go]");
  if (go && !go.disabled) { const u = new URLSearchParams(location.search); u.set("scene", go.dataset.go); u.delete("v"); location.search = u.toString(); return; }
  const a = e.target.closest("[data-act]"); if (!a) return;
  const nav = (scene, v) => { const u = new URLSearchParams(location.search); u.set("scene", scene); if (v) u.set("v", v); else u.delete("v"); location.search = u.toString(); };
  const act = a.dataset.act;
  if (act === "dlg-close") { e.preventDefault(); if (SCN.startsWith("settings")) nav(SCN, SCN === "settings-prompts" && VAR === "discard" ? "edit" : SCN === "settings-prompts" && VAR === "reset" ? "view" : ""); else nav(SCN, ""); return; }
  if (act === "dlg-back") { if (BACK_OF[VAR]) nav(SCN, BACK_OF[VAR]); return; }
  const map = { "add-board": ["settings-boards", "add-1"], "edit-board": ["settings-boards", "edit-1"], "remove-board": ["settings-boards", "remove"], "add-repo": ["settings-repos", "add"],
    "change-path": ["settings-repos", "change-path"], "edit-prompt": ["settings-prompts", "edit"], "reset-prompt": ["settings-prompts", "reset"], "discard-prompt": ["settings-prompts", "discard"] };
  if (map[act]) { e.preventDefault(); nav(...map[act]); return; }
  if (act === "dlg-go" && SCN === "settings-boards" && NEXT_OF[VAR]) { nav(SCN, NEXT_OF[VAR]); return; }
  if (act === "dlg-go" && SCN === "settings-boards") { nav(SCN, ""); return; }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (document.querySelector(".dlg")) { const c = document.querySelector('.dlg [data-act="dlg-close"]'); if (c && !c.disabled) c.click(); return; }
  }
  if (document.querySelector(".dlg") && e.key === "Tab") {
    const f = [...document.querySelectorAll(".dlg button:not(:disabled), .dlg input:not(:disabled), .dlg textarea, .dlg a[href], .dlg summary")].filter((x) => x.offsetParent);
    const k = f.indexOf(document.activeElement);
    if (e.shiftKey && k <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && k === f.length - 1) { e.preventDefault(); f[0].focus(); }
    return;
  }
  // History: ↑ ↓ between rows, Enter opens, / to the search.
  if (e.key === "/" && SCN === "history" && !e.target.closest("input, textarea")) { e.preventDefault(); document.getElementById("h-q").focus(); return; }
  const row = e.target.closest && e.target.closest(".hrow");
  if (row && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
    e.preventDefault(); const all = [...document.querySelectorAll(".hrow")]; const k = all.indexOf(row); const to = all[k + (e.key === "ArrowDown" ? 1 : -1)];
    if (to) { row.tabIndex = -1; to.tabIndex = 0; to.focus(); to.scrollIntoView({ block: "nearest" }); } return;
  }
  // Settings navigation: ↑ ↓ between pages.
  const sn = e.target.closest && e.target.closest(".sni");
  if (sn && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); const all = [...document.querySelectorAll(".sni")]; const k = all.indexOf(sn); const to = all[(k + (e.key === "ArrowDown" ? 1 : all.length - 1)) % all.length]; to.focus(); }
});

// ---------------- ?audit: round 10's, with this round's geometry and cut text ----------------
function audit14() {
  audit();
  const pre = document.getElementById("report"), out = JSON.parse(pre.textContent);
  const frac = (v) => Math.abs(v - Math.round(v)) > 0.01; const bad = []; let n = 0;
  [".set", ".snav", ".spage", ".srow", ".mrow", ".cr", ".dlg", ".left", ".lst-in", ".ain", ".cres", ".tcard", ".mig-in", ".home", ".appnotice", ".ntbl"].forEach((sel) => document.querySelectorAll(sel).forEach((el) => {
    const r = el.getBoundingClientRect(); if (!r.width && !r.height) return; n++;
    const f = ["left", "top", "width", "height"].filter((k) => frac(r[k])); if (f.length) bad.push(`${sel} ${f.map((k) => `${k}=${r[k].toFixed(2)}`).join(" ")}`);
  }));
  const cut = [...document.querySelectorAll(".cr .tl, .cr .col .t, .sn, .s2, .ll, .ih-title .trunc, .rc")].filter((el) => el.offsetParent && el.scrollWidth > el.clientWidth + 0.5 && !el.dataset.tip && !el.closest("[data-tip]")).map((el) => el.textContent.trim().slice(0, 50));
  // Overlap between siblings of a row: a column that runs into the next.
  const over = [];
  document.querySelectorAll(".srow, .cr, .mrow, .lrow .lr-l").forEach((row) => {
    const kids = [...row.children].filter((k) => k.offsetParent && k.getBoundingClientRect().width > 0 && getComputedStyle(k).position !== "absolute");
    for (let a = 0; a < kids.length; a++) for (let b = a + 1; b < kids.length; b++) { const x = kids[a].getBoundingClientRect(), y = kids[b].getBoundingClientRect(); if (x.right > y.left + 0.5 && y.right > x.left + 0.5 && x.bottom > y.top + 0.5 && y.bottom > x.top + 0.5) over.push(`${row.className.split(" ")[0]}: ${kids[a].className} × ${kids[b].className}`); }
  });
  // A row of History that lost its meta (where and the result) is a defect the geometry can't see.
  const metaHidden = [...document.querySelectorAll(".hrow .meta")].filter((m) => m.closest(".hrow").offsetParent && getComputedStyle(m).display === "none").length;
  Object.assign(out, { historyMetaHidden: metaHidden, scene: SCN, variation: VAR, roundGeometryChecked: n, roundGeometryFractional: bad.slice(0, 12), roundCutWithoutTooltip: cut.slice(0, 12), rowOverlap: [...new Set(over)].slice(0, 12) });
  pre.textContent = JSON.stringify(out, null, 1);
}
const _mt = markTruncated;
markTruncated = function (root) {
  _mt(root);
  document.querySelectorAll(".cr .tl, .cr .col .t, .sn, .s2, .ll, .rc, .ntb").forEach((el) => { if (el.scrollWidth > el.clientWidth + 0.5) el.dataset.tip = el.textContent.trim(); else if (el.dataset.tip && el.dataset.auto) delete el.dataset.tip; });
};
function boot14() {
  if (window.SPECIMEN) return;
  document.body.insertAdjacentHTML("afterbegin", SPRITE + SPRITE_14);
  document.body.insertAdjacentHTML("beforeend", `<div id="root"></div><div class="toasts" role="status" aria-live="polite" aria-label="Notifications"></div><pre id="report" class="report" hidden></pre>`);
  if (Q.has("clean")) document.body.classList.add("noshots");
  addEventListener("resize", () => { markTruncated(); moreBelow(); });
  render(); focusFirst();
  if (document.fonts) document.fonts.ready.then(() => { markTruncated(); moreBelow(); });
  if (Q.has("audit")) setTimeout(audit14, 1400);
}
document.addEventListener("DOMContentLoaded", boot14);
