import { screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import { Radio, RadioGroup } from "./Radio";

function Subject({ onChange }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState("merge");
  return (
    <RadioGroup
      label="Merge method"
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    >
      <Radio value="merge">Merge commit</Radio>
      <Radio value="squash">Squash</Radio>
    </RadioGroup>
  );
}

describe("Radio", () => {
  it("is a radio group with the chosen radio checked", () => {
    renderWithStore(<Subject />);
    expect(screen.getByRole("radiogroup", { name: "Merge method" })).toHaveClass("flex-col");
    expect(screen.getByRole("radio", { name: "Merge commit" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: "Squash" })).toHaveAttribute("aria-checked", "false");
  });

  it("moves the choice with the arrows", async () => {
    const onChange = vi.fn();
    const { user } = renderWithStore(<Subject onChange={onChange} />);
    await user.tab();
    await user.keyboard("{ArrowDown}");
    expect(onChange).toHaveBeenCalledWith("squash");
    expect(screen.getByRole("radio", { name: "Squash" })).toHaveAttribute("aria-checked", "true");
  });

  it("takes the focus on the chosen radio", async () => {
    const { user } = renderWithStore(<Subject />);
    await user.tab();
    expect(screen.getByRole("radio", { name: "Merge commit" })).toHaveFocus();
  });

  it("ignores the change while disabled and tells the reason", async () => {
    const onValueChange = vi.fn();
    const { user } = renderWithStore(
      <RadioGroup
        label="Merge method"
        value="merge"
        onValueChange={onValueChange}
        orientation="horizontal"
        disabled
        disabledReason="The repository allows only squash"
      >
        <Radio value="merge">Merge commit</Radio>
        <Radio value="squash">Squash</Radio>
      </RadioGroup>,
    );
    const group = screen.getByRole("radiogroup", { name: "Merge method" });
    expect(group).toHaveAttribute("aria-disabled", "true");
    expect(group).toHaveAccessibleDescription("The repository allows only squash");
    await user.click(screen.getByRole("radio", { name: "Squash" }));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("marks the group invalid in the error state", () => {
    renderWithStore(
      <RadioGroup label="Merge method" value="" onValueChange={() => {}} invalid>
        <Radio value="merge">Merge commit</Radio>
      </RadioGroup>,
    );
    expect(screen.getByRole("radiogroup", { name: "Merge method" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });
});
