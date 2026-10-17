import { describe, expect, it } from "vitest";
import {
  checkedText,
  checkedTip,
  keepsRunningText,
  releaseHeading,
  resultOf,
  signLabel,
  signOf,
  signText,
  updateBlockOf,
  versionTitle,
  workingLines,
} from "@/features/about/about";
import {
  makeDiscussion,
  makeReviewSummary,
  makeState,
  makeTask,
  makeUpdate,
  makeUpdateInstall,
  makeUpdateInstallFailure,
  makeUpdateRelease,
} from "@/test/wails-mock";

const NOW = Date.parse("2026-10-17T14:10:00");

describe("versionTitle", () => {
  it.each([
    ["0.4.0", "MySpec 0.4.0"],
    ["dev", "MySpec dev"],
  ])("heads %s as %s", (version, title) => {
    expect(versionTitle(makeUpdate({ version }))).toBe(title);
  });
});

describe("signLabel", () => {
  it.each([
    [{ kind: "available", version: "0.5.0" }, "MySpec 0.5.0 is available. Open About."],
    [{ kind: "updating", version: "0.5.0" }, "Updating to MySpec 0.5.0… Open About."],
    [
      { kind: "installed", version: "0.5.0" },
      "MySpec 0.5.0 is installed. Restart to use it. Open About.",
    ],
  ] as const)("names the state of %j and where the sign leads", (sign, label) => {
    expect(signLabel(sign)).toBe(label);
  });
});

describe("keepsRunningText", () => {
  it("says the running version keeps running", () => {
    expect(keepsRunningText("0.4.0")).toBe(
      "Restart to use it. Until then, MySpec 0.4.0 keeps running.",
    );
  });
});

const FAILURE = makeUpdateInstallFailure({ kind: "libraries", reason: "libfoo is missing." });

describe("updateBlockOf", () => {
  it("is installed with the version installed, before anything else", () => {
    const update = makeUpdate({
      latest: "0.6.0",
      install: makeUpdateInstall({ phase: "installed", version: "0.5.0", target: "0.5.0" }),
    });

    expect(updateBlockOf(update)).toEqual({ kind: "installed", version: "0.5.0" });
  });

  it("is updating with the target, or the latest without one", () => {
    const install = makeUpdateInstall({ phase: "installing", target: "0.5.0" });

    expect(updateBlockOf(makeUpdate({ latest: "0.6.0", install }))).toEqual({
      kind: "updating",
      version: "0.5.0",
    });
    expect(
      updateBlockOf(makeUpdate({ latest: "0.6.0", install: { ...install, target: "" } })),
    ).toEqual({ kind: "updating", version: "0.6.0" });
  });

  it("is failed with the latest, or the target without one", () => {
    const install = makeUpdateInstall({ phase: "failed", target: "0.5.0", failure: FAILURE });

    expect(updateBlockOf(makeUpdate({ latest: "0.6.0", install }))).toEqual({
      kind: "failed",
      version: "0.6.0",
      failure: FAILURE,
    });
    expect(updateBlockOf(makeUpdate({ latest: "", install }))).toEqual({
      kind: "failed",
      version: "0.5.0",
      failure: FAILURE,
    });
  });

  it("falls to the newest version known when a failed phase has no failure", () => {
    const install = makeUpdateInstall({ phase: "failed" });

    expect(updateBlockOf(makeUpdate({ latest: "0.5.0", install }))).toEqual({
      kind: "available",
      version: "0.5.0",
    });
  });

  it("is available with the latest, none without one", () => {
    expect(updateBlockOf(makeUpdate({ latest: "0.5.0" }))).toEqual({
      kind: "available",
      version: "0.5.0",
    });
    expect(updateBlockOf(makeUpdate())).toEqual({ kind: "none" });
  });

  it("is none in a build that never checks", () => {
    const install = makeUpdateInstall({ phase: "installed", version: "0.5.0" });

    expect(updateBlockOf(makeUpdate({ checks: false, latest: "0.5.0", install }))).toEqual({
      kind: "none",
    });
  });
});

describe("signOf and signText", () => {
  it("has no sign without a block", () => {
    expect(signOf(makeUpdate())).toBeNull();
  });

  it("is available for a newer version and for a failed installation", () => {
    const failed = makeUpdateInstall({ phase: "failed", failure: FAILURE });

    expect(signOf(makeUpdate({ latest: "0.5.0" }))).toEqual({
      kind: "available",
      version: "0.5.0",
    });
    expect(signOf(makeUpdate({ latest: "0.5.0", install: failed }))).toEqual({
      kind: "available",
      version: "0.5.0",
    });
  });

  it("is updating while the installation runs and installed after it", () => {
    expect(
      signOf(makeUpdate({ install: makeUpdateInstall({ phase: "installing", target: "0.5.0" }) })),
    ).toEqual({ kind: "updating", version: "0.5.0" });
    expect(
      signOf(makeUpdate({ install: makeUpdateInstall({ phase: "installed", version: "0.5.0" }) })),
    ).toEqual({ kind: "installed", version: "0.5.0" });
  });

  it("says each state", () => {
    expect(signText({ kind: "available", version: "0.5.0" })).toBe("MySpec 0.5.0 is available");
    expect(signText({ kind: "updating", version: "0.5.0" })).toBe("Updating to MySpec 0.5.0…");
    expect(signText({ kind: "installed", version: "0.5.0" })).toBe(
      "MySpec 0.5.0 is installed. Restart to use it.",
    );
  });
});

describe("workingLines", () => {
  const app = makeState({
    tasks: [makeTask({ id: "t1", name: "Add login" })],
    reviews: [makeReviewSummary({ id: "r1", title: "acme/api#12" })],
    discussions: [makeDiscussion({ id: "d1", title: "Caching" })],
  });

  it("titles a task, a review and a discussion", () => {
    expect(
      workingLines(app, [
        { itemId: "t1", stage: "step:3" },
        { itemId: "r1", stage: "review" },
        { itemId: "d1", stage: "discussion" },
      ]),
    ).toEqual(["Add login · Step 3", "acme/api#12 · Review", "Caching · Discussion"]);
  });

  it("names only the place of an unknown item, or without a state", () => {
    expect(workingLines(app, [{ itemId: "x", stage: "prd" }])).toEqual(["PRD"]);
    expect(workingLines(null, [{ itemId: "t1", stage: "prd" }])).toEqual(["PRD"]);
  });

  it.each([
    ["prd", "PRD"],
    ["tech_spec", "Tech spec"],
    ["plan", "Plan"],
    ["one_shot", "Planning"],
    ["step:2", "Step 2"],
    ["step_review:2", "Reviewer of step 2"],
    ["pr", "PR"],
    ["pr_review", "PR review"],
    ["review", "Review"],
    ["discussion", "Discussion"],
    ["mystery", "mystery"],
  ])("places %s as %s", (stage, place) => {
    expect(workingLines(app, [{ itemId: "t1", stage }])).toEqual([`Add login · ${place}`]);
  });
});

describe("releaseHeading", () => {
  it("writes the day of this year without the year", () => {
    expect(releaseHeading(makeUpdateRelease({ version: "0.4.0" }), NOW)).toBe("0.4.0 · Oct 16");
  });

  it("writes the year before this one", () => {
    const release = makeUpdateRelease({ version: "0.4.0", publishedAt: "2025-10-16T12:00:00Z" });

    expect(releaseHeading(release, NOW)).toBe("0.4.0 · Oct 16, 2025");
  });
});

describe("checkedText and checkedTip", () => {
  it("says how long ago the check ended and when", () => {
    const checkedAt = new Date(Date.parse("2026-10-17T14:05:00")).toISOString();

    expect(checkedText(checkedAt, NOW)).toBe("Checked 5m ago");
    expect(checkedTip(checkedAt, NOW)).toBe("Last checked at 14:05");
  });

  it("says just now under a minute", () => {
    const checkedAt = new Date(NOW - 10_000).toISOString();

    expect(checkedText(checkedAt, NOW)).toBe("Checked just now");
  });

  it("names the day of an earlier check in the tooltip", () => {
    const checkedAt = new Date(Date.parse("2026-10-16T17:40:00")).toISOString();

    expect(checkedTip(checkedAt, NOW)).toBe("Last checked yesterday at 17:40");
  });
});

describe("resultOf", () => {
  const failure = { kind: "offline", detail: "" };

  it("is local for a build that never checks, before anything else", () => {
    expect(resultOf(makeUpdate({ checks: false, failure, latest: "0.5.0" }))).toEqual({
      kind: "local",
    });
  });

  it("is the failure, with its reason, before a known version", () => {
    expect(resultOf(makeUpdate({ failure, latest: "0.5.0" }))).toEqual({
      kind: "failed",
      reason: "No connection to GitHub.",
    });
  });

  it("is available with a newer version known", () => {
    expect(resultOf(makeUpdate({ latest: "0.5.0" }))).toEqual({ kind: "available" });
  });

  it("is latest after a successful check without a newer version", () => {
    expect(resultOf(makeUpdate())).toEqual({ kind: "latest" });
  });

  it("is none before the first check", () => {
    expect(resultOf(makeUpdate({ checkedAt: "" }))).toEqual({ kind: "none" });
  });
});
