/* =====================================================================
   ROUND 14 · the data of the scenes. The acme world of rounds 09 to 13,
   with the volume of the real database (design/research/rest.md §7):
   3 boards, 12 repositories, 9 prompts, 9 model defaults with 6 changed,
   44 archived items in 12 days.
   ===================================================================== */
const SPRITE_14 = `<svg class="sprite" aria-hidden="true">
  <symbol id="i-info" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.5"/><path d="M8 7.3v3.4M8 5.3h.01"/></symbol>
  <symbol id="i-card" viewBox="0 0 16 16"><rect x="2.5" y="3.5" width="11" height="9" rx="1.5"/><path d="M5 6.5h6M5 9.5h3.5"/></symbol>
  <symbol id="i-search" viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.2"/><path d="M10.2 10.2 13.5 13.5"/></symbol>
  <symbol id="i-refresh" viewBox="0 0 16 16"><path d="M13 8a5 5 0 1 1-1.5-3.6"/><path d="M13 3v3h-3"/></symbol>
  <symbol id="i-folder" viewBox="0 0 16 16"><path d="M2.5 4.5v8h11V6H8L6.5 4.5z"/></symbol>
  <symbol id="i-board" viewBox="0 0 16 16"><rect x="2.5" y="3" width="3" height="10" rx="1"/><rect x="6.5" y="3" width="3" height="7" rx="1"/><rect x="10.5" y="3" width="3" height="5" rx="1"/></symbol>
  <symbol id="i-clone" viewBox="0 0 16 16"><path d="M8 2.5v7M5 6.5l3 3 3-3"/><path d="M3 11v2.5h10V11"/></symbol>
  <symbol id="i-epic" viewBox="0 0 16 16"><rect x="2.5" y="2.5" width="11" height="3" rx="1"/><rect x="2.5" y="6.5" width="11" height="3" rx="1"/><rect x="2.5" y="10.5" width="7" height="3" rx="1"/></symbol>
  <symbol id="i-trash" viewBox="0 0 16 16"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5"/></symbol>
  <symbol id="i-sliders" viewBox="0 0 16 16"><path d="M3 4.5h6M12 4.5h1M3 11.5h1M7 11.5h6"/><circle cx="10.5" cy="4.5" r="1.5"/><circle cx="5.5" cy="11.5" r="1.5"/></symbol>
  <symbol id="i-repo" viewBox="0 0 16 16"><path d="M4 12.5V3.5A1 1 0 0 1 5 2.5h7.5v8H5a1 1 0 0 0-1 1v0a1 1 0 0 0 1 1h7.5"/></symbol>
  <symbol id="i-prompt" viewBox="0 0 16 16"><path d="M4 2.5h5l3 3v8H4z"/><path d="M6 8.5l1.5 1.2L6 11M8.5 11H10"/></symbol>
  <symbol id="i-sun" viewBox="0 0 16 16"><circle cx="8" cy="8" r="2.6"/><path d="M8 2v1.4M8 12.6V14M2 8h1.4M12.6 8H14M3.8 3.8l1 1M11.2 11.2l1 1M3.8 12.2l1-1M11.2 4.8l1-1"/></symbol>
  <symbol id="i-bell" viewBox="0 0 16 16"><path d="M4.5 11V7.5a3.5 3.5 0 0 1 7 0V11l1 1.5h-9z"/><path d="M6.8 13.8a1.3 1.3 0 0 0 2.4 0"/></symbol>
  <symbol id="i-lock" viewBox="0 0 16 16"><rect x="3.5" y="7" width="9" height="6.5" rx="1.5"/><path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7"/></symbol>
  <symbol id="i-back" viewBox="0 0 16 16"><path d="M6.5 4.5 3 8l3.5 3.5M3.5 8H13"/></symbol>
</svg>`;

// ---------------- Boards and repositories ----------------
const BOARDS = [
  { id: "int", title: "Internal Tools", owner: "acme", kind: "Organization", url: "https://github.com/orgs/acme/projects/12", final: ["Done"], fresh: "Backlog", read: "Read yesterday", readTip: "Sep 23 at 17:48" },
  { id: "mob", title: "Mobile App", owner: "gmartins", kind: "User", url: "https://github.com/users/gmartins/projects/3", final: ["Shipped"], fresh: "None", read: "Read failed 18m ago", fail: "GitHub's rate limit was reached. It resets at 14:32.", readTip: "Last read Sep 24 at 11:02" },
  { id: "plat", title: "Platform Roadmap", owner: "acme", kind: "Organization", url: "https://github.com/orgs/acme/projects/7", final: ["Done", "Won't do", "Duplicate"], fresh: "None", read: "Read 2m ago", readTip: "Sep 24 at 14:12" },
];
// path null: not cloned. missing: the clone at path is gone. act/arch: tasks; rev: reviews.
const REPOS14 = [
  { r: "acme/api", b: "plat", path: "~/code/api", act: 4, arev: 0 },
  { r: "acme/billing", b: "plat", path: null, act: 0, arev: 0 },
  { r: "acme/docs", b: "plat", path: "~/code/docs", act: 0, arev: 0 },
  { r: "acme/gateway", b: "plat", path: "~/code/gateway", act: 0, arev: 0 },
  { r: "acme/sdk-js", b: "plat", path: "~/src/sdk-js", act: 0, arev: 0 },
  { r: "acme/web", b: "plat", path: "~/code/web", act: 0, arev: 1, instr: false },
  { r: "acme/android", b: "mob", path: null, act: 0, arev: 0 },
  { r: "acme/ios", b: "mob", path: "~/code/ios", act: 3, arev: 1 },
  { r: "acme/admin", b: "int", path: "~/code/admin", act: 0, arev: 0 },
  { r: "acme/status-page", b: "int", path: "~/code/status-page", act: 0, arev: 0 },
  { r: "acme/tools", b: "int", path: "~/code/tools", act: 0, arev: 0 },
  { r: "acme/infra", b: null, path: "~/code/infra", missing: true, act: 1, arev: 0 },
];
// The archived counts come from History, so the page and the list never disagree.
function countRepos() {
  REPOS14.forEach((x) => {
    const short = x.r.split("/")[1];
    const mine = HIST.filter((h) => h[4] === short || h[4].startsWith(short + "#"));
    x.arch = mine.filter((h) => h[2] === "t" || h[2] === "o").length;
    x.rev = mine.filter((h) => h[2] === "r").length + x.arev;
  });
}
const boardOf = (id) => BOARDS.find((b) => b.id === id);
const reposOf = (id) => REPOS14.filter((x) => x.b === id);

// ---------------- Models: the catalog of the installed Claude Code, and the defaults ----------------
const CATALOG = [
  { m: "Opus 5.5 (1M)", efforts: ["low", "medium", "high", "xhigh", "max"] },
  { m: "Fable 5.1", efforts: ["low", "medium", "high", "xhigh", "max"] },
  { m: "Sonnet 5", efforts: ["low", "medium", "high", "xhigh", "max"] },
  { m: "Haiku 4.5", efforts: [] },
];
// [stage, factory, current, what else starts from it]
const DEFAULTS = [
  { grp: "Planning", rows: [
    ["PRD", "Fable 5.1 · high", "Opus 5.5 (1M) · xhigh"],
    ["Tech spec", "Fable 5.1 · high", "Opus 5.5 (1M) · xhigh"],
    ["Plan", "Fable 5.1 · high", "Opus 5.5 (1M) · medium"],
    ["One-Shot planning", "Fable 5.1 · high", "Opus 5.5 (1M) · xhigh"]] },
  { grp: "Steps", rows: [
    ["Implementation", "Opus 5.5 (1M) · high", "Opus 5.5 (1M) · medium"],
    ["Step review", "Opus 5.5 (1M) · high", "Opus 5.5 (1M) · high"]] },
  { grp: "Pull request", rows: [
    ["PR", "Opus 5.5 (1M) · medium", "Opus 5.5 (1M) · medium"],
    ["PR review", "Opus 5.5 (1M) · high", "Fable 5.1 · high", "Also where a review of someone's pull request starts"]] },
  { grp: "Discussion", rows: [
    ["Discussion", "Fable 5.1 · high", "Fable 5.1 · high", "Where a new discussion starts"]] },
];

// ---------------- Prompts, in the order of the workflow ----------------
const PROMPTS = [
  { id: "prd", n: "PRD", d: "Opens the PRD session of a task.", lines: 87, ph: ["task_name", "artifacts_dir", "prd_path", "initial_context"], edited: "Sep 20" },
  { id: "spec", n: "Tech spec", d: "Opens the tech spec session.", lines: 88, ph: ["task_name", "repository", "prd_path", "tech_spec_path"] },
  { id: "plan", n: "Plan", d: "Opens the plan session. Holds the template of the step files, which are the prompts of the implementation.", lines: 108, ph: ["task_name", "tech_spec_path", "steps_dir"] },
  { id: "one", n: "One-Shot planning", d: "Opens the planning session of a One-Shot task. Holds the structure of the One-Shot document, which is the prompt of its implementation.", lines: 115, ph: ["task_name", "one_shot_path", "initial_context"] },
  { id: "srev", n: "Step review", d: "Opens the review session of a step in Agent mode.", lines: 72, ph: ["step_path", "review_path", "branch"] },
  { id: "commit", n: "Commit", d: "Sent after a step is approved, by you or by the agent review, and after you approve the changes of a PR review.", lines: 33, ph: ["what_to_commit", "push"] },
  { id: "pr", n: "PR", d: "Opens the pull request session of the task.", lines: 57, ph: ["draft_path", "base_branch"] },
  { id: "prrev", n: "PR review", d: "Opens the review session of the pull request.", lines: 49, ph: ["pr_number", "pr_url", "review_path"] },
  { id: "disc", n: "Discussion", d: "Opens the conversation of a discussion, which writes the document and the drafts of cards.", lines: 51, ph: ["document_path", "drafts_path"] },
];
const PH_WHAT = {
  task_name: ["the task's name", ""], artifacts_dir: ["the folder of the task's documents", ""],
  prd_path: ["where the PRD is written", "Without it, the path is added at the end."],
  initial_context: ["the card or the description the task started from", "Without it, the initial context is added at the end."],
};

// ---------------- History: 44 archived items, Sep 12 to 24 ----------------
// [day, time, kind, name, where, result, more]; kind: t (task), o (One-Shot), r (review), d (discussion)
const DAYS = { 24: "Today", 23: "Yesterday", 22: "Monday, Sep 22", 21: "Sunday, Sep 21", 20: "Saturday, Sep 20", 19: "Friday, Sep 19", 18: "Thursday, Sep 18", 17: "Wednesday, Sep 17", 16: "Tuesday, Sep 16", 15: "Monday, Sep 15", 13: "Saturday, Sep 13", 12: "Friday, Sep 12" };
const HIST = [
  [24, "15:02", "t", "Idempotency keys for payment intents", "api#398", "#1279 merged", "6 steps"],
  [24, "13:20", "r", "Retry the export when S3 throttles", "gateway#88", "Merged", "1 pass"],
  [24, "11:47", "d", "Webhook delivery guarantees", "Platform Roadmap", "4 cards published", ""],
  [24, "10:05", "o", "Fix the flaky login e2e", "web#2279", "#2290 merged", "One-Shot"],
  [23, "18:31", "t", "Scheduled exports to S3", "gateway#84", "#91 merged", "8 steps"],
  [23, "16:20", "r", "Migrate settings page to react-hook-form", "web#2291", "Merged", "2 passes"],
  [23, "15:12", "d", "Usage alerts at 80% of the plan", "Platform Roadmap", "3 cards published", ""],
  [23, "11:03", "o", "Bump Go to 1.25 in CI", "api", "#1276 merged", "One-Shot"],
  [23, "09:40", "r", "Dark mode for the admin tables", "admin#77", "Merged", "3 passes"],
  [22, "19:15", "t", "Audit log for key changes", "api#415", "#1271 merged", "5 steps"],
  [22, "17:02", "t", "Offline banner on the task list", "ios#91", "#318 merged", "4 steps"],
  [22, "14:48", "r", "Paginate the invoices endpoint", "api#1266", "Merged", "1 pass"],
  [22, "12:30", "d", "Mobile onboarding without a password", "Mobile App", "5 cards published", ""],
  [22, "10:11", "o", "Remove the legacy pricing page", "web", "#2283 merged", "One-Shot"],
  [21, "16:44", "t", "Workspace invitations by link", "web#2260", "#2281 merged", "7 steps"],
  [21, "11:20", "r", "Cache the plan lookup in the gateway", "gateway#86", "Merged", "2 passes"],
  [20, "18:02", "o", "Typo in the password reset email", "web", "#2279 merged", "One-Shot"],
  [20, "15:37", "t", "Retry-After on 503 from the gateway", "gateway#79", "#83 merged", "4 steps"],
  [20, "10:26", "d", "Status page for partial outages", "Internal Tools", "2 cards published", ""],
  [19, "19:09", "t", "Export the audit log as CSV", "api#463", "#1262 merged", "6 steps"],
  [19, "16:51", "r", "Share sheet crash when offline", "ios#312", "Merged", "2 passes"],
  [19, "14:14", "r", "Sign in with Apple on the web", "web#2240", "Merged", "1 pass"],
  [19, "09:58", "d", "Admin roles for support agents", "Internal Tools", "4 cards published", ""],
  [18, "18:40", "o", "Upgrade React Router to v7", "web", "#2270 merged", "One-Shot"],
  [18, "15:05", "t", "Rotate the signing keys of webhooks", "api#441", "#1255 merged", "5 steps"],
  [18, "12:22", "r", "Stream the build logs", "tools#31", "Merged", "1 pass"],
  [18, "10:00", "d", "Search in the docs site", "Platform Roadmap", "1 card published", ""],
  [17, "17:48", "t", "Plan picker with yearly prices", "web#2244", "#2266 merged", "6 steps"],
  [17, "13:31", "r", "Fix the timezone of scheduled exports", "gateway#81", "Merged", "3 passes"],
  [17, "11:15", "o", "Drop Node 18 from the SDK", "sdk-js", "#44 merged", "One-Shot"],
  [16, "19:22", "t", "Invoice PDF with line items", "web#2236", "#2262 merged", "7 steps"],
  [16, "16:03", "d", "Offline mode on mobile, round 1", "Mobile App", "6 cards published", ""],
  [16, "14:40", "r", "Rate limit headers in the SDK", "sdk-js#41", "Merged", "1 pass"],
  [16, "09:12", "t", "Staging deploy on every merge to dev", "infra#12", "#57 merged", "4 steps"],
  [15, "18:55", "t", "Two-factor with passkeys", "web#2231", "#2258 merged", "9 steps"],
  [15, "15:21", "r", "Tokens page redesign", "web#2250", "Merged", "2 passes"],
  [15, "11:44", "d", "Kill switch for the gateway", "Platform Roadmap", "2 cards published", ""],
  [15, "10:02", "o", "Sentry release tags", "api", "#1239 merged", "One-Shot"],
  [13, "17:10", "t", "Bulk archive in the admin", "admin#70", "#74 merged", "5 steps"],
  [13, "12:36", "r", "Move status checks to GitHub Actions", "status-page#19", "Closed", "1 pass"],
  [13, "10:48", "d", "Docs versioning", "Platform Roadmap", "3 cards published", ""],
  [12, "18:20", "t", "Webhook signing secrets per endpoint", "api#470", "#1231 merged", "6 steps"],
  [12, "15:03", "o", "Health check for the worker", "gateway", "#72 merged", "One-Shot"],
  [12, "11:30", "d", "Public API for usage", "Platform Roadmap", "1 card published", ""],
];
// The closings that skipped the update of the base (8 of 22 in the real database): the row says it.
const SKIPPED = new Set(["Idempotency keys for payment intents", "Audit log for key changes", "Workspace invitations by link", "Export the audit log as CSV", "Remove the legacy pricing page", "Typo in the password reset email", "Two-factor with passkeys", "Health check for the worker"]);
countRepos();
