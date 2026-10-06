import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PanelDocument } from "@/features/task/PanelDocument";
import { api } from "@/lib/wails";
import { HEADED, paintOf, setTheme, THEMES, TRANSPARENT, token, uiHeadings } from "@/test/painted";
import { renderWithStore } from "@/test/render";

// Only the boundary is replaced, as in the jsdom suite: no call reaches the runtime of Wails.
vi.mock("@/lib/wails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wails")>()),
  ...(await import("@/test/wails-mock")),
}));

function open(file: string, step = false) {
  return renderWithStore(
    <PanelDocument
      taskId="task-1"
      file={file}
      artifactVersion={0}
      title="Step 3"
      back="Details"
      onBack={() => undefined}
      step={step}
    />,
  );
}

describe.each(THEMES)("PanelDocument in the %s theme", (theme) => {
  it("draws the headings of a document under its title at the size of the UI, in 600", async () => {
    setTheme(theme);
    vi.mocked(api.readArtifact).mockImplementation(() => Promise.resolve(HEADED));
    open("PRD.md");

    const { got, want } = await uiHeadings();
    expect(got).toEqual(want);
  });

  it("draws the headings of a step file at the size of the UI, in 600", async () => {
    setTheme(theme);
    vi.mocked(api.readArtifact).mockImplementation(() =>
      Promise.resolve(`---\nstatus: done\n---\n${HEADED}`),
    );
    open("steps/3-wire-the-api.md", true);

    const { got, want } = await uiHeadings();
    expect(got).toEqual(want);
  });

  it("says a read that failed in the sunken strip, with a ghost Try again", async () => {
    setTheme(theme);
    vi.mocked(api.readArtifact).mockImplementation(() =>
      Promise.reject(new Error("permission denied")),
    );
    open("PRD.md");

    const strip = await screen.findByRole("alert");
    expect(strip).toHaveTextContent("Couldn't read PRD.md permission denied");
    expect(paintOf(strip, { background: "" })).toEqual({ background: token("--surface-0") });
    const retry = screen.getByRole("button", { name: "Try again" });
    expect(paintOf(retry, { background: "" })).toEqual({ background: TRANSPARENT });
  });
});
