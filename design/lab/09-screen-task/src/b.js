/* =====================================================================
   B · Workflow with conversations
   ?scene=plan|run|ask|error|manual|blocked|checks|findings|close
   ?place=prd|spec|plan|s1i|…|s3r|pr|prr · ?theme · ?panel · ?end · ?audit · ?clean
   ===================================================================== */
const S = { panel: ["Details", "Artifacts", "Card"].includes(Q.get("panel")) ? Q.get("panel") : null, place: Q.get("place") || SC.place, born: false, hideDec: false };

// ---------------- Place content ----------------
function pastStepB(n, who) {
  const d = STEP_DONE[n];
  if (who === "r") return [
    { o: 1, html: HAND("Reviewer", "· pass 1 · the step, the PRD, the tech spec and the implementer's answer", d.at, `<div class="prose"><p>Review step ${n} against its step file, the PRD and the tech spec.</p></div>`) },
    { o: 2, html: ACTS({ n: 38, roll: "Read 22 · Searched 8 · Tests 5 · Lint 2", dur: "5 min", earlier: 34, rows: [["Run the whole suite with the race detector", "go test ./... -race", "done", "46 s"], ["Run the linter", "golangci-lint run ./...", "done", "20 s"]] }) },
    { o: 3, html: REPORT(1, n === 2 || n === 5 || n === 7, 2, d.at, n === 2 || n === 5 || n === 7 ? "Nothing to change." : [["internal/ratelimit/config.go:14", "Validate that burst is at least 1."], ["config/plans.yaml", "Enterprise has no default."]], { step: n }) },
  ];
  return [
    { o: 1, html: EVX("file", `Started with <span class="n">steps/0${n}.md</span>`, d.at, "", `<div class="docbody prose"><h4>Step ${n}: ${STEPS[n - 1][0]}</h4></div>`) },
    { o: 2, html: ACTS({ n: Math.round(d.acts * 0.55), roll: "Read 14 · Wrote 8 · Tests 5 · git 3", dur: "14 min", earlier: 20, rows: [["Run the package tests", "go test ./internal/... -race", "done", "22 s"]] }) },
    { o: 9, html: COMMIT(d.sha, d.sub, d.at) },
  ];
}
function placeEntries(p) {
  if (p === "prd") return sessPRD(SC_KEY);
  if (p === "spec") return sessSpec();
  if (p === "plan") return sessPlan();
  if (p === "pr") return sessPR("");
  if (p === "prr") return SC_KEY === "checks" ? [{ o: 0, html: CHECKS(true) }] : sessPRR(SC_KEY);
  const m = p.match(/^s(\d)([ir])$/); if (!m) return [];
  const n = +m[1];
  if (SC.stage === 3 && n === SC.step) return ({ 3: sessStep3, 4: sessStep4, 5: sessStep5 }[n](SC_KEY)).filter((e) => e.p === p);
  return pastStepB(n, m[2]);
}
const PLACE_NAME = (p) => p === "prd" ? ["", "PRD"] : p === "spec" ? ["", "Tech spec"] : p === "plan" ? ["", "Plan"] : p === "pr" ? ["", "Pull request"] : p === "prr" ? ["Pull request /", "PR review"] : [`Step ${p[1]} · ${STEPS[+p[1] - 1][0]} /`, p[2] === "r" ? "Reviewer" : "Implementer"];
const isCurPlace = (p) => p === SC.place || (SC.stage === 3 && p.startsWith(`s${SC.step}`)) || (SC.stage >= 5 && (p === "prr" || (SC.cur === "pr" && p === "pr")));

// ---------------- The rail ----------------
function rail() {
  const rn = (o) => `<button class="rn ${o.cls || ""} ${S.place === o.p && !o.nosel ? "sel" : ""}" ${o.p ? `data-place="${o.p}"` : "disabled"} ${S.place === o.p ? 'aria-current="true"' : ""} aria-label="${(o.tip || o.lb.replace(/<[^>]+>/g, "")) + (o.l2 ? " · " + o.l2 : "")}" data-tip="${o.tip || o.lb.replace(/<[^>]+>/g, "")}"><span class="c1">${o.g}<span class="num">${o.num || ""}</span></span><span class="lb">${o.lb}</span><span class="r ${o.mono ? "mono" : ""}">${o.r || ""}</span>${o.l2 ? `<span class="l2">${o.l2}</span>` : ""}</button>`;
  const ok = I("check"), todo = st("todo");
  let h = `<div class="rail-h">Workflow<span>Structured · Agent review</span></div><div class="rgrp">`;
  const stg = [["prd", "PRD", "09:14", "4 questions · PRD.md", "Opus · high"], ["spec", "Tech spec", "09:41", "1 question · tech-spec.md", "Opus · high"], ["plan", "Plan", "10:22", "7 steps · 1 correction", "Opus · medium"]];
  stg.forEach(([p, n, t, l2, model], k) => {
    if (SC.stage > k) h += rn({ p, g: ok, lb: n, r: t, l2, cls: "done" });
    else if (SC.stage === k) h += rn({ p, g: st("wait", "Waiting for your reply"), lb: n, r: "now", l2: "3 answered · the agent asks", cls: "cur you" });
    else h += rn({ g: todo, lb: n, r: model, cls: "next" });
  });
  h += `</div>`;
  if (SC.stage === 3 || SC.stage > 3) {
    const segs = `<span class="segs" role="img" aria-label="${SC.doneSteps} of 7 committed">${[1, 2, 3, 4, 5, 6, 7].map((k) => `<i class="${k <= SC.doneSteps ? "d" : k === SC.step ? "c" : ""}"></i>`).join("")}</span>`;
    h += `<div class="rgrp"><div class="rgrp-h ${SC.stage === 3 ? "cur" : ""}">Implementation <span class="n">${SC.stage === 3 ? `${SC.step} of 7` : "7 of 7 done"}</span></div>`;
  } else h += `<div class="rgrp"><div class="rgrp-h">Implementation <span class="n">steps come from the plan</span></div>`;
  if (SC.stage >= 1) for (let n = 1; n <= 7; n++) {
    const d = STEP_DONE[n];
    if (n <= SC.doneSteps) { h += rn({ p: `s${n}i`, g: ok, num: n, lb: `<span class="k">${n}</span>${STEPS[n - 1][0]}`, r: d.sha, mono: true, cls: "done", tip: `Step ${n} · ${STEPS[n - 1][0]} · ${d.sha} · ${d.loop}` }); continue; }
    if (SC.stage === 3 && n === SC.step) {
      const g = SC_KEY === "blocked" || SC_KEY === "error" ? st("error") : SC_KEY === "run" ? st("run") : st("wait");
      const state = { run: "Addressing review · round 1 of 3", ask: "Agent review · pass 2", error: "Agent review · pass 2", manual: "Manual · your review · 71%", blocked: "Blocked · worktree not clean" }[SC_KEY];
      h += rn({ g, num: n, lb: `<span class="k">${n}</span>${STEPS[n - 1][0]}`, l2: state, cls: `cur ${SC_KEY === "blocked" ? "err" : ""}`, p: `s${n}i`, nosel: ["run", "ask", "error", "manual"].includes(SC_KEY) });
      if (SC_KEY === "run" || SC_KEY === "ask" || SC_KEY === "error") {
        const ig = SC_KEY === "run" ? st("run", "working") : SC_KEY === "ask" ? st("wait", "waiting for you") : st("idle", "idle");
        const iw = SC_KEY === "run" ? "round 1 · 4m" : SC_KEY === "ask" ? "Permission" : "waits for the review";
        const rg = SC_KEY === "ask" ? st("wait", "waiting for you") : SC_KEY === "error" ? st("error", "error") : st("idle", "idle");
        const rw = SC_KEY === "ask" ? "pass 2 · Question" : SC_KEY === "error" ? "pass 2 · Session error" : "pass 1 done";
        h += rn({ p: `s${n}i`, g: ig, lb: `Implementer <span class="k">· ${iw}</span>`, cls: `place ${SC_KEY === "ask" ? "you" : ""}`, tip: `Implementer · ${iw}` });
        h += rn({ p: `s${n}r`, g: rg, lb: `Reviewer <span class="k">· ${rw}</span>`, cls: `place ${SC_KEY === "ask" ? "you" : ""} ${SC_KEY === "error" ? "err" : ""}`, tip: `Reviewer · ${rw}${SC_KEY === "ask" ? " · waiting for you for 18 minutes" : ""}` });
        h += `<div class="rart"><button data-panel="Artifacts">${I("file")}Review 1 · changes</button></div>`;
      }
      if (SC_KEY === "manual") h += rn({ p: `s${n}i`, g: st("idle", "idle"), lb: `Implementer <span class="k">· idle</span>`, cls: "place" });
      continue;
    }
    h += rn({ g: todo, num: n, lb: `<span class="k">${n}</span>${STEPS[n - 1][0]}`, r: STEPS[n - 1][1].split(" · ")[0], cls: "next", tip: `Step ${n} · ${STEPS[n - 1][0]} · ${STEPS[n - 1][1]}` });
  }
  h += `</div><div class="rgrp"><div class="rgrp-h ${SC.stage >= 4 ? "cur" : ""}">Pull request ${SC.stage >= 5 ? `<span class="n">#1284</span>` : ""}</div>`;
  if (SC.stage >= 5) {
    h += rn({ p: "pr", g: ok, lb: "Draft and opening", r: "17:18", l2: "draft approved · #1284 opened", cls: "done" });
    const g = SC_KEY === "checks" ? st("gh") : SC_KEY === "findings" ? st("wait") : ok;
    const l2 = SC_KEY === "checks" ? "waiting for checks · 3 of 5" : SC_KEY === "findings" ? "pass 1 · decide 1 of 4" : "pass 2 · clean · merged 18:44";
    h += rn({ p: "prr", g, lb: "PR review", l2, cls: `${SC_KEY === "close" ? "done" : "cur"} ${SC_KEY === "findings" ? "you" : ""}` });
    if (SC_KEY !== "checks") h += `<div class="rart"><button data-panel="Artifacts">${I("file")}Review 1 · changes</button>${SC_KEY === "close" ? `<button data-panel="Artifacts">${I("file")}Review 2 · clean</button>` : ""}</div>`;
    h += rn({ g: SC_KEY === "close" ? st("close") : todo, lb: "Closing", l2: SC_KEY === "close" ? "ready · worktree, branch, dev" : "", cls: SC_KEY === "close" ? "cur you" : "next", p: SC_KEY === "close" ? "prr" : "" });
  } else {
    h += rn({ g: todo, lb: "Draft and opening", r: "Sonnet", cls: "next" }) + rn({ g: todo, lb: "PR review", r: "Opus", cls: "next" }) + rn({ g: todo, lb: "Closing", cls: "next" });
  }
  return `<nav class="wfrail" id="rail" aria-label="Workflow of the task">${h}</div></nav>`;
}

// ---------------- The place on screen ----------------
function placeHead() {
  const p = S.place, [ctx, name] = PLACE_NAME(p);
  const v = p.endsWith("r") ? "rev" : p === "prr" ? "rev" : "impl";
  const av = `<span class="av ${v === "rev" ? "rev" : ""}">${I(v === "rev" ? "review-s" : "bot")}</span>`;
  const cur = isCurPlace(p);
  let state = "", tools = "";
  if (p.match(/^s\d[ir]$/)) {
    const n = p[1];
    state = !cur ? `committed ${STEP_DONE[n].sha}` : { run: p.endsWith("i") ? "round 1 of 3 · working 4m" : "pass 1 done", ask: p.endsWith("r") ? "pass 2 · asks you" : "waits for your permission", error: p.endsWith("r") ? "pass 2 · session error" : "waits for the review", manual: "your review · 71% staged", blocked: "blocked before it started" }[SC_KEY];
    if (cur) tools = SC_KEY === "manual" || SC_KEY === "blocked" ? `<button class="btn ghost xs" aria-label="Open in VS Code" data-tip="Open the worktree in VS Code">${I("vscode")}<span class="lbl-long">Open in VS Code</span></button>${SC_KEY === "manual" ? `<button class="btn ghost xs">Discard step…</button>` : ""}` : `<button class="btn xs" data-tip="Take the review of step ${n} from the agent">Review myself</button><button class="btn ghost xs" aria-label="Open in VS Code" data-tip="Open the worktree in VS Code">${I("vscode")}<span class="lbl-long">Open in VS Code</span></button><button class="btn ghost xs">Discard step…</button>`;
  } else if (p === "prr" || p === "pr") {
    state = p === "pr" ? "#1284 opened 17:32" : { checks: "waiting for checks · checked 40s ago", findings: "pass 1 · 4 findings", close: "pass 2 · clean · merged" }[SC_KEY];
    tools = `<button class="btn ghost xs" data-tip="Read the pull request now">Refresh PR</button>${p === "prr" && SC_KEY !== "checks" ? `<button class="btn ghost xs" data-tip="Ask for another pass now">Review again</button>` : ""}<button class="btn ghost xs" aria-label="Open PR" data-tip="Open #1284 on GitHub">${I("external")}<span class="lbl-long">Open PR</span></button>`;
  } else {
    state = SC.stage === 0 && p === "prd" ? "3 answered · the agent asks" : "done · the conversation is closed";
    if (SC.stage === 0) tools = `<button class="btn ghost xs">Discard and restart…</button>`;
  }
  return `<div class="place-h">${ctx ? `<span class="ctxt trunc">${ctx}</span>` : ""}${av}<b>${name}</b><span class="state">· ${state}</span><span class="tools">${tools}</span></div>`;
}
function stream(p) {
  const es = placeEntries(p).sort((a, b) => a.o - b.o);
  if (SC_KEY === "checks" && p === "prr") return es.map((e) => e.html).join("") + `<div class="empty-place"><b>The review conversation starts when the checks finish.</b>MySpec reads the pull request every minute; the first pass begins once e2e and preview-deploy are done.</div>`;
  return es.map((e) => e.dec ? "" : e.html).join("");
}
function askB() {
  const p = S.place;
  if (SC_KEY === "ask") {
    const rev = { label: "Question", place: "Reviewer", s: { sev: "wait", since: "18m", long: "18 minutes" } }, imp = { label: "Permission", place: "Implementer", s: { sev: "wait", since: "4m", long: "4 minutes" } };
    const [here, other, oc] = p === "s3i" ? [imp, rev, "s3r"] : [rev, imp, "s3i"];
    const card = p === "s3i" ? "askcard2" : "askcard";
    if (p !== "s3i" && p !== "s3r") return `<div class="ask-in quiet" role="region" aria-label="What this item asks"><span class="req what">${st("wait")}<span class="lbl">Step 3 waits for you</span><span class="muted">· 2 requests</span>${tw(rev.s)}</span><span class="acts-r"><button class="btn sm" data-place="s3r">Go to step 3</button></span></div>`;
    return `<div class="ask-in quiet" role="region" aria-label="What this item asks"><span class="sr" role="status">${here.label} from the ${here.place}</span>
      <span class="req what">${st("wait")}<span class="lbl">${here.label}</span><span class="muted">· ${here.place}</span>${tw(here.s)}<button class="btn sm" data-show="${card}">${I("up")}Show</button></span>
      <span class="req what">${st("wait")}<span class="muted">The ${other.place.toLowerCase()} also waits · ${other.label}</span>${tw(other.s)}<button class="btn sm" data-place="${oc}">Go to ${other.place.toLowerCase()}</button></span></div>`;
  }
  if (!SC.ask) return "";
  let a = SC.ask;
  if (SC_KEY === "findings") a = { ...a, actions: `<button class="btn sm" aria-pressed="${!S.hideDec}" data-hidedec data-tip="Show or hide the findings column">${S.hideDec ? "Show findings" : "Hide findings"}</button>` + a.actions };
  if (SC_KEY === "error" && p === "s3i") a = { kind: "other", label: "Session error", place: "in Reviewer · pass 2", s: a.s, detail: "This conversation waits for the review", actions: `<button class="btn sm" data-place="s3r">Go to reviewer</button>` };
  if (a.kind === "other") return ASK({ ...a, kind: "quiet" }).replace("st-wait", "st-error");
  return ASK(a);
}
function composerB() {
  const p = S.place;
  if (!isCurPlace(p)) return COMPOSER({ disabled: true, ph: `This conversation is closed: ${PLACE_NAME(p)[1].toLowerCase()} ${p.match(/^s\d/) ? `of step ${p[1]} is committed` : "is done"}.`, why: "Read only" });
  if (SC_KEY === "ask" || SC_KEY === "error" || SC_KEY === "run") {
    const rev = p.endsWith("r");
    if (SC_KEY === "run" && !rev) return COMPOSER({ ph: "Queue a message for the implementer…", model: "Sonnet · high", working: "Implementer working · 3m 40s", label: "Message to the implementer" });
    return COMPOSER({ ph: rev ? (SC_KEY === "error" ? "Sending restarts the reviewer's session…" : "Answer with 1–3, or reply to the reviewer…") : "Reply to the implementer…", model: rev ? "Opus · high" : "Sonnet · high", label: rev ? "Reply to the reviewer" : "Reply to the implementer" });
  }
  const c = SC.comp;
  const base = COMPOSER({ ...c, to: null });
  const quick = c.quick ? `<div class="qr" role="group" aria-label="Quick replies">Reply with ${c.quick.map(([k, t]) => `<button class="chip" data-tip="Sends “${k}”"><span class="kn">${k}</span>${t}</button>`).join("")}<span>or write below</span></div>` : "";
  return quick ? base.replace('<div class="cbox">', `<div class="cbox">${quick}`) : base;
}
function decol() {
  if (SC_KEY !== "findings" || S.place !== "prr" || S.hideDec) return "";
  const f = FINDCARD(true);
  return `<aside class="decol" id="decol" aria-label="Findings to decide"><div class="decol-h">${st("wait")}<b>Findings</b><span class="muted">· pass 1</span><span class="n">1 of 4 decided</span></div><div class="decol-b">${f.sum}<div class="fnds">${f.items}</div><div class="foot why" style="white-space:normal">A approves, D discards · Alt+↓ next to decide</div></div></aside>`;
}
function header() {
  const i = ITEMS.t1;
  const dots = `<span class="sdots" aria-hidden="true">${STAGES.map((n, k) => `<i class="${k < SC.stage ? "d" : k === SC.stage ? "c" : ""}"></i>`).join("")}</span>`;
  return `<header class="ih1" id="ih">${NAVBTNS}${crumbs()}<h1 class="ih-title">${ty(i)}<span class="trunc">${i.name}</span></h1><span class="ih-ref">acme/api#412</span>
    <button class="pos" aria-label="${STAGES[SC.stage]}, ${SC.pos}" data-tip="The rail is narrow: ${STAGES[SC.stage]} · ${SC.pos}">${dots}<span class="stn">${STAGES[SC.stage]}</span><span class="pp">${SC.pos}</span></button>
    <span class="grow"></span>${tools({ ctx: SC.ctx })}</header>`;
}
function jump() {
  if (!SC.scrolled || Q.has("end") || S.place !== "s3i") return "";
  return `<div class="jump"><button type="button" id="jump-btn" data-tip="Go to the end · End">${I("arrow-down")}<span class="nm">New messages</span><span class="live">· ${st("run")}<span class="mono">go test ./internal/ratelimit/... -race</span></span></button></div>`;
}
function main() {
  const panel = S.panel ? PANEL(S.panel, { now: SC.now, doneSteps: SC.doneSteps }) : "";
  const a = askB();
  return `<main class="main" id="main">${header()}<div class="body" id="body">${rail()}<div class="colconvo">
    <div class="convo-wrap"><div class="convo" id="convo" tabindex="-1" aria-label="${PLACE_NAME(S.place)[1]} conversation"><div class="convo-in enter">${placeHead()}${stream(S.place)}</div></div>
    ${jump()}</div>${a ? `<div class="ask">${a}</div>` : ""}<div class="composer"><div class="composer-in">${composerB()}</div></div></div>${decol()}${panel}</div></main>`;
}
// The rail folds to glyphs when the conversation would drop under 680 px; the panel covers when the reading column would drop under 760.
function layoutRules() {
  const m = document.getElementById("main"); if (!m) return;
  const w = m.getBoundingClientRect().width, dec = document.getElementById("decol") ? (w < 900 ? 280 : Math.min(420, Math.max(300, Math.floor(w * 0.24)))) : 0;
  const rail = document.getElementById("rail"); const railFull = Math.min(320, Math.max(256, Math.floor(w * 0.14))); const railC = 48;
  const compact = w - railFull - dec < 680;
  rail.classList.toggle("compact", compact); document.getElementById("ih").classList.toggle("railc", compact);
  const p = document.getElementById("panel");
  if (p) { const pw = Math.min(480, Math.max(360, Math.round(w * 0.28))); p.classList.toggle("over", w - (compact ? railC : railFull) - dec - pw < 760); }
}
function render() {
  document.getElementById("app").innerHTML = sidebar() + main() + mockbar(SCENE_KEYS, SC_KEY);
  layoutRules(); fitHeader();
  const cv = document.getElementById("convo");
  cv.scrollTop = SC.scrolled && !Q.has("end") && S.place === "s3i" ? cv.scrollHeight - cv.clientHeight - 560 : cv.scrollHeight;
  document.getElementById("tree").addEventListener("scroll", moreBelow);
  requestAnimationFrame(() => { fitHeader(); moreBelow(); markTruncated(); });
}
document.addEventListener("DOMContentLoaded", () => {
  document.body.insertAdjacentHTML("beforeend", `<div id="app" class="app"></div><div class="toasts" role="status" aria-live="polite" aria-label="Notifications"></div><pre id="report" class="report" hidden></pre>`);
  bootCommon(render);
  document.addEventListener("click", (e) => {
    const pl = e.target.closest("[data-place]"); if (pl) { S.place = pl.dataset.place; render(); const b = document.querySelector(`.rn[data-place="${S.place}"].sel`); if (b) b.focus(); return; }
    if (e.target.closest("[data-hidedec]")) { S.hideDec = !S.hideDec; render(); return; }
    if (e.target.closest("#jump-btn")) { const cv = document.getElementById("convo"); cv.scrollTop = cv.scrollHeight; e.target.closest(".jump").remove(); }
  });
  // The rail is one Tab stop; ↑↓ move between places, Enter opens.
  document.addEventListener("keydown", (e) => {
    const r = e.target.closest && e.target.closest(".wfrail"); if (!r || (e.key !== "ArrowDown" && e.key !== "ArrowUp")) return;
    const bs = [...r.querySelectorAll(".rn:not([disabled])")], k = bs.indexOf(e.target.closest(".rn"));
    const t = bs[Math.max(0, Math.min(bs.length - 1, k + (e.key === "ArrowDown" ? 1 : -1)))]; if (t) { e.preventDefault(); t.focus(); }
  });
  addEventListener("resize", () => { layoutRules(); fitHeader(); });
  render();
  if (document.fonts) document.fonts.ready.then(() => { fitHeader(); markTruncated(); });
  if (Q.has("audit")) setTimeout(audit, 1200);
});
