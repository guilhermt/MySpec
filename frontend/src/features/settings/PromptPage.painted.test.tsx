import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mainArea, resolve, setTheme, THEMES } from "@/test/painted";
import { renderWithStore } from "@/test/render";
import { makePrompt, makeState } from "@/test/wails-mock";
import { PromptPage } from "./PromptPage";

function page() {
  renderWithStore(
    <div style={mainArea(1000)}>
      <PromptPage
        stage="prd"
        state={{
          status: "ready",
          prompt: makePrompt({ text: "# PRD of\n\n## Goals\n\nWrite it." }),
        }}
        onRetry={() => {}}
        onReset={() => {}}
        focus="title"
      />
    </div>,
    { state: makeState(), ui: { location: { kind: "settings", section: "prd" } } },
  );
}

describe.each(THEMES)("PromptPage in the %s theme", (theme) => {
  it("draws the headings of the prompt at the size of the UI, in 600, under the page title", async () => {
    setTheme(theme);
    page();

    const title = screen.getByRole("heading", { level: 2, name: "PRD" });
    for (const name of ["PRD of", "Goals"]) {
      const style = getComputedStyle(await screen.findByRole("heading", { name }));
      expect([style.fontSize, style.lineHeight, style.fontWeight]).toEqual([
        resolve("var(--text-ui)", "font-size"),
        resolve("var(--leading-ui)", "line-height"),
        "600",
      ]);
      expect(Number.parseFloat(style.fontSize)).toBeLessThan(
        Number.parseFloat(getComputedStyle(title).fontSize),
      );
    }
  });
});
