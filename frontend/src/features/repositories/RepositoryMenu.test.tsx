import { screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { RemoveRepositoryDialog } from "@/features/repositories/RemoveRepositoryDialog";
import { RepositoryMenu } from "@/features/repositories/RepositoryMenu";
import type { Repository } from "@/lib/wails";
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

/** WithRemoveDialog is the ⋯ with the dialog its Remove… opens, as the row wires them. */
function WithRemoveDialog({ repository }: { repository: Repository }) {
  const [removing, setRemoving] = useState(false);
  return (
    <>
      <RepositoryMenu
        repository={repository}
        onChangePath={() => {}}
        onReviewInstructions={() => {}}
        onRemove={() => setRemoving(true)}
      />
      <RemoveRepositoryDialog repository={repository} open={removing} onOpenChange={setRemoving} />
    </>
  );
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

  it("opens Remove… with the focus on Cancel, which the menu doesn't take back to the ⋯", async () => {
    // The menu gives the focus back once its exit animation ends, after the dialog took it: the
    // test gives the menu an exit animation, which jsdom doesn't play, for that order to happen.
    vi.stubGlobal("BASE_UI_ANIMATIONS_DISABLED", false);
    const animations = vi.spyOn(Element.prototype, "getAnimations").mockImplementation(function (
      this: Element,
    ) {
      if (this.getAttribute("role") !== "menu") return [];
      const finished = new Promise((done) => setTimeout(done, 50));
      return [{ finished, pending: false, playState: "finished" } as unknown as Animation];
    });
    try {
      const repository = makeRepository();
      const { user } = renderWithStore(<WithRemoveDialog repository={repository} />, {
        state: makeState({ repositories: [repository] }),
      });
      const trigger = screen.getByRole("button", { name: "More for dev/web" });
      await user.click(trigger);

      await user.click(await screen.findByRole("menuitem", { name: "Remove…" }));
      const dialog = await screen.findByRole("alertdialog", { name: "Remove dev/web?" });
      // The menu, hidden behind the dialog, leaves once its animation ends, and gives the focus
      // back in the frame after.
      await waitFor(() => expect(document.querySelector("[role='menu']")).toBeNull());
      await new Promise((done) => requestAnimationFrame(done));

      expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();
      expect(trigger).not.toHaveFocus();
    } finally {
      animations.mockRestore();
      vi.stubGlobal("BASE_UI_ANIMATIONS_DISABLED", true);
    }
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
