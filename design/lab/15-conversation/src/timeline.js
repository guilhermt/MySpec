/* =====================================================================
   B · Timeline. A narrow column holds a thread: one glyph per entry
   (the agent, you, the product, a group of actions, a milestone), joined
   by a vertical line. The time sits on the thread, written when it
   changes. The content is on the right. A group of actions is a node:
   folded, one line; open, its actions become small nodes on the same
   thread. The glyph carries the state: the spinner where someone works,
   the amber disc where something waits for you, the diamond where it
   failed. No names over the speeches: the glyph says who speaks.
   The arrow keys walk the thread node by node; → opens a node, ← folds it.
   ===================================================================== */
let TL_LAST = "";
function tlTime(at) {
  const show = at && at !== TL_LAST; if (at) TL_LAST = at;
  return `<span class="tt2" ${show ? "" : 'aria-hidden="true"'} data-tip="${LONG_TIME(at)}">${show ? at : ""}</span>`;
}
function tlNode(e) {
  if (e.t === "agent") return `<span class="tn tn-ag ${e.who === "rev" ? "rev" : ""}" data-tip="${WHO[e.who]}">${e.streaming ? st("run") : I(WHO_ICON[e.who])}</span>`;
  if (e.t === "user") return `<span class="tn tn-us" data-tip="You">${I("user")}</span>`;
  if (e.t === "mark") return `<span class="tn tn-mk ${e.kind}">${I(e.icon)}</span>`;
  if (e.t === "acts") return `<span class="tn tn-ac">${e.live ? st("run") : e.hold ? I("hold") : `<i class="ring"></i>`}</span>`;
  if (e.t === "question" || e.t === "permission" || e.t === "findings") return `<span class="tn tn-rq">${e.answered ? I("check") : st("wait")}</span>`;
  if (e.t === "error") return `<span class="tn tn-er">${st("error")}</span>`;
  if (e.t === "activity") return `<span class="tn tn-ac">${st("run")}</span>`;
  return `<span class="tn"></span>`;
}
const tlRow = (e, cls, body, extra = "") => `<div class="tr ${cls}" ${extra}>${tlTime(e.at)}${tlNode(e)}<div class="tc">${body}</div></div>`;
function tlEntries(list) { return list.map(tlEntry).join(""); }
function tlEntry(e) {
  if (e.t === "agent") return tlRow(e, `t-sp ${e.streaming ? "streaming" : ""}`, `<div class="prose">${speechHTML(e)}</div>${e.interrupted ? `<div class="intr">${I("ban")}Interrupted by you</div>` : ""}`, `data-nav tabindex="-1" role="article" aria-label="${WHO[e.who]}, ${e.at}${e.streaming ? ", writing" : ""}${e.interrupted ? ", interrupted" : ""}"`);
  if (e.t === "user") return tlRow(e, `t-us ${e.queued ? "queued" : ""}`, `${e.queued ? `<div class="tq">Queued · sends when the turn ends<button class="btn ghost xs" data-tip="Remove the message from the queue">Remove</button></div>` : ""}<div class="tut">${e.text}</div>${e.fromQueue ? `<div class="tq">from the queue</div>` : ""}`, `data-nav tabindex="-1" role="article" aria-label="You, ${e.at}${e.queued ? ", queued" : ""}"`);
  if (e.t === "acts") {
    // Folded, one line; open, each action is a small node on the same thread.
    const earlier = e.earlier ? `<div class="tr t-sub more">${tlTime("")}<span class="tn tn-dot"></span><div class="tc"><button class="earlier" type="button">${I("up")}Show ${e.earlier} earlier actions</button></div></div>` : "";
    const rows = e.rows.map((r) => {
      if (r[2] === "agent") return `<div class="tr t-sub">${tlTime("")}<span class="tn tn-dot ag">${I("bot")}</span><div class="tc"><ul class="arows">${actRow(r)}</ul></div></div>`;
      return `<div class="tr t-sub ${r[2] === "running" ? "now" : ""}">${tlTime("")}<span class="tn tn-dot ${r[2] === "error" ? "bad" : ""}">${r[2] === "running" ? st("run") : r[2] === "error" ? st("error") : ""}</span><div class="tc"><ul class="arows">${actRow(r).replace(/<span class="ai[^"]*">[\s\S]*?<\/span>/, '<span class="ai"></span>')}</ul></div></div>`;
    }).join("");
    return `<details class="t-grp ${e.live ? "live" : ""}" ${e.open ? "open" : ""}><summary class="tr t-ac" data-nav tabindex="-1" aria-label="${actName(e)}">${tlTime(e.at)}${tlNode(e)}<span class="tc tsum"><span class="tan">${e.n} actions</span>${actRoll(e)}<span class="tad">${e.live ? e.live[2] : e.dur || ""}</span>${I("right", "i chev")}</span></summary>${earlier}${rows}</details>`;
  }
  if (e.t === "mark") {
    const line = `<span class="tml"><span class="tmt">${e.text}</span>${e.n ? `<span class="tmn" data-tip="${plain(e.n)}">${e.n}</span>` : ""}</span>`;
    if (!e.body) return tlRow(e, `t-mk ${e.kind}`, line, `data-nav tabindex="-1" role="separator" aria-label="${markName(e)}"`);
    return `<details class="t-mkd"><summary class="tr t-mk ${e.kind}" data-nav tabindex="-1" aria-label="${markName(e)}, show">${tlTime(e.at)}${tlNode(e)}<span class="tc tsum">${line}${I("right", "i chev")}</span></summary><div class="tr t-body">${tlTime("")}<span class="tn"></span><div class="tc">${markBody(e)}</div></div></details>`;
  }
  if (e.t === "question" || e.t === "permission") return tlRow(e, "t-rq", reqCard(e), `data-nav tabindex="-1" role="article" aria-label="${e.t === "question" ? (e.answered ? "Question, answered" : "Question") : "Permission"}, ${e.at}"`);
  if (e.t === "findings") return tlRow({ ...e, at: "" }, "t-rq", findingsCard(), `data-nav tabindex="-1" role="article" aria-label="Findings to decide"`);
  if (e.t === "error") return tlRow(e, "t-er", errBlock(e), `data-nav tabindex="-1" role="article" aria-label="Session error, ${e.at}"`);
  if (e.t === "activity") return tlRow(e, "t-act", `<span class="tact" role="status"><b>${e.text}</b><span>· ${e.sub}</span></span>`, `data-nav tabindex="-1"`);
  if (e.t === "fold") {
    // A stretch of the past, compressed on the thread: a dashed span with its range and its size.
    const first = e.entries[0];
    const range = `<span class="tt2 range" data-tip="${LONG_TIME(e.at)} to ${e.to}">${e.at}<br>${e.to}</span>`;
    TL_LAST = "";
    const inner = tlEntries(e.entries.slice(1));
    TL_LAST = e.to;
    return `<details class="t-fold"><summary class="tr t-gap" data-nav tabindex="-1" aria-label="${plain(e.title)} ${plain(e.sub)}, folded: ${e.speeches} speeches and ${e.actions} actions, ${e.at} to ${e.to}">${range}<span class="tn tn-gap"><i class="dash"></i>${I(e.product ? "product" : "play")}</span><span class="tc tsum"><span class="tml"><span class="tmt">${e.title}</span><span class="tmn" data-tip="${plain(e.sub)}">${e.sub}</span></span><span class="tgs">${e.speeches} speeches · ${e.actions} actions</span>${I("right", "i chev")}</span></summary><div class="t-fold-in">${inner}</div></details>`;
  }
  return "";
}
V.nav = "[data-nav]";
V.key = (e, cur) => {
  const d = cur.tagName === "SUMMARY" ? cur.parentElement : null; if (!d) return;
  if (e.key === "ArrowRight" && !d.open) { e.preventDefault(); d.open = true; }
  if (e.key === "ArrowLeft" && d.open) { e.preventDefault(); d.open = false; }
};
V.conv = () => { ENTRY_N = 0; TL_LAST = ""; return `<div class="cv tl" role="feed" aria-label="The conversation with the ${(WHO[curVoice()] || "agent").toLowerCase()}">${tlEntries(convEntries())}</div>${newMessages()}`; };
V.after = afterRender;
