import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DiscussionComposer } from "@/features/discussion/DiscussionComposer";
import type { DiscussionSummary } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeDiscussion, makeDraft, makeEntry, makeSituation, makeState } from "@/test/wails-mock";

const PLACE = { kind: "discussion", stage: "discussion", step: 0 };

function composer(overrides: Partial<DiscussionSummary> = {}, ui = {}) {
  const discussion = makeDiscussion({
    sessionStatus: "waiting",
    turnRunning: false,
    processRunning: false,
    ...overrides,
  });
  return renderWithStore(<DiscussionComposer discussion={discussion} />, {
    state: makeState({ discussions: [discussion] }),
    ui,
  });
}

const field = () => screen.getByRole("textbox", { name: "Reply to the agent" });

describe("DiscussionComposer", () => {
  it("is there from the start of the discussion, with no starters", () => {
    composer();

    expect(field()).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Starts of a message" })).not.toBeInTheDocument();
  });

  it("starts the message asking for changes in the drafts of the round", async () => {
    const { user } = composer({ status: "deciding", round: 1, drafts: [makeDraft()] });

    await user.click(screen.getByRole("button", { name: "Ask for changes" }));

    expect(field()).toHaveValue("Change the drafts: ");
    expect(field()).toHaveFocus();
  });

  it("starts the message asking to fix the drafts file the agent wrote badly", async () => {
    const { user } = composer({
      round: 0,
      unreadableDrafts: "Draft export has no title.",
    });

    await user.click(screen.getByRole("button", { name: "Ask to fix the drafts" }));

    expect(field()).toHaveValue(
      "drafts.md can't be read: Draft export has no title. Rewrite it in the format MySpec reads. ",
    );
  });

  it("says in its placeholder that the drafts file can't be read", () => {
    composer({ round: 0, unreadableDrafts: "Draft export has no title." });

    expect(field()).toHaveAttribute("placeholder", expect.stringMatching(/drafts/i));
  });

  describe("quick replies", () => {
    const said = () => {
      const entry = makeEntry("assistant");
      return entry.assistant === null
        ? entry
        : {
            ...entry,
            assistant: { ...entry.assistant, text: "Which?\n\na) Per key\nb) Per plan" },
          };
    };
    const transcript = {
      transcripts: {
        "discussion-1|discussion": {
          status: "ready",
          error: "",
          entries: [said()],
          pending: [],
          buffered: [],
        },
      },
    };

    it("are offered while the discussion waits for a reply", () => {
      composer(
        {
          situations: [
            makeSituation({
              taskId: "discussion-1",
              kind: "reply",
              group: "waiting",
              place: PLACE,
            }),
          ],
        },
        transcript,
      );

      expect(
        within(screen.getByRole("group", { name: "Quick replies" })).getAllByRole("button"),
      ).toHaveLength(2);
    });

    it("stay away from any other situation", () => {
      composer(
        {
          status: "deciding",
          round: 1,
          drafts: [makeDraft()],
          situations: [
            makeSituation({
              taskId: "discussion-1",
              kind: "drafts",
              group: "waiting",
              place: PLACE,
            }),
          ],
        },
        transcript,
      );

      expect(screen.queryByRole("group", { name: "Quick replies" })).not.toBeInTheDocument();
    });
  });

  it("says that sending restarts the session while it is stopped", () => {
    composer({ sessionStatus: "stopped", lastError: "It crashed." });

    expect(field()).toHaveAttribute("placeholder", "Sending restarts the session…");
  });
});
