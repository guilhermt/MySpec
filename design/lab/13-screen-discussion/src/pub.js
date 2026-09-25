/* =====================================================================
   The model of both variations. The user's answer (2026-09-24): approving
   a draft publishes it at once, as today; what depends on something waits
   until that is created. The epic keeps the rule of features.md: it is
   published when it is approved and every card of it is decided, with at
   least two approved; its cards wait for it. So a gesture can publish a
   chain, and the draft says, before the gesture, exactly what it publishes.
   There is no Publish epic and no confirmation. A card of a discarded epic
   doesn't publish and says so; it doesn't hold the archive. The
   publication is one marker per round, with the state of each draft.
   ===================================================================== */
const LOOP_MS = 900;
let RUNNING = false;
const TIMES = { 5: "14:29", 8: "14:30", 1: "15:10", 2: "15:10", 3: "15:11", 4: "15:12" };
const epicOff = (d, dec = S.dec) => d.epic && dec[d.epic] === "no";
const blocked = (d) => d.repo === "status-page";
// What a draft waits for before it can go to GitHub, given the decisions and what is published; "" when it can go.
function waitsFor(d, dec = S.dec, pub = S.pub) {
  if (blocked(d)) return "a repository of the board";
  if (d.kind === "epic") {
    const open = d.kids.filter((k) => !dec[k]);
    if (open.length) return `${plural(open.length, "more card")} of the epic to be decided`;
    return kidsOk(d, dec) >= 2 ? "" : "two approved cards";
  }
  if (epicOff(d, dec)) return "the epic, which is discarded";
  if (d.epic && pub[d.epic] !== "done") return "the epic";
  const dep = (d.deps || []).find((k) => D[k] && dec[k] !== "no" && pub[k] !== "done");
  return dep ? D[dep].title : "";
}
// What a gesture would publish now, in order: the chain that approving or discarding a draft sets off.
function chainOf(n, d) {
  const dec = { ...S.dec, [n]: d }, pub = { ...S.pub }, out = [];
  if (Object.values(pub).includes("run")) return [];
  for (;;) {
    const k = ORDER.find((x) => dec[x] === "ok" && !pub[x] && !waitsFor(D[x], dec, pub));
    if (!k) return out;
    pub[k] = "done"; out.push(k);
  }
}
const stuck = () => DRAFTS.some((e) => e.kind === "epic" && S.dec[e.n] === "ok" && S.pub[e.n] !== "done" && !kidsOpen(e) && kidsOk(e) < 2);
const offKids = () => DRAFTS.filter((d) => epicOff(d) && S.dec[d.n] === "ok");
const failedAny = () => DRAFTS.some((d) => S.pub[d.n] === "fail");
// Publish what can go, one at a time, in the order of the dependencies.
function settle() {
  if (RUNNING || failedAny()) return;
  const n = ORDER.find((k) => S.dec[k] === "ok" && !S.pub[k] && !waitsFor(D[k]));
  if (!n) return;
  RUNNING = true; S.pub[n] = "run"; render(`#drf-${S.cur}`);
  setTimeout(() => { RUNNING = false; S.pub[n] = "done"; S.log.push(n); TIMES[n] = TIMES[n] || "15:14"; render(`#drf-${S.cur}`); settle(); }, LOOP_MS);
}
const MODEL = {
  init() {
    const all = (ns) => Object.fromEntries(ns.map((n) => [n, "ok"])), done = (ns) => { ns.forEach((n) => { S.pub[n] = "done"; }); S.log = [...ns]; };
    ({
      drafts: () => { S.dec = all([1, 2]); S.cur = 3; },
      rewrite: () => { S.dec = all([1, 5]); done([5]); S.cur = 2; },
      // Before approving 4, the last card of the epic to decide: the draft says the gesture publishes a chain.
      // ?after: the moment after, with the epic created and 2 on its way.
      publish: () => { if (Q.has("after")) { S.dec = all([1, 2, 3, 4, 5]); done([5, 1]); S.pub[2] = "run"; } else { S.dec = all([1, 2, 3, 5]); done([5]); } S.cur = 4; },
      published: () => { S.dec = all([1, 2, 3, 4, 5]); done([5, 1, 2, 3, 4]); S.cur = 0; },
      "partial-fail": () => { S.dec = all([1, 2, 3, 4, 5]); done([5, 1, 2]); S.pub[3] = "fail"; S.cur = 3; },
      epic: () => { S.dec = { 1: "ok", 2: "ok", 3: "no", 4: "no", 5: "ok" }; done([5]); S.cur = 1; },
      "epic-off": () => { S.dec = { 1: "no", 2: "ok", 3: "ok", 4: "no", 5: "ok" }; done([5]); S.cur = 1; },
      "archive-blocked": () => { S.dec = { 1: "ok", 2: "ok", 3: "no", 4: "no", 5: "ok" }; done([5]); S.cur = 1; },
      many: () => { S.dec = all([2, 5, 6, 8]); done([5, 8]); S.cur = 3; },
      done: () => { S.dec = all([1]); done([1]); S.cur = 0; TIMES[1] = "15:49"; },
    }[SCN] || (() => {}))();
  },
  afterBoot() {
    if (SCN === "publish" && Q.has("after") && !FREEZE) { RUNNING = true; setTimeout(() => { RUNNING = false; S.pub[2] = "done"; S.log.push(2); render(`#drf-${S.cur}`); settle(); }, 1500); }
    const t = SCN === "partial-fail" ? document.querySelector('[data-act="retry"]') : null;
    if (t) { t.scrollIntoView({ block: "center" }); t.focus({ preventScroll: true }); }
  },
  chain: (n, d) => chainOf(n, d),
  failed: failedAny,
  situation() {
    if (SCN === "talk") return S.sessErr ? "sesserr" : "reply";
    if (SCN === "unreadable") return "unreadable";
    if (failedAny()) return "failed";
    if (offKids().length) return "epicoff";
    if (decided() < DRAFTS.length) return "decide";
    if (stuck()) return "epic";
    if (DRAFTS.some((d) => S.dec[d.n] === "ok" && S.pub[d.n] !== "done" && !blocked(d))) return "publishing";
    return SCN === "done" ? "archive3" : "archive";
  },
  // The state of a draft, said in one line: what it waits for, publishing, on GitHub, failed.
  stateLine(d, short = false) {
    const p = S.pub[d.n];
    if (p === "done") return `<span class="dst">${I("check")}${created(d)}<span class="t">· ${TIMES[d.n]}</span></span>`;
    if (p === "run") return `<span class="dst" role="status"><span class="spin" aria-hidden="true"></span>Publishing…</span>`;
    if (p === "fail") return short ? `<span class="dst err">${st("error")}Couldn't write to GitHub · open it to Retry</span>` : `<span class="dst err" id="fail-${d.n}">${st("error")}Couldn't write to GitHub: GitHub's rate limit was reached. It resets at 14:32.</span>`;
    if (S.dec[d.n] === "ok") {
      if (epicOff(d)) return `<span class="dst strong">${I("hold")}The epic is discarded · this card won't publish</span>`;
      if (d.kind === "epic" && stuck()) return `<span class="dst strong">${I("hold")}Approved · the epic needs two approved cards · ${kidsOk(d)} of ${d.kids.length}</span>`;
      const w = waitsFor(d); return w ? `<span class="dst">${I("hold")}Approved · waits for ${w}</span>` : "";
    }
    if (S.dec[d.n] === "no") return `<span class="dst off">Discarded</span>`;
    if (blocked(d)) return `<span class="dst">${st("warn")}Can't publish · choose a repository</span>`;
    return "";
  },
  // Before the gesture, the draft says exactly what it publishes now, or what it will wait for.
  consequence(d) {
    if (S.dec[d.n] || S.pub[d.n]) return "";
    if (blocked(d)) return `<p class="dcons" id="cons-${d.n}">${I("hold")}<span>Can't publish: choose a repository of the board in <b>Edit</b>.</span></p>`;
    const ca = chainOf(d.n, "ok"), cd = chainOf(d.n, "no");
    const names = (c) => listOf(c.map((k) => nameOf(D[k], d.n)));
    let a;
    if (ca.length) a = `<b>Approve</b> publishes ${ca.length === 1 ? "this card" : names(ca)} to GitHub now.`;
    else { const w = waitsFor(d, { ...S.dec, [d.n]: "ok" }); a = `<b>Approve</b> publishes nothing yet: ${d.kind === "epic" ? "the epic" : "this card"} waits for ${w}.`; }
    const dsc = cd.length ? ` <b>Discard</b> publishes ${names(cd)} now.` : "";
    return `<p class="dcons ${ca.length > 1 || cd.length ? "chain" : ""}" id="cons-${d.n}">${I(ca.length || cd.length ? "chain" : "hold")}<span>${a}${dsc}</span></p>`;
  },
  decArea(d) {
    const p = S.pub[d.n];
    if (p === "done") return `<div class="fa">${this.stateLine(d)}<span class="note">To take it back, ${d.out[0] === "updated" ? "edit" : "close"} ${d.out[1]} on GitHub.</span></div>`;
    if (p === "run") return `<div class="fa">${this.stateLine(d)}</div>`;
    if (p === "fail") return `<div class="fa">${this.stateLine(d)}<button class="btn sm primary" data-act="retry" aria-describedby="fail-${d.n}" data-tip="Goes on from this draft; nothing is created twice">Retry</button></div>`;
    const dec = S.dec[d.n];
    // While a publication runs, or while the draft is being edited, the decision waits, with the reason beside it.
    if (DRAFTS.some((x) => S.pub[x.n] === "run")) return dec === "ok" ? `<div class="fa">${this.stateLine(d)}</div>` : `<div class="fa">${decButtons(d, true, `busy-${d.n}`)}<span class="note" id="busy-${d.n}">A publication is running · the decision waits for it</span><span class="grow"></span>${editBtn(d)}</div>`;
    if (S.edit === d.n) return `<div class="fa">${decButtons(d, true, `ed-${d.n}`)}<span class="note" id="ed-${d.n}">Finish editing to decide</span></div>`;
    const cons = this.consequence(d);
    let note = dec === "ok" ? `${this.stateLine(d)}<span class="note">click again to undo</span>` : dec === "no" ? `<span class="note">Discarded · click again to undo</span>` : "";
    if (!dec && S.revised[d.n] === "cleared") note = `<span class="note">Revised · your approval was cleared</span>`;
    const dis = blocked(d) && !dec;
    return `${cons}<div class="fa">${decButtons(d, false).replace('data-dec="ok"', `data-dec="ok" ${cons ? `aria-describedby="cons-${d.n}"` : ""} ${dis ? "disabled" : ""}`)}${note}<span class="grow"></span>${editBtn(d)}</div>`;
  },
  itemClass: (d) => S.pub[d.n] === "fail" ? "is-error" : "",
  // One marker per round of publication, with the state of each draft inside. It enters at the round's first
  // publication and is kept up to date; a failure is said there too, once.
  roundMarker(open = false) {
    const ok = DRAFTS.filter((d) => S.dec[d.n] === "ok");
    const done = S.log.length, up = S.log.filter((n) => D[n] && D[n].kind === "update").length;
    const stateOf = (d) => {
      const p = S.pub[d.n];
      if (p === "done") return { g: I("check"), txt: created(d) };
      if (p === "run") return { g: `<span class="spin" aria-hidden="true"></span>`, txt: "Publishing…" };
      if (p === "fail") return { g: st("error"), txt: `<span class="err">Couldn't write to GitHub: rate limit, resets at 14:32</span>`, cls: "is-error" };
      if (S.dec[d.n] === "no") return { g: I("x"), txt: "Discarded · not published", cls: "off" };
      if (S.dec[d.n] === "ok") { const w = waitsFor(d); return { g: I("hold"), txt: epicOff(d) ? "The epic is discarded" : w ? `Waits for ${w}` : failedAny() ? "Not published · the run stopped before it" : "Next" }; }
      return { g: st("todo"), txt: "Not decided" };
    };
    const all = ok.length && ok.every((d) => S.pub[d.n] === "done") && decided() === DRAFTS.length;
    const label = failedAny() ? `Publication stopped <span class="n">· round 1 · ${done} published · ${D[3].title} failed</span>`
      : all ? `Published <span class="n">· round 1 · ${done - up} created, ${up} updated</span>`
      : `Published <span class="n">· round 1 · ${done} so far</span>`;
    const t1 = TIMES[S.log[0]] || "", t2 = TIMES[S.log[S.log.length - 1]] || "";
    return EVX(failedAny() ? "alert" : "pr", label, t1 && t2 && t1 !== t2 ? `${t1} – ${t2}` : t1 || "—", "", `<div class="docbody full">${roundList(stateOf)}</div>`, { open, cls: failedAny() ? "is-error" : "" });
  },
  // Past rounds fold into one marker each when the next round's drafts arrive: its drafts, revisions and publications.
  foldedRounds() {
    const r1 = ROUND1.map((d) => ({ ...d, title: { 2: "Tier limits and overage prices", 3: "Overage on the monthly invoice", 4: "Plan picker with tiers and overage" }[d.n] || d.title }));
    const e = [EVX("cards", `Round 1 <span class="n">· 5 drafts, revised once · 4 created, 1 updated</span>`, "14:29 – 15:12", "", `<div class="docbody full">${roundList((d) => ({ g: I("check"), txt: created(d) }), r1, [5, 1, 2, 3, 4])}</div>`)];
    e.push(US(`<p>can I keep going here? I also need the admin report of the overage, per workspace.</p>`, "15:20"));
    e.push(AG("agent", `<p>Yes: the drafts published in round 1 don't change, and new ones start round 2. One card, in the epic that exists, <em>#450 Usage-based billing</em>, because it reads the metering and not the tiers.</p>`, "15:22"));
    const r2 = [{ n: 1, kind: "new", title: "Overage report per workspace for admins", out: ["created", "web#2305"] }];
    e.push(EVX("cards", `Round 2 <span class="n">· 1 draft · 1 created</span>`, "15:24 – 15:26", "", `<div class="docbody full">${roundList((d) => ({ g: I("check"), txt: created(d) }), r2, [1])}</div>`));
    e.push(US(`<p>one more: current customers keep their plan for 90 days once the tiers ship</p>`, "15:41"));
    e.push(AG("agent", `<p>That is the grandfathering we left out. One card in <em>Pricing tiers with metered overage</em>, now billing#478 on GitHub.</p>`, "15:44"));
    e.push(EV("cards", `Drafts written <span class="n">· round 3 · 1 draft</span>`, "15:47"));
    e.push(draftsCard());
    e.push(EVX("pr", `Published <span class="n">· round 3 · 1 created</span>`, "15:49", "", `<div class="docbody full">${roundList((d) => ({ g: I("check"), txt: created(d) }))}</div>`));
    return e;
  },
  bar() {
    const s = this.situation(), show = (to, tip) => `<button class="btn sm" data-act="show" data-to="${to}" data-tip="${tip}">${I("up")}Show</button>`;
    if (s === "reply") return ASK({ kind: "tinted", label: "Waiting for reply", place: "Discussing", s: { sev: "wait", since: "2m", long: "2 minutes" }, detail: "", actions: "" });
    if (s === "sesserr") return ASK({ kind: "error", label: "Session error", place: "Discussing", s: { sev: "error", since: "3m", long: "3 minutes" }, detail: "", actions: `<button class="btn sm primary" data-act="retry-session" data-tip="Opens the session again where it stopped">Retry</button>` });
    if (s === "unreadable") return ASK({ kind: "tinted", label: "Waiting for the drafts", place: "Discussing", s: { sev: "wait", since: "1m", long: "1 minute" }, detail: "ask the agent to fix drafts.md below", actions: "" });
    if (s === "publishing") return "";
    if (s === "failed") return ASK({ kind: "error", label: "Publish failed", place: "round 1", s: { sev: "error", since: "1m", long: "1 minute" }, detail: `Stopped at ${D[3].title}`,
      actions: show("#drf-3", "Go to the draft where the publication stopped; Retry is there") });
    if (s === "archive" || s === "archive3") return ASK({ kind: "close", sev: "close", label: "Ready to archive", place: s === "archive" ? "round 1" : "round 3", s: { sev: "close", since: s === "archive" ? "1m" : "4m", long: s === "archive" ? "1 minute" : "4 minutes" },
      detail: `${s === "archive" ? "5 published" : "7 published in 3 rounds"} · or ask the agent for more cards below`, actions: `<button class="btn sm primary" data-act="archive" data-tip="The conversation ends; everything stays in History">Archive…</button>` });
    if (s === "epic") return ASK({ kind: "tinted", label: "Epic can't publish", place: "round 1", s: { sev: "wait", since: "1m", long: "1 minute" }, detail: `${kidsOk(D[1])} of ${D[1].kids.length} cards approved · approve one more, or discard the epic`,
      actions: show("#drf-1", "Go to the epic") });
    if (s === "epicoff") { const k = offKids(); return ASK({ kind: "tinted", label: "Epic discarded", place: "round 1", s: { sev: "wait", since: "1m", long: "1 minute" }, detail: `${plural(k.length, "approved card")} of it won't publish · approve the epic again, or discard ${k.length === 1 ? "it" : "them"}`,
      actions: show("#drf-1", "Go to the epic") }); }
    return ASK({ kind: "tinted", label: "Decide drafts", place: "round 1", s: { sev: "wait", since: "6m", long: "6 minutes" }, detail: `${decided()} of ${DRAFTS.length} decided`,
      actions: `<button class="btn sm" data-act="next" data-tip="The next draft to decide · Alt+↓">${I("arrow-down")}Next to decide <span class="k">Alt ↓</span></button>` });
  },
  menuArchive() {
    if (failedAny()) return "a publication failed: Retry it, or discard the draft";
    if (DRAFTS.some((d) => S.pub[d.n] === "run")) return "a publication is running";
    if (stuck()) return "the epic can't publish: approve one more card, or discard the epic";
    if (DRAFTS.some((d) => S.dec[d.n] === "ok" && S.pub[d.n] !== "done" && !epicOff(d) && !blocked(d))) return "approved drafts wait to be published";
    return "";
  },
  afterDecide() { settle(); },
  onAct(act, a) {
    if (act === "retry") { delete S.pub[3]; render(`#drf-${S.cur}`); settle(); return; }
    if (act === "retry-session") { S.sessErr = false; render(); return; }
    if (act === "show") { const t = document.querySelector(a.dataset.to); if (t) { const n = +t.dataset.dnum; if (n) { S.cur = n; render(`#drf-${n}`); } const el = document.querySelector(a.dataset.to); el.scrollIntoView({ block: "center" }); const b = el.querySelector('[data-act="retry"]'); (b || el).focus({ preventScroll: true }); } }
  },
  onKey: () => false,
};
