import { describe, expect, it } from "vitest";
import {
  cycleFilter,
  emptyText,
  filterState,
  filterSummary,
  isFiltering,
  visibleRows,
} from "@/features/reviews/reviews-view";
import {
  makePullRequestRow,
  makeRepository,
  makeReviewCenter,
  makeReviewFilters,
  makeState,
} from "@/test/wails-mock";

describe("visibleRows", () => {
  it("lists what the filters keep", () => {
    const center = makeReviewCenter({
      pullRequests: [
        makePullRequestRow({ key: "dev/web#31" }),
        makePullRequestRow({ key: "dev/web#32", filtered: true }),
      ],
    });

    expect(visibleRows(center).map((row) => row.key)).toEqual(["dev/web#31"]);
  });
});

describe("emptyText", () => {
  it("asks for a repository when none is registered", () => {
    expect(emptyText(makeState({ repositories: [] }))).toBe(
      "Register a repository to see its pull requests.",
    );
  });

  it("says there is nothing open", () => {
    expect(emptyText(makeState({ repositories: [makeRepository()] }))).toBe(
      "No open pull requests.",
    );
  });

  it("blames the filters when every pull request is hidden", () => {
    const app = makeState({
      reviewCenter: makeReviewCenter({
        pullRequests: [makePullRequestRow({ filtered: true })],
      }),
    });

    expect(emptyText(app)).toBe("No pull requests match the filters.");
  });
});

describe("cycleFilter", () => {
  it("walks a value from nothing to excluded, included and back", () => {
    const none = makeReviewFilters();
    expect(filterState(none, "author", "bot")).toBe("none");

    const excluded = cycleFilter(none, "author", "bot");
    expect(filterState(excluded, "author", "bot")).toBe("exclude");
    expect(excluded.authorsExclude).toEqual(["bot"]);

    const included = cycleFilter(excluded, "author", "bot");
    expect(filterState(included, "author", "bot")).toBe("include");
    expect(included.authorsInclude).toEqual(["bot"]);
    expect(included.authorsExclude).toEqual([]);

    const cleared = cycleFilter(included, "author", "bot");
    expect(filterState(cleared, "author", "bot")).toBe("none");
    expect(cleared.authorsInclude).toEqual([]);
  });

  it("walks the labels without touching the authors", () => {
    const filters = cycleFilter(makeReviewFilters({ authorsExclude: ["bot"] }), "label", "chore");

    expect(filters.labelsExclude).toEqual(["chore"]);
    expect(filters.authorsExclude).toEqual(["bot"]);
  });
});

describe("filterSummary", () => {
  it("reads Any when the filter lets everything through", () => {
    expect(filterSummary(makeReviewFilters(), "author")).toBe("Any");
  });

  it("writes the included with a plus and the excluded with a minus", () => {
    const filters = makeReviewFilters({ authorsInclude: ["alice"], authorsExclude: ["bot"] });

    expect(filterSummary(filters, "author")).toBe("+alice −bot");
  });
});

describe("isFiltering", () => {
  it("is false for a view that shows everything", () => {
    expect(isFiltering(makeReviewFilters())).toBe(false);
  });

  it("is true for each filter on its own", () => {
    expect(isFiltering(makeReviewFilters({ boardId: "board-1" }))).toBe(true);
    expect(isFiltering(makeReviewFilters({ repositoryId: "repo-1" }))).toBe(true);
    expect(isFiltering(makeReviewFilters({ labelsInclude: ["bug"] }))).toBe(true);
    expect(isFiltering(makeReviewFilters({ pendingOnly: true }))).toBe(true);
  });
});
