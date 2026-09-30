import { describe, expect, it } from "vitest";
import {
  findingLocation,
  lastRecordedPass,
  outcomeLabel,
  placementLabel,
  reportLabel,
  verdictLabel,
} from "@/features/reviews/review-status";
import { makeReviewFinding, makeReviewPass, makeReviewSummary } from "@/test/wails-mock";

describe("reportLabel", () => {
  it("names a pass and how it closed", () => {
    expect(reportLabel(makeReviewPass({ pass: 2, clean: false }))).toBe("Review 2 · changes");
    expect(reportLabel(makeReviewPass({ pass: 3, clean: true }))).toBe("Review 3 · clean");
  });

  it("says when the pass was published", () => {
    expect(reportLabel(makeReviewPass({ pass: 1, clean: true, published: true }))).toBe(
      "Review 1 · clean · published",
    );
  });
});

describe("verdictLabel", () => {
  it("names each verdict", () => {
    expect(verdictLabel("approve")).toBe("Approve");
    expect(verdictLabel("request_changes")).toBe("Request changes");
    expect(verdictLabel("comment")).toBe("Comment");
  });
});

describe("findingLocation", () => {
  it("points at the file and the line of an anchored finding", () => {
    expect(findingLocation(makeReviewFinding({ path: "src/login.ts", line: 12 }))).toBe(
      "src/login.ts:12",
    );
  });

  it("calls a finding without a line general", () => {
    expect(findingLocation(makeReviewFinding({ path: "", line: 0 }))).toBe("General");
  });
});

describe("placementLabel", () => {
  it.each([
    ["inline", "Inline comment"],
    ["body", "In the review body"],
    ["", "Not published"],
    ["elsewhere", "Not published"],
  ])("says where a finding placed %j went", (placement, label) => {
    expect(placementLabel(placement)).toBe(label);
  });
});

describe("outcomeLabel", () => {
  it.each([
    ["merged", "Merged"],
    ["closed", "Closed"],
    ["", "Closed"],
  ])("reads the outcome %j", (outcome, label) => {
    expect(outcomeLabel(outcome)).toBe(label);
  });
});

describe("lastRecordedPass", () => {
  it("is the last pass whose report the app could read", () => {
    const review = makeReviewSummary({
      passes: [
        makeReviewPass({ pass: 1 }),
        makeReviewPass({ pass: 2 }),
        makeReviewPass({ pass: 3, recorded: false }),
      ],
    });

    expect(lastRecordedPass(review)?.pass).toBe(2);
  });

  it("is nothing before a report came in", () => {
    expect(lastRecordedPass(makeReviewSummary({ passes: [] }))).toBeNull();
  });
});
