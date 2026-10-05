import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DocumentsPanel } from "@/features/discussion/DocumentsPanel";
import { api } from "@/lib/wails";
import { HEADED, paintOf, setTheme, THEMES, TRANSPARENT, token, uiHeadings } from "@/test/painted";
import { renderWithStore } from "@/test/render";
import { makeDiscussion, makeState } from "@/test/wails-mock";

// Only the boundary is replaced, as in the jsdom suite: no call reaches the runtime of Wails.
vi.mock("@/lib/wails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wails")>()),
  ...(await import("@/test/wails-mock")),
}));

function panel() {
  const discussion = makeDiscussion({ hasDocument: true, documentRevision: 1 });
  return renderWithStore(<DocumentsPanel discussion={discussion} />, {
    state: makeState({ discussions: [discussion] }),
  });
}

describe.each(THEMES)("DocumentsPanel in the %s theme", (theme) => {
  it("draws the headings of the document at the size of the UI, in 600", async () => {
    setTheme(theme);
    vi.mocked(api.readDiscussionArtifact).mockImplementation(() => Promise.resolve(HEADED));
    panel();

    const { got, want } = await uiHeadings();
    expect(got).toEqual(want);
  });

  it("says a read that failed in the sunken strip, with a ghost Try again", async () => {
    setTheme(theme);
    vi.mocked(api.readDiscussionArtifact).mockImplementation(() =>
      Promise.reject(new Error("No such file.")),
    );
    panel();

    const strip = await screen.findByRole("alert");
    expect(paintOf(strip, { background: "" })).toEqual({ background: token("--surface-0") });
    const retry = screen.getByRole("button", { name: "Try again" });
    expect(paintOf(retry, { background: "" })).toEqual({ background: TRANSPARENT });
  });
});
