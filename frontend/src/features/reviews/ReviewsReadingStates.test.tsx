import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  NoMatch,
  NoPullRequests,
  NoRepositories,
  ReadingSkeleton,
  ReviewsFailureStrips,
} from "@/features/reviews/ReviewsReadingStates";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import {
  makePullRequestRow,
  makePullsFailure,
  makeRepository,
  makeReviewCenter,
  makeState,
} from "@/test/wails-mock";

const FAILED_AT = "2026-09-16T12:00:00Z";
const FOUR_MINUTES_LATER = Date.parse(FAILED_AT) + 4 * 60_000;

describe("ReviewsFailureStrips", () => {
  const center = makeReviewCenter({
    failures: [
      makePullsFailure({
        repositoryId: "repo-2",
        repository: "acme/ios",
        message: "gh is not authenticated. Run gh auth login.",
        failedAt: FAILED_AT,
      }),
      makePullsFailure({
        repositoryId: "repo-1",
        repository: "acme/api",
        message: "The repository doesn't exist or this account can't read its pull requests.",
        failedAt: FAILED_AT,
      }),
    ],
  });

  it("draws a strip for each repository that failed, in alphabetical order", () => {
    renderWithStore(<ReviewsFailureStrips center={center} now={FOUR_MINUTES_LATER} />);

    const strips = screen.getAllByRole("alert");
    expect(strips).toHaveLength(2);
    expect(strips[0]).toHaveTextContent("Couldn't read acme/api · 4m ago");
    expect(strips[1]).toHaveTextContent("Couldn't read acme/ios · 4m ago");
    expect(strips[1]).toHaveTextContent("gh is not authenticated. Run gh auth login.");
  });

  it("reads the whole list again on Try again", async () => {
    const { user } = renderWithStore(
      <ReviewsFailureStrips center={center} now={FOUR_MINUTES_LATER} />,
    );

    await user.click(screen.getAllByRole("button", { name: "Try again" })[0] as HTMLElement);

    expect(api.refreshPullRequests).toHaveBeenCalledOnce();
  });

  it("says Reading… in every strip while it reads", () => {
    renderWithStore(
      <ReviewsFailureStrips center={{ ...center, reading: true }} now={FOUR_MINUTES_LATER} />,
    );

    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
    for (const strip of screen.getAllByRole("alert")) {
      expect(strip).toHaveTextContent("Reading…");
    }
  });

  it("draws nothing without failures", () => {
    const { container } = renderWithStore(
      <ReviewsFailureStrips center={makeReviewCenter()} now={FOUR_MINUTES_LATER} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

describe("ReadingSkeleton", () => {
  it("stands in with four bars under a name", () => {
    const { container } = renderWithStore(<ReadingSkeleton />);

    expect(screen.getByRole("status", { name: "Reading the pull requests…" })).toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(4);
  });
});

describe("the empty states", () => {
  it("asks for a repository", () => {
    renderWithStore(<NoRepositories />);

    expect(screen.getByText("Register a repository to see its pull requests.")).toBeInTheDocument();
  });

  it("says what the list shows when nothing is open, and reads again on Read now", async () => {
    const { user } = renderWithStore(
      <NoPullRequests app={makeState({ repositories: [makeRepository()] })} />,
    );

    expect(screen.getByText("No open pull requests.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "The list shows the open pull requests of your 1 repository, from any author. MySpec reads them every 5 minutes and when you open Reviews.",
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Read now" }));
    expect(api.refreshPullRequests).toHaveBeenCalledOnce();
  });

  it("dashes Read now while a reading runs over the empty list, with the reason", async () => {
    const { user } = renderWithStore(
      <NoPullRequests
        app={makeState({
          repositories: [makeRepository()],
          reviewCenter: makeReviewCenter({ readAt: "2026-09-24T17:58:00Z", reading: true }),
        })}
      />,
    );

    const read = screen.getByRole("button", { name: "Read now" });
    expect(read).toHaveAttribute("aria-disabled", "true");
    expect(read).toHaveAccessibleDescription("A reading is running.");
    await user.click(read);
    expect(api.refreshPullRequests).not.toHaveBeenCalled();
  });

  it("counts the pull requests the filters hide, and clears the filters", async () => {
    let cleared = 0;
    const center = makeReviewCenter({
      pullRequests: [
        makePullRequestRow({ filtered: true }),
        makePullRequestRow({ filtered: true }),
      ],
    });
    const { user } = renderWithStore(<NoMatch center={center} onClear={() => (cleared += 1)} />);

    expect(screen.getByText("No pull requests match the filters.")).toBeInTheDocument();
    expect(screen.getByText("2 are open; the filters hide all of them.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(cleared).toBe(1);
  });
});
