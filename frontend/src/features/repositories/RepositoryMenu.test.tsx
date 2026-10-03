import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RepositoryMenu } from "@/features/repositories/RepositoryMenu";
import { renderWithStore } from "@/test/render";
import { makeRepository, makeState } from "@/test/wails-mock";

function menu(overrides = {}) {
  const handlers = { onChangePath: vi.fn(), onReviewInstructions: vi.fn(), onRemove: vi.fn() };
  const rendered = renderWithStore(
    <RepositoryMenu repository={makeRepository(overrides)} {...handlers} />,
    { state: makeState() },
  );
  return { ...rendered, ...handlers };
}

async function open(rendered: ReturnType<typeof menu>) {
  await rendered.user.click(screen.getByRole("button", { name: "More for dev/web" }));
  await screen.findByRole("menu");
}

describe("RepositoryMenu", () => {
  it("opens from the ⋯ and asks nothing of a repository with nothing in it", async () => {
    const rendered = menu();
    await open(rendered);

    await rendered.user.click(screen.getByRole("menuitem", { name: "Change path…" }));
    expect(rendered.onChangePath).toHaveBeenCalledOnce();
  });

  it("says whether the review instructions are set", async () => {
    const none = menu();
    await open(none);
    expect(screen.getByRole("menuitem", { name: "Review instructions… None" })).toBeInTheDocument();
    none.unmount();

    const set = menu({ reviewInstructions: "Look at the migrations." });
    await open(set);
    expect(screen.getByRole("menuitem", { name: "Review instructions… Set" })).toBeInTheDocument();
  });

  it("opens the instructions without taking the focus back to the ⋯", async () => {
    const rendered = menu();
    await open(rendered);

    await rendered.user.click(screen.getByRole("menuitem", { name: /^Review instructions…/ }));

    expect(rendered.onReviewInstructions).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "More for dev/web" })).not.toHaveFocus();
  });

  it("removes a repository with nothing in it", async () => {
    const rendered = menu();
    await open(rendered);

    await rendered.user.click(screen.getByRole("menuitem", { name: "Remove…" }));

    expect(rendered.onRemove).toHaveBeenCalledOnce();
  });

  it("keeps a repository with tasks or reviews, in the ink of what can't be done, with the reason under it", async () => {
    const rendered = menu({ archivedTasks: 8, activeReviews: 1, archivedReviews: 3 });
    await open(rendered);

    const remove = screen.getByRole("menuitem", { name: /^Remove…/ });
    expect(remove).toHaveAttribute("aria-disabled", "true");
    expect(remove).not.toHaveClass("text-state-error");
    expect(remove).toHaveAccessibleDescription(
      "8 archived tasks and 4 reviews: delete them first.",
    );

    await rendered.user.click(remove);
    expect(rendered.onRemove).not.toHaveBeenCalled();
  });

  it("waits while the repository is cloned, but still opens the review instructions", async () => {
    const rendered = menu({ cloned: false, cloning: true });
    await open(rendered);

    expect(screen.getByRole("menuitem", { name: "Change path… · Cloning…" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("menuitem", { name: "Remove… · Cloning…" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await rendered.user.click(screen.getByRole("menuitem", { name: /^Review instructions…/ }));
    expect(rendered.onReviewInstructions).toHaveBeenCalledOnce();
  });
});
