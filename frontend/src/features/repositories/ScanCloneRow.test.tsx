import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ScanCloneRow, type ScanCloneRowProps } from "@/features/repositories/ScanCloneRow";
import { makeRepositoryCandidate } from "@/test/wails-mock";

function row(props: Partial<ScanCloneRowProps> = {}) {
  const onCheckedChange = vi.fn<(checked: boolean) => void>();
  render(
    <ul>
      <ScanCloneRow
        candidate={makeRepositoryCandidate()}
        checked={false}
        disabled={false}
        adding={false}
        refusal=""
        linksAClone={false}
        registered={false}
        onCheckedChange={onCheckedChange}
        {...props}
      />
    </ul>,
  );
  return onCheckedChange;
}

describe("ScanCloneRow", () => {
  it("names the box by the repository and its path, with the home as a tilde", () => {
    row();

    expect(screen.getByRole("checkbox", { name: "dev/web ~/projects/web" })).not.toBeChecked();
  });

  it("checks on a click", async () => {
    const onCheckedChange = row();

    await userEvent.click(screen.getByRole("checkbox"));

    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("says that registering links a clone, as the description of the box", () => {
    row({ linksAClone: true });

    expect(screen.getByRole("checkbox")).toHaveAccessibleDescription(
      "Registered without a clone: this links the clone to it.",
    );
  });

  it("shows the spinner instead of the box while it is added", () => {
    row({ checked: true, adding: true });

    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-busy", "true");
  });

  it("says the refusal under the row, as an alert that describes the box", () => {
    row({ checked: true, refusal: "dev/web is already registered at ~/web." });

    expect(screen.getByRole("alert")).toHaveTextContent("dev/web is already registered at ~/web.");
    expect(screen.getByRole("checkbox")).toHaveAccessibleDescription(
      "dev/web is already registered at ~/web.",
    );
  });

  it("disables a registered clone and says it", async () => {
    const onCheckedChange = row({ registered: true });

    expect(screen.getByText("Registered")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(screen.getByRole("checkbox"));
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it("disables a clone that was already registered, without the word", () => {
    row({ disabled: true });

    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByText("Registered")).not.toBeInTheDocument();
  });
});
