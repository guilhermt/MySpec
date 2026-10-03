import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  BoardRepositoryRow,
  type BoardRepositoryRowProps,
} from "@/features/boards/BoardRepositoryRow";
import { renderWithStore } from "@/test/render";
import { makeBoardRepositoryOption, makeRepository } from "@/test/wails-mock";

function row(props: Partial<BoardRepositoryRowProps> = {}) {
  const onCheckedChange = vi.fn();
  const onCloneChange = vi.fn();
  const rendered = renderWithStore(
    <ul>
      <BoardRepositoryRow
        option={makeBoardRepositoryOption()}
        repository={makeRepository()}
        chosenClone=""
        disabled={false}
        consequence=""
        onCheckedChange={onCheckedChange}
        onCloneChange={onCloneChange}
        {...props}
      />
    </ul>,
  );
  return { ...rendered, onCheckedChange, onCloneChange };
}

describe("BoardRepositoryRow", () => {
  it("is a box named by the repository and its cards, with how it ties beside it", async () => {
    const { user, onCheckedChange } = row();
    expect(screen.getByRole("checkbox", { name: "dev/web 4 cards" })).toBeChecked();
    expect(screen.getByText("Registered · ~/projects/web")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox"));
    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });

  it("says the clone of a registered repository is missing", () => {
    row({ repository: makeRepository({ missing: true }) });
    expect(
      screen.getByText("Registered · the clone at ~/projects/web is missing"),
    ).toBeInTheDocument();
  });

  it("offers the clones found beside the box, and a click on it doesn't check", async () => {
    const { user, onCheckedChange, onCloneChange } = row({
      option: makeBoardRepositoryOption({
        fullName: "acme/warehouse",
        link: "clone",
        path: "/home/dev/code/warehouse",
        clones: ["/home/dev/code/warehouse", "/home/dev/work/warehouse"],
      }),
      repository: null,
      chosenClone: "/home/dev/code/warehouse",
    });
    expect(screen.getByText("Clone found · 2 clones:")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Clone of acme/warehouse: ~/code/warehouse" }),
    );
    await user.click(await screen.findByRole("menuitemradio", { name: "~/work/warehouse" }));
    expect(onCloneChange).toHaveBeenCalledWith("/home/dev/work/warehouse");
    expect(onCheckedChange).not.toHaveBeenCalled();
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("disables a repository of another board and says why", () => {
    row({
      option: makeBoardRepositoryOption({
        fullName: "acme/api",
        link: "other_board",
        otherBoard: "Platform Roadmap",
      }),
      repository: null,
    });
    const box = screen.getByRole("checkbox", { name: /acme\/api/ });
    expect(box).toHaveAttribute("aria-disabled", "true");
    expect(box).not.toBeChecked();
    expect(box).toHaveAccessibleDescription("acme/api belongs to the board Platform Roadmap.");
  });

  it("writes what unchecking does under the name, as the description of the box", () => {
    const text = "Moves to No board: it has a clone. Nothing on disk changes.";
    row({
      option: makeBoardRepositoryOption({ checked: false, release: "no_board" }),
      consequence: text,
    });
    expect(screen.getByText(`→ ${text}`)).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toHaveAccessibleDescription(`→ ${text}`);
  });

  it("holds the box while the board is saved", async () => {
    const { user, onCheckedChange } = row({ disabled: true });
    await user.click(screen.getByRole("checkbox"));
    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});
