import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { SettingsView } from "@/features/settings/SettingsView";
import {
  cutTexts,
  edgesOf,
  mainArea,
  NARROW_MAIN,
  setTheme,
  settle,
  THEMES,
  withoutTooltip,
} from "@/test/painted";
import { renderWithStore } from "@/test/render";
import { fixSettingsSceneClock, settingsScene } from "@/test/settings-scenes";
import { api, resetWailsMock } from "@/test/wails-mock";

// Only the boundary is replaced, as in the jsdom suite: no call reaches the runtime of Wails.
vi.mock("@/lib/wails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wails")>()),
  ...(await import("@/test/wails-mock")),
}));

/** WIDTHS are the main areas of the scenes of Settings: a monitor, half of it, and a 1100px window. */
const WIDTHS = [2180, 978, NARROW_MAIN];

/**
 * LONG_PATH is a clone deep in a mounted share, longer than the line of a row at any width, with no
 * hyphen or space where a line could break on its own.
 */
const LONG_PATH =
  "/mnt/team_share/engineering_platform/services_internal/payments_and_billing/acme_api_gateway_v2";

fixSettingsSceneClock();

const VIEWPORT = { width: window.innerWidth, height: window.innerHeight };

afterEach(async () => {
  await page.viewport(VIEWPORT.width, VIEWPORT.height);
  for (const fn of Object.values(api)) {
    fn.mockReset();
  }
  resetWailsMock();
});

describe.each(THEMES)("Settings, a long path of a repository in the %s theme", (theme) => {
  it.each(WIDTHS)("keeps the whole path readable at the main area of %ipx", async (width) => {
    setTheme(theme);
    const { state, location } = settingsScene("settings-repos", "");
    const repositories = (state.repositories ?? []).map((repository) =>
      repository.fullName === "acme/api" ? { ...repository, path: LONG_PATH } : repository,
    );
    await page.viewport(width, VIEWPORT.height);
    const { container } = renderWithStore(
      <div style={{ ...mainArea(width), height: "800px", display: "flex" }}>
        <SettingsView />
      </div>,
      { state: { ...state, repositories }, ui: { location } },
    );
    await settle();

    const path = await screen.findByText(LONG_PATH);
    const row = path.closest("li");
    const pageBox = container.querySelector(".settings-body")?.children[1];
    if (row === null || pageBox === undefined) {
      throw new Error("the row of acme/api or the page is not drawn");
    }
    // The path breaks onto more lines rather than leaving the row, and nothing it cuts goes unsaid.
    expect(edgesOf(path).right, "the path inside its row").toBeLessThanOrEqual(edgesOf(row).right);
    expect(edgesOf(row).right, "the row inside the page").toBeLessThanOrEqual(
      edgesOf(pageBox).right,
    );
    expect(await withoutTooltip(cutTexts(row))).toEqual([]);
  });
});
