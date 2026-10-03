/**
 * The scenes of the discussion screen and of the dialog that starts a discussion
 * (design/tasks/09-discussion.md §1, pronto 1): the discussion Usage-based pricing tiers of the board
 * Platform Roadmap, over #455 and #461, at the thirteen moments of the mock, with its flags. The data
 * is the one of the mock (design/lab/13-screen-discussion/src/disc.js and pub.js). The scene tests
 * draw DiscussionView and NewDiscussionDialog from them.
 */

import { act, screen, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, vi } from "vitest";
import { focusDraft, focusRequest } from "@/lib/focus";
import type { Location } from "@/lib/locations";
import type {
  ActionEntry,
  Board,
  BoardCard,
  DiscussionCard,
  DiscussionSummary,
  Draft,
  DraftBefore,
  DraftDependency,
  DraftHold,
  DraftRef,
  Entry,
  MarkerEntry,
  MarkerType,
  Repository,
  State,
  TaskSummary,
  UserEntry,
} from "@/lib/wails";
import { DISCUSSION_STAGE, sessionKey } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { fromTranscript, type TranscriptState } from "@/store/transcript";
import { inStep } from "@/test/task-scenes";
import {
  makeAction,
  makeArchivedDiscussion,
  makeBoard,
  makeBoardCard,
  makeDiscussion,
  makeDiscussionCard,
  makeDraft,
  makeEntry,
  makeModelDefaults,
  makeRepository,
  makeSituation,
  makeState,
  makeStepReviewer,
  makeTranscript,
} from "@/test/wails-mock";

/** DISCUSSION_SCENES are the thirteen moments of the mock: the dialog that starts the discussion, and twelve of its screen. */
export const DISCUSSION_SCENES = [
  "start",
  "talk",
  "unreadable",
  "drafts",
  "rewrite",
  "publish",
  "published",
  "partial-fail",
  "epic",
  "epic-off",
  "many",
  "done",
  "archive-blocked",
] as const;

/** DiscussionSceneName is one moment of the mock. */
export type DiscussionSceneName = (typeof DISCUSSION_SCENES)[number];

/** ScreenScene is a moment of the screen of the discussion: every one but the dialog that starts it. */
type ScreenScene = Exclude<DiscussionSceneName, "start">;

/**
 * DiscussionFlags are the flags of the mock: home opens the dialog from the Home, with the field
 * Board; error stops the session on an error; after is the moment after approving the last card of
 * the epic, with the epic created and draft 2 on its way; edit opens the edit of draft 3; archive,
 * group and delete open their dialog; panel opens Details or Documents; menu opens the ⋯.
 */
export interface DiscussionFlags {
  home?: boolean;
  error?: boolean;
  after?: boolean;
  edit?: boolean;
  archive?: boolean;
  group?: boolean;
  delete?: boolean;
  panel?: "Details" | "Documents";
  menu?: boolean;
}

/** DiscussionScene is what a test draws for a moment: the state, the place and what the user did. */
export interface DiscussionScene {
  state: State;
  location: Location;
  /** transcripts are the conversations on screen, already read, by sessionKey. */
  transcripts: Record<string, TranscriptState>;
  /** storage is what the screen remembers in localStorage, by key. */
  storage: Record<string, string>;
  /** now is the moment of the scene, local time as the mock writes it. */
  now: string;
  /** after drives what the scene has open: the current draft, a dialog, a panel, the ⋯. */
  after?: (user: UserEvent) => Promise<void>;
}

// DAY is the day of the scenes; the hours are written without a zone, as board-scenes.ts writes its
// moment, so they are the local ones on any machine.
const DAY = "2026-09-24";

// local is an hour of a day of the scenes, "14:02" or "14:02:10", as the mock writes it.
function local(time: string, day = DAY): string {
  return `${day}T${time.length === 5 ? `${time}:00` : time}`;
}

// at is the instant of an hour of a day of the scenes, as the Go writes it.
function at(time: string, day = DAY): string {
  return new Date(local(time, day)).toISOString();
}

// before is the instant some seconds before another.
function before(iso: string, seconds: number): string {
  return new Date(Date.parse(iso) - seconds * 1000).toISOString();
}

/** SCENE_NOW is the hour of each scene, by the material (§1, pronto 1). */
const SCENE_NOW: Record<DiscussionSceneName, string> = {
  start: local("14:02"),
  talk: local("14:11"),
  unreadable: local("14:28"),
  drafts: local("14:33"),
  rewrite: local("14:38"),
  publish: local("15:10"),
  published: local("15:13"),
  "partial-fail": local("15:12"),
  epic: local("14:40"),
  "epic-off": local("14:40"),
  many: local("14:33"),
  done: local("15:53"),
  "archive-blocked": local("14:40"),
};

/**
 * fixDiscussionSceneClock stops the clock of the page at the moment of a scene for each test that
 * runs next in the describe it is called in, and gives it back after, with what the screen
 * remembered; only Date is faked, so the timers of the page still run.
 */
export function fixDiscussionSceneClock(scene: DiscussionScene): void {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(scene.now));
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });
}

// ---------------- The repositories and the boards ----------------

const OWNER = "acme";

/** ME is the account of gh on the machine of the scenes. */
const ME = "gmartins";

const PLATFORM_ID = "board-platform";
const TOOLS_ID = "board-tools";
const MOBILE_ID = "board-mobile";
const PLATFORM_TITLE = "Platform Roadmap";

const OPUS = "claude-opus-5-5[1m]";

const repositoryId = (name: string) => `repo-${name}`;
const issueUrl = (repository: string, number: number) =>
  `https://github.com/${OWNER}/${repository}/issues/${number}`;

// PLATFORM_REPOSITORIES are the repositories of Platform Roadmap, in the order of the board.
const PLATFORM_REPOSITORIES = ["api", "billing", "docs", "gateway", "web"];

// repositories are the repositories of the scenes: the five of Platform Roadmap, billing without a
// clone; ios of Mobile App and tools of Internal Tools; and status-page, which left the board.
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
    ...PLATFORM_REPOSITORIES.map((name) =>
      named(name, PLATFORM_ID, name === "billing" ? { cloned: false, path: "" } : {}),
    ),
    named("ios", MOBILE_ID),
    named("tools", TOOLS_ID),
    named("status-page", ""),
  ];
}

/** MODULES are the options of the field Module of Platform Roadmap. */
const MODULES = ["API", "Auth", "Billing", "Dashboard", "Docs", "Gateway", "Infra", "Web app"];

const STATUSES = ["Backlog", "Ready", "In progress", "Code review", "Done"];

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** CardSpec is a card of Platform Roadmap the discussion reads: its epic and what it depends on. */
interface CardSpec {
  number: number;
  title: string;
  status: string;
  repository: string;
  module: string;
  epic: number | null;
  dependencies: number[];
  body: string;
}

// BODY_461 is the body of #461 on GitHub, which draft 5 rewrites.
const BODY_461 = `## Context

The gateway counts requests per workspace in memory and flushes a total every hour.

## Problem

Invoicing needs the total per workspace.

## What the delivery includes

- Tests for a flush under load.

## Out of scope

- Metering of websocket traffic.`;

// BODY_474 is the body of #474 on GitHub, which draft 8 of the ten rewrites.
const BODY_474 = `## Context

Customers on usage-based plans find out they went over the plan when the invoice arrives.

## What the delivery includes

- An email to the billing admins when the workspace reaches 80%
  of the plan's monthly units, once per billing period.
- The metering events from #461 as the source.

## Out of scope

- Alerts per API key.`;

const BODY_455 = `## Context

Every workspace pays a flat price per plan, and heavy API users cost more than they pay.

## What the delivery includes

- Sell plans with an included volume of requests and a price per 1,000 requests over it.
- The tiers on the pricing page and in the plan picker.

## Out of scope

- Discounts per contract.`;

// plainBody is the body of a card of the board the scenes don't read closely.
const plainBody = (title: string) => `## Context

${title} came up in the last planning.

## What the delivery includes

- The change itself, behind no flag.
- Tests for the new path.`;

// CARDS are the cards of Platform Roadmap the scenes need: the epic of #455 and #461 with its cards,
// and the dependency of #455.
const CARDS: CardSpec[] = [
  {
    number: 450,
    title: "Usage-based billing",
    status: "In progress",
    repository: "billing",
    module: "Billing",
    epic: null,
    dependencies: [],
    body: "Usage-based billing groups the work of the quarter.",
  },
  {
    number: 455,
    title: "Usage-based pricing tiers",
    status: "Backlog",
    repository: "billing",
    module: "Billing",
    epic: 450,
    dependencies: [490],
    body: BODY_455,
  },
  {
    number: 461,
    title: "Metering events from the gateway",
    status: "Backlog",
    repository: "gateway",
    module: "Gateway",
    epic: 450,
    dependencies: [],
    body: BODY_461,
  },
  {
    number: 466,
    title: "Proration on plan change",
    status: "Backlog",
    repository: "billing",
    module: "Billing",
    epic: 450,
    dependencies: [],
    body: plainBody("Proration on plan change"),
  },
  {
    number: 471,
    title: "Invoice PDF with line items per API key",
    status: "Ready",
    repository: "billing",
    module: "Billing",
    epic: 450,
    dependencies: [455],
    body: plainBody("Invoice PDF with line items per API key"),
  },
  {
    number: 474,
    title: "Usage alerts at 80% of the plan",
    status: "Ready",
    repository: "api",
    module: "Billing",
    epic: 450,
    dependencies: [461],
    body: BODY_474,
  },
  {
    number: 475,
    title: "Plan limits on the pricing page",
    status: "Backlog",
    repository: "web",
    module: "Dashboard",
    epic: 450,
    dependencies: [],
    body: plainBody("Plan limits on the pricing page"),
  },
  {
    number: 490,
    title: "Idempotency keys on POST /v2/charges",
    status: "Backlog",
    repository: "billing",
    module: "Billing",
    epic: null,
    dependencies: [],
    body: plainBody("Idempotency keys on POST /v2/charges"),
  },
];

function cardSpec(number: number): CardSpec {
  const spec = CARDS.find((card) => card.number === number);
  if (spec === undefined) {
    throw new Error(`no card #${number} in the scenes`);
  }
  return spec;
}

const cardKey = (spec: CardSpec) => `${OWNER}/${spec.repository}#${spec.number}`;

function issueOf(spec: CardSpec) {
  return {
    key: cardKey(spec),
    repository: `${OWNER}/${spec.repository}`,
    number: spec.number,
    title: spec.title,
    url: issueUrl(spec.repository, spec.number),
    state: "open",
  };
}

// boardCard is a card of Platform Roadmap as its reading has it.
function boardCard(spec: CardSpec, readAt: string): BoardCard {
  const epic = spec.epic === null ? null : cardSpec(spec.epic);
  const siblings =
    epic === null
      ? []
      : CARDS.filter((card) => card.epic === epic.number && card.number !== spec.number);
  return makeBoardCard({
    ...issueOf(spec),
    body: spec.body,
    statusId: slug(spec.status),
    status: spec.status,
    final: false,
    assignees: [],
    fields: [{ name: "Module", value: spec.module }],
    epic: epic === null ? null : issueOf(epic),
    epicBody: epic === null ? "" : epic.body,
    siblings: siblings.map((card) => ({ ...issueOf(card), status: card.status, onBoard: true })),
    dependencies: spec.dependencies.map((number) => {
      const on = cardSpec(number);
      return {
        ...issueOf(on),
        status: on.status,
        onBoard: true,
        pullRequests: [],
        satisfied: false,
      };
    }),
    readAt,
    suggestedName: slug(`${spec.number}-${spec.title}`),
    repositoryId: repositoryId(spec.repository),
    action: spec.repository === "billing" ? "clone" : "start",
  });
}

// boards are the three boards of the mock, in its order: Internal Tools read yesterday, Mobile App
// with its last reading failed 18 minutes ago, and Platform Roadmap read two minutes ago.
function boards(now: string): Board[] {
  const readAt = before(now, 120);
  return [
    makeBoard({
      id: TOOLS_ID,
      owner: OWNER,
      number: 3,
      title: "Internal Tools",
      url: "https://github.com/orgs/acme/projects/3",
      repositoryIds: [repositoryId("tools")],
      readAt: at("12:00", "2026-09-23"),
      viewer: ME,
    }),
    makeBoard({
      id: MOBILE_ID,
      owner: OWNER,
      number: 5,
      title: "Mobile App",
      url: "https://github.com/orgs/acme/projects/5",
      repositoryIds: [repositoryId("ios")],
      readAt: before(now, 160 * 60),
      failure: {
        reason: "rate_limited",
        message: "GitHub's rate limit was reached. It resets at 16:32.",
        failedAt: before(now, 18 * 60),
      },
      viewer: ME,
    }),
    makeBoard({
      id: PLATFORM_ID,
      owner: OWNER,
      number: 7,
      title: PLATFORM_TITLE,
      url: "https://github.com/orgs/acme/projects/7",
      statuses: STATUSES.map((name) => ({ id: slug(name), name, final: name === "Done" })),
      repositoryIds: PLATFORM_REPOSITORIES.map(repositoryId),
      readAt,
      viewer: ME,
      newCardStatus: "Backlog",
      cards: CARDS.map((spec) => boardCard(spec, readAt)),
    }),
  ];
}

// ---------------- The discussion ----------------

const DISCUSSION_ID = "d1";
const TITLE = "Usage-based pricing tiers";

/** WHAT is what the user wrote in What to discuss. */
const WHAT =
  "We want to charge by usage: tiers with an included volume and a price for what goes over. The gateway already meters requests (#461). What's missing to sell it, and in which repositories?";

/** ENTRY_CARDS are the numbers of the cards the discussion starts from. */
const ENTRY_CARDS = [455, 461];

function discussionCard(number: number): DiscussionCard {
  const spec = cardSpec(number);
  return makeDiscussionCard({
    key: cardKey(spec),
    repository: `${OWNER}/${spec.repository}`,
    number,
    title: spec.title,
    url: issueUrl(spec.repository, number),
  });
}

/** CONTEXT is the context the session opened with, as the Go side assembles it from the board and the cards. */
const CONTEXT = `# ${TITLE}

Board ${PLATFORM_TITLE} (acme · project 7). The clones of the board: acme/api at \`~/code/api\`, acme/docs at \`~/code/docs\`, acme/gateway at \`~/code/gateway\` and acme/web at \`~/code/web\`. acme/billing isn't cloned.

## What to discuss

${WHAT}

## #455 Usage-based pricing tiers · acme/billing · Backlog

Module Billing · epic #450 Usage-based billing · depends on #490.

${BODY_455}

## #461 Metering events from the gateway · acme/gateway · Backlog

Module Gateway · epic #450 Usage-based billing.

${BODY_461}

## The epic #450 Usage-based billing · acme/billing · In progress

Usage-based billing groups the work of the quarter.

## The other cards of the epic

- #466 Proration on plan change · acme/billing · Backlog
- #471 Invoice PDF with line items per API key · acme/billing · Ready
- #474 Usage alerts at 80% of the plan · acme/api · Ready
- #475 Plan limits on the pricing page · acme/web · Backlog

## The dependency

- #490 Idempotency keys on POST /v2/charges · acme/billing · Backlog`;

// ---------------- The drafts ----------------

// body is the body of a draft as the agent writes it: the context, the problem, what the delivery
// includes and what it leaves out.
function body(context: string, problem: string, includes: string[], out: string[]): string {
  return [
    `## Context\n\n${context}`,
    `## Problem\n\n${problem}`,
    `## What the delivery includes\n\n${includes.map((item) => `- ${item}`).join("\n")}`,
    `## Out of scope\n\n${out.map((item) => `- ${item}`).join("\n")}`,
  ].join("\n\n");
}

/** Out is the issue the publication of a draft makes or changes. */
interface Out {
  outcome: "created" | "updated";
  repository: string;
  number: number;
}

/** DraftSpec is a draft of the mock before it becomes a Draft. */
interface DraftSpec {
  /** n is the number of the draft in the mock, its position in drafts.md. */
  n: number;
  id: string;
  kind: "new" | "update" | "epic";
  title: string;
  repository: string;
  module: string;
  /** epic is the number of its epic among the drafts of the round. */
  epic?: number;
  /** epicIssue is its epic when that is an issue on GitHub: the repository, the number, the title. */
  epicIssue?: [string, number, string];
  /** dependencies are the numbers of the drafts of the round it depends on. */
  dependencies?: number[];
  /** card is the number of the card of the board an update rewrites. */
  card?: number;
  body: string;
  out: Out;
  warnings?: string[];
}

const EPIC_450: [string, number, string] = ["billing", 450, "Usage-based billing"];

// The titles of drafts 2, 3 and 4 before the revision of 14:32, and after it.
const TITLES_BEFORE: Record<number, string> = {
  2: "Tier limits and overage prices in the plans table",
  3: "Charge metered overage on the monthly invoice",
  4: "Plan picker shows the tiers and the overage price",
};
const TITLES_AFTER: Record<number, string> = {
  2: "Tier limits and overage prices",
  3: "Overage on the monthly invoice",
  4: "Plan picker with tiers and overage",
};

const created = (repository: string, number: number): Out => ({
  outcome: "created",
  repository,
  number,
});
const updated = (repository: string, number: number): Out => ({
  outcome: "updated",
  repository,
  number,
});

// roundOne are the five drafts of round 1 (ROUND1 of the mock), with the titles before the
// revision of 14:32 or after it, when the plan picker depends on the invoice and not on the tiers.
function roundOne(revised: boolean): DraftSpec[] {
  const titles = revised ? TITLES_AFTER : TITLES_BEFORE;
  return [
    {
      n: 1,
      id: "pricing-tiers",
      kind: "epic",
      title: "Pricing tiers with metered overage",
      repository: "billing",
      module: "",
      body: body(
        "Every workspace pays a flat price per plan today, and heavy API users cost more than they pay. Card #455 asks for tiers; #461 already meters requests at the gateway.",
        "There is no way to sell a plan with an included volume and charge what goes over it.",
        [
          "The limits and overage prices of each tier, as data.",
          "The overage on the monthly invoice, from the metering events.",
          "The plan picker showing the tiers and what goes over costs.",
        ],
        ["Grandfathering current customers.", "Alerts, which #474 covers."],
      ),
      out: created("billing", 478),
    },
    {
      n: 2,
      id: "tier-limits",
      kind: "new",
      title: titles[2] ?? "",
      repository: "billing",
      module: "Billing",
      epic: 1,
      body: body(
        "The `plans` table in acme/billing has a flat `monthly_price` per plan and nothing about volume.",
        "Invoicing and the plan picker need, per tier, the requests included per month and the price of each 1,000 requests over it.",
        [
          "`included_requests` and `overage_per_1k` on each plan, with a migration that fills today's plans as unlimited.",
          "An admin form in Billing › Plans to edit them.",
          "The values in the plans API response.",
        ],
        ["Changing today's prices."],
      ),
      out: created("billing", 479),
    },
    {
      n: 3,
      id: "invoice-overage",
      kind: "new",
      title: titles[3] ?? "",
      repository: "billing",
      module: "Billing",
      epic: 1,
      dependencies: [2, 5],
      body: body(
        "The monthly invoice is built by `invoice.Build` from the plan's flat price. The gateway will emit one metering event per request and API key (#461).",
        "Requests over the tier's included volume aren't charged.",
        [
          "A line `Overage · N requests` on the invoice, priced per 1,000.",
          "The count from the metering events of the billing period, per workspace.",
          "An invoice without overage keeps its lines as today.",
        ],
        ["Overage per API key on the invoice: the admin report covers it."],
      ),
      out: created("billing", 480),
    },
    {
      n: 4,
      id: "plan-picker",
      kind: "new",
      title: titles[4] ?? "",
      repository: "web",
      module: "Web app",
      epic: 1,
      dependencies: revised ? [3] : [2],
      body: body(
        "The plan picker in acme/web lists the plans with their flat price.",
        "A customer can't see what a tier includes or what going over costs before choosing it.",
        [
          "Each tier with its included requests and the overage price.",
          "An estimate from the workspace's last 30 days: *At your usage, about $412 a month*.",
        ],
        ["Changing the plan from the picker's estimate."],
      ),
      out: created("web", 2302),
    },
    {
      n: 5,
      id: "metering-per-key",
      kind: "update",
      title: "Metering events per API key from the gateway",
      repository: "gateway",
      module: "Gateway",
      epicIssue: EPIC_450,
      card: 461,
      body: `## Context

The gateway counts requests per workspace in memory and flushes a total every hour.

## Problem

Overage per tier and the admin report need the count per API key, durable, per request.

## What the delivery includes

- One metering event per request, with the workspace, the API key and the route, to the \`metering\` topic.
- At-least-once delivery, deduplicated by request id downstream.
- The hourly total kept until the invoice reads the events.
- Tests for a flush under load.

## Out of scope

- Metering of websocket traffic.`,
      out: updated("gateway", 461),
    },
  ];
}

// roundOfTen is the largest real round (MANY of the mock): ten drafts, an epic of five cards, two
// updates, a draft whose repository left the board and one with a warning.
function roundOfTen(): DraftSpec[] {
  return [
    ...roundOne(false),
    {
      n: 6,
      id: "overage-report",
      kind: "new",
      title: "Overage report per workspace for admins",
      repository: "web",
      module: "Web app",
      epic: 1,
      dependencies: [5],
      body: body(
        "Admins only see the invoice total.",
        "They can't tell which API key drove the overage.",
        ["A report per billing period, per API key, from the metering events.", "CSV export."],
        ["Alerts."],
      ),
      out: created("web", 2303),
    },
    {
      n: 7,
      id: "proration",
      kind: "new",
      title: "Proration when a workspace changes tier mid-period",
      repository: "billing",
      module: "Billing",
      epic: 1,
      dependencies: [2],
      body: body(
        "A workspace can change plan any day.",
        "The included volume and the overage are per period, and a change mid-period has no rule.",
        [
          "The included volume prorated by days on each tier.",
          "The overage counted against the prorated volume.",
        ],
        ["Refunds."],
      ),
      out: created("billing", 481),
    },
    {
      n: 8,
      id: "usage-alerts",
      kind: "update",
      title: "Usage alerts at 80% of the tier's included requests",
      repository: "api",
      module: "Billing",
      epicIssue: EPIC_450,
      card: 474,
      dependencies: [5],
      body: BODY_474.replace("of the plan's monthly units", "of the tier's included requests"),
      out: updated("api", 474),
    },
    {
      n: 9,
      id: "status-page-tiers",
      kind: "new",
      title: "Tier names and prices on the public status page",
      repository: "status-page",
      module: "Web app",
      body: body(
        "The public status page lists the plans by name.",
        "The tiers need their names and included volume there.",
        ["The tiers and their included requests.", "A link to the pricing page."],
        ["Prices per region."],
      ),
      out: created("status-page", 88),
    },
    {
      n: 10,
      id: "support-usage-view",
      kind: "new",
      title: "Support view of a workspace's metered usage",
      repository: "web",
      module: "Web app",
      body: body(
        "Support answers overage questions from the invoice PDF.",
        "They can't see the requests behind a charge.",
        ["A read-only view of a workspace's metering per day and per API key."],
        ["Editing a charge."],
      ),
      out: created("web", 2304),
      warnings: ["The dependency on Websocket metering is no longer among the drafts."],
    },
  ];
}

// ROUND_TWO is the draft of round 2 of the scene done: the admin report, in the epic that exists.
const ROUND_TWO: DraftSpec[] = [
  {
    n: 1,
    id: "admin-overage-report",
    kind: "new",
    title: "Overage report per workspace for admins",
    repository: "web",
    module: "Web app",
    epicIssue: EPIC_450,
    body: body(
      "Admins only see the invoice total.",
      "They can't tell which workspace drove the overage.",
      ["A report per billing period and per workspace, from the metering events.", "CSV export."],
      ["Overage per API key."],
    ),
    out: created("web", 2305),
  },
];

// ROUND_THREE is the draft of round 3 of the scene done (ROUND3 of the mock): the grandfathering,
// in the epic round 1 created.
const ROUND_THREE: DraftSpec[] = [
  {
    n: 1,
    id: "grandfathering",
    kind: "new",
    title: "Keep current customers on their plan for 90 days",
    repository: "billing",
    module: "Billing",
    epicIssue: ["billing", 478, "Pricing tiers with metered overage"],
    body: body(
      "Current customers are on flat plans.",
      "Moving them to tiers the day they ship changes their bill without notice.",
      [
        "90 days on the current plan from the day the tiers ship.",
        "An email 30 days before the move.",
      ],
      ["Custom deals."],
    ),
    out: created("billing", 483),
  },
];

/** BLOCKED are the repositories the board no longer manages: a draft in one can't publish. */
const BLOCKED = new Set(["status-page"]);

/**
 * RoundMoment is where the drafts of a round stand, by their number in the mock: the decisions,
 * the hour each one went to GitHub, the one that failed, the one being written, and what the last
 * revision changed.
 */
interface RoundMoment {
  approved: number[];
  discarded?: number[];
  published?: Record<number, string>;
  failed?: number;
  publishing?: number;
  revised?: number[];
  cleared?: number[];
}

/** RATE_LIMITED is why the publication of the scene partial-fail stopped. */
const RATE_LIMITED = "GitHub's rate limit was reached. It resets at 15:32.";

const NO_HOLD: DraftHold = { reason: "", title: "", left: 0, approved: 0, cards: 0 };

// specOf is the draft of a round with a number of the mock.
function specOf(specs: readonly DraftSpec[], n: number): DraftSpec {
  const spec = specs.find((one) => one.n === n);
  if (spec === undefined) {
    throw new Error(`no draft ${n} in the round`);
  }
  return spec;
}

// epicRefOf is what a draft points at as its epic: another draft of the round, or an issue.
function epicRefOf(spec: DraftSpec, specs: readonly DraftSpec[]): DraftRef | null {
  if (spec.epic !== undefined) {
    const epic = specOf(specs, spec.epic);
    return { draft: epic.id, key: "", reference: "", title: epic.title, url: "" };
  }
  if (spec.epicIssue !== undefined) {
    const [repository, number, title] = spec.epicIssue;
    const reference = `${OWNER}/${repository}#${number}`;
    return { draft: "", key: reference, reference, title, url: issueUrl(repository, number) };
  }
  return null;
}

// draftsOf are the drafts of a round at a moment, in position order, as the store records them;
// what holds each one and what its gesture publishes come after, from the chain.
function draftsOf(
  specs: readonly DraftSpec[],
  round: number,
  moment: RoundMoment,
  readAt: string,
): Draft[] {
  const published = moment.published ?? {};
  return specs.map((spec) => {
    const time = published[spec.n];
    const decision = moment.approved.includes(spec.n)
      ? "approved"
      : (moment.discarded ?? []).includes(spec.n)
        ? "discarded"
        : "";
    const epic = epicRefOf(spec, specs);
    const card = spec.card === undefined ? null : cardSpec(spec.card);
    const revised = (moment.revised ?? []).includes(spec.n);
    const dependencies: DraftDependency[] = (spec.dependencies ?? []).map((n) => {
      const on = specOf(specs, n);
      return {
        draft: on.id,
        key: "",
        reference: "",
        title: on.title,
        url: "",
        linked: time !== undefined && published[n] !== undefined,
        dropped: "",
        detail: "",
      };
    });
    return makeDraft({
      id: spec.id,
      position: spec.n,
      kind: spec.kind,
      source: "agent",
      repository: `${OWNER}/${spec.repository}`,
      repositoryId: BLOCKED.has(spec.repository) ? "" : repositoryId(spec.repository),
      card: card === null ? null : discussionCard(card.number),
      title: spec.title,
      body: spec.body,
      module: spec.module,
      epic,
      dependencies,
      current:
        card === null
          ? null
          : {
              title: card.title,
              body: card.body,
              module: card.module,
              status: card.status,
              epic,
              dependencies: card.dependencies.map((number) => {
                const on = issueOf(cardSpec(number));
                return { draft: "", key: on.key, reference: on.key, title: on.title, url: on.url };
              }),
              readAt,
            },
      decision,
      revision: revised ? 2 : 1,
      warnings: spec.warnings ?? [],
      outcome: time === undefined ? "" : spec.out.outcome,
      number: time === undefined ? 0 : spec.out.number,
      url: time === undefined ? "" : issueUrl(spec.out.repository, spec.out.number),
      published: time !== undefined,
      publishedAt: time === undefined ? "" : at(time),
      publishError: moment.failed === spec.n ? RATE_LIMITED : "",
      publishing: moment.publishing === spec.n,
      round,
      revised,
      approvalCleared: (moment.cleared ?? []).includes(spec.n),
    });
  });
}

// ---------------- The chain ----------------

/** MIN_EPIC_CARDS is how many approved cards an epic needs to be published. */
const MIN_EPIC_CARDS = 2;

/** Chain is what the next run writes, in order, and what holds each draft back. */
interface Chain {
  run: string[];
  holds: Map<string, DraftHold>;
}

const isCard = (draft: Draft) => draft.kind !== "epic";
const decided = (draft: Draft) => draft.decision !== "" || draft.published;

// orderOf is the order GitHub takes the drafts of a run in: by position, each after its epic and
// what it depends on.
function orderOf(targets: readonly Draft[]): string[] {
  const left = [...targets].sort((a, b) => a.position - b.position);
  const written = new Set<string>();
  const firsts = (draft: Draft) =>
    [
      draft.epic?.draft ?? "",
      ...(draft.dependencies ?? []).filter((on) => on.dropped === "").map((on) => on.draft),
    ].filter((id) => id !== "");
  const order: string[] = [];
  while (left.length > 0) {
    const next = left.findIndex((draft) =>
      firsts(draft).every((id) => written.has(id) || !left.some((one) => one.id === id)),
    );
    const [draft] = left.splice(Math.max(next, 0), 1);
    if (draft !== undefined) {
      written.add(draft.id);
      order.push(draft.id);
    }
  }
  return order;
}

/**
 * chainOf is the rule of internal/discussionflow/chain.go over the drafts of a scene: what the next
 * run writes and what holds each draft back, so each draft carries what the Go side sends.
 */
function chainOf(drafts: readonly Draft[]): Chain {
  const byId = new Map(drafts.map((draft) => [draft.id, draft]));
  // A card's epic is a draft of the discussion not on GitHub yet; one on GitHub publishes on its own.
  const epicOf = (draft: Draft): Draft | null => {
    const epic = byId.get(draft.epic?.draft ?? "");
    return epic !== undefined && !isCard(epic) && !epic.published ? epic : null;
  };
  const membersOf = (epic: Draft) =>
    drafts.filter((draft) => isCard(draft) && draft.epic?.draft === epic.id);
  // dependencies are the drafts a draft depends on that still have to be published.
  const dependencies = (draft: Draft) =>
    (draft.dependencies ?? []).flatMap(({ draft: id, dropped }) => {
      const on = byId.get(id);
      return id !== "" &&
        dropped === "" &&
        on !== undefined &&
        !on.published &&
        on.decision !== "discarded"
        ? [id]
        : [];
    });
  const needsBefore = (draft: Draft): string[] => {
    if (isCard(draft)) {
      const epic = epicOf(draft);
      return [...(epic === null ? [] : [epic.id]), ...dependencies(draft)];
    }
    const members = membersOf(draft);
    const ids: string[] = [];
    for (const member of members) {
      if (member.decision !== "approved" || member.published) continue;
      for (const id of dependencies(member)) {
        const inside = members.some((one) => one.id === id && one.decision === "approved");
        if (!inside && !ids.includes(id)) ids.push(id);
      }
    }
    return ids;
  };
  // open is the gate of a draft: a card goes with its epic, and an epic with two approved cards.
  const open = (draft: Draft): boolean => {
    if (isCard(draft)) {
      const epic = epicOf(draft);
      return epic === null || (epic.decision !== "discarded" && open(epic));
    }
    if (draft.outcome !== "") return true;
    if (draft.decision !== "approved") return false;
    const members = membersOf(draft);
    return (
      members.every(decided) &&
      members.filter((member) => member.decision === "approved").length >= MIN_EPIC_CARDS
    );
  };
  const ok = (id: string) => {
    const on = byId.get(id);
    return (
      on !== undefined &&
      (on.published || (on.decision === "approved" && on.publishError === "" && open(on)))
    );
  };
  const needs = new Map(
    drafts.filter((draft) => !draft.published).map((draft) => [draft.id, needsBefore(draft)]),
  );
  // reach is every draft a draft needs, directly or not.
  const reach = (id: string): string[] => {
    const seen = new Set([id]);
    const found: string[] = [];
    const queue = [...(needs.get(id) ?? [])];
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      if (seen.has(next)) continue;
      seen.add(next);
      found.push(next);
      queue.push(...(needs.get(next) ?? []));
    }
    return found;
  };
  const due = drafts.filter(
    (draft) =>
      draft.decision === "approved" &&
      !draft.published &&
      draft.publishError === "" &&
      open(draft) &&
      reach(draft.id).every(ok),
  );
  const going = new Set(due.map((draft) => draft.id));
  const holdOf = (draft: Draft): DraftHold => {
    if (draft.published || going.has(draft.id) || draft.publishError !== "") return NO_HOLD;
    if (draft.decision === "discarded") return NO_HOLD;
    const epic = epicOf(draft);
    if (epic !== null && epic.decision === "discarded") {
      return { ...NO_HOLD, reason: "epic_discarded" };
    }
    if (draft.decision !== "approved") return NO_HOLD;
    const gate = epic ?? (isCard(draft) ? null : draft);
    if (gate !== null && gate.decision === "approved" && gate.outcome === "") {
      const members = membersOf(gate);
      const left = members.filter((member) => !decided(member)).length;
      const approved = members.filter((member) => member.decision === "approved").length;
      if (left > 0) return { ...NO_HOLD, reason: "cards", left };
      if (approved < MIN_EPIC_CARDS) {
        return { ...NO_HOLD, reason: "epic_short", approved, cards: members.length };
      }
    }
    if (epic !== null && !going.has(epic.id)) return { ...NO_HOLD, reason: "epic" };
    const waiting = byId.get((needs.get(draft.id) ?? []).find((id) => !going.has(id)) ?? "");
    return waiting === undefined ? NO_HOLD : { ...NO_HOLD, reason: "draft", title: waiting.title };
  };
  return {
    run: orderOf(due),
    holds: new Map(drafts.map((draft) => [draft.id, holdOf(draft)])),
  };
}

/**
 * settled are the drafts with what the chain says of each one: what holds it and, for one still to
 * decide, what approving or discarding it would publish now, as discussionflow/state.go says it.
 */
function settled(drafts: readonly Draft[], publishing: boolean): Draft[] {
  const chain = chainOf(drafts);
  const withDecision = (id: string, decision: string) =>
    chainOf(drafts.map((draft) => (draft.id === id ? { ...draft, decision } : draft)));
  return drafts.map((draft) => {
    const open =
      draft.decision === "" && draft.outcome === "" && draft.publishError === "" && !publishing;
    const approved = open ? withDecision(draft.id, "approved") : null;
    const discarded = open ? withDecision(draft.id, "discarded") : null;
    const now = (next: Chain | null) =>
      next === null ? [] : next.run.filter((id) => !chain.run.includes(id));
    return {
      ...draft,
      hold: chain.holds.get(draft.id) ?? NO_HOLD,
      approvePublishes: now(approved),
      discardPublishes: now(discarded),
      approveHold: approved?.holds.get(draft.id) ?? NO_HOLD,
    };
  });
}

// ---------------- The conversation ----------------

const USER: UserEntry = {
  text: "",
  pending: false,
  prompt: false,
  app: false,
  sent: "",
  appKind: "",
  appPass: 0,
  appRound: 0,
  appRounds: 0,
  appCount: 0,
};

function marker(time: string, type: MarkerType, fields: Partial<MarkerEntry> = {}): Entry {
  const base = makeEntry("marker").marker;
  if (base === null) {
    throw new Error("a marker entry has no marker");
  }
  return makeEntry("marker", { createdAt: at(time), marker: { ...base, type, ...fields } });
}

function speech(time: string, text: string): Entry {
  return makeEntry("assistant", {
    createdAt: at(time),
    assistant: {
      messageId: `msg_${time.replaceAll(":", "")}`,
      blockIndex: 0,
      text,
      complete: true,
      interrupted: false,
      parentToolUseId: "",
      interruptedBy: "",
    },
  });
}

function you(time: string, text: string): Entry {
  return makeEntry("user", { createdAt: at(time), user: { ...USER, text } });
}

/** Act is an action of a group: the tool, what the agent wrote it does, and its target. */
type Act = [tool: "Bash" | "Read" | "Grep" | "Write", description: string, target: string];

// group is a turn of actions started at an hour, spread over some seconds; stopped leaves the last
// one interrupted, as a session that died under it does.
function group(time: string, span: number, acts: readonly Act[], stopped = false): Entry[] {
  const turnId = `turn_${time.replaceAll(":", "")}`;
  const first = Date.parse(at(time));
  const gap = span / Math.max(acts.length, 1);
  return acts.map(([tool, description, target], index) => {
    const startedAt = new Date(first + index * gap * 1000).toISOString();
    const cut = stopped && index === acts.length - 1;
    const fields: Partial<ActionEntry> = {
      toolUseId: `toolu_${turnId}_${index}`,
      tool,
      label: tool,
      target,
      description: tool === "Bash" ? description : "",
      commandLines: tool === "Bash" ? 1 : 0,
      status: cut ? "interrupted" : "done",
      startedAt,
      finishedAt: cut ? "" : new Date(Date.parse(startedAt) + 100).toISOString(),
      exitCode: cut ? -1 : 0,
    };
    return makeEntry("action", { turnId, createdAt: startedAt, action: makeAction(fields) });
  });
}

// The first look of the agent: ten files read and searched, then the four commands the mock shows.
const FIRST_LOOK: Act[] = [
  ["Read", "", "gateway/internal/meter/meter.go"],
  ["Grep", "", "monthly_price"],
  ["Read", "", "api/internal/plans/plans.go"],
  ["Read", "", "api/internal/invoice/build.go"],
  ["Grep", "", "flush"],
  ["Read", "", "gateway/internal/meter/flush.go"],
  ["Grep", "", "workspace_id"],
  ["Read", "", "web/src/billing/PlanPicker.tsx"],
  ["Grep", "", "overage"],
  ["Read", "", "docs/pricing.md"],
  ["Bash", "Read the gateway's counter", "sed -n '1,120p' gateway/internal/meter/counter.go"],
  ["Bash", "Find where the invoice is built", 'rg -n "func Build" api/internal/invoice'],
  ["Bash", "Read the plans schema", "cat api/internal/plans/schema.sql"],
  ["Bash", "Look for a billing clone", "ls ~/code | rg billing"],
];

// The question the agent asked on a card at 14:06, answered at 14:07.
function overageQuestion(): Entry {
  const question = "Where should the overage be charged?";
  return makeEntry("question", {
    createdAt: at("14:06"),
    question: {
      requestId: "req-overage",
      toolUseId: "toolu_overage",
      questions: [
        {
          question,
          header: "Overage",
          options: [
            {
              label: "On the monthly invoice, as one line for the workspace",
              description: "One invoice; the line counts the requests over the tier.",
            },
            {
              label: "On an invoice of its own at the end of the period",
              description: "Two invoices a month for a workspace that goes over.",
            },
          ],
          multiSelect: false,
        },
      ],
      answers: { [question]: "On the monthly invoice, as one line for the workspace" },
      status: "allowed",
      answeredAt: at("14:07"),
    },
  });
}

// talk is the conversation up to the question in text of 14:09, or up to the session that died at
// 14:08 under a command.
function talk(error: boolean): Entry[] {
  const entries = [
    marker("14:02", "discussion_started", {
      model: OPUS,
      effort: "high",
      board: PLATFORM_TITLE,
      epics: ["acme/billing#450"],
    }),
    makeEntry("user", { createdAt: at("14:02"), user: { ...USER, text: CONTEXT, prompt: true } }),
    ...group("14:02:10", 150, FIRST_LOOK),
    speech(
      "14:05",
      "The gateway flushes one total per workspace every hour (`meter/counter.go`), and the invoice reads only `plans.monthly_price`. acme/billing isn't cloned, so what I say about it comes from #455.",
    ),
    overageQuestion(),
  ];
  if (error) {
    return [
      ...entries,
      ...group(
        "14:07:40",
        20,
        [
          ["Bash", "Read the invoice builder", "sed -n '1,80p' api/internal/invoice/build.go"],
          ["Bash", "Read the plans handler", "sed -n '1,60p' api/internal/plans/handler.go"],
        ],
        true,
      ),
      makeEntry("error", {
        createdAt: at("14:08"),
        error: {
          kind: "process_exit",
          message: "exit status 1 · claude --resume 9f2c…a71e",
          retryable: true,
        },
      }),
    ];
  }
  return [
    ...entries,
    speech(
      "14:09",
      [
        "Clear. One more gap before I write anything.",
        "",
        "Should current customers move to the tiers in this round?",
        "",
        // The two spaces break the line: each option on a line of its own, as the mock draws them.
        "a) No. They stay on their flat plan; tiers are for new workspaces and for anyone who changes plan.  ",
        "b) Yes, with 90 days on their current price before the overage starts.",
      ].join("\n"),
    ),
  ];
}

/** UNREADABLE is why drafts.md can't be read in the scene unreadable. */
const UNREADABLE = "Draft invoice-overage: it has no ### Title.";

// confirm is the answer, the plan of the drafts and their writing, up to the document of 14:27; the
// drafts that can't be read say so there.
function confirm(ten: boolean, unreadable: boolean): Entry[] {
  const plan = ten
    ? "I'd write the document and ten drafts: an epic, *Pricing tiers with metered overage*, with five cards, updates of #461 and #474, and two loose cards (the status page and a support view). Shall I write them?"
    : "I'd write the document and five drafts: an epic, *Pricing tiers with metered overage*, with three new cards (the tier data, the invoice, the plan picker), and an update of #461 so it meters per API key. Shall I write them?";
  const entries = [
    you("14:21", "a. grandfathering is another card, later"),
    speech(
      "14:23",
      `Here is what I understood: tiers with an included volume and an overage price per 1,000 requests, charged on the monthly invoice from per-key metering at the gateway; current customers stay on their plan for now.\n\n${plan}`,
    ),
    you("14:24", "yes"),
    ...group("14:24:10", 110, [
      ["Write", "", "discussion.md"],
      ["Write", "", "drafts.md"],
      ["Bash", "Check the drafts' format", "cat drafts.md"],
    ]),
  ];
  if (unreadable) {
    return [
      ...entries,
      speech("14:27", "Written. The document has the understanding; the drafts follow it."),
      marker("14:27", "discussion_document", { first: true }),
      marker("14:27", "drafts_unreadable", { reason: UNREADABLE }),
    ];
  }
  return [
    ...entries,
    speech(
      "14:27",
      `Written. The document has the understanding; the ${ten ? "ten" : "five"} drafts are below. The invoice card depends on the tier data and on #461, so it goes after both.`,
    ),
    marker("14:27", "discussion_document", { first: true }),
  ];
}

// BEFORE is round 1 as it was before the revision of 14:32, with what the revision changed.
const BEFORE: DraftBefore[] = [
  {
    title: "Pricing tiers with metered overage",
    kind: "epic",
    decision: "approved",
    outcome: "",
    reference: "",
    changes: [],
    dropped: false,
    added: false,
    approvalCleared: false,
  },
  {
    title: TITLES_BEFORE[2] ?? "",
    kind: "new",
    decision: "approved",
    outcome: "",
    reference: "",
    changes: ["title"],
    dropped: false,
    added: false,
    approvalCleared: true,
  },
  {
    title: TITLES_BEFORE[3] ?? "",
    kind: "new",
    decision: "",
    outcome: "",
    reference: "",
    changes: ["title"],
    dropped: false,
    added: false,
    approvalCleared: false,
  },
  {
    title: TITLES_BEFORE[4] ?? "",
    kind: "new",
    decision: "",
    outcome: "",
    reference: "",
    changes: ["title", "dependencies"],
    dropped: false,
    added: false,
    approvalCleared: false,
  },
  {
    title: "Metering events per API key from the gateway",
    kind: "update",
    decision: "approved",
    outcome: "updated",
    reference: "acme/gateway#461",
    changes: [],
    dropped: false,
    added: false,
    approvalCleared: false,
  },
];

// revise is the change the user asked for at 14:31 and the revision of 14:32.
function revise(): Entry[] {
  return [
    you(
      "14:31",
      "shorter titles, please. And the plan picker depends on the invoice card, not on the tier data.",
    ),
    ...group("14:31:20", 40, [
      ["Bash", "Read the drafts", "cat drafts.md"],
      ["Write", "", "drafts.md"],
    ]),
    speech(
      "14:32",
      "Done. Three titles are shorter, and *Plan picker with tiers and overage* now depends on *Overage on the monthly invoice*. The epic and the update of #461 didn't change.",
    ),
    marker("14:32", "drafts_revised", { round: 1, changed: 3, before: BEFORE }),
  ];
}

// laterRounds are rounds 2 and 3 of the scene done: one card each, asked for in the conversation.
function laterRounds(): Entry[] {
  return [
    you(
      "15:20",
      "can I keep going here? I also need the admin report of the overage, per workspace.",
    ),
    speech(
      "15:22",
      "Yes: the drafts published in round 1 don't change, and new ones start round 2. One card, in the epic that exists, *#450 Usage-based billing*, because it reads the metering and not the tiers.",
    ),
    marker("15:23", "drafts_written", { round: 2, count: 1 }),
    marker("15:26", "drafts_published", { round: 2 }),
    you("15:41", "one more: current customers keep their plan for 90 days once the tiers ship"),
    speech(
      "15:44",
      "That is the grandfathering we left out. One card in *Pricing tiers with metered overage*, now billing#478 on GitHub.",
    ),
    marker("15:47", "drafts_written", { round: 3, count: 1 }),
    marker("15:49", "drafts_published", { round: 3 }),
  ];
}

// conversationOf is the conversation of the discussion at a moment of the mock (disc.js, convo).
function conversationOf(name: ScreenScene, flags: DiscussionFlags): Entry[] {
  if (name === "talk") {
    return talk(flags.error === true);
  }
  const ten = name === "many";
  const opening = [...talk(false), ...confirm(ten, name === "unreadable")];
  switch (name) {
    case "unreadable":
      return opening;
    case "drafts":
    case "many":
      return [
        ...opening,
        marker("14:27", "drafts_written", { round: 1, count: ten ? 10 : 5 }),
        // The two updates of the ten went to GitHub at 14:29 and 14:30.
        ...(ten ? [marker("14:29", "drafts_published", { round: 1 })] : []),
      ];
    default:
      // The update of #461 was approved and published at 14:29, before the revision.
      return [
        ...opening,
        marker("14:27", "drafts_written", { round: 1, count: 5 }),
        marker("14:29", "drafts_published", { round: 1 }),
        ...revise(),
        ...(name === "done" ? laterRounds() : []),
      ];
  }
}

// transcriptsOf are the conversation of the discussion at a moment, already read.
function transcriptsOf(name: ScreenScene, flags: DiscussionFlags): Record<string, TranscriptState> {
  const transcript = makeTranscript({
    taskId: DISCUSSION_ID,
    sessionId: "session-discussion-d1",
    stage: DISCUSSION_STAGE,
    entries: conversationOf(name, flags),
  });
  return { [sessionKey(DISCUSSION_ID, DISCUSSION_STAGE)]: fromTranscript(transcript) };
}

// ---------------- The moments of the discussion ----------------

// TIMES are the hours the drafts of round 1 went to GitHub, by their number in the mock.
const TIMES: Record<number, string> = {
  1: "15:10",
  2: "15:10",
  3: "15:11",
  4: "15:12",
  5: "14:29",
  8: "14:30",
};

// publishedAt are the hours of TIMES of some drafts of round 1.
const publishedAt = (...numbers: number[]): Record<number, string> =>
  Object.fromEntries(numbers.map((n) => [n, TIMES[n] ?? ""]));

/** Moment is where the discussion stands at a scene: its drafts and what waits for the user. */
interface Moment {
  status: string;
  drafts: Draft[];
  /** situation is what the discussion waits on the user for, with the hour it started; null for nothing. */
  situation: { kind: string; group: string; since: string } | null;
  draftsRevision: number;
  unreadable?: string;
  hasDocument: boolean;
  publishing?: boolean;
  archiveHint?: string;
  contextPercent: number;
  /** error is the session stopped on an error. */
  error?: boolean;
}

/** REVISED are the drafts of round 1 the revision of 14:32 changed. */
const REVISED = [2, 3, 4];

const WAITING_PUBLICATION = "Approved drafts wait to be published.";

// momentOf is the discussion at a scene of the mock (pub.js, MODEL.init), with its flags.
function momentOf(name: ScreenScene, flags: DiscussionFlags, now: string): Moment {
  const readAt = before(new Date(now).toISOString(), 120);
  const round1 = (moment: RoundMoment, revised = true) =>
    draftsOf(roundOne(revised), 1, revised ? { revised: REVISED, ...moment } : moment, readAt);
  const deciding = (drafts: Draft[], since: string, draftsRevision = 2): Moment => ({
    status: "deciding",
    drafts,
    situation: { kind: "drafts", group: "waiting", since },
    draftsRevision,
    hasDocument: true,
    archiveHint: WAITING_PUBLICATION,
    contextPercent: 31,
  });
  switch (name) {
    case "talk":
      return {
        status: "discussing",
        drafts: [],
        situation:
          flags.error === true
            ? { kind: "session_error", group: "error", since: "14:08" }
            : { kind: "reply", group: "waiting", since: "14:09" },
        draftsRevision: 0,
        hasDocument: false,
        contextPercent: 18,
        error: flags.error === true,
      };
    case "unreadable":
      return {
        status: "awaiting_drafts",
        drafts: [],
        situation: { kind: "reply", group: "waiting", since: "14:27" },
        draftsRevision: 0,
        unreadable: UNREADABLE,
        hasDocument: true,
        contextPercent: 31,
      };
    case "drafts":
      return deciding(round1({ approved: [1, 2] }, false), "14:27", 1);
    case "many":
      return deciding(
        draftsOf(roundOfTen(), 1, { approved: [2, 5, 6, 8], published: publishedAt(5, 8) }, readAt),
        "14:27",
        1,
      );
    case "rewrite":
      return deciding(
        round1({ approved: [1, 5], published: publishedAt(5), cleared: [2] }),
        "14:32",
      );
    case "publish":
      if (flags.after === true) {
        return {
          status: "publishing",
          drafts: round1({
            approved: [1, 2, 3, 4, 5],
            published: publishedAt(5, 1),
            publishing: 2,
          }),
          situation: null,
          draftsRevision: 2,
          hasDocument: true,
          publishing: true,
          archiveHint: "A publication is running.",
          contextPercent: 31,
        };
      }
      return deciding(round1({ approved: [1, 2, 3, 5], published: publishedAt(5) }), "15:04");
    case "published":
      return {
        status: "ready_to_archive",
        drafts: round1({ approved: [1, 2, 3, 4, 5], published: publishedAt(5, 1, 2, 3, 4) }),
        situation: { kind: "ready_to_archive", group: "closing", since: "15:12" },
        draftsRevision: 2,
        hasDocument: true,
        contextPercent: 31,
      };
    case "partial-fail":
      return {
        status: "publish_failed",
        drafts: round1({ approved: [1, 2, 3, 4, 5], published: publishedAt(5, 1, 2), failed: 3 }),
        situation: { kind: "publish_failed", group: "error", since: "15:11" },
        draftsRevision: 2,
        hasDocument: true,
        archiveHint: "A publication failed: Retry it, or discard the draft.",
        contextPercent: 31,
      };
    case "epic":
    case "archive-blocked":
      return {
        status: "epic_cant_publish",
        drafts: round1({ approved: [1, 2, 5], discarded: [3, 4], published: publishedAt(5) }),
        situation: { kind: "epic_cant_publish", group: "waiting", since: "14:39" },
        draftsRevision: 2,
        hasDocument: true,
        archiveHint: "The epic can't publish: approve one more card, or discard the epic.",
        contextPercent: 31,
      };
    case "epic-off":
      return {
        status: "epic_discarded",
        drafts: round1({ approved: [2, 3, 5], discarded: [1, 4], published: publishedAt(5) }),
        situation: { kind: "epic_discarded", group: "waiting", since: "14:39" },
        draftsRevision: 2,
        hasDocument: true,
        contextPercent: 31,
      };
    case "done":
      // Rounds 1 and 2 are folded; round 3 was published at 15:49.
      return {
        status: "ready_to_archive",
        drafts: [
          ...round1({ approved: [1, 2, 3, 4, 5], published: publishedAt(5, 1, 2, 3, 4) }, true).map(
            (draft) => ({ ...draft, revised: false }),
          ),
          ...draftsOf(ROUND_TWO, 2, { approved: [1], published: { 1: "15:26" } }, readAt),
          ...draftsOf(ROUND_THREE, 3, { approved: [1], published: { 1: "15:49" } }, readAt),
        ],
        situation: { kind: "ready_to_archive", group: "closing", since: "15:49" },
        draftsRevision: 4,
        hasDocument: true,
        contextPercent: 46,
      };
  }
}

// discussionOf is the discussion d1 at a moment.
function discussionOf(moment: Moment): DiscussionSummary {
  const publishing = moment.publishing === true;
  const drafts = settled(moment.drafts, publishing);
  const round = Math.max(0, ...drafts.map((draft) => draft.round));
  const all = repositories();
  return makeDiscussion({
    id: DISCUSSION_ID,
    boardId: PLATFORM_ID,
    board: PLATFORM_TITLE,
    title: TITLE,
    text: WHAT,
    status: moment.status,
    cards: ENTRY_CARDS.map(discussionCard),
    drafts,
    round,
    publishing,
    draftsRead: round > 0,
    draftsRevision: moment.draftsRevision,
    unreadableDrafts: moment.unreadable ?? "",
    hasDocument: moment.hasDocument,
    documentRevision: moment.hasDocument ? 1 : 0,
    moduleField: "Module",
    moduleOptions: MODULES,
    repositories: PLATFORM_REPOSITORIES.map((name) => {
      const repository = all.find((one) => one.name === name);
      return {
        id: repositoryId(name),
        fullName: `${OWNER}/${name}`,
        cloned: repository?.cloned ?? true,
        missing: repository?.missing ?? false,
      };
    }),
    canArchive: moment.archiveHint === undefined,
    archiveHint: moment.archiveHint ?? "",
    sessionStage: DISCUSSION_STAGE,
    sessionStatus: moment.error === true ? "error" : "waiting",
    sessionModel: OPUS,
    sessionEffort: "high",
    turnRunning: false,
    processRunning: moment.error !== true,
    contextPercent: moment.contextPercent,
    lastError: moment.error === true ? "exit status 1" : "",
    situations:
      moment.situation === null
        ? []
        : [
            makeSituation({
              id: `${DISCUSSION_ID}-${moment.situation.kind}`,
              taskId: DISCUSSION_ID,
              kind: moment.situation.kind,
              group: moment.situation.group,
              place: { kind: "discussion", stage: "", step: 0 },
              startedAt: at(moment.situation.since),
            }),
          ],
    createdAt: at("14:02"),
  });
}

// usageAlerts is the discussion of #474 archived two days before, the last one on Platform Roadmap
// before this one: the board the dialog of the Home comes in on.
function usageAlerts() {
  return makeArchivedDiscussion({
    id: "d-alerts",
    boardId: PLATFORM_ID,
    board: PLATFORM_TITLE,
    title: "Usage alerts",
    text: "Alert the admins before a workspace goes over its plan.",
    cards: [discussionCard(474)],
    drafts: [],
    publishedCount: 0,
    repositoryIds: [repositoryId("api")],
    createdAt: at("10:12", "2026-09-22"),
    archivedAt: at("11:40", "2026-09-22"),
  });
}

// ---------------- The task ----------------

// t1 is Rate limit per API key: a question of the reviewer of step 3 for 18 minutes, as the task
// scenes have it.
function t1(now: string): TaskSummary {
  return inStep(
    3,
    {
      status: "agent_review",
      reviewPass: 2,
      reviewer: makeStepReviewer({ sessionStage: "step_review:3", sessionStatus: "needs_answer" }),
    },
    {
      id: "t1",
      sessionStatus: "waiting",
      situations: [
        makeSituation({
          id: "t1-question",
          taskId: "t1",
          kind: "question",
          group: "waiting",
          place: { kind: "step_review", stage: "", step: 3 },
          startedAt: before(new Date(now).toISOString(), 18 * 60),
        }),
      ],
    },
    false,
  );
}

// ---------------- The scenes ----------------

// stateOf is the state of the scenes at a moment: the boards, the task, the discussion when it
// exists, and the discussion of #474 in the History.
function stateOf(now: string, discussion: DiscussionSummary | null): State {
  return makeState({
    repositories: repositories(),
    boards: boards(new Date(now).toISOString()),
    tasks: [t1(now)],
    discussions: discussion === null ? [] : [discussion],
    discussionHistory: [usageAlerts()],
    cloneFolder: "/home/dev/code",
    // The Defaults of the mock start a discussion on Opus 5.5 (1M), with high effort.
    modelDefaults: makeModelDefaults().map((choice) =>
      choice.stage === "discussion" ? { ...choice, model: OPUS } : choice,
    ),
  });
}

// draftNamed is a draft of the card by its number in the round, open or folded.
const draftNamed = (number: number, total: number) =>
  screen.findByRole("group", { name: new RegExp(`^Draft ${number} of ${total}:`) });

// CURRENT is the draft the mock has open at a scene, by its number, and how many the round holds:
// the first to decide, or the one the bar names; and in the ten, draft 3, which the user opened.
const CURRENT: Partial<Record<ScreenScene, [number, number]>> = {
  drafts: [3, 5],
  rewrite: [2, 5],
  publish: [4, 5],
  epic: [1, 5],
  "epic-off": [1, 5],
  many: [3, 10],
};

// opening is what the mock has on screen as a scene starts: the current draft open with the focus,
// the Retry of the draft that failed with it, or the ⋯ that says why Archive waits.
function opening(name: ScreenScene): ((user: UserEvent) => Promise<void>) | null {
  if (name === "partial-fail") {
    // The arrival at the failure: the draft that failed comes into view, and the focus goes to its Retry.
    return async () => {
      const retry = await screen.findByRole("button", { name: "Retry" });
      act(() => {
        focusRequest("draft");
      });
      await vi.waitFor(() => {
        if (document.activeElement !== retry) throw new Error("the Retry does not hold the focus");
      });
    };
  }
  if (name === "archive-blocked") {
    // The arrival at the epic that can't publish, then the ⋯ that says why Archive waits.
    return async (user) => {
      await screen.findByRole("button", { name: "More actions" });
      act(() => {
        focusRequest("draft");
      });
      await user.click(screen.getByRole("button", { name: "More actions" }));
    };
  }
  const current = CURRENT[name];
  if (current === undefined) {
    return null;
  }
  const [number, total] = current;
  return async (user) => {
    // A draft the card doesn't open by itself is opened as the user would: the after of publish,
    // where nothing is left to decide, and draft 3 of the ten, behind the epic to decide.
    if (name === "many" || name === "publish") {
      const folded = await draftNamed(number, total);
      if (folded.getAttribute("aria-expanded") === "false") {
        await user.click(folded);
      }
    }
    // The draft comes into view as the app brings it: one the user opened as Show and Alt+↓ do,
    // the others by the arrival at what the bar asks for.
    const draft = await draftNamed(number, total);
    act(() => {
      if (name === "many" || name === "publish" || !focusRequest("draft")) {
        focusDraft(draft.dataset.cardItem ?? "", false);
      }
    });
    const focused = await draftNamed(number, total);
    if (document.activeElement !== focused) {
      throw new Error(`draft ${number} of ${total} does not hold the focus`);
    }
  };
}

// flagged is what the flags of a scene open on top of it: the edit of draft 3, a dialog, a panel,
// the ⋯.
function flagged(flags: DiscussionFlags): ((user: UserEvent) => Promise<void>) | null {
  const store = () => useAppStore.getState();
  if (flags.edit === true) {
    return async (user) => {
      const draft = await draftNamed(3, 5);
      await user.click(within(draft).getByRole("button", { name: /^Edit/ }));
    };
  }
  if (flags.menu === true) {
    return async (user) => {
      await user.click(await screen.findByRole("button", { name: "More actions" }));
    };
  }
  const dialog = flags.archive ? "archive" : flags.group ? "group" : flags.delete ? "delete" : null;
  if (dialog !== null) {
    return async () => {
      act(() => store().openDiscussionDialog(DISCUSSION_ID, dialog));
    };
  }
  if (flags.panel !== undefined) {
    const panel = flags.panel === "Details" ? "details" : "documents";
    return async () => {
      act(() => store().openPanel(panel));
    };
  }
  return null;
}

// startScene is the dialog that starts the discussion, over the board with #455 and #461 picked or
// over the Home with the field Board, with the title and what to discuss written.
function startScene(flags: DiscussionFlags, now: string): DiscussionScene {
  const home = flags.home === true;
  return {
    state: stateOf(now, null),
    location: home ? { kind: "home" } : { kind: "board", id: PLATFORM_ID },
    transcripts: {},
    storage: {},
    now,
    after: async (user) => {
      act(() =>
        useAppStore.getState().openNewDiscussion({
          boardId: PLATFORM_ID,
          cardKeys: home ? [] : ENTRY_CARDS.map((number) => cardKey(cardSpec(number))),
          askBoard: home,
        }),
      );
      await user.type(await screen.findByRole("textbox", { name: "Title" }), TITLE);
      // What to discuss is pasted: typed key by key, it reads the context again once per key.
      await user.click(screen.getByRole("textbox", { name: /^What to discuss/ }));
      await user.paste(WHAT);
    },
  };
}

/**
 * discussionScene is what a test draws for a moment of the mock with its flags: the state, the
 * place, the conversation on screen, what the screen remembers, and what the user does once it is
 * on screen.
 */
export function discussionScene(
  name: DiscussionSceneName,
  flags: DiscussionFlags = {},
): DiscussionScene {
  const now = SCENE_NOW[name];
  if (name === "start") {
    return startScene(flags, now);
  }
  const discussion = discussionOf(momentOf(name, flags, now));
  const steps = [opening(name), flagged(flags)].filter(
    (step): step is (user: UserEvent) => Promise<void> => step !== null,
  );
  return {
    state: stateOf(now, discussion),
    location: { kind: "discussion", id: DISCUSSION_ID },
    transcripts: transcriptsOf(name, flags),
    storage: {},
    now,
    ...(steps.length === 0
      ? {}
      : {
          after: async (user: UserEvent) => {
            for (const step of steps) {
              await step(user);
            }
          },
        }),
  };
}
