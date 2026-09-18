import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MultiFilterMenu } from "@/features/reviews/MultiFilterMenu";
import type { ReviewFilters } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeReviewFilters } from "@/test/wails-mock";

function menu(filters: ReviewFilters, onChange = vi.fn<(next: ReviewFilters) => void>()) {
  const rendered = renderWithStore(
    <MultiFilterMenu
      name="Author"
      kind="author"
      values={["alice", "dependabot"]}
      filters={filters}
      onChange={onChange}
    />,
  );
  return { ...rendered, onChange };
}

describe("MultiFilterMenu", () => {
  it("reads Any until a value is filtered", () => {
    menu(makeReviewFilters());

    expect(screen.getByRole("button", { name: "Author: Any" })).toBeInTheDocument();
  });

  it("writes what it includes and excludes on the trigger", () => {
    menu(makeReviewFilters({ authorsInclude: ["alice"], authorsExclude: ["dependabot"] }));

    expect(screen.getByRole("button", { name: "Author: +alice −dependabot" })).toBeInTheDocument();
  });

  it("excludes a value on the first click and stays open for the next", async () => {
    const { user, onChange } = menu(makeReviewFilters());

    await user.click(screen.getByRole("button", { name: "Author: Any" }));
    await user.click(await screen.findByRole("menuitem", { name: "dependabot: not filtered" }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ authorsExclude: ["dependabot"] }),
    );
    expect(screen.getByRole("menuitem", { name: "alice: not filtered" })).toBeInTheDocument();
  });

  it("says what each value is doing in the filter", async () => {
    const { user } = menu(makeReviewFilters({ authorsExclude: ["dependabot"] }));

    await user.click(screen.getByRole("button", { name: "Author: −dependabot" }));

    expect(
      await screen.findByRole("menuitem", { name: "dependabot: excluded" }),
    ).toBeInTheDocument();
  });

  it("says when the reading found nothing to filter by", async () => {
    const { user } = renderWithStore(
      <MultiFilterMenu
        name="Label"
        kind="label"
        values={[]}
        filters={makeReviewFilters()}
        onChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Label: Any" }));

    expect(
      await screen.findByRole("menuitem", { name: "Nothing to filter by" }),
    ).toBeInTheDocument();
  });
});
