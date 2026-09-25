/* =====================================================================
   ROUND 14 · the rest: starting, welcome, migration, the app notice and
   the toasts, the page of an item that left, the task's dialogs, the
   pause, and the notifications as a table.
   ===================================================================== */

// ---------------- Starting: the sidebar in skeleton, the steps named while they run ----------------
function startingMain() {
  if (VAR === "failed") return `<main class="main" id="main"><div class="homew"><div class="home boot"><section class="bt" role="alert"><span class="bt-ic">${st("error", "Error")}</span><h2 class="bt-t">MySpec couldn't start</h2>
    <p class="bt-s">MySpec can't open its data. Nothing was changed: your tasks, documents and worktrees are as they were. Give your user back the folder <span class="mono">~/.local/share/myspec</span>, then try again.</p>
    <div class="code"><div class="ch">${I("code")}<span>error</span><span class="grow"></span><button class="btn ghost xs icon" data-tip="Copy the error" aria-label="Copy the error">${I("copy")}</button></div><pre>open ~/.local/share/myspec/myspec.db: permission denied
the folder belongs to root (drwx------ root root)</pre></div>
    <div class="row"><button class="btn primary">Try again <span class="k">Enter</span></button></div></section></div></div></main>`;
  const slow = VAR === "slow";
  const step = (s, t, d) => `<li class="${s}"><span class="c">${s === "done" ? I("check") : s === "run" ? st("run") : st("todo")}</span><span class="w">${t}</span><span class="d">${d || ""}</span></li>`;
  return `<main class="main" id="main"><div class="homew"><div class="home boot"><section class="bt" role="status" aria-live="polite"><span class="brand"><span class="mark">${I("mark", "")}</span></span><h2 class="bt-t">Starting MySpec…</h2>
    <ol class="bsteps">${step("done", "Opening your data", "")}${step("run", "Checking the clones of 12 repositories", slow ? "12s · ~/code/infra doesn't answer" : "")}</ol></section></div></div></main>`;
}

// ---------------- Welcome: nothing registered yet ----------------
function welcomeMain() {
  // This machine appears only when something is missing: a first run that works shows nothing to check.
  const chk = (t, d, cmd) => `<li class="warn"><span class="c">${st("warn")}</span><span class="w">${t}<span class="d">${d}</span>${cmd ? `<span class="cmdl"><code class="phc">${cmd}</code><button class="btn ghost xs icon" aria-label="Copy ${cmd}" data-tip="Copy the command">${I("copy")}</button></span>` : ""}</span></li>`;
  const miss = { "no-login": chk("The GitHub CLI isn't signed in", "Sign in from a terminal, then add a board. Adding a repository works without it.", "gh auth login"),
    "no-gh": chk("The GitHub CLI isn't installed", "MySpec reads boards and pull requests through it. Install it and sign in, then add a board.", "gh auth login"),
    "no-claude": chk("Claude Code was not found", "Every task, review and discussion runs in it. Install it, or point MYSPEC_CLAUDE_PATH at the executable, then reopen MySpec. You can register boards and repositories meanwhile.", "") }[VAR];
  return `<main class="main" id="main"><div class="homew"><div class="home wel"><section class="wl-h"><span class="brand"><span class="mark">${I("mark", "")}</span></span><h2>Welcome to MySpec</h2>
      <p>MySpec runs Claude Code through a task, from the card on your GitHub board to the merged pull request. Register where your work lives to start.</p></section>
    ${miss ? `<section aria-labelledby="w-c"><h2 id="w-c">This machine</h2><ul class="wchk">${miss}</ul></section>` : ""}
    <section aria-labelledby="w-s"><h2 id="w-s">Start</h2><ul class="hl">
      <li><button class="hr wr" id="w-board">${I("board")}<span class="tx"><span class="l">Add board</span><span class="s">A GitHub project. Its cards start tasks, and the repositories of its issues come with it.</span></span><span class="r">${I("right")}</span></button></li>
      <li><button class="hr wr">${I("repo")}<span class="tx"><span class="l">Add repository</span><span class="s">A clone on this machine, for tasks without a board.</span></span><span class="r">${I("right")}</span></button></li></ul></section></div></div></main>`;
}

// ---------------- Migration refused: the whole window, the cases by kind ----------------
function migrationMain() {
  const kase = (t, what, rows) => `<section class="mcase"><h3>${t}</h3><p>${what}</p><ul>${rows.map(([where, det, tasks]) => `<li><div class="mw mono">${where}</div>${det ? `<div class="md">${det}</div>` : ""}<ul class="mt">${tasks.map((x) => `<li><span class="mono">${x[0]}</span><span class="faint"> · ${x[1]}</span></li>`).join("")}</ul></li>`).join("")}</ul></section>`;
  return `<div class="mig" role="main"><div class="mig-in"><span class="brand"><span class="mark">${I("mark", "")}</span>MySpec</span><h1>MySpec couldn't be updated</h1>
    <p class="lead">This version keeps every task in a registered repository, one repository per task. Some of your tasks can't be carried over, so nothing was changed: your tasks, documents and worktrees are as they were, and the previous version still opens them.</p>
    ${kase("Tasks at the root of a workspace", "Close or delete these tasks in the previous version of MySpec.", [["~/work", "", [["billing-export", "Implementation, step 2 of 5"], ["fix-ci-cache", "PRD"]]]])}
    ${kase("Repositories without an origin on GitHub", "Add a GitHub origin to the repository, or delete its tasks, in the previous version of MySpec.", [["~/work/legacy-portal", "The origin remote is not on GitHub: git@gitlab.com:acme/legacy-portal.git", [["portal-sso", "Tech spec"]]]])}
    ${kase("Tasks with the same name in the same repository", "Delete one of the tasks in the previous version of MySpec.", [["acme/api", "", [["rate-limit", "~/work/api"], ["rate-limit", "~/code/api"]]]])}
    <p class="foot">Once they're resolved, open this version again and the update runs again.</p><div class="row"><button class="btn sm">${I("copy")}Copy the list</button></div></div></div>`;
}

// ---------------- The app notice at the top of the main area, and the toasts ----------------
function noticeMain() {
  if (VAR === "toast") return taskMain() + "";
  const n = `<div class="appnotice" role="alert"><span class="lbl">Couldn't pause Rate limit per API key</span><span class="det">The reviewer's session didn't stop in 10 seconds, so it keeps running. Try Pause again, or Stop its answer from the Reviewer tab.</span><button class="btn ghost sm" data-tip="Dismiss the notice">Dismiss</button></div>`;
  return taskMain({ notice: n });
}
function toasts() {
  if (!(SCN === "notice" && VAR === "toast")) return "";
  return toast14("archive", "“Idempotency keys for payment intents” was archived", "Closed at 15:02 · dev not updated: another branch is checked out", `<button class="btn ghost xs">Open in History</button>`)
    + toast14("merge", "web#2288 was merged, and its review ended", "Pass 2 was published at 13:10", `<button class="btn ghost xs">Open in History</button>`);
}

// ---------------- The page of an item that left while open ----------------
function goneMain(force) {
  const v = force || VAR || "closed";
  if (v === "nothing") return goneMain("closed").replace(/<button class="btn primary" id="gone-next"[^]*?<\/button>/, `<button class="btn" id="gone-next" disabled aria-describedby="why-next">Next that needs you</button><span class="why" id="why-next">Nothing else needs you now.</span>`).replace('<a class="btn" href="?scene=history&v=fresh">', '<a class="btn primary" href="?scene=history&v=fresh">');
  const pg = (icon, title, p, res, acts, back) => `<main class="main" id="main">${placeHead(title.split(" was ")[0].replace(/<[^>]+>/g, ""), "", back)}<div class="leftw"><div class="left" role="status"><div class="hd"><span class="ic">${I(icon)}</span><h2>${title}</h2><p>${p}</p></div>${res}<div class="acts2">${acts}</div></div></div></main>`;
  const next = `<button class="btn primary" id="gone-next" data-tip="Widget for today's tasks · Ctrl+J">Next that needs you <span class="k">Ctrl J</span></button>`;
  if (v === "closed") return pg("archive", "Idempotency keys for payment intents was closed and archived", "PR #1279 was merged into dev at 14:51. MySpec closed the task at 15:02; its documents, steps and reports are in History.",
    closeResult(CLOSE_398, "15:02"), `${next}<a class="btn" href="?scene=history&v=fresh">Open in History</a><button class="btn ghost">Back to Platform Roadmap</button>`, "Platform Roadmap");
  if (v === "deleted") return pg("trash", "Idempotency keys for payment intents was deleted", "The documents, the steps and every record of the task are gone. PR #1279 stays open on GitHub.",
    `<div class="cres" role="group" aria-label="What stayed on disk"><div class="cres-h">Git couldn't remove everything</div><ul>
      <li class="fail"><span class="c">${st("error")}</span><span class="w">The worktree stayed at <span class="mono">~/.local/share/myspec/worktrees/acme/api/idempotency-keys</span><span class="d">fatal: '…/idempotency-keys' contains modified or untracked files, use --force to delete it</span></span></li>
      <li class="done"><span class="c">${I("check")}</span><span class="w">Branch idempotency-keys deleted</span></li></ul></div>
    <p class="dp warnl">${st("warn")}<span><b>--force deletes the modified and untracked files in it too.</b> Copy out what you want to keep first.</span></p><div class="code"><div class="ch">${I("code")}<span>To remove it yourself, in ~/code/api</span><span class="grow"></span><button class="btn ghost xs icon" data-tip="Copy the command" aria-label="Copy the command">${I("copy")}</button></div><pre>git worktree remove --force ~/.local/share/myspec/worktrees/acme/api/idempotency-keys</pre></div>`,
    `${next}<button class="btn ghost">Back to Platform Roadmap</button>`, "Platform Roadmap");
  if (v === "review") return pg("merge", "web#2291 was merged, and its review ended", "rsouza merged it into dev at 16:20. MySpec stopped the session and removed the worktree. The reports and the verdicts are in History; the conversation isn't kept.",
    `<div class="res" aria-label="What was published"><ul><li><span class="p">Pass 1</span><span>Request changes · 2 inline comments, 1 in the body</span><span class="t">13:41</span></li><li><span class="p">Pass 2</span><span>Approve · the 2 findings fixed</span><span class="t">15:48</span></li></ul></div>`,
    `${next}<a class="btn" href="?scene=archived-review">Open in History</a><button class="btn ghost">Back to Reviews</button>`, "Reviews");
  return pg("archive", "Webhook delivery guarantees was archived", "The conversation ended at 11:47. The document, the drafts and what was published are in History; a task started from these cards gets the document in its context.",
    `<div class="res" aria-label="What was published"><ul><li><span class="p">Round 1</span><span>3 created, 1 updated · api#452 and 2 of its cards, gateway#440</span><span class="t">11:40</span></li></ul></div>`,
    `${next}<a class="btn" href="?scene=archived-discussion">Open in History</a><button class="btn ghost">Open Platform Roadmap</button>`, "Platform Roadmap");
}

// ---------------- The task's dialogs: delete, discard step, back to a stage ----------------
function deleteTaskDialog() {
  const v = VAR, loading = v === "loading", failed = v === "failed", merged = v === "merged", busy = v === "deleting";
  const item = (icon, h, d, tag = "") => `<li><span class="c">${icon}</span><span class="w">${h}${tag}${d ? `<span class="d">${d}</span>` : ""}</span></li>`;
  let pv;
  if (loading) pv = `<div class="dprev-rd" role="status"><span class="rd">Reading the worktree and the branch…</span></div><ul class="dprev is-loading" aria-hidden="true"><li class="skel"><i></i></li><li class="skel"><i></i></li><li class="skel"><i></i></li></ul>`;
  else pv = `<ul class="dprev" aria-label="What will be destroyed">${item(st("run"), "The reviewer's answer in progress is interrupted", "")}
    ${failed ? item(st("warn"), "Couldn't read the worktree", "git status failed: not a git repository. Deleting still removes it.")
      : item(I("folder"), "The worktree is removed", `<span class="mono">~/.local/share/myspec/worktrees/acme/api/rate-limit-per-api-key</span>`, `<span class="dtag">3 uncommitted files</span>`)}
    ${item(I("branch"), `The branch <span class="mono">rate-limit-per-api-key</span> is deleted`, "", merged ? "" : `<span class="dtag">not merged · 9 commits</span>`)}
    ${merged ? item(I("merge"), `PR #1284 is merged`, "Nothing changes on GitHub.") : item(I("pr"), `PR #1284 stays open on GitHub`, `Close it there if you don't need it. <a href="#">Open #1284${I("external")}</a>`)}</ul>`;
  return dialog({ alert: true, title: "Delete “Rate limit per API key”?", busy,
    body: `<p class="dp">This removes the documents, the steps and every record of the task. It can't be undone.</p>${pv}`,
    why: "", primary: busy ? pbtn("", { busy: "Deleting…", danger: true }) : pbtn("Delete task", { danger: true }) });
}
function discardStepDialog() {
  const clean = VAR !== "keep";
  return dialog({ alert: true, title: "Discard step 3 and start over?",
    body: `<p class="dp">This ends the sessions and deletes the conversations of step 3 and of its reviewer, with the 2 reports of the agent review. The step starts again from scratch right away.</p>
      <label class="cbl opt2" for="clean"><input type="checkbox" class="sr" id="clean" ${clean ? "checked" : ""} aria-describedby="clean-d">${cbx(clean)}<span class="tx"><b>Also clean the worktree</b><span id="clean-d">${clean ? "Discards the 3 uncommitted files in the worktree." : "The 3 uncommitted files stay, and the step starts blocked until the worktree is clean."}</span></span></label>`,
    primary: pbtn("Discard step", { danger: true }) });
}
function backDialog() {
  const v = VAR;
  const L = v === "pr" ? ["the tech spec conversation and document", "the plan conversation and the 7 step files", "the conversations of the 7 steps and their 9 review reports", "the pull request draft, the PR conversation and the reports of its review", "the worktree and the branch rate-limit-per-api-key, with 3 uncommitted files"]
    : v === "discard" ? ["the plan conversation and the 7 step files", "the conversations of steps 1 to 3 and their 4 review reports", "the worktree and the branch rate-limit-per-api-key, with 3 uncommitted files"]
      : ["the plan conversation and the 7 step files", "the conversations of steps 1 to 3 and their 4 review reports", "the worktree and the branch rate-limit-per-api-key, with 3 uncommitted files"];
  const title = v === "pr" ? "Back to the PRD?" : v === "discard" ? "Discard the Plan and start over?" : "Back to the Tech spec?";
  const stays = v === "pr" ? "The PRD stays, and the tech spec starts again from scratch when you continue." : v === "discard" ? "A new plan session starts right away, from the tech spec." : "The Tech spec stays, and the plan starts again from scratch when you continue.";
  const pr = v === "pr" ? `<div class="stale" role="note">${I("pr")}<span class="l"><b>PR #1284 stays open on GitHub.</b> Close it there if you don't need it.</span></div>` : "";
  const run = v === "pr" ? "The PR reviewer's answer in progress is interrupted." : "The reviewer's answer in progress is interrupted.";
  return dialog({ alert: true, title, body: `<p class="dp">This deletes:</p><ul class="dlist">${L.map((x) => `<li>${x}</li>`).join("")}</ul>${pr}<p class="dp">${stays}</p><p class="dp faint">${run}</p>`,
    primary: pbtn(v === "pr" ? "Back to the PRD" : v === "discard" ? "Discard the Plan" : "Back to the Tech spec", { danger: true }) });
}

// ---------------- Paused ----------------
function pauseMain() {
  if (VAR === "pausing") return taskMain({ pausing: true });
  if (VAR === "blocked") return taskMain({ error: true, pauseOff: true, g: "error", short: "error", word: "The reviewer's session stopped", bar: true });
  return taskMain({ paused: true, g: "paused", short: "paused", word: "Paused since 14:52" });
}

// ---------------- Notifications: the text of each situation as the system shows it, and what the click opens ----------------
// The whole catalog of rest.md §5.4. place: the text of a session's situation names its place (PRD, tech spec, plan,
// One-Shot planning, step N, the pull request, the review, the discussion); a row per place where the click differs.
const NOTI = [
  ["Task", "Question", "The agent has a question in the tech spec.", "The tech spec, the focus on the first option of the card", ""],
  ["Task", "Question · PR", "The agent has a question in the pull request.", "The PR, the focus on the first option of the card", ""],
  ["Task", "Permission", "Permission requested in step 3.", "Step 3, the Implementer tab, the focus on Allow", ""],
  ["Task", "Permission · PR review", "Permission requested in the review.", "The PR review, the focus on Allow", ""],
  ["Task", "Waiting for reply", "The agent is waiting for your reply in the PRD.", "The PRD, the focus in the composer", ""],
  ["Task", "Session error", "The session stopped with an error in step 3.", "Step 3, the focus on Retry", ""],
  ["Task", "Session error · PR", "The session stopped with an error in the pull request.", "The PR, the focus on Retry", ""],
  ["Task", "Reviewer asks", "The reviewer of step 3 has a question.", "Step 3, the Reviewer tab, the first option", ""],
  ["Task", "Reviewer permission", "The reviewer of step 3 asks for a permission.", "Step 3, the Reviewer tab, the focus on Allow", ""],
  ["Task", "Reviewer without report", "The reviewer of step 3 stopped without writing its report.", "Step 3, the Reviewer tab, the focus on Retry reviewer", ""],
  ["Task", "Reviewer error", "The review of step 3 stopped with an error.", "Step 3, the Reviewer tab, the focus on Retry reviewer", ""],
  ["Task", "Plan invalid", "The plan is still invalid after 3 automatic corrections.", "The plan, at the product's message with the problems; the fix goes through the composer", "changed"],
  ["Task", "Ready to continue", "The tech spec is revised and ready to continue.", "The tech spec, the focus on Continue", ""],
  ["Task", "Ready to continue · One-Shot", "The One-Shot document is revised and ready to continue.", "Planning, the focus on Continue", ""],
  ["Task", "Step blocked", "Step 5 can't start: the worktree has uncommitted changes.", "Step 5, the focus on Try again", ""],
  ["Task", "Worktree unreadable", "Step 3: the worktree can't be read.", "Step 3, the error in the bar; it clears by itself", ""],
  ["Task", "Step to review", "Step 4 is ready for your review. 7 files changed.", "Step 4, the focus on Open in VS Code", "changed"],
  ["Task", "No commit after approval", "Step 4: the last approval didn't produce a commit.", "Step 4, the focus on Open in VS Code", ""],
  ["Task", "Agent review gave up", "Step 3: the agent review didn't come clean after 3 rounds. It's yours now.", "Step 3, the Implementer tab, the last report", "changed"],
  ["Task", "Step empty", "Step 6 finished without changes.", "Step 6, the focus on Discard step 6…", ""],
  ["Task", "PR blocked", "The pull request is blocked: the branch has no commits ahead of dev.", "The PR, the focus on Try again", ""],
  ["Task", "Draft", "The pull request draft is ready for your OK.", "The PR, the draft in the conversation, the focus on Approve draft", ""],
  ["Task", "Findings", "The review of the pull request found 4 changes for you to decide.", "The PR review, the first finding to decide", "changed"],
  ["Task", "Changes to review", "The changes from the review of the pull request are ready for your review.", "The PR review, the focus on Open in VS Code", ""],
  ["Task", "No commit after approval · PR", "The last approval of the pull request didn't produce a commit.", "The PR review, the focus on Open in VS Code", ""],
  ["Task", "Check failed after review", "A check failed after the review: e2e (chromium).", "The PR review, the check by name, the focus on Review again", ""],
  ["Task", "Checks failed after review", "Checks failed after the review: e2e (chromium), lint.", "The PR review, the checks by name, the focus on Review again", ""],
  ["Task", "Conflict after review", "The pull request has a conflict with dev.", "The PR review, the focus on Review again", ""],
  ["Task", "Ready to merge", "PR #1284 is ready to merge.", "The PR, the focus on Open PR", "changed"],
  ["Task", "Ready to close", "PR #1284 was merged. The task is ready to close.", "The PR, the focus on Close task", "changed"],
  ["Task", "PR closed", "PR #1284 was closed without a merge.", "The PR, the focus on Delete task…", ""],
  ["Review", "Question", "The agent has a question in the review.", "The review, the focus on the first option", ""],
  ["Review", "Permission", "Permission requested in the review.", "The review, the focus on Allow", ""],
  ["Review", "Session error", "The session stopped with an error in the review.", "The review, the focus on Retry", ""],
  ["Review", "No readable report", "The reviewer stopped without a report the app can read.", "The review, the focus in the composer to ask for it again", ""],
  ["Review", "Findings", "The review has 5 findings for you to decide.", "The review, the first finding to decide", "changed"],
  ["Review", "Ready to publish", "The review is ready to publish.", "The review, the focus on Publish review…", ""],
  ["Review", "Publish failed", "The review couldn't be published: GitHub's rate limit was reached.", "The review, the focus on Retry", "changed"],
  ["Review", "Pass blocked", "The next pass of the review couldn't start: the clone is missing.", "The review, the way out in the bar", "changed"],
  ["Review", "New commits", "2 commits arrived since your review.", "The review, the focus on Review again", "changed"],
  ["Review", "Check failed after publishing", "A check failed after the review: e2e (chromium).", "The review, the check by name, the focus on Review again", ""],
  ["Review", "Conflict after publishing", "The pull request has a conflict with dev.", "The review, the focus on Review again", ""],
  ["Review", "Apply · ready to apply", "The approved findings are ready to apply.", "The review, the focus on Apply approved", ""],
  ["Review", "Apply · changes to review", "The changes from the review are ready for your review.", "The review, the focus on Open in VS Code", ""],
  ["Review", "Apply · ready to merge", "The pull request is ready to merge.", "The review, the focus on Open PR", ""],
  ["Discussion", "Question", "The agent has a question in the discussion.", "The discussion, the focus on the first option", ""],
  ["Discussion", "Permission", "Permission requested in the discussion.", "The discussion, the focus on Allow", ""],
  ["Discussion", "Waiting for reply", "The agent is waiting for your reply in the discussion.", "The discussion, the focus in the composer", ""],
  ["Discussion", "Session error", "The session stopped with an error in the discussion.", "The discussion, the focus on Retry", ""],
  ["Discussion", "Drafts can't be read", "The agent wrote drafts the app can't read in the discussion.", "The discussion, the marker with the line that fails", ""],
  ["Discussion", "Decide drafts", "There are 5 drafts to decide in the discussion.", "The discussion, the first draft to decide", "changed"],
  ["Discussion", "Epic can't publish", "The epic can't publish: approve one more of its cards, or discard it.", "The discussion, the epic open", "new"],
  ["Discussion", "Epic discarded", "The epic is discarded, and 2 of its approved cards won't publish.", "The discussion, the epic open", "new"],
  ["Discussion", "Publish failed", "Couldn't publish “Overage on the monthly invoice”: GitHub's rate limit was reached.", "The discussion, the draft with Retry", "changed"],
  ["Discussion", "Ready to archive", "Every draft is published or discarded. The discussion is ready to archive.", "The discussion, the focus on Archive…", "new"],
];
function notificationsMain() {
  const tag = (t) => t ? `<span class="dtag ${t === "new" ? "on" : ""}">${t}</span>` : "";
  const ttl = { Task: "Rate limit per API key", Review: "acme/web#2291 · Migrate settings page…", Discussion: "Usage-based pricing tiers" };
  const sect = (it) => it === "Review" ? `<tr class="nsec"><th colspan="3" scope="colgroup">Review of a pull request <span class="dtag">changed</span> <span class="faint">the title adds the pull request's title to owner/name#N</span></th></tr>` : `<tr class="nsec"><th colspan="3" scope="colgroup">${it === "Task" ? "Task" : "Discussion"}</th></tr>`;
  return `<main class="main" id="main">${placeHead("Notifications", "", "Rate limit per API key")}<div class="aw"><div class="ain wide">
    <p class="lead2">A notification appears only while the MySpec window isn't focused, once per situation, when it starts. The title is the item; the body is what it asks, always with the place. With the chime of MySpec, unless another notification played less than 2 seconds before. It leaves the screen when its situation ends. Clicking brings the window forward and opens the place, as Ctrl+J does. With a prompt edit not saved, <b>Discard your changes?</b> comes first.</p>
    <div class="ntw"><table class="ntbl"><caption class="sr">The notification of each situation</caption><thead><tr><th scope="col">Situation</th><th scope="col">Title · body</th><th scope="col">The click opens</th></tr></thead><tbody>
    ${NOTI.map(([it, s, b, click, t], k) => `${k === 0 || NOTI[k - 1][0] !== it ? sect(it) : ""}<tr><td>${s}</td><td><div class="nt"><span class="ntt">${ttl[it]}</span><span class="ntb">${b}</span></div>${tag(t)}</td><td class="cl">${click}</td></tr>`).join("")}</tbody></table></div>
    <p class="sfoot">${NOTI.length} texts. A session's question, permission, reply and error use one text per kind, with the place in it (PRD, tech spec, plan, One-Shot planning, step N, the pull request, the review, the discussion); the table has a row where the click lands somewhere else. changed: the body today leaves out the count, the name or the way out. new: a situation decided in the discussion round, without a body today. The rest is today's text.</p></div></div></main>`;
}
