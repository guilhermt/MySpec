import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DiscussionHeader } from "@/features/discussion/DiscussionHeader";
import { mainArea, NARROW_MAIN, placeHeaderFits, setTheme, THEMES } from "@/test/painted";
import { renderWithStore } from "@/test/render";
import { makeBoard, makeDiscussion, makeState } from "@/test/wails-mock";

/** LONG_TITLE is a discussion title longer than any header has room for. */
const LONG_TITLE = "Plan the rotation of the API keys of every service without downtime ".repeat(3);

describe.each(THEMES)("DiscussionHeader in the %s theme", (theme) => {
  it("keeps everything on one line at 812px of main area, cutting only the title", () => {
    setTheme(theme);
    const discussion = makeDiscussion({
      title: LONG_TITLE,
      boardId: "board-1",
      status: "awaiting_drafts",
      sessionStatus: "working",
      contextPercent: 72,
    });
    renderWithStore(
      <div style={mainArea(NARROW_MAIN)}>
        <DiscussionHeader discussion={discussion} />
      </div>,
      {
        state: makeState({ boards: [makeBoard()], discussions: [discussion] }),
        ui: { location: { kind: "discussion", id: discussion.id } },
      },
    );
    expect(placeHeaderFits(screen.getByRole("banner"))).toBe(true);
  });
});
