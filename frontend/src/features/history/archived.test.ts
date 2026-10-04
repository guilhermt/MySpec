import { describe, expect, it } from "vitest";
import {
  archivedDate,
  archivedTaskFacts,
  archivedTaskTabs,
  deleteTaskStays,
  reportMarker,
  stepMarkers,
} from "@/features/history/archived";
import { makeArchivedTask, makeCloseResult, makeTaskCard } from "@/test/wails-mock";

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
