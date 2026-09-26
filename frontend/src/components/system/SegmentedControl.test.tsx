import { screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import { SegmentedControl } from "./SegmentedControl";

const OPTIONS = [
  { value: "chat", label: "Chat" },
  { value: "changes", label: "Changes", detail: "+4 −1" },
] as const;

function Subject({ onChange }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState<"chat" | "changes">("chat");
  return (
    <SegmentedControl
      label="View"
      value={value}
      options={OPTIONS}
      onValueChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe("SegmentedControl", () => {
  it("is a radio group with only the chosen option checked", () => {
    renderWithStore(<Subject />);
    expect(screen.getByRole("radiogroup", { name: "View" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Chat" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Changes +4 −1" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("moves the choice with the arrows", async () => {
    const onChange = vi.fn();
    const { user } = renderWithStore(<Subject onChange={onChange} />);
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenCalledWith("changes");
    expect(screen.getByRole("radio", { name: "Changes +4 −1" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("is one Tab stop", async () => {
    const { user } = renderWithStore(
      <>
        <Subject />
        <button type="button">After</button>
      </>,
    );
    await user.tab();
    expect(screen.getByRole("radio", { name: "Chat" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });

  it("tints the chosen option", () => {
    renderWithStore(<Subject />);
    expect(screen.getByRole("radio", { name: "Chat" })).toHaveClass("data-checked:bg-brand-tint");
  });

  it("has the hover and the focus of the system", async () => {
    const { user } = renderWithStore(<Subject />);
    await user.tab();
    const chat = screen.getByRole("radio", { name: "Chat" });
    expect(chat).toHaveFocus();
    expect(chat).toHaveClass(
      "not-data-readonly:not-data-checked:hover:bg-veil-hover",
      "focus-visible:focus-ring",
    );
  });

  it("ignores the change while disabled and tells the reason", async () => {
    const onValueChange = vi.fn();
    const { user } = renderWithStore(
      <SegmentedControl
        label="View"
        value="chat"
        options={OPTIONS}
        onValueChange={onValueChange}
        size="sm"
        disabled
        disabledReason="No changes yet"
      />,
    );
    const group = screen.getByRole("radiogroup", { name: "View" });
    expect(group).toHaveAttribute("aria-disabled", "true");
    expect(group).toHaveAccessibleDescription("No changes yet");
    expect(group).toHaveClass("dashed-disabled");
    const changes = screen.getByRole("radio", { name: "Changes +4 −1" });
    expect(changes).toHaveAttribute("data-readonly");
    await user.click(changes);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("refuses more than three options", () => {
    const four = ["a", "b", "c", "d"].map((value) => ({ value, label: value }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      renderWithStore(
        <SegmentedControl label="Too many" value="a" options={four} onValueChange={() => {}} />,
      ),
    ).toThrow("at most 3 options");
  });
});
