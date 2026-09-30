import { describe, expect, it } from "vitest";
import { visibleRows } from "@/features/reviews/reviews-view";
import { makePullRequestRow, makeReviewCenter } from "@/test/wails-mock";

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

  it("lists only the pull requests that wait for the user with pending only on", () => {
    const center = makeReviewCenter({
      pullRequests: [
        makePullRequestRow({ key: "dev/web#31", pending: true }),
        makePullRequestRow({ key: "dev/web#32", pending: false }),
        makePullRequestRow({ key: "dev/web#33", pending: true, filtered: true }),
      ],
    });

    expect(visibleRows(center, true).map((row) => row.key)).toEqual(["dev/web#31"]);
    expect(visibleRows(center, false).map((row) => row.key)).toEqual(["dev/web#31", "dev/web#32"]);
  });
});
