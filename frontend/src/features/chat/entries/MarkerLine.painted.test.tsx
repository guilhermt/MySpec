import { act, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MarkerLine } from "@/features/chat/entries/MarkerLine";
import type { MarkerBody, MarkerView } from "@/features/chat/markers";
import { api } from "@/lib/wails";
import {
  cutTexts,
  HEADED,
  paintOf,
  setTheme,
  THEMES,
  TRANSPARENT,
  token,
  uiHeadings,
  withoutTooltip,
} from "@/test/painted";
import { renderWithStore } from "@/test/render";
import { makeDiscussion, makeTask } from "@/test/wails-mock";

// Only the boundary is replaced, as in the jsdom suite: no call reaches the runtime of Wails.
vi.mock("@/lib/wails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wails")>()),
  ...(await import("@/test/wails-mock")),
}));

/** STOPPED is the line of a publication that stopped, with a list whose state is longer than its half. */
const STOPPED: MarkerView = {
  icon: "problem",
  text: "Publication stopped",
  complement: "round 1 · 3 published · Overage on the monthly invoice failed",
  tone: "error",
  timeHidden: false,
  body: {
    kind: "drafts",
    rows: [
      {
        key: "a",
        glyph: "error",
        prefix: "",
        title: "Overage on the monthly invoice",
        status:
          "acme/billing rejected the issue: the label Billing doesn't exist in the repository",
        tone: "error",
        link: null,
      },
    ],
  },
};

// opened draws a line with the body given, opened without the pointer, in a task and a discussion.
function opened(body: MarkerBody) {
  const discussion = makeDiscussion();
  renderWithStore(
    <MarkerLine
      view={{ icon: "product", text: "MySpec → Reviewer", complement: "", body, timeHidden: false }}
      createdAt=""
      task={makeTask()}
      discussion={{ id: discussion.id, documentRevision: 1, documents: true }}
    />,
  );
  act(() => screen.getByRole("button", { expanded: false }).click());
}

describe.each(THEMES)("MarkerLine in the %s theme", (theme) => {
  it("draws the headings of a message of the product at the size of the UI, in 600", async () => {
    setTheme(theme);
    opened({ kind: "markdown", text: HEADED });

    const { got, want } = await uiHeadings();
    expect(got).toEqual(want);
  });

  it("draws the headings of a document of the task at the size of the UI, in 600", async () => {
    setTheme(theme);
    vi.mocked(api.readArtifact).mockImplementation(() => Promise.resolve(HEADED));
    opened({ kind: "artifact", name: "PRD.md", openIn: "artifacts" });

    const { got, want } = await uiHeadings();
    expect(got).toEqual(want);
  });

  it("draws the headings of a document of the discussion at the size of the UI, in 600", async () => {
    setTheme(theme);
    opened({ kind: "discussionDocument", name: "discussion.md", text: HEADED });

    const { got, want } = await uiHeadings();
    expect(got).toEqual(want);
  });

  it.each([
    ["of the task", { kind: "artifact", name: "PRD.md", openIn: "artifacts" }],
    ["of the discussion", { kind: "discussionDocument", name: "discussion.md", text: null }],
  ] satisfies [string, MarkerBody][])(
    "says a document %s that couldn't be read in the sunken strip, with a ghost Try again",
    async (_of, body) => {
      setTheme(theme);
      vi.mocked(api.readArtifact).mockImplementation(() => Promise.reject(new Error("gone")));
      vi.mocked(api.readDiscussionArtifact).mockImplementation(() =>
        Promise.reject(new Error("gone")),
      );
      opened(body);

      const retry = await screen.findByRole("button", { name: "Try again" });
      const strip = retry.closest<HTMLElement>('[data-slot="notice-strip"]');
      if (strip === null) {
        throw new Error("the failure is not a strip");
      }
      expect(strip).toHaveTextContent(`Couldn't read ${body.name} gone`);
      expect(paintOf(strip, { background: "" })).toEqual({ background: token("--surface-0") });
      expect(paintOf(retry, { background: "" })).toEqual({ background: TRANSPARENT });
    },
  );

  it("says in a tooltip the complement and the state of a row it cuts", async () => {
    setTheme(theme);
    const { container } = renderWithStore(
      <div style={{ width: "480px" }}>
        <MarkerLine view={STOPPED} createdAt="" />
      </div>,
    );
    // Opened without the pointer, which would rest on the complement it then hovers.
    act(() => screen.getByRole("button", { expanded: false }).click());
    const cut = cutTexts(container as HTMLElement).map((element) => element.textContent);

    expect(cut).toEqual(expect.arrayContaining([STOPPED.complement]));
    const list = within(container as HTMLElement).getByRole("list");
    expect(cutTexts(list).map((element) => element.textContent)).toContain(
      "acme/billing rejected the issue: the label Billing doesn't exist in the repository",
    );
    expect(await withoutTooltip(cutTexts(container as HTMLElement))).toEqual([]);
  });
});
