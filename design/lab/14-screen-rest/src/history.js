/* =====================================================================
   ROUND 14 · History, the one organization the user keeps: one list by
   date, newest first, grouped by day, each row with its kind and its
   result. The search is its own; the repository filter is the sidebar's.
   An archived item opens as a place, with ← History.
   ===================================================================== */
const KIND14 = { t: ["task", "Task"], o: ["oneshot", "One-Shot task"], r: ["review", "Review"], d: ["discussion", "Discussion"] };
function histRow(h, k, fresh) {
  const [day, time, kind, name, where, result, more] = h;
  const [icon, word] = KIND14[kind];
  const res = kind === "r" ? `${result === "Closed" ? `<span class="rw2">Closed</span>` : "Merged"} · ${more}` : kind === "d" ? result : `PR ${result.replace(" merged", "")} · ${more}${SKIPPED.has(name) ? ` · <span class="rw2">dev not updated</span>` : ""}`;
  const label = `${word} ${name}, ${where}, ${res.replace(/<[^>]+>/g, "")}, archived ${day === 24 ? "today" : DAYS[day]} at ${time}${fresh ? ", just archived" : ""}`;
  const go = kind === "r" ? "archived-review" : kind === "d" ? "archived-discussion" : "archived-task";
  return `<li><a class="cr hrow ${fresh ? "open" : ""}" href="?scene=${go}${kind === "o" ? "&v=oneshot" : ""}" tabindex="${k === 0 ? 0 : -1}" aria-label="${label}">
    <span class="lead"><svg class="ty" aria-hidden="true"><use href="#i-${icon}"/></svg></span><span class="tl">${name}</span>
    <span class="meta"><span class="col hw"><span class="t">${where}</span></span><span class="col hres"><span class="t">${res}</span></span></span><span class="col htm">${time}</span></a></li>`;
}
function historyMain() {
  let list = HIST;
  const filtered = VAR === "filtered";
  if (filtered) list = HIST.filter((h) => /^web#/.test(h[4]) || h[4] === "web" || h[3] === "Usage alerts at 80% of the plan");
  const q = VAR === "no-match" ? "refund" : "";
  const search = `<span class="input srch"><label class="sr" for="h-q">Search History</label>${I("search")}<input id="h-q" placeholder="Search by name, title or #number" value="${q}">${q ? `<button class="clr" aria-label="Clear the search" data-tip="Clear the search">${I("x")}</button>` : `<kbd>/</kbd>`}</span>`;
  const chip = filtered ? `<span class="btn sm fchip on" data-tip="The repository filter of the sidebar applies here too">Only acme/web<button class="x" aria-label="Show all repositories" data-tip="Show all repositories">${I("x")}</button></span>` : "";
  const bar = `<div class="fbar" role="search">${search}${chip}<span class="sp"></span><span class="hcount">${filtered ? `${list.length} of 44` : "44 archived"} · Sep 12 – today</span></div>`;
  let body = "";
  if (VAR === "empty") body = `<div class="bempty"><p class="t">Nothing archived yet</p><p class="s">A task comes here once it's closed, a review once its pull request is merged or closed, a discussion once it's archived.</p></div>`;
  else if (q) body = `<div class="bempty"><p class="t">Nothing matches “refund”</p><p class="s">Try another name, title or #number, or clear the search.</p><div class="row"><button class="btn sm">Clear the search</button></div></div>`;
  else {
    const days = [...new Set(list.map((h) => h[0]))];
    let k = 0;
    body = `<div class="lst hlst">${days.map((d) => {
      const rows = list.filter((h) => h[0] === d);
      return `<section class="hday" aria-labelledby="d-${d}"><h3 class="sech is-static" id="d-${d}"><span class="nm">${DAYS[d]}<span class="cnt">${rows.length}</span></span></h3><ul class="grpb">${rows.map((h) => histRow(h, k++, VAR === "fresh" && k === 1)).join("")}</ul></section>`;
    }).join("")}</div>`;
  }
  return `<main class="main" id="main">${placeHead("History", "", VAR === "fresh" ? "Platform Roadmap" : "Rate limit per API key")}<div class="bbody"><div class="lstw"><div class="lst-in">${bar}${body}</div></div></div></main>`;
}

// ---------------- An archived item: the header, the facts, then its content ----------------
const evx = (...a) => EVX(...a).replace('<span class="t">· </span>', "");
function archHead(icon, title, tag, tools) {
  return `<header class="ih1 bh ah">${navBack("History")}<svg class="ty tyh" aria-hidden="true"><use href="#i-${icon}"/></svg><h1 class="ih-title"><span class="trunc">${title}</span></h1>${tag}<span class="grow"></span><div class="ih-tools">${tools}
    <button class="btn ghost sm icon" id="more-btn" aria-label="More actions" aria-haspopup="menu" data-tip="Delete from History">${I("more")}</button></div></header>`;
}
const facts = (rows) => `<dl class="afacts">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>`;
// The result of the closing: one line per part, done, skipped with its reason, or failed with its detail.
function closeResult(parts, when) {
  const ic = { done: I("check"), skip: `<span class="skipm" aria-hidden="true">–</span>`, fail: st("error") };
  return `<div class="cres" role="group" aria-label="What the closing did"><div class="cres-h">Closing<span class="t">${when}</span></div><ul>${parts.map(([s, t, d]) => `<li class="${s}"><span class="c">${ic[s]}</span><span class="w">${t}${d ? `<span class="d">${d}</span>` : ""}</span></li>`).join("")}</ul></div>`;
}
const CLOSE_398 = [["done", "Worktree removed", ""], ["done", "Branch idempotency-keys-for-payment-intents deleted", ""], ["skip", "dev not updated: another branch is checked out", "Pull dev in ~/code/api when you check it out again."]];
function archivedTask() {
  const one = VAR === "oneshot";
  const title = one ? "Fix the flaky login e2e" : "Idempotency keys for payment intents";
  const tabs = one ? [["", "One-Shot document"], ["pr", "Pull request"]] : [["", "PRD"], ["spec", "Tech spec"], ["steps", "Steps · 6"], ["pr", "Pull request"]];
  const cur = VAR === "steps" || VAR === "pr" ? VAR : "";
  const tabbar = `<div class="vtabs atabs"><div class="vtabs-in" role="tablist" aria-label="Documents of the task">${tabs.map(([k, n]) => `<a role="tab" class="vt" href="?scene=archived-task&v=${k || (one ? "oneshot" : "")}" aria-selected="${k === cur}" tabindex="${k === cur ? 0 : -1}">${n}</a>`).join("")}</div></div>`;
  const tools = `<a class="btn ghost sm" href="#" data-tip="Open #${one ? "2290" : "1279"} on GitHub">PR #${one ? "2290" : "1279"}${I("external")}</a>`;
  const head = archHead(one ? "oneshot" : "task", title, `<span class="dtag">Archived</span>${one ? `<span class="dtag">One-Shot</span>` : ""}`, tools);
  const top = facts([["Repository", `acme/${one ? "web" : "api"} · card <a href="#">${one ? "web#2279" : "api#398"}</a> · Done`], ["Pull request", `<a href="#">#${one ? "2290" : "1279"}</a> merged into dev by lnakamura · ${one ? "Sep 24 at 09:58" : "Sep 24 at 14:51"}`], ["Started", one ? "Sep 24 at 08:12" : "Sep 17 at 10:03"]])
    + closeResult(one ? [["done", "Worktree removed", ""], ["done", "Branch fix-the-flaky-login-e2e deleted", ""], ["done", "dev updated by 3 commits", ""]] : CLOSE_398, one ? "Sep 24 at 10:05" : "Sep 24 at 15:02");
  let doc = "";
  if (cur === "steps") {
    const ST = [["Idempotency key column and index", "a41c9e2", ["Review 1 · clean"]], ["Store the key on payment intent create", "7b20d15", ["Review 1 · changes", "Review 2 · clean"]], ["Replay the stored response on a repeated key", "c93f0aa", ["Review 1 · changes", "Review 2 · changes", "Review 3 · clean"]], ["Expire keys after 24 hours", "e18d4b7", ["Review 1 · clean"]], ["Return 422 when the body differs", "0f6a2c1", ["Review 1 · clean"]], ["Docs for the Idempotency-Key header", "5d77e90", ["Review 1 · clean"]]];
    doc = `<ol class="asteps">${ST.map(([n, sha, revs], k) => `<li><div class="as-h"><span class="no">${k + 1}</span><span class="grow">${n}</span><span class="sha mono">${sha}</span></div><div class="as-r">${revs.map((r, j) => evx(r.includes("clean") ? "filecheck" : "file", `${r.split(" · ")[0]} <span class="n">· ${r.split(" · ")[1]}</span>`, "", "", `<div class="docbody full prose"><p>${r.includes("clean") ? "Nothing to change. The step does what its file asks, and the tests cover the new path." : "The replay reads the stored response before checking that the request body matches; a different body with the same key returns the old response."}</p></div>`, { open: k === 2 && j === 0 })).join("")}</div></li>`).join("")}</ol>`;
  } else if (cur === "pr") {
    doc = `<div class="pdraft"><div class="cd-h">The pull request</div><h3>Idempotency keys for payment intents</h3><div class="prose"><p>Adds the <code>Idempotency-Key</code> header to <code>POST /payment_intents</code>. A repeated key within 24 hours returns the stored response; a repeated key with a different body returns <code>422</code>.</p><p>Closes acme/api#398</p></div></div>
      <div class="cd-h">Review of the pull request</div><div class="as-r">${EVX("file", `Review 1 <span class="n">· changes · 2 findings</span>`, "14:10", "", `<div class="docbody full"><ol class="flist"><li><span class="fn">1</span><span>The migration adds the index without CONCURRENTLY and locks the table.<span class="loc">db/migrations/0042_idempotency.sql:3</span></span></li><li><span class="fn">2</span><span>The 24 hours are a literal in two places.<span class="loc">internal/idem/store.go:17</span></span></li></ol></div>`)}${EVX("filecheck", `Review 2 <span class="n">· clean</span>`, "14:38", "", `<div class="docbody full prose"><p>Both findings fixed. The checks pass and the branch merges clean into dev.</p></div>`)}</div>`;
  } else {
    doc = one ? `<div class="adoc prose"><h4>What to fix</h4><p>The login e2e fails about one run in eight: the test clicks <code>Sign in</code> before the form mounts its handler.</p><h4>The change</h4><ul><li>Wait for the form's <code>data-ready</code> attribute before typing.</li><li>Drop the fixed 500 ms sleep.</li></ul><h4>Done when</h4><ul><li>Fifty runs in CI pass in a row.</li></ul></div>`
      : `<div class="adoc prose"><h4>Context</h4><p>A client that retries <code>POST /payment_intents</code> after a timeout can charge a customer twice. Support refunded 41 double charges in August.</p><h4>Problem</h4><p>The API has no way to tell a retry from a new request.</p><h4>Goals</h4><ul><li>A client sends <code>Idempotency-Key</code>; a repeated key within 24 hours returns the first response.</li><li>A repeated key with a different body is refused with <code>422</code>.</li></ul><h4>Out of scope</h4><ul><li>Idempotency on other endpoints.</li><li>Keys that live longer than 24 hours.</li></ul><h4>Acceptance criteria</h4><ul><li>Two requests with the same key and body create one payment intent.</li><li>The second response has the header <code>Idempotent-Replayed: true</code>.</li></ul></div>`;
  }
  const dlg = VAR === "delete" ? dialog({ alert: true, title: "Delete “Idempotency keys for payment intents”?", body: `<p class="dp">This removes the archived task and its documents from History. It can't be undone.</p><p class="dp faint">Nothing changes on GitHub: PR #1279 and the card api#398 stay.</p>`, primary: pbtn("Delete task", { danger: true }) }) : "";
  const menu = VAR === "delete" ? "" : "";
  return `<main class="main" id="main">${head}<div class="aw"><div class="ain">${top}${tabbar}<div class="adoc-w">${doc}</div></div></div>${menu}${dlg}</main>`;
}
function archivedReview() {
  const tools = `<a class="btn ghost sm" href="#" data-tip="Open web#2291 on GitHub">Open on GitHub${I("external")}</a>`;
  const head = archHead("review", "Migrate settings page to react-hook-form", `<span class="dtag">Merged</span>`, tools);
  const top = facts([["Pull request", `<a href="#">web#2291</a> by tchen · merged into dev by rsouza · Sep 23 at 16:20`], ["Card", `<a href="#">web#2238</a> · Settings form keeps the old validation`], ["Reviewed", "2 passes, both published"]]);
  const pass = (n, verdict, when, items, rep) => `<section class="apass" aria-label="Pass ${n}"><div class="ap-h"><span class="ap-n">Pass ${n}</span><span class="ap-v">${verdict}</span><span class="t">published ${when}</span></div>
    ${items.length ? `<ul class="apub">${items.map(([t, w, where]) => `<li><span class="w">${t}</span><span class="loc mono">${w}</span><span class="wh">${where}</span></li>`).join("")}</ul>` : ""}
    ${evx("file", `Report <span class="n">· reviews/pass-${n}.md</span>`, "", "", `<div class="docbody full prose">${rep}</div>`)}</section>`;
  const body = pass(1, "Request changes", "Sep 23 at 13:41", [["The time zone lost its required rule.", "src/settings/schema.ts:22", "Inline comment"], ["Settings asks about unsaved changes as soon as it opens.", "src/settings/SettingsForm.tsx:48", "Inline comment"], ["The e2e selectors are out of date; the spec is skipped, so it can wait.", "", "In the review body"]], "<p>The move to react-hook-form keeps every field and the submit flow, and the six checks pass. Two things to fix before merging.</p>")
    + pass(2, "Approve", "Sep 23 at 15:48", [], "<p>Both findings fixed in 3f1a9c0. Nothing else changed. The checks pass and the branch merges clean into dev.</p>");
  return `<main class="main" id="main">${head}<div class="aw"><div class="ain">${top}${body}<p class="sfoot">The conversation of a review isn't kept in History.</p></div></div></main>`;
}
function archivedDiscussion() {
  const head = archHead("discussion", "Webhook delivery guarantees", `<span class="dtag">Archived</span>`, `<a class="btn ghost sm" href="#" data-tip="Open the board">Platform Roadmap</a>`);
  const top = facts([["Board", "Platform Roadmap · from <a href=\"#\">api#447</a> and <a href=\"#\">api#449</a>"], ["Archived", "Sep 24 at 11:47 · 1 round"], ["Published", "4 of 5 drafts: 3 created, 1 updated"]]);
  const row = (kind, t, out, ref, indent) => `<li class="${indent ? "kid" : ""} ${out === "Not published" ? "np" : ""}"><span class="dtag">${kind}</span><span class="w">${t}</span><span class="o">${out === "Not published" ? `<span class="faint">Not published · discarded</span>` : `${out} <a href="#" data-tip="Open ${ref} on GitHub">${ref}${I("external")}</a>`}</span></li>`;
  const pub = `<section class="asec" aria-labelledby="pb-h"><h3 id="pb-h" class="cd-h">What it published</h3><ul class="dpub">
    ${row("Epic", "Webhook delivery guarantees", "Created", "api#452")}${row("New card", "Retry failed webhook deliveries with backoff", "Created", "api#453", 1)}${row("New card", "Dead-letter queue for webhooks", "Created", "api#454", 1)}${row("New card", "Replay a webhook from the delivery log", "Not published", "", 1)}${row("Update", "Signed webhook payloads", "Updated", "gateway#440")}</ul></section>`;
  const doc = `<section class="asec"><h3 class="cd-h">Document and conversation</h3><div class="as-r">${EVX("filecheck", `discussion.md <span class="n">· the understanding</span>`, "11:12", "", `<div class="docbody full prose"><h4>Context</h4><p>The gateway sends each webhook once. A receiver that is down at that moment never gets it, and support replays events by hand from the logs.</p><h4>In scope</h4><ul><li>Retries with backoff for 24 hours, then a dead-letter queue.</li><li>Signed payloads, so a replay is verifiable.</li></ul><h4>Out of scope</h4><ul><li>Ordering guarantees between events.</li></ul></div>`)}
    ${EVX("discussion", `Conversation <span class="n">· 31 messages, read only</span>`, "10:02 – 11:40", "", `<div class="docbody full prose"><p><b>You</b> · Webhooks get lost when a receiver is down. I want retries and a way to see what failed.</p><p><b>Agent</b> · The gateway sends from <code>internal/webhooks/send.go</code> with a single attempt and no record of the failure. Should a retry keep the original signature, or sign again at send time?</p><p class="faint">… 29 more messages</p></div>`)}</div></section>`;
  return `<main class="main" id="main">${head}<div class="aw"><div class="ain">${top}${pub}${doc}</div></div></main>`;
}
