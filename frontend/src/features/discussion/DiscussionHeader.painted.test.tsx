import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DiscussionHeader } from "@/features/discussion/DiscussionHeader";
import { mainArea, NARROW_MAIN, placeHeaderFits, setTheme, THEMES } from "@/test/painted";
import { renderWithStore } from "@/test/render";
import { makeBoard, makeDiscussion, makeState } from "@/test/wails-mock";

/** LONG_TITLE is a discussion title longer than any header has room for. */
const LONG_TITLE = "Plan the rotation of the API keys of every service without downtime ".repeat(3);

// header draws the header of a discussion while its agent works, with every piece the band can hold,
// inside a main area of a fixed width, the container its queries measure.
function header(width: number, title = "Usage-based pricing tiers") {
  const discussion = makeDiscussion({
    title,
    round: 1,
    sessionStatus: "working",
    contextPercent: 72,
  });
  renderWithStore(
    <div style={mainArea(width)}>
      <DiscussionHeader discussion={discussion} />
    </div>,
    {
      state: makeState({ boards: [makeBoard()], discussions: [discussion] }),
      ui: {
        location: { kind: "discussion", id: discussion.id },
        // A settled conversation: the pill stops glowing and takes its place in the stepper.
        transcripts: {
          "discussion-1|discussion": {
            status: "ready",
            error: "",
            entries: [],
            pending: [],
            buffered: [],
          },
        },
      },
    },
  );
  return screen.getByRole("banner");
}

// shown tells whether an element takes room on screen: a visually hidden one keeps a single pixel,
// a hidden one none.
function shown(element: Element): boolean {
  return element.getBoundingClientRect().width > 1;
}

// pieces finds what each limit of the band gives way.
function pieces() {
  const pill = within(screen.getByRole("list", { name: /^Progress/ })).getByRole("listitem", {
    current: "step",
  });
  const track = screen.getByRole("meter", { name: "Context" }).querySelector("[data-slot='track']");
  if (track === null) {
    throw new Error("the band has no track");
  }
  return {
    levels: within(screen.getByRole("navigation", { name: "Breadcrumb" })).getByRole("list", {
      hidden: true,
    }),
    panelName: within(screen.getByRole("button", { name: "Details" })).getByText("Details"),
    pauseName: within(screen.getByRole("button", { name: "Pause" })).getByText("Pause"),
    track,
    word: within(pill).getByText("working"),
  };
}

/** LIMITS are the main area widths from which each piece shows, the ones of the header of a task. */
const LIMITS = { levels: 1660, panelName: 1440, pauseName: 1360, track: 1300, word: 1040 } as const;

/** WIDTHS are every limit and the pixel under it. */
const WIDTHS = [...new Set(Object.values(LIMITS))].flatMap((limit) => [limit, limit - 1]);

describe.each(THEMES)("DiscussionHeader in the %s theme", (theme) => {
  it.each(WIDTHS)("at %ipx of main area shows each piece from its limit on", (width) => {
    setTheme(theme);
    header(width);
    const found = pieces();

    const seen = Object.fromEntries(
      Object.entries(found).map(([name, element]) => [name, shown(element)]),
    );
    const want = Object.fromEntries(
      Object.entries(LIMITS).map(([name, limit]) => [name, width >= limit]),
    );
    expect(seen).toEqual(want);
  });

  it("keeps everything on one line at 812px of main area, cutting only the title", () => {
    setTheme(theme);
    expect(placeHeaderFits(header(NARROW_MAIN, LONG_TITLE))).toBe(true);
  });
});
