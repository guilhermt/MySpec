import { screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { ArchivedDiscussion } from "@/features/history/ArchivedDiscussion";
import { ArchivedReview } from "@/features/history/ArchivedReview";
import { ArchivedTask } from "@/features/history/ArchivedTask";
import type { Location } from "@/lib/locations";
import { menuGone, withMenuExitAnimation } from "@/test/menu-exit";
import { renderWithStore } from "@/test/render";
import {
  makeArchivedDiscussion,
  makeArchivedReview,
  makeArchivedTask,
  makeState,
} from "@/test/wails-mock";

const TASK = makeArchivedTask({ id: "task-1", name: "add-login" });
const REVIEW = makeArchivedReview({ id: "review-1" });
const DISCUSSION = makeArchivedDiscussion({ id: "discussion-1", title: "The invoices" });

const CASES: { kind: string; view: ReactElement; location: Location; title: string }[] = [
  {
    kind: "task",
    view: <ArchivedTask taskId={TASK.id} />,
    location: { kind: "archived-task", id: TASK.id },
    title: "Delete “add-login”?",
  },
  {
    kind: "review",
    view: <ArchivedReview reviewId={REVIEW.id} />,
    location: { kind: "archived-review", id: REVIEW.id },
    title: "Delete the review of web#31?",
  },
  {
    kind: "discussion",
    view: <ArchivedDiscussion discussionId={DISCUSSION.id} />,
    location: { kind: "archived-discussion", id: DISCUSSION.id },
    title: "Delete “The invoices”?",
  },
];

describe("ArchivedMenu", () => {
  it.each(CASES)(
    "opens Delete… of an archived $kind on Cancel, which the menu doesn't take back to the ⋯",
    async ({ view, location, title }) => {
      await withMenuExitAnimation(async () => {
        const { user } = renderWithStore(view, {
          state: makeState({
            history: [TASK],
            reviewHistory: [REVIEW],
            discussionHistory: [DISCUSSION],
          }),
          ui: { location },
        });
        const trigger = screen.getByRole("button", { name: "More actions" });
        await user.click(trigger);

        await user.click(await screen.findByRole("menuitem", { name: "Delete…" }));
        const dialog = await screen.findByRole("alertdialog", { name: title });
        await menuGone();

        expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();
        expect(trigger).not.toHaveFocus();
      });
    },
  );
});
