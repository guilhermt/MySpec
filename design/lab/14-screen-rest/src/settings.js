/* =====================================================================
   ROUND 14 · Settings. A place like the others: the header with the way
   back and Close (Esc), a short navigation at the left (Defaults, Boards,
   Repositories, Prompts) and the page at the right. Defaults is where
   Settings opens: it is the page that changes (6 of 9 models). The theme
   stays in the foot of the sidebar; there is no Appearance page.
   ===================================================================== */
const SPAGES = [["settings-defaults", "Defaults", "sliders"], ["settings-boards", "Boards", "board"], ["settings-repos", "Repositories", "repo"], ["settings-prompts", "Prompts", "prompt"]];
function settingsNav() {
  const empty = SCN === "settings-repos" && VAR === "empty";
  return `<nav class="snav" aria-label="Settings">${SPAGES.map(([k, n, ic]) => {
    const warn = k === "settings-repos" && !empty;
    const extra = warn ? `<span class="snx" data-tip="The clone of acme/infra is missing">${st("warn")}1</span>` : "";
    return `<a class="sni" href="?scene=${k}" ${SCN === k ? 'aria-current="page"' : ""}${warn ? ' aria-describedby="snav-clone"' : ""}>${I(ic)}<span class="grow">${n}</span>${extra}</a>`;
  }).join("")}${empty ? "" : `<span class="sr" id="snav-clone">The clone of acme/infra is missing</span>`}</nav>`;
}
function settingsMain(page, dlg = "") {
  const close = `<button class="btn ghost sm" data-tip="Close Settings and go back to Rate limit per API key · Esc">Close <span class="k">Esc</span></button>`;
  return `<main class="main" id="main">${placeHead("Settings", close)}<div class="setw"><div class="set">${settingsNav()}<div class="spage">${page}</div></div></div>${dlg}</main>`;
}
const pageHead = (title, desc, act = "") => `<header class="sp-h"><div class="sp-t"><h2>${title}</h2>${desc ? `<p>${desc}</p>` : ""}</div>${act ? `<div class="sp-a">${act}</div>` : ""}</header>`;

// ---------------- Defaults: the review mode, then the models of each stage ----------------
// The model and the effort are two groups of radios in one menu: one choice in each.
function modelList(stage, cur, factory, failed) {
  if (failed) return `<div class="pop menu mlist" role="menu" aria-label="Model of ${stage}"><div class="menu-msg">Claude Code was not found, so there is nothing to choose from. Install it or point MYSPEC_CLAUDE_PATH at the executable, and reopen MySpec.</div></div>`;
  const [cm, ce] = cur.split(" · "), [fm, fe] = factory.split(" · ");
  const opt = (v, on, f) => `<button class="mi" role="menuitemradio" aria-checked="${on}">${I("check", "i ck")}<span class="grow">${v}</span>${f ? `<span class="sub">factory</span>` : ""}</button>`;
  return `<div class="pop menu mlist" role="menu" aria-label="Model and effort of ${stage}"><div role="group" aria-labelledby="ml-m"><div class="menu-cap" id="ml-m">Model</div>${CATALOG.map((c) => opt(c.m, c.m === cm, c.m === fm)).join("")}</div>
    <div class="menu-sep" role="separator"></div><div role="group" aria-labelledby="ml-e"><div class="menu-cap" id="ml-e">Effort · ${cm}</div>${CATALOG[0].efforts.map((e) => opt(e, e === ce, e === fe && cm === fm)).join("")}</div>
    <div class="menu-msg">From the Claude Code installed here, read when MySpec opened.</div></div>`;
}
function defaultsPage() {
  const reading = VAR === "reading", failed = VAR === "failed", saving = VAR === "saving";
  const opt = (m, d, on, c = "") => `<button class="pop-opt ${c}" role="radio" aria-checked="${on}" tabindex="${on ? 0 : -1}" ${c === "is-loading" ? 'aria-busy="true"' : ""}>${c === "is-loading" ? `<span class="spin"></span>` : I(m === "Manual" ? "user" : "bot")}<span class="po-t"><b>${m}${c === "is-loading" ? " · saving…" : ""}</b><small>${d}</small></span>${I("check", "i ck")}</button>`;
  const rm = `<section class="sgrp" aria-labelledby="rm-h"><div class="sg-h"><h3 id="rm-h">Review mode</h3><span class="sg-d">Who reviews the steps of a new task</span></div>
    <div class="rmopts" role="radiogroup" aria-labelledby="rm-h">${opt("Agent", "An agent reviews each step with the implementer; clean steps are committed.", !saving)}${opt("Manual", "You review each step in VS Code, stage the files and approve.", saving, saving ? "is-loading" : "")}</div></section>`;
  let changed = 0;
  // A group of one stage has no heading: the row says it.
  const rows = DEFAULTS.map((g) => `<div class="mgrp" role="group" aria-label="${g.grp}">${g.rows.length > 1 ? `<div class="mgrp-h">${g.grp}</div>` : ""}${g.rows.map(([n, f, c, hint]) => {
    const own = f !== c; if (own) changed++;
    const open = VAR === "list" && n === "Plan" || failed && n === "PRD";
    let chip = `<button class="chip sm ${own ? "own" : ""}" aria-haspopup="menu" aria-expanded="${open}" aria-label="${n}: ${c}${own ? `, changed from the factory default ${f}` : ", the factory default"}" data-tip="${own ? `Factory default: ${f}` : "The factory default"}">${c}${I("down")}</button>`;
    let under = "";
    // Reading the catalog: the saved choice stays in view, with the shimmer of a reading; only the menu waits.
    if (reading) chip = `<button class="chip sm ${own ? "own" : ""} is-reading" aria-haspopup="menu" aria-busy="true" aria-label="${n}: ${c}, reading the models of Claude Code" data-tip="Reading the models of Claude Code · the menu opens when it ends"><span class="rd">${c}</span>${I("down")}</button>`;
    if (saving && n === "Plan") chip = `<button class="chip sm own is-loading" aria-busy="true"><span class="spin"></span>Saving…</button>`;
    if (saving && n === "Tech spec") under = `<div class="mrow-err" role="alert">Couldn't save Opus 5.5 (1M) · high: no space left on the disk of ~/.local/share/myspec. Free some space, then try again. <button class="btn ghost xs" data-tip="Save the choice again">Try again</button></div>`;
    if (saving && n === "Step review") chip = `<button class="chip sm own is-warn" aria-haspopup="menu" aria-label="Step review: Opus 4.1 · high, unavailable" data-tip="The installed Claude Code no longer lists Opus 4.1. A session still starts with it, and the CLI decides.">${st("warn")}Opus 4.1 · high<span class="un">· unavailable</span>${I("down")}</button>`;
    const pop = VAR === "list" && n === "Plan" ? modelList(n, c, f) : failed && n === "PRD" ? modelList(n, c, f, true) : "";
    return `<div class="mrow"><span class="mn">${n}${hint ? `<span class="mhint">${hint}</span>` : ""}</span><span class="mc">${chip}${pop}</span>${under}</div>`;
  }).join("")}</div>`).join("");
  const fail = failed ? `<div class="readfail sm">${st("warn")}<span class="lines"><span class="lbl">Claude Code was not found</span><span class="det">Install it or point MYSPEC_CLAUDE_PATH at the executable, then reopen MySpec. The choices below stay as they are.</span></span></div>` : "";
  const md = `<section class="sgrp" aria-labelledby="md-h"><div class="sg-h"><h3 id="md-h">Models</h3><span class="sg-d">${reading ? `<span class="rd">Reading the models of Claude Code…</span>` : `${changed} of 9 changed from the factory defaults`}</span></div>${fail}
    <div class="mtab">${rows}</div><p class="sfoot">A commit runs in the session of its step or of its pull request review, with that session's model and effort.</p></section>`;
  return pageHead("Defaults", "What a new task, review or discussion starts with. A change applies to what you create after it; nothing that runs changes.") + rm + md;
}

// ---------------- Boards ----------------
function boardRow(b) {
  const rs = reposOf(b.id).map((x) => x.r.split("/")[1]);
  const read = b.fail ? `<span class="rs is-failed" data-tip="${b.readTip}">${st("warn")}${b.read}</span>` : `<span class="rs" data-tip="${b.readTip}">${b.read}</span>`;
  const failLine = b.fail ? `<div class="srow-sub">${st("warn")}<span class="grow">${b.fail} The last reading stays in use.</span><button class="btn ghost xs">${I("refresh")}Try again</button></div>` : "";
  return `<li class="srow" aria-label="${b.title}, ${b.owner}, ${rs.length} repositories${b.fail ? ", the last reading failed" : ""}"><span class="si">${I("board")}</span>
    <div class="stx"><div class="s1"><span class="sn">${b.title}</span><a class="ghl" href="#" data-tip="Open the project on GitHub · ${b.url}">${b.owner}/projects/${b.url.split("/").pop()}${I("external")}</a></div>
      <div class="s2">${b.kind} · ${plural(rs.length, "repository", "repositories")}: ${rs.join(", ")}</div>
      <div class="s2">Final: ${b.final.join(", ")} · New cards: ${b.fresh}</div></div>
    <div class="sr-r">${read}<button class="btn sm" data-act="edit-board">Edit…</button><button class="btn ghost sm" data-act="remove-board">Remove…</button></div>${failLine}</li>`;
}
function boardsPage() {
  return pageHead("Boards", "The GitHub projects your tasks start from, each with the repositories it manages.", `<button class="btn sm" data-act="add-board">${I("plus")}Add board</button>`)
    + `<ul class="slist">${BOARDS.map(boardRow).join("")}</ul>`;
}
// The board dialog. Add has three steps (the project, the statuses, the repositories); Edit opens reading the
// board and has two (the statuses, the repositories); a board without a Status field skips the statuses, so its
// count drops by one. Back goes to the step before, in the same dialog. The consequence of an unchecked
// repository is said on its row, and summed up beside the confirmation.
const BSTEPS = {
  "add-1": { add: true, step: 1, of: 3 }, "add-1-reading": { add: true, step: 1, of: 3, reading: true }, "add-1-error": { add: true, step: 1, of: 3, error: true },
  "add-2": { add: true, step: 2, of: 3, kind: "status" }, "add-3": { add: true, step: 3, of: 3, kind: "repos" }, "add-nostatus": { add: true, step: 2, of: 2, kind: "repos", nostatus: true },
  "edit-reading": { add: false, step: 0, of: 2, reading: true }, "edit-1": { add: false, step: 1, of: 2, kind: "status" }, "edit-2": { add: false, step: 2, of: 2, kind: "repos" },
};
const BACK_OF = { "add-2": "add-1", "add-3": "add-2", "add-nostatus": "add-1", "edit-2": "edit-1" };
const NEXT_OF = { "add-1": "add-2", "add-2": "add-3", "edit-1": "edit-2" };
function repoLines(L) {
  return `<ul class="lrows">${L.map(([r, c, l, on, cons, off], k) => `<li class="lrow ${off ? "is-off" : ""} ${cons ? "has-cons" : ""}"><label class="lr-l" for="lr-${k}"><input type="checkbox" class="sr" id="lr-${k}" ${on ? "checked" : ""} ${off ? "disabled" : ""} ${cons ? `aria-describedby="lr-c-${k}"` : ""}>${cbx(on, off ? "off-limits" : "")}<span class="ln">${r}</span><span class="lc">${c}</span><span class="ll trunc">${l}</span></label>${cons ? `<div class="lcons" id="lr-c-${k}">${I("right")}${cons}</div>` : ""}</li>`).join("")}</ul>
    <div class="addrow"><span class="input mono"><label class="sr" for="lr-add">Add a repository</label><input id="lr-add" placeholder="owner/name"></span><button class="btn sm">Add</button></div>`;
}
function boardDialog() {
  const B = BSTEPS[VAR], add = B.add;
  const name = add ? (B.nostatus ? "Release Train · acme" : "Data Platform · acme") : "Platform Roadmap · acme";
  const sub = B.step === 0 ? "Platform Roadmap · acme" : B.step === 1 && add ? `Step 1 of ${B.of} · The project` : `${name} · Step ${B.step} of ${B.of} · ${B.kind === "status" ? "Statuses" : "Repositories"}`;
  let body = "", why = "", prim = "", err = false, cancelOnly = false;
  if (B.step === 0) {
    body = `<div class="scan" role="status"><span class="spin"></span><span>Reading the board…</span></div>`;
    cancelOnly = true;
  } else if (B.step === 1 && add) {
    const rd = !!B.reading, bad = !!B.error;
    body = `<div class="fld"><label class="lb" for="b-url">URL of the GitHub project</label><span class="input mono ${bad ? "is-error" : ""} ${rd ? "is-disabled" : ""}"><input id="b-url" value="https://github.com/orgs/acme/projects/15" ${rd ? "disabled" : ""} ${bad ? 'aria-invalid="true" aria-describedby="b-url-e"' : 'aria-describedby="b-url-h"'}></span>
      ${bad ? `<span class="help err" id="b-url-e">The board doesn't exist or this account can't read it. Check the number, or run gh auth refresh -s read:project.</span>` : `<span class="help" id="b-url-h">github.com/orgs/&lt;org&gt;/projects/&lt;n&gt; or github.com/users/&lt;user&gt;/projects/&lt;n&gt;. Views and filters in the URL are fine.</span>`}</div>`;
    why = rd ? "Reading the board…" : "";
    prim = rd ? pbtn("", { busy: "Reading…" }) : pbtn("Continue");
  } else if (B.kind === "status") {
    const opts = add ? [["Inbox", false], ["To do", false, true], ["Doing", false], ["Review", false], ["Done", true], ["Canceled", false]]
      : [["Inbox", false], ["Backlog", false], ["Ready", false], ["In progress", false], ["In review", false], ["QA", false, false, "new"], ["Blocked", false], ["Done", true], ["Won't do", true], ["Duplicate", true]];
    body = `<p class="dp">Mark the statuses that end the work on a card, and the status a card published by a discussion starts in.</p>
      ${add ? "" : note(`<b>The board changed since it was saved.</b> Archived is gone from its statuses, and QA is new, not marked.`, st("warn"))}
      <table class="stbl"><thead><tr><th scope="col">Status</th><th scope="col">Ends the work</th><th scope="col">New cards</th></tr></thead><tbody>
      ${opts.map(([n, fin, fresh, tag], k) => `<tr><th scope="row">${n}${tag ? ` <span class="dtag">new</span>` : ""}</th><td><label class="cbl" for="fin-${k}"><input type="checkbox" class="sr" id="fin-${k}" ${fin ? "checked" : ""}>${cbx(fin)}<span class="sr">${n} ends the work</span></label></td><td><label class="rbl" for="new-${k}"><input type="radio" name="fresh" class="sr" id="new-${k}" ${fresh ? "checked" : ""}><span class="rb ${fresh ? "on" : ""}" aria-hidden="true"></span><span class="sr">New cards start in ${n}</span></label></td></tr>`).join("")}
      <tr class="none"><th scope="row">No status</th><td></td><td><label class="rbl" for="new-none"><input type="radio" name="fresh" class="sr" id="new-none" ${add ? "" : "checked"}><span class="rb ${add ? "" : "on"}" aria-hidden="true"></span><span class="sr">New cards start without a status</span></label></td></tr></tbody></table>
      ${add ? `<p class="help">Done and To do are marked for you, from their names.</p>` : ""}`;
    prim = pbtn("Continue");
  } else if (add) {
    const L = B.nostatus ? [["acme/infra", "6 cards", "Registered · the clone at ~/code/infra is missing", true], ["acme/release-notes", "3 cards", "Registered without a clone", true]]
      : [["acme/data-pipelines", "38 cards", "Clone found · ~/code/data-pipelines", true], ["acme/warehouse", "21 cards", "Clone found · 2 clones", true], ["acme/dbt-models", "9 cards", "Registered without a clone", true], ["acme/api", "4 cards", "acme/api belongs to the board Platform Roadmap.", false, "", true]];
    body = `${B.nostatus ? note("This board has no Status field, so there are no statuses to mark: its cards end when their issues close.", st("warn")) : ""}<p class="dp">Check the repositories this board manages. They come from the issues on the board.</p>${repoLines(L)}
      ${B.nostatus ? "" : `<p class="help">acme/warehouse has two clones: ~/code/warehouse and ~/src/warehouse-old. The menu on its row picks one.</p>`}`;
    prim = pbtn("Add board");
  } else {
    const L = [["acme/api", "48 cards", "Registered · ~/code/api", true], ["acme/billing", "22 cards", "Registered · Not cloned", false, "Leaves MySpec: it has no clone, tasks or reviews."],
      ["acme/docs", "9 cards", "Registered · ~/code/docs", false, "Moves to No board: it has a clone. Nothing on disk changes."],
      ["acme/gateway", "17 cards", "Registered · ~/code/gateway", true], ["acme/sdk-js", "4 cards", "Registered · ~/src/sdk-js", true], ["acme/web", "31 cards", "Registered · ~/code/web", true],
      ["acme/marketing-site", "2 cards", "Clone found · ~/code/marketing-site", false], ["acme/ios", "1 card", "acme/ios belongs to the board Mobile App.", false, "", true]];
    body = `<p class="dp">Check the repositories this board manages. They come from the issues on the board.</p>${repoLines(L)}`;
    why = "acme/docs moves to No board, and acme/billing leaves MySpec.";
    prim = pbtn("Save");
  }
  const h = dialog({ kind: "wide", cls: "bdlg", title: add ? "Add board" : "Edit board", sub, body, back: !!BACK_OF[VAR], why, whyErr: err, primary: prim });
  return cancelOnly ? h : h;
}
function removeBoardDialog() {
  return dialog({ alert: true, title: "Remove Platform Roadmap?", body: `<p class="dp">5 repositories move to No board and 1 leaves MySpec. Tasks keep their cards, and nothing changes on GitHub or on disk.</p>
    <div class="ctxrow col"><span class="w"><b>To No board:</b> api, docs, gateway, sdk-js, web</span><span class="w"><b>Leaves MySpec:</b> billing, with no clone, tasks or reviews</span></div>`,
    primary: pbtn("Remove board", { danger: true }) });
}

// ---------------- Repositories: what needs a clone first, then the boards in alphabetical order ----------------
function cnt(x) { return [x.act ? `${x.act} active` : "", x.arch ? `${x.arch} archived` : "", x.rev ? plural(x.rev, "review") : ""].filter(Boolean).join(" · ") || "No tasks or reviews"; }
function repoRow(x, top = false) {
  const b = x.b ? boardOf(x.b).title : "No board";
  const path = x.path ? `<span class="mono">${x.path}</span>` : `<span class="faint">Not cloned</span>`;
  const line2 = top ? `${b} · ${path}` : path;
  let sub = "";
  if (!x.path) sub = `<div class="srow-sub">${st("warn")}<span class="grow">Its cards can't start a task until it's cloned.</span><button class="btn ghost xs">${I("clone")}Clone</button></div>`;
  if (x.missing) sub = `<div class="srow-sub">${st("warn")}<span class="grow">The clone is missing. Its task can't start a step or close until it has one.</span><button class="btn ghost xs" data-act="change-path">Change path…</button></div>`
    + (VAR === "change-path" ? `<div class="srow-sub err" role="alert"><span class="grow"><span class="mono">~/code/infra-old</span> is a clone of acme/terraform, not of acme/infra.</span></div>` : "");
  const instr = VAR === "instructions" && x.r === "acme/web" ? `<div class="instr"><div class="fld"><label class="lb" for="ri">Review instructions</label><textarea class="textarea" id="ri" rows="5">Every form uses react-hook-form with the zod schema next to it; flag a form that validates by hand.
Components under src/ui are shared: a change there needs a story in Storybook.
Ignore the generated files under src/api/gen.</textarea><span class="help">Added to every pull request review of acme/web, the reviews of task pull requests included. A change applies from the next pass.</span></div><div class="row end"><button class="btn ghost sm">Cancel</button><button class="btn sm primary">Save</button></div></div>` : "";
  const why = `${x.act ? `${plural(x.act, "active task")}, ` : ""}${plural(x.arch, "archived task")} and ${plural(x.rev, "review")}: delete them first`;
  const removable = !x.act && !x.arch && !x.rev;
  const menu = VAR === "menu" && x.r === "acme/web" ? `<div class="pop menu rmenu" role="menu" aria-label="acme/web"><button class="mi" role="menuitem">Change path…</button><button class="mi" role="menuitem">Review instructions…<span class="sub">None</span></button><div class="menu-sep" role="separator"></div>${removable ? `<button class="mi danger" role="menuitem">Remove…</button>` : `<button class="mi danger" role="menuitem" aria-disabled="true" aria-describedby="rm-why">Remove…</button><div class="menu-msg" id="rm-why">${why}.</div>`}</div>` : "";
  const set = x.r === "acme/web" && VAR === "instructions" ? ` · <span class="ri-set">Review instructions set</span>` : "";
  return `<li class="srow rrow ${VAR === "menu" && x.r === "acme/web" ? "is-open" : ""}"><span class="si">${I("repo")}</span><div class="stx"><div class="s1"><span class="sn">${x.r}</span></div><div class="s2">${line2}${set}</div></div>
    <span class="rc">${cnt(x)}</span><span class="rm-w"><button class="btn ghost sm icon" aria-label="More for ${x.r}" aria-haspopup="menu" aria-expanded="${!!menu}" data-tip="Change path, review instructions, remove">${I("more")}</button>${menu}</span>${sub}${instr}</li>`;
}
function reposPage() {
  const act = `<button class="btn sm" data-act="add-repo">${I("plus")}Add repository</button>`;
  if (VAR === "empty") return pageHead("Repositories", "The repositories your tasks belong to, each tied to its local clone.", act)
    + `<div class="sempty"><p class="t">No repositories yet</p><p class="s">Add a clone from this machine, or add a board: the repositories of its issues come with it.</p><div class="row"><a class="btn ghost sm" href="?scene=settings-boards">Go to Boards</a></div></div>`;
  const needs = REPOS14.filter((x) => !x.path || x.missing);
  const grp = (t, list, top = false, note2 = "") => list.length ? `<section class="rgrp ${top ? "needs" : ""}" aria-label="${t}"><div class="sgh">${t}<span class="cnt">${list.length}</span>${note2 ? `<span class="sgn">${note2}</span>` : ""}</div><ul class="slist">${list.map((x) => repoRow(x, top)).join("")}</ul></section>` : "";
  const rest = (list) => list.filter((x) => !needs.includes(x));
  return pageHead("Repositories", "The repositories your tasks belong to, each tied to its local clone.", act)
    + `<div class="rgroups">${grp("Needs a clone", needs, true, "Their cards can't start a task until they have one")}${BOARDS.map((b) => grp(b.title, rest(reposOf(b.id)))).join("")}${grp("No board", rest(REPOS14.filter((x) => !x.b)))}</div>`
    + `<section class="sgrp cf" aria-labelledby="cf-h"><div class="sg-h"><h3 id="cf-h">Clone folder</h3><span class="sg-d">Where Clone puts a repository that isn't on this machine</span></div>
      <div class="cfrow"><span class="faint grow">Not chosen · you're asked the first time you clone</span><button class="btn sm">Choose…</button></div></section>`;
}
function addRepoDialog() {
  const scanning = VAR === "add-scanning";
  const A = [["acme/billing", "~/src/billing", "Registered without a clone: this links the clone to it.", true], ["acme/marketing-site", "~/code/marketing-site", "", true], ["gmartins/dotfiles", "~/dotfiles", "", false], ["gmartins/myspec", "~/pessoal/myspec", "", false]];
  const R = [["acme/admin", "~/code/admin"], ["acme/api", "~/code/api"], ["acme/docs", "~/code/docs"], ["acme/gateway", "~/code/gateway"], ["acme/ios", "~/code/ios"], ["acme/sdk-js", "~/src/sdk-js"], ["acme/status-page", "~/code/status-page"], ["acme/tools", "~/code/tools"], ["acme/web", "~/code/web"]];
  const body = scanning ? `<div class="scan" role="status"><span class="spin"></span><span>Scanning your home folder…</span></div>`
    : `<span class="input srch wide"><label class="sr" for="ar-f">Filter by name or path</label>${I("search")}<input id="ar-f" placeholder="Filter by name or path"></span>
      <ul class="lrows scanl">${A.map(([r, p, n, on], k) => `<li class="lrow"><label class="lr-l" for="ar-${k}"><input type="checkbox" class="sr" id="ar-${k}" ${on ? "checked" : ""}>${cbx(on)}<span class="ln">${r}</span><span class="ll mono trunc">${p}</span></label>${n ? `<div class="lcons">${n}</div>` : ""}</li>`).join("")}</ul>
      <details class="regd"><summary>${I("right", "i chev")}Already registered <span class="cnt">${R.length}</span></summary><ul class="lrows scanl">${R.map(([r, p]) => `<li class="lrow is-off"><span class="lr-l">${cbx(false, "off-limits")}<span class="ln">${r}</span><span class="ll mono trunc">${p}</span></span></li>`).join("")}</ul></details>`;
  const why = scanning ? "Wait for the scan to end." : VAR === "add-refused" ? "~/Downloads/site is not the root of a git repository." : "";
  return dialog({ kind: "wide", cls: "ardlg", title: "Add repository", sub: "Pick the clones to register. The scan looks through your home folder, up to 6 folders deep.", body, back: false,
    why, whyErr: VAR === "add-refused", primary: scanning ? `<button class="btn primary" disabled aria-describedby="why-dlg">Add repository</button>` : pbtn("Add 2 repositories"),
    cancel: "Cancel" }).replace('<div class="dlg-ft">', `<div class="dlg-ft"><button class="btn ghost" data-tip="Pick a folder the scan didn't reach">${I("folder")}Browse…</button>`);
}
function removeRepoDialog() {
  return dialog({ alert: true, title: "Remove acme/docs?", body: `<p class="dp">The repository leaves MySpec and the board Platform Roadmap. Nothing is deleted on disk: the clone stays at <span class="mono">~/code/docs</span>.</p><p class="dp faint">A reading of the board suggests it again while its issues are there.</p>`, primary: pbtn("Remove repository", { danger: true }) });
}

// ---------------- Prompts: a list, then one prompt read, edited, reset ----------------
function promptsList() {
  return pageHead("Prompts", "The instructions each session starts with. A prompt you never edit follows the default of every new version of MySpec.")
    + `<ul class="slist plist2">${PROMPTS.map((p) => `<li><a class="srow prow" href="?scene=settings-prompts&v=view"><span class="si">${I("prompt")}</span><span class="stx"><span class="s1"><span class="sn">${p.n}</span></span><span class="s2">${p.d}</span></span><span class="pst">${p.edited ? `<span class="dtag on">Edited ${p.edited}</span>` : `<span class="faint">Default</span>`}</span>${I("right", "i chev")}</a></li>`).join("")}</ul>`;
}
const PRD_TEXT = [
  ["h", "# PRD of {{task_name}}"],
  ["p", "You write the product requirements of **{{task_name}}** with the user, one question at a time, and save them to {{prd_path}}. Everything the task produces lives in {{artifacts_dir}}."],
  ["h", "## Where you start"],
  ["p", "{{initial_context}}"],
  ["p", "The context above may already answer most of what you need: a card with its epic, its siblings and its dependencies, or a detailed description. Treat it as the main source of the what and the why. Don't ask what it already answers; ask only about the real gaps."],
  ["h", "## How you talk"],
  ["li", "One question per turn, with two to four options and the trade-off of each."],
  ["li", "Say what you understood before you write, and wait for the user's OK."],
  ["li", "Never propose the solution: the tech spec does that."],
  ["h", "## What the PRD has"],
  ["li", "Context, problem, goals and what is out of scope."],
  ["li", "The acceptance criteria, each one testable."],
];
function mdPrompt(lines, edited) {
  const ph = (s) => s.replace(/\{\{(\w+)\}\}/g, `<span class="phc" data-tip="Filled when the session starts">{{$1}}</span>`).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  let h = "", inl = false;
  lines.forEach(([k, t]) => {
    if (k === "li") { if (!inl) { h += "<ul>"; inl = true; } h += `<li>${ph(t)}</li>`; return; }
    if (inl) { h += "</ul>"; inl = false; }
    h += k === "h" ? `<h4>${ph(t.replace(/^#+ /, ""))}</h4>` : `<p>${ph(t)}</p>`;
  });
  if (inl) h += "</ul>";
  if (edited) h += `<h4>Tone</h4><ul><li>Write in the language of the card.</li><li>Keep each acceptance criterion to one line.</li></ul>`;
  return h;
}
function promptView() {
  const p = PROMPTS[0];
  const top = `<a class="btn ghost xs backl" href="?scene=settings-prompts">${I("left")}Prompts</a>`;
  const acts = `<button class="btn sm" data-act="edit-prompt">Edit</button><button class="btn ghost sm" data-act="reset-prompt">Reset to default…</button>`;
  return top + pageHead(`${p.n} <span class="dtag on">Edited ${p.edited}</span>`, `${p.d} Your version has 92 lines; the default of this version has ${p.lines}.`, acts)
    + `<div class="pdoc prose">${mdPrompt(PRD_TEXT, true)}</div><p class="sfoot">MySpec fills the placeholders when a session starts. A session that is running keeps the prompt it started with.</p>`;
}
function promptEdit() {
  const p = PROMPTS[0];
  const text = PRD_TEXT.map(([k, t]) => (k === "li" ? "- " : "") + t).join("\n\n").replace(/\n\n- /g, "\n- ") + "\n\n## Tone\n\n- Write in the language of the card.\n- Keep each acceptance criterion to one line.";
  const phs = p.ph.map((x) => `<li><span class="phc">{{${x}}}</span><span class="pw">${(PH_WHAT[x] || ["", ""])[0]}</span>${(PH_WHAT[x] || ["", ""])[1] ? `<span class="pwo">${PH_WHAT[x][1]}</span>` : ""}</li>`).join("");
  return `<a class="btn ghost xs backl" href="?scene=settings-prompts&v=view">${I("left")}${p.n}</a>` + pageHead(`Editing the ${p.n} prompt`, "Markdown. The placeholders are filled when a session starts.")
    + `<div class="pedit"><label class="sr" for="pe">The ${p.n} prompt</label><textarea class="textarea mono" id="pe" rows="24" spellcheck="false">${esc(text)}</textarea>
      <aside class="phs" aria-labelledby="ph-h"><h3 id="ph-h">Placeholders</h3><p>The ones the default uses. Move or remove any of them.</p><ul>${phs}</ul></aside></div>
      <div class="pbar"><span class="why">Unsaved changes</span><button class="btn ghost sm" data-act="discard-prompt">Cancel</button><button class="btn sm primary">Save <span class="k">Ctrl S</span></button></div>`;
}
function resetDialog() {
  return dialog({ alert: true, title: "Reset the PRD prompt to the default?", body: `<p class="dp">Your edits are replaced by the default of this version, and the prompt follows the default of new versions again.</p><p class="dp faint">A session that is running keeps the prompt it started with.</p>`, primary: pbtn("Reset prompt", { danger: true }) });
}
function discardDialog() {
  return dialog({ alert: true, title: "Discard your changes?", body: `<p class="dp">The edits to the PRD prompt haven't been saved.</p>`, cancel: "Keep editing", primary: pbtn("Discard", { danger: true }) });
}

function settingsScene() {
  if (SCN === "settings-defaults") return settingsMain(defaultsPage());
  if (SCN === "settings-boards") return settingsMain(boardsPage(), VAR === "remove" ? removeBoardDialog() : VAR ? boardDialog() : "");
  if (SCN === "settings-repos") return settingsMain(reposPage(), VAR.startsWith("add") ? addRepoDialog() : VAR === "remove" ? removeRepoDialog() : "");
  return settingsMain(VAR === "" ? promptsList() : VAR === "edit" || VAR === "discard" ? promptEdit() : promptView(), VAR === "reset" ? resetDialog() : VAR === "discard" ? discardDialog() : "");
}
