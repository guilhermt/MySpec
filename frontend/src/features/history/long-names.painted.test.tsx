import { describe, expect, it, vi } from "vitest";
import { ArchivedDiscussion } from "@/features/history/ArchivedDiscussion";
import { ArchivedTask } from "@/features/history/ArchivedTask";
import { HistoryView } from "@/features/history/HistoryView";
import type { Location } from "@/lib/locations";
import {
  cutTexts,
  mainArea,
  NARROW_MAIN,
  setTheme,
  settle,
  THEMES,
  withoutTooltip,
} from "@/test/painted";
import { renderWithStore } from "@/test/render";
import {
  makeArchivedDiscussion,
  makeArchivedReview,
  makeArchivedTask,
  makeDraft,
  makeHistorySummary,
  makeRepository,
  makeState,
  makeTaskCard,
} from "@/test/wails-mock";

// Only the boundary is replaced, as in the jsdom suite: no call reaches the runtime of Wails.
vi.mock("@/lib/wails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wails")>()),
  ...(await import("@/test/wails-mock")),
}));

/**
 * The History and the archived items with names longer than any line has room for: the names of the
 * rows, where they come from, the title of an archived item and the title of a draft it published.
 * Every one of them cuts, and each says its whole text in a tooltip.
 */

const WIDE_MAIN = 2180;
const HALF_MAIN = 978;

const LONG_REPOSITORY = "acme-corporation/payments-gateway-service-for-every-region";
const LONG_TASK = makeArchivedTask({
  id: "task-long",
  name: "Idempotency keys for payment intents across every gateway, every retry, every webhook and every replay the support team asks for after an incident",
  repositoryId: "repo-long",
  repository: LONG_REPOSITORY,
  card: makeTaskCard({ repository: LONG_REPOSITORY, number: 39812 }),
  archivedAt: "2026-09-24T12:02:00Z",
});
const LONG_REVIEW = makeArchivedReview({
  id: "review-long",
  title:
    "Move the settings form to the new validation of every field, with the old one kept behind a flag until the last customer on the old plan moves over",
  repositoryId: "repo-long",
  repository: LONG_REPOSITORY,
  number: 22917,
  archivedAt: "2026-09-24T11:02:00Z",
});
const LONG_DISCUSSION = makeArchivedDiscussion({
  id: "discussion-long",
  title:
    "Webhook delivery guarantees, with the retries, the dead letters, the replays they need and the dashboards that tell the support team what happened",
  board: "Platform Roadmap of the payments gateway for every region, this quarter and the next",
  drafts: [
    makeDraft({
      id: "draft-long",
      title:
        "Retry the failed deliveries with a backoff that grows until the endpoint answers again",
    }),
  ],
  archivedAt: "2026-09-24T10:02:00Z",
});
const STATE = makeState({
  repositories: [
    makeRepository({
      id: "repo-long",
      owner: "acme-corporation",
      name: "payments-gateway-service-for-every-region",
      fullName: LONG_REPOSITORY,
    }),
  ],
  history: [LONG_TASK],
  reviewHistory: [LONG_REVIEW],
  discussionHistory: [LONG_DISCUSSION],
  historySummary: makeHistorySummary({ tasks: 1, reviews: 1, discussions: 1 }),
});

// draw draws a place in a main area of a width, once what it reads is read.
async function draw(view: React.ReactElement, location: Location, width: number) {
  const { container } = renderWithStore(
    <div style={{ ...mainArea(width), height: "800px", display: "flex" }}>{view}</div>,
    { state: STATE, ui: { location } },
  );
  await vi.waitFor(() => {
    if (container.querySelector('[aria-busy="true"], [aria-label^="Reading "]') !== null) {
      throw new Error("the screen is still reading");
    }
  });
  await settle();
  const area = container.firstElementChild;
  if (!(area instanceof HTMLElement)) {
    throw new Error("the main area is not drawn");
  }
  return area;
}

// cutOf is the text of each element the screen cuts.
const cutOf = (area: HTMLElement) => cutTexts(area).map((element) => element.textContent);

describe.each(THEMES)("The long names of the History, in the %s theme", (theme) => {
  it.each([NARROW_MAIN, WIDE_MAIN])(
    "cuts the names and where the rows come from at %ipx, each with its tooltip",
    async (width) => {
      setTheme(theme);
      const area = await draw(<HistoryView />, { kind: "history" }, width);

      expect(cutOf(area)).toEqual(
        expect.arrayContaining([LONG_TASK.name, LONG_REVIEW.title, LONG_DISCUSSION.title]),
      );
      if (width === WIDE_MAIN) {
        expect(cutOf(area)).toEqual(
          expect.arrayContaining(["payments-gateway-service-for-every-region#39812"]),
        );
      }
      expect(await withoutTooltip(cutTexts(area))).toEqual([]);
    },
  );

  it("cuts the title of an archived task, with its tooltip", async () => {
    setTheme(theme);
    const area = await draw(
      <ArchivedTask taskId={LONG_TASK.id} />,
      { kind: "archived-task", id: LONG_TASK.id },
      HALF_MAIN,
    );

    expect(cutOf(area)).toEqual(expect.arrayContaining([LONG_TASK.name]));
    expect(await withoutTooltip(cutTexts(area))).toEqual([]);
  });

  it("cuts the title of a draft an archived discussion published, with its tooltip", async () => {
    setTheme(theme);
    const area = await draw(
      <ArchivedDiscussion discussionId={LONG_DISCUSSION.id} />,
      { kind: "archived-discussion", id: LONG_DISCUSSION.id },
      HALF_MAIN,
    );

    expect(cutOf(area)).toEqual(
      expect.arrayContaining([LONG_DISCUSSION.title, LONG_DISCUSSION.drafts?.[0]?.title]),
    );
    expect(await withoutTooltip(cutTexts(area))).toEqual([]);
  });
});
