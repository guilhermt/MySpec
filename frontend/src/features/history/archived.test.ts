import { describe, expect, it } from "vitest";
import {
  archivedDate,
  archivedDiscussionFacts,
  archivedReviewFacts,
  archivedTaskFacts,
  archivedTaskTabs,
  deleteTaskStays,
  outFindingViews,
  passHeading,
  publishedRows,
  publishedSentence,
  reportMarker,
  reviewedSentence,
  stepMarkers,
} from "@/features/history/archived";
import {
  makeArchivedDiscussion,
  makeArchivedReview,
  makeArchivedTask,
  makeCloseResult,
  makeDiscussionCard,
  makeDraft,
  makeReviewFinding,
  makeReviewPass,
  makeTaskCard,
} from "@/test/wails-mock";

// NOW is Sunday, September 27, 2026, 15:00 in the local time of the runner.
const NOW = new Date(2026, 8, 27, 15, 0).getTime();
const local = (...parts: [number, number, number, number, number]) =>
  new Date(...parts).toISOString();

const CARD = makeTaskCard({ repository: "acme/api", number: 398, status: "Done" });
const PR = {
  number: 1279,
  url: "https://github.com/acme/api/pull/1279",
  state: "merged",
  base: "dev",
  mergedBy: "lnakamura",
  mergedAt: local(2026, 8, 24, 14, 51),
};
const TASK = makeArchivedTask({
  repository: "acme/api",
  card: CARD,
  pr: PR,
  createdAt: local(2026, 8, 17, 10, 3),
  archivedAt: local(2026, 8, 24, 15, 2),
});

describe("archivedDate", () => {
  it.each([
    ["this year", local(2026, 8, 24, 14, 51), "Sep 24 at 14:51"],
    ["another year", local(2025, 8, 24, 14, 51), "Sep 24, 2025 at 14:51"],
    ["no moment", "", ""],
  ])("writes a moment of %s", (_, iso, text) => {
    expect(archivedDate(iso, NOW)).toBe(text);
  });
});

describe("archivedTaskFacts", () => {
  const linkOf = (task: typeof TASK, label: string) =>
    archivedTaskFacts(task, NOW).find((fact) => fact.label === label)?.link;

  it("says the repository with its card and status, the pull request, and when it started", () => {
    expect(archivedTaskFacts(TASK, NOW)).toEqual([
      {
        label: "Repository",
        value: "acme/api · card api#398 · Done",
        link: { text: "api#398", href: CARD.url, tooltip: "Open api#398 on GitHub" },
      },
      {
        label: "Pull request",
        value: "#1279 merged into dev by lnakamura · Sep 24 at 14:51",
        link: { text: "#1279", href: PR.url, tooltip: "Open #1279 on GitHub" },
      },
      { label: "Started", value: "Sep 17 at 10:03" },
      { label: "Archived", value: "Sep 24 at 15:02" },
    ]);
  });

  it("leaves the card out of a task without one and the status out of a card without one", () => {
    expect(archivedTaskFacts({ ...TASK, card: null }, NOW)[0]).toEqual({
      label: "Repository",
      value: "acme/api",
    });
    expect(archivedTaskFacts({ ...TASK, card: { ...CARD, status: "" } }, NOW)[0]?.value).toBe(
      "acme/api · card api#398",
    );
  });

  it.each([
    ["without who merged it", { mergedBy: "" }, "#1279 merged into dev · Sep 24 at 14:51"],
    ["without when", { mergedAt: "" }, "#1279 merged into dev by lnakamura"],
    ["without its base", { base: "" }, "#1279 merged by lnakamura · Sep 24 at 14:51"],
    [
      "that wasn't confirmed merged",
      { state: "open", mergedBy: "", mergedAt: "" },
      "#1279 into dev · the merge wasn't confirmed",
    ],
  ])("says a pull request %s", (_, change, value) => {
    const facts = archivedTaskFacts({ ...TASK, pr: { ...PR, ...change } }, NOW);

    expect(facts.find((fact) => fact.label === "Pull request")?.value).toBe(value);
  });

  it("drops the pull request line of an old task that has none", () => {
    expect(linkOf({ ...TASK, pr: null }, "Pull request")).toBeUndefined();
    expect(archivedTaskFacts({ ...TASK, pr: null }, NOW).map((fact) => fact.label)).not.toContain(
      "Pull request",
    );
  });

  it("leaves Archived to the closing, whose block carries the hour", () => {
    const labels = archivedTaskFacts({ ...TASK, close: makeCloseResult() }, NOW).map(
      (fact) => fact.label,
    );

    expect(labels).toEqual(["Repository", "Pull request", "Started"]);
  });
});

describe("archivedTaskTabs", () => {
  it("lists the documents of a structured task, the steps counted, then the pull request", () => {
    const steps = [1, 2, 3].map((number) => ({
      number,
      file: `${number}.md`,
      title: `Step ${number}`,
      reports: [],
      commitSha: "",
    }));

    expect(archivedTaskTabs({ ...TASK, steps })).toEqual([
      { id: "prd", label: "PRD" },
      { id: "tech_spec", label: "Tech spec" },
      { id: "steps", label: "Steps · 3" },
      { id: "pr", label: "Pull request" },
    ]);
  });

  it("keeps a tab whose document the task doesn't have", () => {
    const labels = archivedTaskTabs({ ...TASK, hasPrd: false, steps: [] }).map((tab) => tab.label);

    expect(labels).toEqual(["PRD", "Tech spec", "Steps", "Pull request"]);
  });

  it("lists the document and the pull request of a One-Shot task", () => {
    expect(archivedTaskTabs({ ...TASK, mode: "one_shot" })).toEqual([
      { id: "one_shot", label: "One-Shot document" },
      { id: "pr", label: "Pull request" },
    ]);
  });
});

describe("stepMarkers", () => {
  const step = {
    number: 3,
    file: "03-add-the-limiter.md",
    title: "Add the limiter",
    reports: [],
    commitSha: "c19f02e8a4b7d0",
  };

  it("makes a line of a step: its number, title and short commit, opening the step file", () => {
    expect(stepMarkers({ ...TASK, steps: [step] })).toEqual([
      {
        icon: "file",
        text: "Add the limiter",
        complement: "",
        body: { kind: "artifact", name: "steps/03-add-the-limiter.md", openIn: "artifacts" },
        lead: "3",
        aside: "c19f02e",
        timeHidden: true,
      },
    ]);
  });

  it("leaves the commit out of a step without one", () => {
    const [marker] = stepMarkers({ ...TASK, steps: [{ ...step, commitSha: "" }] });

    expect(marker).not.toHaveProperty("aside");
  });

  it("leaves the number out of the single step of a One-Shot task", () => {
    const [marker] = stepMarkers({ ...TASK, mode: "one_shot", steps: [step] });

    expect(marker).not.toHaveProperty("lead");
  });
});

describe("reportMarker", () => {
  const report = { pass: 1, file: "03-review-1.md", clean: false, findings: 2 };

  it.each([
    ["with findings", report, "changes · 2 findings"],
    ["with one finding", { ...report, findings: 1 }, "changes · 1 finding"],
    ["in text", { ...report, findings: -1 }, "changes"],
    ["clean", { ...report, clean: true, findings: 0 }, "clean"],
  ])("says a report %s", (_, given, complement) => {
    expect(reportMarker(given, "step-reviews/03-review-1.md")).toEqual({
      icon: "file",
      text: "Review 1",
      complement,
      body: { kind: "artifact", name: "step-reviews/03-review-1.md", openIn: "artifacts" },
      timeHidden: true,
    });
  });

  it("opens the document it is given, the pull request's under pr/", () => {
    const marker = reportMarker(
      { pass: 2, file: "review-2.md", clean: true, structured: true, findings: 0 },
      "pr/review-2.md",
    );

    expect(marker.text).toBe("Review 2");
    expect(marker.body).toMatchObject({ name: "pr/review-2.md" });
  });
});

describe("deleteTaskStays", () => {
  it.each([
    [
      "a pull request and a card",
      TASK,
      "Nothing changes on GitHub: PR #1279 and the card api#398 stay.",
    ],
    ["a pull request", { ...TASK, card: null }, "Nothing changes on GitHub: PR #1279 stays."],
    ["a card", { ...TASK, pr: null }, "Nothing changes on GitHub: the card api#398 stays."],
    ["neither", { ...TASK, card: null, pr: null }, "Nothing changes on GitHub."],
  ])("says what stays with %s", (_, task, text) => {
    expect(deleteTaskStays(task)).toBe(text);
  });
});

const pass = (overrides: Parameters<typeof makeReviewPass>[0] = {}) => makeReviewPass(overrides);

describe("reviewedSentence", () => {
  it.each([
    ["no pass", [], ""],
    ["a pass without report", [pass({ file: "" })], ""],
    [
      "both published",
      [pass({ published: true }), pass({ pass: 2, published: true })],
      "2 passes, both published",
    ],
    ["one published", [pass({ published: true })], "1 pass, published"],
    [
      "some published",
      [pass({ published: true }), pass({ pass: 2, published: true }), pass({ pass: 3 })],
      "3 passes, 2 published",
    ],
    ["none published", [pass(), pass({ pass: 2 })], "2 passes, none published"],
    [
      "both sent",
      [pass({ sent: true }), pass({ pass: 2, sent: true })],
      "2 passes, both sent to the agent",
    ],
    ["one sent", [pass({ sent: true })], "1 pass, sent to the agent"],
    [
      "published and sent",
      [pass({ published: true }), pass({ pass: 2, sent: true }), pass({ pass: 3, file: "" })],
      "2 passes, 1 published and 1 sent to the agent",
    ],
    [
      "one of each among three",
      [pass({ published: true }), pass({ pass: 2, sent: true }), pass({ pass: 3 })],
      "3 passes, 1 published and 1 sent to the agent",
    ],
  ])("says %s", (_, passes, want) => {
    expect(reviewedSentence(passes)).toBe(want);
  });
});

describe("archivedReviewFacts", () => {
  const REVIEW = makeArchivedReview({
    repository: "acme/web",
    number: 2291,
    author: "tchen",
    outcome: "merged",
    baseBranch: "dev",
    mergedBy: "rsouza",
    mergedAt: local(2026, 8, 23, 16, 20),
    createdAt: local(2026, 8, 22, 9, 14),
    passes: [pass({ published: true }), pass({ pass: 2, published: true })],
  });

  it("says the pull request, when it started and what became of the passes", () => {
    expect(archivedReviewFacts(REVIEW, NOW)).toEqual([
      {
        label: "Pull request",
        value: "web#2291 by tchen · merged into dev by rsouza · Sep 23 at 16:20",
        link: {
          text: "web#2291",
          href: "https://github.com/dev/web/pull/31",
          tooltip: "Open web#2291 on GitHub",
        },
      },
      { label: "Started", value: "Sep 22 at 09:14" },
      { label: "Reviewed", value: "2 passes, both published" },
    ]);
  });

  it("says a closed pull request, and the card with its title", () => {
    const facts = archivedReviewFacts(
      {
        ...REVIEW,
        outcome: "closed",
        closedAt: local(2026, 8, 23, 16, 20),
        card: {
          boardId: "board-1",
          number: 2238,
          title: "Settings form keeps the old validation",
          url: "https://github.com/acme/web/issues/2238",
          status: "Done",
        },
      },
      NOW,
    );

    expect(facts.map(({ label, value }) => [label, value])).toEqual([
      ["Pull request", "web#2291 by tchen · closed · Sep 23 at 16:20"],
      ["Card", "web#2238 · Settings form keeps the old validation"],
      ["Started", "Sep 22 at 09:14"],
      ["Reviewed", "2 passes, both published"],
    ]);
  });

  it("says when it was archived only for a pull request with no hour, after the passes", () => {
    const facts = archivedReviewFacts(
      { ...REVIEW, mergedAt: "", mergedBy: "", archivedAt: local(2026, 8, 23, 16, 21) },
      NOW,
    );

    expect(facts[0]?.value).toBe("web#2291 by tchen · merged into dev");
    expect(facts.at(-1)).toEqual({ label: "Archived", value: "Sep 23 at 16:21" });
  });
});

describe("passHeading", () => {
  it.each([
    [
      "a published pass",
      pass({
        published: true,
        verdict: "request_changes",
        publishedAt: local(2026, 8, 23, 13, 41),
      }),
      { title: "Pass 1", outcome: "Request changes", time: "published Sep 23 at 13:41" },
    ],
    [
      "an approval without the hour",
      pass({ published: true, verdict: "approve" }),
      { title: "Pass 1", outcome: "Approve", time: "" },
    ],
    [
      "a pass sent to the agent",
      pass({
        sent: true,
        sentAt: local(2026, 8, 23, 13, 41),
        findings: [
          makeReviewFinding({ decision: "approved" }),
          makeReviewFinding({ number: 2, decision: "approved" }),
          makeReviewFinding({ number: 3, decision: "discarded" }),
        ],
      }),
      { title: "Pass 1", outcome: "2 findings sent to the agent", time: "sent Sep 23 at 13:41" },
    ],
    ["a pass that left nowhere", pass(), { title: "Pass 1", outcome: "not published", time: "" }],
  ])("writes %s", (_, one, want) => {
    expect(passHeading(one, NOW)).toEqual(want);
  });
});

describe("outFindingViews", () => {
  it("keeps the findings that left, with where each went", () => {
    const published = pass({
      published: true,
      publishedAt: local(2026, 8, 23, 13, 41),
      findings: [
        makeReviewFinding({ decision: "approved", placement: "inline" }),
        makeReviewFinding({ number: 2, decision: "approved", placement: "body" }),
        makeReviewFinding({ number: 3, decision: "discarded" }),
        makeReviewFinding({ number: 4, decision: "" }),
      ],
    });

    expect(outFindingViews(published, "publish", NOW).map((view) => view.disabled)).toEqual([
      "Inline comment · published Sep 23, 13:41",
      "In the review body · published Sep 23, 13:41",
    ]);
  });
});

const made = (id: string, overrides: Parameters<typeof makeDraft>[0] = {}) =>
  makeDraft({ id, position: Number(id.replace("d", "")), ...overrides });
const created = (id: string, number: number, overrides: Parameters<typeof makeDraft>[0] = {}) =>
  made(id, {
    repository: "acme/api",
    number,
    url: `https://github.com/acme/api/issues/${number}`,
    published: true,
    outcome: "created",
    ...overrides,
  });

describe("publishedSentence", () => {
  it.each([
    [
      "created and updated",
      [
        created("d1", 1),
        created("d2", 2),
        created("d3", 3),
        created("d4", 4, { outcome: "updated" }),
        made("d5"),
      ],
      "4 of 5 drafts: 3 created, 1 updated",
    ],
    ["only the parts that exist", [created("d1", 1), made("d2")], "1 of 2 drafts: 1 created"],
    ["nothing published", [made("d1"), made("d2"), made("d3")], "None of 3 drafts"],
    ["a single draft", [made("d1")], "None of 1 draft"],
    ["no drafts", [], ""],
  ])("writes %s", (_, drafts, want) => {
    expect(publishedSentence(drafts)).toBe(want);
  });
});

describe("archivedDiscussionFacts", () => {
  const discussion = makeArchivedDiscussion({
    board: "Platform Roadmap",
    cards: [
      makeDiscussionCard({ repository: "acme/api", number: 447 }),
      makeDiscussionCard({ repository: "acme/api", number: 449 }),
    ],
    drafts: [created("d1", 452, { round: 1 }), created("d2", 453, { round: 2 }), made("d3")],
    createdAt: local(2026, 8, 24, 10, 2),
    archivedAt: local(2026, 8, 24, 11, 47),
  });

  it("says the board with its cards, the dates with the rounds, and what it published", () => {
    expect(archivedDiscussionFacts(discussion, NOW)).toEqual([
      { label: "Board", value: "Platform Roadmap · from api#447 and api#449" },
      { label: "Started", value: "Sep 24 at 10:02" },
      { label: "Archived", value: "Sep 24 at 11:47 · 2 rounds" },
      { label: "Published", value: "2 of 3 drafts: 2 created" },
    ]);
  });

  it("leaves out the cards, the rounds and the publication that it doesn't have", () => {
    const bare = makeArchivedDiscussion({
      board: "Platform Roadmap",
      cards: [],
      drafts: [],
      createdAt: local(2026, 8, 24, 10, 2),
      archivedAt: local(2026, 8, 24, 11, 47),
    });

    expect(archivedDiscussionFacts(bare, NOW)).toEqual([
      { label: "Board", value: "Platform Roadmap" },
      { label: "Started", value: "Sep 24 at 10:02" },
      { label: "Archived", value: "Sep 24 at 11:47" },
    ]);
  });
});

describe("publishedRows", () => {
  it("lists the drafts by position, the cards of an epic right after it and indented", () => {
    const epic = made("d2", { kind: "epic", title: "Webhooks", repository: "acme/api" });
    const card = created("d4", 452, {
      title: "Retry failed deliveries",
      epic: { draft: "d2", key: "", reference: "", title: "Webhooks", url: "" },
    });
    const rows = publishedRows(
      makeArchivedDiscussion({
        drafts: [
          created("d1", 440, {
            kind: "update",
            title: "Fix the gateway",
            repository: "acme/gateway",
            outcome: "updated",
          }),
          epic,
          made("d3", { title: "Dropped idea", decision: "discarded" }),
          card,
        ],
      }),
    );

    expect(rows.map((row) => [row.kind, row.label, row.title, row.indented])).toEqual([
      ["update", "Update", "Fix the gateway", false],
      ["epic", "Epic", "Webhooks", false],
      ["card", "New card", "Retry failed deliveries", true],
      ["card", "New card", "Dropped idea", false],
    ]);
    expect(rows[0]?.outcome).toEqual({
      kind: "link",
      text: "Updated gateway#440",
      href: "https://github.com/acme/api/issues/440",
      tooltip: "Open gateway#440 on GitHub",
    });
    expect(rows[2]?.outcome).toMatchObject({ kind: "link", text: "Created api#452" });
  });

  it.each([
    ["discarded", { decision: "discarded" }, "Not published · discarded"],
    ["not decided", { decision: "" }, "Not published · not decided"],
    ["failed", { decision: "approved", publishError: "rate limited" }, "Not published · failed"],
  ])("says why a draft that is %s didn't publish", (_, overrides, text) => {
    const [row] = publishedRows(makeArchivedDiscussion({ drafts: [made("d1", overrides)] }));

    expect(row?.outcome).toEqual({ kind: "text", text });
  });
});
