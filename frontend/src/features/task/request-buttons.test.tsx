import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RequestButton } from "@/components/system/RequestBar";
import { RequestButtons } from "@/features/task/request-buttons";

type Action = "approve" | "discard" | "open";

const APPROVE: RequestButton<Action> = {
  action: "approve",
  label: "Approve",
  variant: "primary",
  loadingLabel: "Approving…",
};

function Bar({
  buttons,
  running = null,
  onPress = () => {},
}: {
  buttons: RequestButton<Action>[];
  running?: Action | null;
  onPress?: (button: RequestButton<Action>) => void;
}) {
  return <div>{RequestButtons({ buttons, running, onPress })}</div>;
}

describe("RequestButtons", () => {
  it("draws the buttons in their order and hands the pressed one back", async () => {
    const onPress = vi.fn();
    const user = userEvent.setup();
    const discard: RequestButton<Action> = {
      action: "discard",
      label: "Discard step 4…",
      variant: "secondary",
      loadingLabel: "",
    };
    render(<Bar buttons={[APPROVE, discard]} onPress={onPress} />);

    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Approve",
      "Discard step 4…",
    ]);
    await user.click(screen.getByRole("button", { name: "Discard step 4…" }));

    expect(onPress).toHaveBeenCalledWith(discard);
  });

  it("shows the loading label of the action running only", () => {
    render(
      <Bar
        buttons={[
          APPROVE,
          { ...APPROVE, action: "open", label: "Open PR", loadingLabel: "Opening…" },
        ]}
        running="approve"
      />,
    );

    expect(screen.getByRole("button", { name: "Approving…" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Open PR" })).not.toHaveAttribute("aria-busy");
  });

  it("disables a button with its reason as the description", () => {
    render(<Bar buttons={[{ ...APPROVE, disabledReason: "Stage 2 more files" }]} />);

    const button = screen.getByRole("button", { name: "Approve" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription("Stage 2 more files");
  });

  it("writes the key of an action on its button, out of its name, with no tooltip", async () => {
    const user = userEvent.setup();
    render(
      <Bar
        buttons={[{ ...APPROVE, action: "open", label: "Open in VS Code", shortcut: "Ctrl E" }]}
      />,
    );

    const button = screen.getByRole("button", { name: "Open in VS Code" });
    expect(button).toHaveTextContent(/^Open in VS CodeCtrl E$/);
    await user.hover(button);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("writes the key on a button whose tooltip says what it does", async () => {
    const user = userEvent.setup();
    render(
      <Bar
        buttons={[
          {
            ...APPROVE,
            action: "open",
            label: "Next to decide",
            shortcut: "Alt ↓",
            tooltip: "The next finding to decide",
          },
        ]}
      />,
    );

    const button = screen.getByRole("button", { name: "Next to decide" });
    expect(button).toHaveTextContent(/^Next to decideAlt ↓$/);
    await user.hover(button);

    expect(await screen.findByRole("tooltip")).toHaveTextContent(/^The next finding to decide$/);
  });

  it("says what a button does in its tooltip when its label doesn't", async () => {
    const user = userEvent.setup();
    render(<Bar buttons={[{ ...APPROVE, tooltip: "Approve the step and commit it" }]} />);

    await user.hover(screen.getByRole("button", { name: "Approve" }));

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Approve the step and commit it");
  });

  it("has no tooltip when the label says it all", async () => {
    const user = userEvent.setup();
    render(<Bar buttons={[APPROVE]} />);

    await user.hover(screen.getByRole("button", { name: "Approve" }));

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
