/* =====================================================================
   ROUND 11 · the data of the mock. The board "Platform Roadmap" at the
   size of the real one (design/research/board.md §4): 120 cards in 10
   statuses, 46 visible with the final statuses folded, 10 epics that are
   cards too (2 open), 32 cards under an epic, 5 people, 2 unsatisfied
   dependencies. The tasks and the discussion match the sidebar tree.
   ===================================================================== */

// The statuses of the board, in the board's order. final: folded at first.
const STATUSES = [
  { name: "Backlog" }, { name: "Ready" }, { name: "In progress" }, { name: "Code review" }, { name: "Changes requested" },
  { name: "Approved" }, { name: "In dev", final: true }, { name: "Ready for release", final: true }, { name: "Done", final: true }, { name: "Paused" },
];
const SI = Object.fromEntries(STATUSES.map((s, k) => [s.name, k]));
const BOARD = { title: "Platform Roadmap", owner: "acme", number: 7, url: "https://github.com/orgs/acme/projects/7", viewer: "gmartins",
  repos: ["api", "web", "billing", "gateway", "docs"], readAgo: "2m", readLong: "2 minutes ago, at 14:08" };
const NOCLONE = { billing: true };            // registered by the board, never cloned
const PEOPLE = ["gmartins", "lnakamura", "rsouza", "tchen", "apatel"];
const MODULES = ["API", "Billing", "Dashboard", "Gateway", "Auth", "Docs", "Infra", "Search"];
const ESTIMATES = ["<30min", "1hr - 3hrs", "3hrs - 6hrs", "~ 1 dia"];

// [number, title, status, repo, extra]
const RAW = [
  // ---- The two open epics, and their cards ----
  [402, "API hardening", "In progress", "api", { epicOf: true, module: "API" }],
  [412, "Rate limit per API key", "In progress", "api", { epic: 402, task: "t1", asg: ["gmartins"], module: "API", est: "~ 1 dia", pr: [] }],
  [441, "Rotate API keys without downtime", "In progress", "api", { epic: 402, task: "t7", asg: ["gmartins"], module: "Auth", est: "3hrs - 6hrs" }],
  [415, "Audit log for key changes", "Ready", "api", { epic: 402, asg: ["tchen"], module: "Auth", est: "3hrs - 6hrs" }],
  [418, "Scoped API keys with read-only and write scopes", "Backlog", "api", { epic: 402, module: "Auth", est: "~ 1 dia" }],
  [420, "Key usage page in the dashboard", "Backlog", "web", { epic: 402, asg: ["apatel"], module: "Dashboard", est: "3hrs - 6hrs" }],
  [416, "Revoke keys from the CLI", "Backlog", "docs", { epic: 402, module: "Docs", est: "1hr - 3hrs" }],
  [409, "Hash API keys at rest", "Done", "api", { epic: 402, closed: true, archived: "409-hash-api-keys-at-rest" }],
  [410, "Key prefix for leak scanning", "Done", "api", { epic: 402, closed: true }],
  [450, "Usage-based billing", "In progress", "billing", { epicOf: true, module: "Billing" }],
  [430, "Retry failed billing webhooks", "In progress", "api", { epic: 450, task: "t3", asg: ["gmartins"], module: "Billing", est: "3hrs - 6hrs" }],
  [455, "Usage-based pricing tiers", "Backlog", "billing", { epic: 450, disc: "d1", asg: ["rsouza"], module: "Billing" }],
  [461, "Metering events from the gateway", "Backlog", "gateway", { epic: 450, disc: "d1", module: "Gateway", est: "~ 1 dia" }],
  [471, "Invoice PDF with line items per API key", "Ready", "billing", { epic: 450, dep: [455], asg: ["rsouza"], module: "Billing", est: "3hrs - 6hrs", rich: "invoice" }],
  [474, "Usage alerts at 80% of the plan", "Ready", "api", { epic: 450, dep: [461], asg: ["gmartins"], module: "Billing", est: "3hrs - 6hrs", start: "2026-09-29", rich: "alerts" }],
  [466, "Proration on plan change", "Backlog", "billing", { epic: 450, module: "Billing", est: "~ 1 dia" }],
  [475, "Plan limits on the pricing page", "Backlog", "web", { epic: 450, module: "Dashboard", est: "1hr - 3hrs" }],
  // ---- Open, without an epic ----
  [449, "Deprecate v1 webhooks", "In progress", "api", { task: "t8", asg: ["gmartins"], module: "API", est: "3hrs - 6hrs" }],
  [467, "Export usage as CSV from the dashboard", "Backlog", "web", { module: "Dashboard", est: "1hr - 3hrs" }],
  [468, "Pagination cursors on /v2/events", "Backlog", "api", { module: "API", est: "3hrs - 6hrs", asg: ["tchen"] }],
  [472, "Webhook delivery log with filters", "Backlog", "web", { module: "Dashboard", est: "~ 1 dia" }],
  [476, "Retry budget per webhook endpoint", "Backlog", "api", { module: "API" }],
  [478, "Dark mode for the dashboard charts", "Backlog", "web", { module: "Dashboard", est: "1hr - 3hrs", asg: ["apatel"] }],
  [479, "Gateway health endpoint for the load balancer", "Backlog", "gateway", { module: "Gateway", est: "<30min" }],
  [481, "Document the rate limit headers", "Backlog", "docs", { module: "Docs", est: "1hr - 3hrs" }],
  [482, "Remove the legacy /v1/tokens route", "Backlog", "api", { module: "API", est: "1hr - 3hrs", asg: ["lnakamura"] }],
  [483, "Timezone setting per workspace", "Backlog", "web", { module: "Dashboard", est: "3hrs - 6hrs" }],
  [485, "Slow query alert on the events table", "Backlog", "api", { module: "Infra", est: "1hr - 3hrs" }],
  [486, "Upgrade the Go toolchain to 1.25", "Backlog", "api", { module: "Infra", est: "<30min", asg: ["lnakamura"] }],
  [487, "Split the gateway config per environment", "Backlog", "gateway", { module: "Gateway", est: "3hrs - 6hrs" }],
  [489, "Empty states for the new dashboard pages", "Backlog", "web", { module: "Dashboard", est: "3hrs - 6hrs", asg: ["apatel"] }],
  [490, "Idempotency keys on POST /v2/charges", "Backlog", "billing", { module: "Billing", est: "~ 1 dia" }],
  [492, "Sandbox mode for new workspaces", "Backlog", "api", { module: "API", est: "~ 1 dia" }],
  [494, "Trace IDs in every error response", "Backlog", "gateway", { module: "Gateway", est: "1hr - 3hrs" }],
  [495, "Bulk invite members from a CSV file", "Backlog", "web", { module: "Dashboard", est: "3hrs - 6hrs" }],
  [498, "Cache plan limits in the gateway", "Backlog", "gateway", { module: "Gateway", est: "1hr - 3hrs", asg: ["tchen"] }],
  [104, "Share the API key screen with the iOS app", "Backlog", "ios", { module: "Auth", other: "Mobile App" }],
  [12, "Incident banner on the status page", "Backlog", "status-page", { module: "Infra", unmanaged: true }],
  [458, "Link the status page from the error pages", "Ready", "web", { module: "Dashboard", est: "<30min" }],
  [462, "Retry-After on 503 from the gateway", "Ready", "gateway", { module: "Gateway", est: "1hr - 3hrs", asg: ["tchen"] }],
  [463, "Show the API version in the dashboard footer", "Ready", "web", { module: "Dashboard", est: "<30min" }],
  [465, "Tighten CORS on the public API", "Ready", "api", { module: "API", est: "1hr - 3hrs", asg: ["lnakamura"] }],
  [469, "Move the events table to monthly partitions", "Ready", "api", { module: "Infra", est: "~ 1 dia", asg: ["gmartins"] }],
  [470, "Quickstart guide for the v2 API", "Ready", "docs", { module: "Docs", est: "3hrs - 6hrs" }],
  [457, "Sort invoices by due date", "Code review", "web", { module: "Billing", est: "1hr - 3hrs", asg: ["apatel"], prOpen: 2310 }],
  [459, "Validate webhook URLs before saving", "Code review", "api", { module: "API", est: "1hr - 3hrs", asg: ["lnakamura"], prOpen: 1291 }],
  [454, "Faster search on the members page", "Approved", "web", { module: "Search", est: "3hrs - 6hrs", asg: ["tchen"], prOpen: 2302 }],
  [447, "Move session storage to Redis", "Paused", "api", { module: "Infra", est: "~ 1 dia", asg: ["rsouza"] }],
  // ---- Final statuses: three still open ----
  [453, "Resend the verification email", "In dev", "web", { module: "Auth", asg: ["apatel"] }],
  [448, "Per-workspace audit export", "Ready for release", "api", { module: "API", closed: true }],
  [451, "New billing emails", "Ready for release", "billing", { module: "Billing" }],
  [452, "CLI login with device code", "Ready for release", "api", { module: "Auth", asg: ["lnakamura"] }],
];
// The eight finished epics, their seventeen cards, and forty-three cards done without an epic.
const DONE_EPICS = [
  [301, "Onboarding v2", ["Welcome checklist on the first login", "Invite teammates from onboarding", "Sample project for new workspaces", "Skip onboarding for invited users", "Onboarding events in analytics"]],
  [322, "Search revamp", ["Search as you type on the cards page", "Highlight matches in results", "Search across workspaces for admins"]],
  [340, "SSO with Okta", ["SAML login with Okta", "Just-in-time provisioning", "Enforce SSO per workspace"]],
  [355, "Team roles", ["Billing admin role", "Role changes in the audit log"]],
  [372, "Status page", ["Public status page with uptime"]],
  [380, "Webhook signing", ["Sign webhook payloads with HMAC"]],
  [388, "Docs site migration", ["Move the docs to the new site generator"]],
  [395, "Gateway on Envoy", ["Replace the gateway proxy with Envoy"]],
];
const DONE_TITLES = ["Fix double charge on retried payments", "Show the last login in the members list", "Email preview in the template editor", "Remove jQuery from the settings page", "Retry DNS lookups in the gateway", "Faster cold start for the API pods",
  "Timeout on long exports", "Upgrade Postgres to 16", "Copy button on API keys", "Paginate the invoices page", "Log slow webhook deliveries", "Keyboard shortcuts in the dashboard",
  "Fix CSV export with commas in names", "Workspace logo upload", "Rename projects without losing links", "Disable signups for closed workspaces", "Rate limit the login endpoint", "Better 404 page for the dashboard",
  "Sentry release tags in CI", "Compress API responses", "Plan badge in the sidebar", "Fix timezone in scheduled reports", "Delete webhooks in bulk", "Currency on every invoice line",
  "Mask secrets in request logs", "Archive old projects", "Move cron jobs to the worker", "Show the plan limits in settings", "Health checks for the worker", "Dependabot for the web app",
  "Fix flaky gateway integration test", "Warn before deleting a workspace", "Resize avatars on upload", "Clean up feature flags from Q2", "Track API errors per key", "Fix dark mode contrast on buttons",
  "Allow two-factor recovery codes", "Cache the pricing page", "Retry failed email sends", "Faster member invites", "Shorter API key display", "Changelog link in the dashboard", "Unify date formats"];

const CARDS = []; const CARD = {};
const repoOf = (r) => `acme/${r}`;
function add(n, t, st, repo, x = {}) {
  const c = { n, t, s: SI[st], repo, closed: !!x.closed, ...x };
  if (!x.asg) c.asg = n % 4 === 0 ? [] : [PEOPLE[n % 5]];
  if (!x.module) c.module = MODULES[n % 8];
  if (!x.est && n % 3) c.est = ESTIMATES[n % 4];
  CARDS.push(c); CARD[n] = c; return c;
}
RAW.forEach(([n, t, st, repo, x]) => add(n, t, st, repo, x));
let dn = 300;
DONE_EPICS.forEach(([n, t, kids]) => {
  add(n, t, "Done", "api", { epicOf: true, closed: true, module: "API" });
  kids.forEach((k) => { dn += 1; while (CARD[dn] || DONE_EPICS.some((e) => e[0] === dn)) dn += 1; add(dn, k, "Done", ["api", "web", "gateway"][dn % 3], { epic: n, closed: true }); });
});
DONE_TITLES.forEach((t, k) => add(150 + k * 3, t, "Done", ["api", "web", "gateway", "docs", "billing"][k % 5], { closed: true, pr: [{ n: 1180 + k, s: "merged" }] }));
// Epics know their cards.
CARDS.forEach((c) => { if (c.epic) (CARD[c.epic].kids = CARD[c.epic].kids || []).push(c.n); });
const epicDone = (e) => (CARD[e].kids || []).filter((k) => STATUSES[CARD[k].s].final).length;

// The tasks and the discussion of the sidebar tree, as a card row says them.
const TASKS = {
  t1: { name: "rate-limit-per-api-key", title: "Rate limit per API key", g: "wait", row: "Question · Step 3/7", long: "Question · Reviewer · Step 3/7", since: "18m", sinceLong: "18 minutes" },
  t7: { name: "rotate-api-keys-without-downtime", title: "Rotate API keys without downtime", g: "run", row: "Step 2/5 · Reviewer pass 2", long: "Step 2/5 · Reviewer pass 2 · the reviewer works" },
  t3: { name: "retry-failed-billing-webhooks", title: "Retry failed billing webhooks", g: "wait", row: "Question · Tech spec", long: "Question · Tech spec", since: "12m", sinceLong: "12 minutes" },
  t8: { name: "deprecate-v1-webhooks", title: "Deprecate v1 webhooks", g: "error", row: "Session error · Plan", long: "Session error · Plan", since: "7m", sinceLong: "7 minutes" },
};
const DISCS = { d1: { title: "Usage-based pricing tiers", cards: [455, 461] } };

// Dependencies: the state of each one, as the card shows it.
const DEPS = {
  455: { title: "Usage-based pricing tiers", repo: "billing", state: "Open", status: "Backlog", sat: false, prs: [] },
  461: { title: "Metering events from the gateway", repo: "gateway", state: "Open", status: "Backlog", sat: false, prs: [] },
};

// The body of the cards the scenes open: twenty lines of Markdown, like the median card of the real board.
const BODIES = {
  alerts: `<h4>Context</h4><p>Customers on usage-based plans find out they went over the plan when the invoice arrives. Support gets about a dozen tickets a month about surprise overages.</p>
<h4>Problem</h4><p>There is no warning before a workspace reaches the limit of its plan, and no way for an admin to see how close it is without opening the usage page.</p>
<h4>What the delivery includes</h4><ul><li>An email to the billing admins when the workspace reaches 80% of the plan's monthly units, once per billing period.</li><li>The same alert as a banner in the dashboard, dismissible per user.</li><li>A setting in <code>Billing › Alerts</code> to change the threshold (50–95%) or turn it off.</li><li>The metering events from #461 as the source; until it ships, the nightly usage job.</li></ul>
<h4>Out of scope</h4><ul><li>Hard caps that stop requests at the limit.</li><li>Alerts per API key.</li></ul>
<h4>Acceptance</h4><ul><li>A workspace at 81% gets one email and one banner, and none again in the same period.</li><li>Changing the threshold below the current usage sends the alert at the next usage update.</li></ul>`,
  invoice: `<h4>Context</h4><p>Finance teams reconcile the invoice with their internal cost centers per integration, and each integration has its own API key.</p>
<h4>Problem</h4><p>The invoice PDF shows one line per plan. Customers ask support to break it down by key every month.</p>
<h4>What the delivery includes</h4><ul><li>One line per API key with the units and the amount, sorted by amount.</li><li>Keys deleted during the period appear with their last name and <em>deleted</em>.</li><li>The same breakdown in the CSV export.</li></ul>
<h4>Out of scope</h4><ul><li>Cost centers configured in the product.</li></ul>`,
  plain: (c) => `<h4>Context</h4><p>${c.t} came up in the last planning. The current behavior works, but it costs time every week.</p><h4>What the delivery includes</h4><ul><li>The change itself, behind no flag.</li><li>Tests for the new path.</li><li>A line in the changelog.</li></ul>`,
};
const SIBL = (c) => (c.epic ? CARD[c.epic].kids.filter((k) => k !== c.n) : []);
