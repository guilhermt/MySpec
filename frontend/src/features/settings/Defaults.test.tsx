import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Defaults } from "@/features/settings/Defaults";
import type { ModelCatalog } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeModelCatalog, makeState } from "@/test/wails-mock";

function defaults(catalog: ModelCatalog = makeModelCatalog()) {
  return renderWithStore(<Defaults />, { state: makeState({ modelCatalog: catalog }) });
}

describe("Defaults", () => {
  it("says why there are no models to offer", () => {
    defaults(makeModelCatalog({ models: [], failure: "not_found" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/Claude Code was not found/);
  });

  it("says nothing when there is a catalog", () => {
    defaults();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
