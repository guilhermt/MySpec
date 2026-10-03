import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { api } from "@/lib/wails";
import { paintOf, resolve, setTheme, THEMES, TRANSPARENT, token } from "@/test/painted";
import { renderWithStore } from "@/test/render";
import { makeModelCatalog, makeState } from "@/test/wails-mock";
import { ModelDefaultRow } from "./ModelDefaultRow";

vi.mock("@/lib/wails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wails")>()),
  ...(await import("@/test/wails-mock")),
}));

const OPUS = { model: "claude-opus-5-5[1m]", effort: "medium" };

describe.each(THEMES)("ModelDefaultRow in the %s theme", (theme) => {
  it("offers Try again of a failed save as a ghost xs button", async () => {
    setTheme(theme);
    vi.mocked(api.setModelDefault).mockRejectedValueOnce(new Error("the disk is full"));
    renderWithStore(
      <ul>
        <ModelDefaultRow stage="pr" note="" choice={OPUS} factory={OPUS} />
      </ul>,
      { state: makeState({ modelCatalog: makeModelCatalog() }) },
    );

    await userEvent.click(screen.getByRole("button", { name: /^PR: / }));
    await userEvent.click(await screen.findByRole("menuitemradio", { name: "low" }));
    const alert = await screen.findByRole("alert");
    const want = {
      height: resolve("var(--size-control-xs)", "height"),
      background: TRANSPARENT,
      color: token("--ink-2"),
    };
    expect(paintOf(within(alert).getByRole("button", { name: "Try again" }), want)).toEqual(want);
    expect(paintOf(within(alert).getByText(/^Couldn't save/), { color: "" })).toEqual({
      color: token("--state-error"),
    });
  });
});
