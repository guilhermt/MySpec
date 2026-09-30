import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import { Finding, type FindingView } from "./Finding";

function view(overrides: Partial<FindingView> = {}): FindingView {
  return {
    id: "2",
    number: 2,
    name: "Finding 2 of 3: The form never saves. GeneralForm.tsx, line 84. Approved.",
    title: "The form never saves",
    locationAsTitle: false,
    location: {
      kind: "anchored",
      text: "web/src/settings/GeneralForm.tsx:84",
      url: "https://github.com/dev/web/pull/7/files#diff-abR84",
      line: 84,
      fileName: "GeneralForm.tsx",
    },
    text: "The submit handler drops the value.",
    decision: "approved",
    disabled: "Inline comment · published 13:41",
    ...overrides,
  };
}

describe("Finding", () => {
  it("names itself, says what it says and where it went", () => {
    renderWithStore(
      <Finding model={view()} onOpenLine={vi.fn()} renderText={(text) => <p>{text}</p>} />,
    );

    const group = screen.getByRole("group", { name: view().name });
    expect(group).toHaveAttribute("data-finding-id", "2");
    expect(group).toHaveAttribute("data-disabled");
    expect(screen.getByText("The form never saves")).toBeInTheDocument();
    expect(screen.getByText("The submit handler drops the value.")).toBeInTheDocument();
    expect(screen.getByText("Inline comment · published 13:41")).toBeInTheDocument();
  });

  it("opens the line on GitHub when its location is clicked", async () => {
    const onOpenLine = vi.fn();
    renderWithStore(
      <Finding model={view()} onOpenLine={onOpenLine} renderText={(text) => <p>{text}</p>} />,
    );

    await userEvent.click(
      screen.getByRole("link", { name: "web/src/settings/GeneralForm.tsx:84" }),
    );

    expect(onOpenLine).toHaveBeenCalledTimes(1);
  });

  it("draws a general finding without a link", () => {
    renderWithStore(
      <Finding
        model={view({
          location: { kind: "general", text: "General · not on a line of the diff" },
          disabled: null,
        })}
        onOpenLine={vi.fn()}
        renderText={(text) => <p>{text}</p>}
      />,
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("General · not on a line of the diff")).toBeInTheDocument();
    expect(screen.getByRole("group")).not.toHaveAttribute("data-disabled");
  });
});
