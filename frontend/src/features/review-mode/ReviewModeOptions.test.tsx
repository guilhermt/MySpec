import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReviewMode } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { ReviewModeOptions, type ReviewModeOptionsProps } from "./ReviewModeOptions";

function options(props: Partial<ReviewModeOptionsProps> = {}) {
  const onChoose = props.onChoose ?? vi.fn<(mode: ReviewMode) => void>();
  const rendered = renderWithStore(
    <ReviewModeOptions
      label="Review mode of a new task"
      value="manual"
      saving={null}
      layout="row"
      {...props}
      onChoose={onChoose}
    />,
  );
  return { ...rendered, onChoose };
}

const group = () => screen.getByRole("radiogroup", { name: "Review mode of a new task" });
const agent = () => screen.getByRole("radio", { name: /^Agent/ });
const manual = () => screen.getByRole("radio", { name: /^Manual/ });

describe("ReviewModeOptions", () => {
  it("offers the two modes in a named group, each with what it does, the value checked", () => {
    options();

    expect(group()).toBeInTheDocument();
    expect(agent()).toHaveAccessibleName(
      "Agent An agent reviews each step with the implementer; clean steps are committed.",
    );
    expect(manual()).toHaveAccessibleName(
      "Manual You review each step in VS Code, stage the files and approve.",
    );
    expect(manual()).toHaveAttribute("aria-checked", "true");
    expect(agent()).toHaveAttribute("aria-checked", "false");
  });

  it("chooses the mode clicked", async () => {
    const { user, onChoose } = options();

    await user.click(agent());

    expect(onChoose).toHaveBeenCalledWith("agent");
  });

  it("doesn't choose the mode that is already chosen", async () => {
    const { user, onChoose } = options();

    await user.click(manual());

    expect(onChoose).not.toHaveBeenCalled();
  });

  it("changes the mode with the arrows", async () => {
    const { user, onChoose } = options();
    manual().focus();

    await user.keyboard("{ArrowUp}");

    expect(onChoose).toHaveBeenCalledWith("agent");
  });

  it("shows the option being saved chosen, with the spinner and · saving…, the group busy and the arrows ignored", async () => {
    const { user, onChoose } = options({ saving: "agent" });

    expect(agent()).toHaveAttribute("aria-checked", "true");
    expect(agent()).toHaveAttribute("aria-busy", "true");
    expect(agent()).toHaveTextContent("Agent · saving…");
    expect(group()).toHaveAttribute("aria-busy", "true");
    expect(manual()).not.toHaveTextContent("saving");

    agent().focus();
    await user.keyboard("{ArrowDown}");
    await user.click(manual());

    expect(onChoose).not.toHaveBeenCalled();
  });

  it("changes nothing when it is disabled, and says why", async () => {
    const { user, onChoose } = options({ disabled: true, disabledReason: "The task has started." });

    await user.click(agent());

    expect(onChoose).not.toHaveBeenCalled();
    expect(group()).toHaveAccessibleDescription("The task has started.");
  });

  it("is described by what its owner says", () => {
    renderWithStore(
      <>
        <p id="note">Applies to what you create next.</p>
        <ReviewModeOptions
          label="Review mode of a new task"
          value="agent"
          saving={null}
          layout="column"
          describedBy="note"
          onChoose={() => {}}
        />
      </>,
    );

    expect(group()).toHaveAccessibleDescription("Applies to what you create next.");
  });

  it("gives the focus ref to the chosen option", () => {
    const chosen = { current: null as HTMLElement | null };
    options({ chosenRef: chosen });

    expect(chosen.current).toBe(manual());
  });
});
