/**
 * The scenes of the board, the Home and the creation dialog: the board Platform Roadmap at the size
 * of the real one, with the two boards beside it, at fourteen moments. The scene tests draw the
 * screens from them.
 */

import { act, screen } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, vi } from "vitest";
import { EMPTY_FILTERS } from "@/features/board/board-view";
import type { Location } from "@/lib/locations";
import { boardViewKey } from "@/lib/ui-storage";
import type {
  Board,
  BoardCard,
  BoardStatus,
  CardDependency,
  CardIssue,
  CardPullRequest,
  CardRelated,
  Repository,
  State,
  Step,
  TaskSummary,
} from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import {
  makeArchivedTask,
  makeBoard,
  makeBoardCard,
  makeDiscussion,
  makeDiscussionCard,
  makeHistorySummary,
  makePullRequestRow,
  makeRepository,
  makeReviewCenter,
  makeSituation,
  makeState,
  makeStep,
  makeStepReviewer,
  makeTask,
  makeTaskCard,
  makeWritingDiscussion,
} from "@/test/wails-mock";

/** BOARD_SCENES are the fourteen moments of the board, the Home and the creation dialog. */
export const BOARD_SCENES = [
  "home",
  "home-disc",
  "home-none",
  "board",
  "card",
  "reading",
  "failed",
  "empty",
  "filtered",
  "stale-card",
  "no-clone",
  "select",
  "create",
  "create-card",
] as const;

/** BoardSceneName is one moment of the board. */
export type BoardSceneName = (typeof BOARD_SCENES)[number];

/** BoardSceneSetup is what a test needs to draw a scene: the state, the place and what the user did. */
export interface BoardSceneSetup {
  state: State;
  location: Location;
  /** back is the places behind the location, which Continue reads on the Home. */
  back: Location[];
  /** storage is what the board view remembers in localStorage, by key. */
  storage: Record<string, string>;
  /** after is what the test does once the screen is drawn, to reach the state of the scene. */
  after?: (user: UserEvent) => Promise<void>;
}

/**
 * SCENE_NOW is the moment every scene is drawn at. It is written without a zone, as task-scenes.ts
 * writes its moment: the clock times of the scenes (read at 14:08) are the local ones on any day the
 * suite runs, in any zone.
 */
export const SCENE_NOW = "2026-09-24T14:10:00";

// at is a moment minutes before SCENE_NOW.
const at = (minutes: number) => new Date(Date.parse(SCENE_NOW) - minutes * 60_000).toISOString();

/**
 * fixBoardSceneClock stops the clock of the page at SCENE_NOW for the test that runs next, and gives
 * it back after; only Date is faked, so the timers of the page still run.
 */
export function fixBoardSceneClock(): void {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(SCENE_NOW));
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });
}

/** PLATFORM_ID, TOOLS_ID and MOBILE_ID are the ids of the three boards. */
export const PLATFORM_ID = "board-platform";
export const TOOLS_ID = "board-tools";
export const MOBILE_ID = "board-mobile";

/** PLATFORM_TITLE is the title of the board the scenes draw. */
export const PLATFORM_TITLE = "Platform Roadmap";

/** cardKey is the key of a card of the reference board. */
export const cardKey = (number: number): string =>
  `acme/${REPOSITORY_OF[number] ?? "api"}#${number}`;

const OWNER = "acme";

const STATUSES: { name: string; final?: boolean }[] = [
  { name: "Backlog" },
  { name: "Ready" },
  { name: "In progress" },
  { name: "Code review" },
  { name: "Changes requested" },
  { name: "Approved" },
  { name: "In dev", final: true },
  { name: "Ready for release", final: true },
  { name: "Done", final: true },
  { name: "Paused" },
];

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const boardStatuses = (): BoardStatus[] =>
  STATUSES.map(({ name, final }) => ({ id: slug(name), name, final: final === true }));

const PEOPLE = ["gmartins", "lnakamura", "rsouza", "tchen", "apatel"];
const MODULES = ["API", "Billing", "Dashboard", "Gateway", "Auth", "Docs", "Infra", "Search"];
const ESTIMATES = ["<30min", "1hr - 3hrs", "3hrs - 6hrs", "~ 1 dia"];

/** Extra is what a card of the mock carries beyond its number, title, status and repository. */
interface Extra {
  epicOf?: boolean;
  epic?: number;
  task?: "t1" | "t3" | "t7" | "t8";
  disc?: "d1";
  asg?: string[];
  module?: string;
  est?: string;
  dep?: number[];
  /** name is the name the card suggests for a task, when it is not the one of its title. */
  name?: string;
  start?: string;
  rich?: "invoice" | "alerts";
  closed?: boolean;
  archived?: string;
  prOpen?: number;
  merged?: number;
  other?: string;
  unmanaged?: boolean;
}

type Raw = [number, string, string, string, Extra];

// RAW are the open cards of the mock, the two open epics and their cards first.
const RAW: Raw[] = [
  [402, "API hardening", "In progress", "api", { epicOf: true, module: "API" }],
  [
    412,
    "Rate limit per API key",
    "In progress",
    "api",
    { epic: 402, task: "t1", asg: ["gmartins"], module: "API", est: "~ 1 dia" },
  ],
  [
    441,
    "Rotate API keys without downtime",
    "In progress",
    "api",
    { epic: 402, task: "t7", asg: ["gmartins"], module: "Auth", est: "3hrs - 6hrs" },
  ],
  [
    415,
    "Audit log for key changes",
    "Ready",
    "api",
    { epic: 402, asg: ["tchen"], module: "Auth", est: "3hrs - 6hrs" },
  ],
  [
    418,
    "Scoped API keys with read-only and write scopes",
    "Backlog",
    "api",
    { epic: 402, module: "Auth", est: "~ 1 dia" },
  ],
  [
    420,
    "Key usage page in the dashboard",
    "Backlog",
    "web",
    { epic: 402, asg: ["apatel"], module: "Dashboard", est: "3hrs - 6hrs" },
  ],
  [
    416,
    "Revoke keys from the CLI",
    "Backlog",
    "docs",
    { epic: 402, module: "Docs", est: "1hr - 3hrs" },
  ],
  [
    409,
    "Hash API keys at rest",
    "Done",
    "api",
    { epic: 402, closed: true, archived: "409-hash-api-keys-at-rest" },
  ],
  [410, "Key prefix for leak scanning", "Done", "api", { epic: 402, closed: true }],
  [450, "Usage-based billing", "In progress", "billing", { epicOf: true, module: "Billing" }],
  [
    430,
    "Retry failed billing webhooks",
    "In progress",
    "api",
    { epic: 450, task: "t3", asg: ["gmartins"], module: "Billing", est: "3hrs - 6hrs" },
  ],
  [
    455,
    "Usage-based pricing tiers",
    "Backlog",
    "billing",
    { epic: 450, disc: "d1", asg: ["rsouza"], module: "Billing" },
  ],
  [
    461,
    "Metering events from the gateway",
    "Backlog",
    "gateway",
    { epic: 450, disc: "d1", module: "Gateway", est: "~ 1 dia" },
  ],
  [
    471,
    "Invoice PDF with line items per API key",
    "Ready",
    "billing",
    {
      epic: 450,
      dep: [455],
      asg: ["rsouza"],
      module: "Billing",
      est: "3hrs - 6hrs",
      rich: "invoice",
    },
  ],
  [
    474,
    "Usage alerts at 80% of the plan",
    "Ready",
    "api",
    {
      epic: 450,
      dep: [461, 455],
      name: "474-usage-alerts-at-80-of-the-plan-for-every-workspace-on-a-tier",
      asg: ["gmartins"],
      module: "Billing",
      est: "3hrs - 6hrs",
      start: "2026-09-29",
      rich: "alerts",
    },
  ],
  [
    466,
    "Proration on plan change",
    "Backlog",
    "billing",
    { epic: 450, module: "Billing", est: "~ 1 dia" },
  ],
  [
    475,
    "Plan limits on the pricing page",
    "Backlog",
    "web",
    { epic: 450, module: "Dashboard", est: "1hr - 3hrs" },
  ],
  [
    449,
    "Deprecate v1 webhooks",
    "In progress",
    "api",
    { task: "t8", asg: ["gmartins"], module: "API", est: "3hrs - 6hrs" },
  ],
  [
    467,
    "Export usage as CSV from the dashboard",
    "Backlog",
    "web",
    { module: "Dashboard", est: "1hr - 3hrs" },
  ],
  [
    468,
    "Pagination cursors on /v2/events",
    "Backlog",
    "api",
    { module: "API", est: "3hrs - 6hrs", asg: ["tchen"] },
  ],
  [
    472,
    "Webhook delivery log with filters",
    "Backlog",
    "web",
    { module: "Dashboard", est: "~ 1 dia" },
  ],
  [476, "Retry budget per webhook endpoint", "Backlog", "api", { module: "API" }],
  [
    478,
    "Dark mode for the dashboard charts",
    "Backlog",
    "web",
    { module: "Dashboard", est: "1hr - 3hrs", asg: ["apatel"] },
  ],
  [
    479,
    "Gateway health endpoint for the load balancer",
    "Backlog",
    "gateway",
    { module: "Gateway", est: "<30min" },
  ],
  [
    481,
    "Document the rate limit headers",
    "Backlog",
    "docs",
    { module: "Docs", est: "1hr - 3hrs" },
  ],
  [
    482,
    "Remove the legacy /v1/tokens route",
    "Backlog",
    "api",
    { module: "API", est: "1hr - 3hrs", asg: ["lnakamura"] },
  ],
  [
    483,
    "Timezone setting per workspace",
    "Backlog",
    "web",
    { module: "Dashboard", est: "3hrs - 6hrs" },
  ],
  [
    485,
    "Slow query alert on the events table",
    "Backlog",
    "api",
    { module: "Infra", est: "1hr - 3hrs" },
  ],
  [
    486,
    "Upgrade the Go toolchain to 1.25",
    "Backlog",
    "api",
    { module: "Infra", est: "<30min", asg: ["lnakamura"] },
  ],
  [
    487,
    "Split the gateway config per environment",
    "Backlog",
    "gateway",
    { module: "Gateway", est: "3hrs - 6hrs" },
  ],
  [
    489,
    "Empty states for the new dashboard pages",
    "Backlog",
    "web",
    { module: "Dashboard", est: "3hrs - 6hrs", asg: ["apatel"] },
  ],
  [
    490,
    "Idempotency keys on POST /v2/charges",
    "Backlog",
    "billing",
    { module: "Billing", est: "~ 1 dia" },
  ],
  [492, "Sandbox mode for new workspaces", "Backlog", "api", { module: "API", est: "~ 1 dia" }],
  [
    494,
    "Trace IDs in every error response",
    "Backlog",
    "gateway",
    { module: "Gateway", est: "1hr - 3hrs" },
  ],
  [
    495,
    "Bulk invite members from a CSV file",
    "Backlog",
    "web",
    { module: "Dashboard", est: "3hrs - 6hrs" },
  ],
  [
    498,
    "Cache plan limits in the gateway",
    "Backlog",
    "gateway",
    { module: "Gateway", est: "1hr - 3hrs", asg: ["tchen"] },
  ],
  [
    104,
    "Share the API key screen with the iOS app",
    "Backlog",
    "ios",
    { module: "Auth", other: "Mobile App" },
  ],
  [
    12,
    "Incident banner on the status page",
    "Backlog",
    "status-page",
    { module: "Infra", unmanaged: true },
  ],
  [
    458,
    "Link the status page from the error pages",
    "Ready",
    "web",
    { module: "Dashboard", est: "<30min" },
  ],
  [
    462,
    "Retry-After on 503 from the gateway",
    "Ready",
    "gateway",
    { module: "Gateway", est: "1hr - 3hrs", asg: ["tchen"] },
  ],
  [
    463,
    "Show the API version in the dashboard footer",
    "Ready",
    "web",
    { module: "Dashboard", est: "<30min" },
  ],
  [
    465,
    "Tighten CORS on the public API",
    "Ready",
    "api",
    { module: "API", est: "1hr - 3hrs", asg: ["lnakamura"] },
  ],
  [
    469,
    "Move the events table to monthly partitions",
    "Ready",
    "api",
    { module: "Infra", est: "~ 1 dia", asg: ["gmartins"] },
  ],
  [470, "Quickstart guide for the v2 API", "Ready", "docs", { module: "Docs", est: "3hrs - 6hrs" }],
  [
    457,
    "Sort invoices by due date",
    "Code review",
    "web",
    { module: "Billing", est: "1hr - 3hrs", asg: ["apatel"], prOpen: 2310 },
  ],
  [
    459,
    "Validate webhook URLs before saving",
    "Code review",
    "api",
    { module: "API", est: "1hr - 3hrs", asg: ["lnakamura"], prOpen: 1291 },
  ],
  [
    454,
    "Faster search on the members page",
    "Approved",
    "web",
    { module: "Search", est: "3hrs - 6hrs", asg: ["tchen"], prOpen: 2302 },
  ],
  [
    447,
    "Move session storage to Redis",
    "Paused",
    "api",
    { module: "Infra", est: "~ 1 dia", asg: ["rsouza"] },
  ],
  [453, "Resend the verification email", "In dev", "web", { module: "Auth", asg: ["apatel"] }],
  [448, "Per-workspace audit export", "Ready for release", "api", { module: "API", closed: true }],
  [451, "New billing emails", "Ready for release", "billing", { module: "Billing" }],
  [
    452,
    "CLI login with device code",
    "Ready for release",
    "api",
    { module: "Auth", asg: ["lnakamura"] },
  ],
];

// The eight finished epics, their seventeen cards, and forty-three cards done without an epic.
const DONE_EPICS: [number, string, string[]][] = [
  [
    301,
    "Onboarding v2",
    [
      "Welcome checklist on the first login",
      "Invite teammates from onboarding",
      "Sample project for new workspaces",
      "Skip onboarding for invited users",
      "Onboarding events in analytics",
    ],
  ],
  [
    322,
    "Search revamp",
    [
      "Search as you type on the cards page",
      "Highlight matches in results",
      "Search across workspaces for admins",
    ],
  ],
  [
    340,
    "SSO with Okta",
    ["SAML login with Okta", "Just-in-time provisioning", "Enforce SSO per workspace"],
  ],
  [355, "Team roles", ["Billing admin role", "Role changes in the audit log"]],
  [372, "Status page", ["Public status page with uptime"]],
  [380, "Webhook signing", ["Sign webhook payloads with HMAC"]],
  [388, "Docs site migration", ["Move the docs to the new site generator"]],
  [395, "Gateway on Envoy", ["Replace the gateway proxy with Envoy"]],
];

const DONE_TITLES = [
  "Fix double charge on retried payments",
  "Show the last login in the members list",
  "Email preview in the template editor",
  "Remove jQuery from the settings page",
  "Retry DNS lookups in the gateway",
  "Faster cold start for the API pods",
  "Timeout on long exports",
  "Upgrade Postgres to 16",
  "Copy button on API keys",
  "Paginate the invoices page",
  "Log slow webhook deliveries",
  "Keyboard shortcuts in the dashboard",
  "Fix CSV export with commas in names",
  "Workspace logo upload",
  "Rename projects without losing links",
  "Disable signups for closed workspaces",
  "Rate limit the login endpoint",
  "Better 404 page for the dashboard",
  "Sentry release tags in CI",
  "Compress API responses",
  "Plan badge in the sidebar",
  "Fix timezone in scheduled reports",
  "Delete webhooks in bulk",
  "Currency on every invoice line",
  "Mask secrets in request logs",
  "Archive old projects",
  "Move cron jobs to the worker",
  "Show the plan limits in settings",
  "Health checks for the worker",
  "Dependabot for the web app",
  "Fix flaky gateway integration test",
  "Warn before deleting a workspace",
  "Resize avatars on upload",
  "Clean up feature flags from Q2",
  "Track API errors per key",
  "Fix dark mode contrast on buttons",
  "Allow two-factor recovery codes",
  "Cache the pricing page",
  "Retry failed email sends",
  "Faster member invites",
  "Shorter API key display",
  "Changelog link in the dashboard",
  "Unify date formats",
];

/** Spec is a card of the mock before it becomes a BoardCard. */
interface Spec {
  number: number;
  title: string;
  status: string;
  repository: string;
  extra: Extra;
}

// specs are the cards of Platform Roadmap: 120 in ten statuses.
const SPECS: Spec[] = (() => {
  const specs: Spec[] = RAW.map(([number, title, status, repository, extra]) => ({
    number,
    title,
    status,
    repository,
    extra,
  }));
  const taken = new Set([
    ...RAW.map(([number]) => number),
    ...DONE_EPICS.map(([number]) => number),
  ]);
  let next = 300;
  for (const [number, title, kids] of DONE_EPICS) {
    specs.push({
      number,
      title,
      status: "Done",
      repository: "api",
      extra: { epicOf: true, closed: true, module: "API" },
    });
    for (const kid of kids) {
      next += 1;
      while (taken.has(next)) {
        next += 1;
      }
      taken.add(next);
      specs.push({
        number: next,
        title: kid,
        status: "Done",
        repository: ["api", "web", "gateway"][next % 3] ?? "api",
        extra: { epic: number, closed: true },
      });
    }
  }
  DONE_TITLES.forEach((title, index) => {
    specs.push({
      number: 150 + index * 3,
      title,
      status: "Done",
      repository: ["api", "web", "gateway", "docs", "billing"][index % 5] ?? "api",
      extra: { closed: true, merged: 1180 + index },
    });
  });
  return specs;
})();

const SPEC_OF = new Map(SPECS.map((spec) => [spec.number, spec]));

// REPOSITORY_OF is the repository of each card, by number, for the keys.
const REPOSITORY_OF: Record<number, string> = Object.fromEntries(
  SPECS.map((spec) => [spec.number, spec.repository]),
);

const repositoryId = (name: string) => `repo-${name}`;
const issueUrl = (spec: Spec) =>
  `https://github.com/${OWNER}/${spec.repository}/issues/${spec.number}`;

const keyOfSpec = (spec: Spec) => `${OWNER}/${spec.repository}#${spec.number}`;

function issueOf(spec: Spec): CardIssue {
  return {
    key: keyOfSpec(spec),
    repository: `${OWNER}/${spec.repository}`,
    number: spec.number,
    title: spec.title,
    url: issueUrl(spec),
    state: spec.extra.closed === true ? "closed" : "open",
  };
}

// kidsOf are the numbers of the cards of an epic.
const kidsOf = (epic: number) =>
  SPECS.filter((spec) => spec.extra.epic === epic).map((spec) => spec.number);

const TASK_OF: Record<string, string> = { t1: "t1", t3: "t3", t7: "t7", t8: "t8" };

const BODIES = {
  alerts: `### Context

Customers on usage-based plans find out they went over the plan when the invoice arrives. Support gets about a dozen tickets a month about surprise overages.

### Problem

There is no warning before a workspace reaches the limit of its plan, and no way for an admin to see how close it is without opening the usage page.

### What the delivery includes

- An email to the billing admins when the workspace reaches 80% of the plan's monthly units, once per billing period.
- The same alert as a banner in the dashboard, dismissible per user.
- A setting in \`Billing › Alerts\` to change the threshold (50–95%) or turn it off.
- The metering events from #461 as the source; until it ships, the nightly usage job.

### Out of scope

- Hard caps that stop requests at the limit.
- Alerts per API key.

### Acceptance

- A workspace at 81% gets one email and one banner, and none again in the same period.
- Changing the threshold below the current usage sends the alert at the next usage update.`,
  invoice: `### Context

Finance teams reconcile the invoice with their internal cost centers per integration, and each integration has its own API key.

### Problem

The invoice PDF shows one line per plan. Customers ask support to break it down by key every month.

### What the delivery includes

- One line per API key with the units and the amount, sorted by amount.
- Keys deleted during the period appear with their last name and *deleted*.
- The same breakdown in the CSV export.

### Out of scope

- Cost centers configured in the product.`,
};

const bodyOf = (spec: Spec) =>
  spec.extra.rich !== undefined
    ? BODIES[spec.extra.rich]
    : `### Context

${spec.title} came up in the last planning. The current behavior works, but it costs time every week.

### What the delivery includes

- The change itself, behind no flag.
- Tests for the new path.
- A line in the changelog.`;

const WRITER = makeWritingDiscussion({ id: "d-alerts", title: "Usage alerts", archived: true });

// pullRequestsOf are the pull requests a card shows.
function pullRequestsOf(spec: Spec): CardPullRequest[] {
  const url = (number: number) => `https://github.com/${OWNER}/${spec.repository}/pull/${number}`;
  const repository = `${OWNER}/${spec.repository}`;
  if (spec.extra.prOpen !== undefined) {
    return [{ repository, number: spec.extra.prOpen, url: url(spec.extra.prOpen), state: "open" }];
  }
  if (spec.extra.merged !== undefined) {
    return [
      { repository, number: spec.extra.merged, url: url(spec.extra.merged), state: "merged" },
    ];
  }
  return [];
}

function dependencyOf(number: number): CardDependency {
  const spec = SPEC_OF.get(number);
  if (spec === undefined) {
    throw new Error(`no card #${number} in the scenes`);
  }
  return {
    key: keyOfSpec(spec),
    repository: `${OWNER}/${spec.repository}`,
    number,
    title: spec.title,
    url: issueUrl(spec),
    state: "open",
    status: spec.status,
    onBoard: true,
    pullRequests: pullRequestsOf(spec),
    satisfied: false,
  };
}

// actionOf is what Start task does for a card.
function actionOf(spec: Spec): string {
  if (spec.extra.closed === true) return "closed";
  if (spec.extra.unmanaged === true) return "add_to_board";
  if (spec.extra.other !== undefined) return "other_board";
  if (spec.extra.task !== undefined) return "has_task";
  return spec.repository === "billing" ? "clone" : "start";
}

// boardCard is a card of Platform Roadmap as its reading has it.
function boardCard(spec: Spec, readAt: string): BoardCard {
  const { extra } = spec;
  const status = STATUSES.findIndex(({ name }) => name === spec.status);
  const assignees =
    extra.asg ?? (spec.number % 4 === 0 ? [] : [PEOPLE[spec.number % 5] ?? "gmartins"]);
  const estimate = extra.est ?? (spec.number % 3 === 0 ? undefined : ESTIMATES[spec.number % 4]);
  const epic = extra.epic === undefined ? undefined : SPEC_OF.get(extra.epic);
  const closed = extra.closed === true;
  return makeBoardCard({
    key: keyOfSpec(spec),
    repository: `${OWNER}/${spec.repository}`,
    number: spec.number,
    title: spec.title,
    url: issueUrl(spec),
    state: closed ? "closed" : "open",
    body: bodyOf(spec),
    statusId: slug(spec.status),
    status: spec.status,
    final: closed || STATUSES[status]?.final === true,
    assignees: assignees.map((login) => ({ login, avatarUrl: "" })),
    fields: [
      { name: "Module", value: extra.module ?? MODULES[spec.number % 8] ?? "API" },
      ...(estimate === undefined ? [] : [{ name: "Estimate", value: estimate }]),
      ...(extra.start === undefined ? [] : [{ name: "Start date", value: extra.start }]),
    ],
    pullRequests: pullRequestsOf(spec),
    epic: epic === undefined ? null : issueOf(epic),
    epicBody: epic === undefined ? "" : `${epic.title} groups the work of the quarter.`,
    siblings:
      epic === undefined
        ? []
        : kidsOf(epic.number)
            .filter((number) => number !== spec.number)
            .flatMap((number): CardRelated[] => {
              const sibling = SPEC_OF.get(number);
              return sibling === undefined
                ? []
                : [
                    {
                      ...issueOf(sibling),
                      status: sibling.status,
                      onBoard: true,
                    },
                  ];
            }),
    dependencies: (extra.dep ?? []).map(dependencyOf),
    readAt,
    suggestedName:
      extra.name ?? slug(`${spec.number}-${spec.title}`).slice(0, 64).replace(/-+$/, ""),
    repositoryId: extra.unmanaged === true ? "" : repositoryId(spec.repository),
    activeTaskId: extra.task === undefined ? "" : (TASK_OF[extra.task] ?? ""),
    archivedTaskId: extra.archived === undefined ? "" : `archived-${extra.archived}`,
    archivedTaskName: extra.archived ?? "",
    action: actionOf(spec),
    otherBoard: extra.other ?? "",
    writtenBy: spec.number === 474 ? WRITER : null,
  });
}

// The open cards of Mobile App: thirty-one outside the final statuses, and four done.
const MOBILE_TITLES = [
  "Biometric unlock for the app",
  "Offline mode for the invoice list",
  "Push notification for payment failures",
  "Dark theme for the settings screen",
  "Share an invoice as a PDF",
  "Deep links to a workspace",
  "Onboarding checklist on first launch",
  "Fix the keyboard covering the amount field",
  "Widget with the balance of the month",
  "Scan a QR code to sign in",
  "Haptic feedback on approvals",
  "Pull to refresh on the cards screen",
  "Localize the app into Portuguese",
  "Crash on rotating the payment sheet",
  "Faster startup on older phones",
  "Sign in with a passkey",
  "Restore purchases after a reinstall",
  "Accessibility labels on the charts",
  "Remember the last workspace",
  "Support Dynamic Type",
  "Export the usage from the app",
  "Show the API key prefix",
  "Report a problem from the app",
  "Update the app icon",
  "Cache images of the avatars",
  "Pinch to zoom on the charts",
  "Confirm before leaving an unsaved form",
  "Retry the upload on a weak network",
  "Clear the cache from settings",
  "Rate the app prompt",
  "Show the plan in the account screen",
];
const MOBILE_DONE = [
  "Ship the first TestFlight build",
  "Set up the crash reporter",
  "Login screen",
  "Splash screen",
];

function mobileCard(
  number: number,
  title: string,
  status: "Todo" | "In progress" | "Done",
  readAt: string,
): BoardCard {
  const done = status === "Done";
  return makeBoardCard({
    key: `${OWNER}/ios#${number}`,
    repository: `${OWNER}/ios`,
    number,
    title,
    url: `https://github.com/${OWNER}/ios/issues/${number}`,
    state: done ? "closed" : "open",
    statusId: slug(status),
    status,
    final: done,
    assignees: [],
    readAt,
    suggestedName: slug(`${number}-${title}`).slice(0, 64).replace(/-+$/, ""),
    repositoryId: repositoryId("ios"),
    action: done ? "closed" : "start",
  });
}

const RATE_LIMIT_MESSAGE = "GitHub's rate limit was reached. It resets at 14:32.";

interface BoardMoment {
  reading?: boolean;
  failed?: boolean;
}

// platform is Platform Roadmap: read at 14:08, or at 12:10 with the reading of 14:06 failed.
function platform({ reading = false, failed = false }: BoardMoment = {}): Board {
  const readAt = failed ? at(120) : at(2);
  return makeBoard({
    id: PLATFORM_ID,
    owner: OWNER,
    number: 7,
    title: PLATFORM_TITLE,
    url: "https://github.com/orgs/acme/projects/7",
    statuses: boardStatuses(),
    repositoryIds: ["api", "web", "billing", "gateway", "docs"].map(repositoryId),
    readAt,
    reading,
    failure: failed
      ? { reason: "rate_limited", message: RATE_LIMIT_MESSAGE, failedAt: at(4) }
      : null,
    viewer: "gmartins",
    newCardStatus: "Backlog",
    cards: SPECS.map((spec) => boardCard(spec, readAt)),
  });
}

// tools is Internal Tools: no issues, read the day before.
function tools(): Board {
  return makeBoard({
    id: TOOLS_ID,
    owner: OWNER,
    number: 3,
    title: "Internal Tools",
    url: "https://github.com/orgs/acme/projects/3",
    repositoryIds: [repositoryId("tools")],
    readAt: new Date("2026-09-23T12:00:00").toISOString(),
    viewer: "gmartins",
    cards: [],
  });
}

// mobile is Mobile App: thirty-one open cards, read at 11:30, its reading of 13:52 failed.
function mobile(): Board {
  const readAt = at(160);
  return makeBoard({
    id: MOBILE_ID,
    owner: OWNER,
    number: 5,
    title: "Mobile App",
    url: "https://github.com/orgs/acme/projects/5",
    statuses: [
      { id: "todo", name: "Todo", final: false },
      { id: "in-progress", name: "In progress", final: false },
      { id: "done", name: "Done", final: true },
    ],
    repositoryIds: [repositoryId("ios")],
    readAt,
    failure: { reason: "rate_limited", message: RATE_LIMIT_MESSAGE, failedAt: at(18) },
    viewer: "gmartins",
    cards: [
      ...MOBILE_TITLES.map((title, index) =>
        mobileCard(100 + index, title, index % 4 === 0 ? "In progress" : "Todo", readAt),
      ),
      ...MOBILE_DONE.map((title, index) => mobileCard(200 + index, title, "Done", readAt)),
    ],
  });
}

// repositories are the repositories of the scenes: billing has no clone, the clone of infra is gone.
function repositories(): Repository[] {
  const named = (name: string, boardId: string, overrides: Partial<Repository> = {}) =>
    makeRepository({
      id: repositoryId(name),
      owner: OWNER,
      name,
      fullName: `${OWNER}/${name}`,
      path: `/home/dev/code/${name}`,
      boardId,
      ...overrides,
    });
  return [
    named("api", PLATFORM_ID),
    named("billing", PLATFORM_ID, { cloned: false, path: "" }),
    named("docs", PLATFORM_ID),
    named("gateway", PLATFORM_ID),
    named("web", PLATFORM_ID),
    named("ios", MOBILE_ID),
    named("tools", TOOLS_ID),
    named("infra", "", { missing: true, path: "/home/dev/code/infra" }),
  ];
}

const WORKTREE = "/home/dev/.local/share/myspec/worktrees/acme/api";

// stepsOf are the steps of a plan of total steps with the current one at n, the ones before it done.
function stepsOf(n: number, total: number, current: Partial<Step> = {}): Step[] {
  return Array.from({ length: total }, (_, index) => {
    const number = index + 1;
    const base = makeStep({
      number,
      title: `Step ${number}`,
      file: `${number}-step-${number}.md`,
      reviewMode: "agent",
    });
    if (number < n) {
      return { ...base, status: "done", commitSha: `c19f0${number}e`, reviewModeEditable: false };
    }
    return number === n ? { ...base, ...current } : base;
  });
}

// taskOf is a task of the scenes on the card of the mock, on the board Platform Roadmap.
function taskOf(
  id: string,
  name: string,
  number: number,
  overrides: Partial<TaskSummary>,
): TaskSummary {
  const spec = SPEC_OF.get(number);
  if (spec === undefined) {
    throw new Error(`no card #${number} in the scenes`);
  }
  const epic = spec.extra.epic === undefined ? undefined : SPEC_OF.get(spec.extra.epic);
  return makeTask({
    id,
    name,
    repositoryId: repositoryId(spec.repository),
    repository: `${OWNER}/${spec.repository}`,
    card: makeTaskCard({
      boardId: PLATFORM_ID,
      key: keyOfSpec(spec),
      repository: `${OWNER}/${spec.repository}`,
      number,
      title: spec.title,
      url: issueUrl(spec),
      status: spec.status,
      epic: epic === undefined ? null : issueOf(epic),
    }),
    reviewMode: "agent",
    hasPrd: true,
    hasTechSpec: true,
    createdAt: at(60 * 24),
    updatedAt: at(5),
    ...overrides,
  });
}

// tasks are the four tasks of the scenes, with the situations the mock says.
function tasks(): TaskSummary[] {
  const stepPlace = (kind: string, step: number) => ({ kind, stage: "", step });
  return [
    taskOf("t1", "rate-limit-per-api-key", 412, {
      stage: "implementation",
      currentStep: 3,
      sessionStatus: "needs_answer",
      worktreePath: WORKTREE,
      steps: stepsOf(3, 7, {
        status: "agent_review",
        reviewPass: 2,
        reviewer: makeStepReviewer({
          sessionStage: "step_review:3",
          sessionStatus: "needs_answer",
        }),
      }),
      situations: [
        makeSituation({
          id: "t1-question",
          taskId: "t1",
          kind: "question",
          group: "waiting",
          place: stepPlace("step_review", 3),
          startedAt: at(18),
        }),
      ],
    }),
    taskOf("t7", "rotate-api-keys-without-downtime", 441, {
      stage: "implementation",
      currentStep: 2,
      sessionStatus: "working",
      turnRunning: true,
      worktreePath: WORKTREE,
      steps: stepsOf(2, 5, {
        status: "agent_review",
        reviewPass: 2,
        reviewer: makeStepReviewer({
          sessionStage: "step_review:2",
          sessionStatus: "working",
          turnRunning: true,
        }),
      }),
    }),
    taskOf("t3", "retry-failed-billing-webhooks", 430, {
      stage: "tech_spec",
      situations: [
        makeSituation({
          id: "t3-question",
          taskId: "t3",
          kind: "question",
          group: "waiting",
          place: { kind: "stage", stage: "tech_spec", step: 0 },
          startedAt: at(12),
        }),
      ],
    }),
    taskOf("t8", "deprecate-v1-webhooks", 449, {
      stage: "plan",
      sessionStatus: "error",
      situations: [
        makeSituation({
          id: "t8-error",
          taskId: "t8",
          kind: "session_error",
          group: "error",
          place: { kind: "stage", stage: "plan", step: 0 },
          startedAt: at(7),
        }),
      ],
    }),
  ];
}

// The reviews the Home counts: four pending, in three repositories.
function reviewCenter() {
  const pending = (number: number, repository: string) =>
    makePullRequestRow({
      key: `${OWNER}/${repository}#${number}`,
      repositoryId: repositoryId(repository),
      repository: `${OWNER}/${repository}`,
      number,
    });
  return makeReviewCenter({
    readAt: at(3),
    pendingCount: 4,
    pullRequests: [
      pending(2310, "web"),
      pending(2302, "web"),
      pending(1291, "api"),
      pending(88, "gateway"),
    ],
  });
}

// discussions is the active discussion of the mock, on #455 and #461.
function discussions() {
  return [
    makeDiscussion({
      id: "d1",
      boardId: PLATFORM_ID,
      board: PLATFORM_TITLE,
      title: "Usage-based pricing tiers",
      cards: [455, 461].map((number) => {
        const spec = SPEC_OF.get(number);
        if (spec === undefined) {
          throw new Error(`no card #${number} in the scenes`);
        }
        return makeDiscussionCard({
          key: keyOfSpec(spec),
          repository: `${OWNER}/${spec.repository}`,
          number,
          title: spec.title,
          url: issueUrl(spec),
        });
      }),
      createdAt: at(60 * 20),
    }),
  ];
}

// stateOf is the state of the scenes, with the boards given, or the three of the mock.
function stateOf(
  platformBoard: Board,
  {
    items = true,
    boards = [tools(), mobile(), platformBoard],
  }: { items?: boolean; boards?: Board[] } = {},
): State {
  return makeState({
    repositories: repositories(),
    boards,
    tasks: items ? tasks() : [],
    history: [
      makeArchivedTask({
        id: "archived-409-hash-api-keys-at-rest",
        name: "409-hash-api-keys-at-rest",
        repositoryId: repositoryId("api"),
        repository: `${OWNER}/api`,
      }),
    ],
    historySummary: makeHistorySummary({ tasks: 1 }),
    discussions: items ? discussions() : [],
    reviewCenter: reviewCenter(),
    cloneFolder: "/home/dev/code",
  });
}

// withoutCard is the state with a card gone from the reading of Platform Roadmap.
function withoutCard(app: State, number: number): State {
  return {
    ...app,
    boards: (app.boards ?? []).map((board) =>
      board.id === PLATFORM_ID
        ? { ...board, cards: (board.cards ?? []).filter((card) => card.number !== number) }
        : board,
    ),
  };
}

// the row of a card in the list, by its number.
const rowOf = (number: number) =>
  screen.getByRole("treeitem", { name: new RegExp(`^#${number} `) });

const HOME: Location = { kind: "home" };
const PLATFORM: Location = { kind: "board", id: PLATFORM_ID };

/**
 * boardScene is what a test draws for a moment: the state of the scene, its place, what the board
 * view remembers, and what the user does once it is on screen. The Home has Rate limit per API key
 * behind it, the place Continue offers to go back to.
 */
export function boardScene(name: BoardSceneName): BoardSceneSetup {
  const open = (number: number) => async (user: UserEvent) => {
    await user.click(rowOf(number));
  };
  const onBoard = (state: State, after?: BoardSceneSetup["after"]): BoardSceneSetup => ({
    state,
    location: PLATFORM,
    back: [],
    storage: {},
    ...(after === undefined ? {} : { after }),
  });
  switch (name) {
    case "home":
      return {
        state: stateOf(platform()),
        location: HOME,
        back: [{ kind: "task", id: "t1" }],
        storage: {},
      };
    case "home-none":
      return {
        state: stateOf(platform(), { items: false }),
        location: HOME,
        back: [],
        storage: {},
      };
    case "home-disc":
      return {
        state: stateOf(platform()),
        location: HOME,
        back: [{ kind: "task", id: "t1" }],
        storage: {},
        after: async (user) => {
          await user.click(screen.getByRole("button", { name: /^New discussion/ }));
          await user.click(await screen.findByRole("button", { name: /^Board: / }));
        },
      };
    case "board":
      // The mock has the keyboard on the row of #474, which shows its keys.
      return onBoard(stateOf(platform()), async () => {
        act(() => rowOf(474).focus());
      });
    case "card":
      return onBoard(stateOf(platform()), open(474));
    case "create-card":
      // The Settings of the mock have Agent as the review mode of a new task.
      return onBoard({ ...stateOf(platform()), reviewModeDefault: "agent" }, async () => {
        act(() => useAppStore.getState().openNewTask({ boardId: PLATFORM_ID, key: cardKey(474) }));
      });
    case "reading":
      return onBoard(stateOf(platform({ reading: true })));
    case "failed":
      return onBoard(stateOf(platform({ failed: true })));
    case "empty":
      return { ...onBoard(stateOf(platform())), location: { kind: "board", id: TOOLS_ID } };
    case "filtered":
      return {
        ...onBoard(stateOf(platform())),
        storage: {
          [boardViewKey(PLATFORM_ID)]: JSON.stringify({
            filters: { ...EMPTY_FILTERS, query: "refund", assignee: "tchen" },
          }),
        },
      };
    case "stale-card":
      return onBoard(stateOf(platform()), async (user) => {
        await open(466)(user);
        act(() => {
          const { app } = useAppStore.getState();
          if (app !== null) {
            useAppStore.setState({ app: withoutCard(app, 466) });
          }
        });
      });
    case "no-clone":
      return onBoard(stateOf(platform()), open(471));
    case "select":
      return onBoard(stateOf(platform()), async (user) => {
        await user.click(screen.getByRole("button", { name: "More actions" }));
        await user.click(await screen.findByRole("menuitem", { name: /^Select cards to discuss/ }));
        for (const number of [455, 461, 475]) {
          await user.click(rowOf(number));
        }
      });
    case "create":
      // The Settings of the mock have Agent as the review mode of a new task.
      return onBoard({ ...stateOf(platform()), reviewModeDefault: "agent" }, async (user) => {
        act(() => useAppStore.getState().openNewTask());
        await user.type(await screen.findByRole("textbox", { name: "Name" }), "Rate limit v2");
        // The context is pasted: typed key by key, it redraws the dialog over the board once per key.
        await user.click(screen.getByRole("textbox", { name: "Context" }));
        await user.paste(
          "Add a daily cap per workspace on top of the rate limit per key. At the cap, answer 429 with a message that names the cap.",
        );
        await user.click(screen.getByRole("radio", { name: "One-Shot" }));
        await user.click(screen.getByRole("button", { name: /^Models/ }));
        await user.click(await screen.findByRole("button", { name: /^One-Shot planning model:/ }));
        await user.click(await screen.findByRole("menuitemradio", { name: "xhigh" }));
        await user.keyboard("{Escape}");
      });
  }
}
