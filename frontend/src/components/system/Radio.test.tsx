import { screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import { Radio, RadioGroup, RadioInput } from "./Radio";

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

function Inputs({ onChoose }: { onChoose: (value: string) => void }) {
  const [value, setValue] = useState("todo");
  const choose = (next: string) => {
    setValue(next);
    onChoose(next);
  };
  return (
    <>
      <RadioInput
        name="fresh"
        value="todo"
        checked={value === "todo"}
        onChoose={choose}
        label="Todo"
      />
      <RadioInput
        name="fresh"
        value="done"
        checked={value === "done"}
        onChoose={choose}
        label="Done"
      />
      <RadioInput name="other" value="x" checked={false} onChoose={() => {}} label="Elsewhere" />
    </>
  );
}

describe("RadioInput", () => {
  it("is a native radio named by its label, checked when chosen", () => {
    renderWithStore(<Inputs onChoose={() => {}} />);
    expect(screen.getByRole("radio", { name: "Todo" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Done" })).not.toBeChecked();
  });

  it("reports the value chosen by a click anywhere on its cell", async () => {
    const onChoose = vi.fn();
    const { user } = renderWithStore(<Inputs onChoose={onChoose} />);
    const cell = screen.getByRole("radio", { name: "Done" }).closest("label");
    await user.click(cell as HTMLElement);
    expect(onChoose).toHaveBeenCalledWith("done");
  });

  it("moves the choice with the arrows among the radios of its name only", async () => {
    const onChoose = vi.fn();
    const { user } = renderWithStore(<Inputs onChoose={onChoose} />);
    screen.getByRole("radio", { name: "Todo" }).focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: "Done" })).toHaveFocus();
    expect(onChoose).toHaveBeenLastCalledWith("done");
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: "Todo" })).toHaveFocus();
    expect(onChoose).toHaveBeenLastCalledWith("todo");
  });
});
