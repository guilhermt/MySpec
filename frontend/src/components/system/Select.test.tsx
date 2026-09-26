import { screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import { Select, type SelectProps } from "./Select";

const OPTIONS = [
  { value: "opus", label: "Opus", sub: "most capable" },
  { value: "sonnet", label: "Sonnet" },
  { value: "legacy", label: "Legacy", unavailable: true },
];

function Subject(props: Partial<SelectProps>) {
  const [value, setValue] = useState("opus");
  return (
    <Select
      label="Model"
      value={value}
      {...(props.groups === undefined ? { options: OPTIONS } : {})}
      onValueChange={setValue}
      {...props}
    />
  );
}

describe("Select", () => {
  it("is a button named by the label and the choice", () => {
    renderWithStore(<Subject />);
    expect(screen.getByRole("button", { name: "Model: Opus" })).toBeInTheDocument();
  });

  it("opens its choices with the chosen one checked", async () => {
    const { user } = renderWithStore(<Subject />);
    await user.click(screen.getByRole("button", { name: "Model: Opus" }));
    await screen.findByRole("menu");
    expect(screen.getByRole("menuitemradio", { name: "Opus most capable" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("menuitemradio", { name: "Sonnet" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("reports the choice", async () => {
    const onValueChange = vi.fn();
    const { user } = renderWithStore(<Subject value="opus" onValueChange={onValueChange} />);
    await user.click(screen.getByRole("button", { name: "Model: Opus" }));
    await screen.findByRole("menu");
    await user.click(screen.getByRole("menuitemradio", { name: "Sonnet" }));
    expect(onValueChange).toHaveBeenCalledWith("sonnet");
  });

  it("disables an unavailable choice and says so", async () => {
    const { user } = renderWithStore(<Subject />);
    await user.click(screen.getByRole("button", { name: "Model: Opus" }));
    await screen.findByRole("menu");
    expect(screen.getByRole("menuitemradio", { name: "◇ Legacy · unavailable" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("marks an unavailable choice on the trigger", () => {
    renderWithStore(<Subject value="legacy" />);
    expect(screen.getByRole("button", { name: "Model: Legacy" })).toHaveTextContent("◇ Legacy");
  });

  it("shows its choices in groups", async () => {
    const { user } = renderWithStore(
      <Subject
        groups={[
          { label: "Current", options: [OPTIONS[0] ?? { value: "", label: "" }] },
          { label: "Older", note: "slower", options: [{ value: "haiku", label: "Haiku" }] },
        ]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Model: Opus" }));
    await screen.findByRole("menu");
    expect(screen.getByText("Older")).toHaveTextContent("Older slower");
    expect(screen.getByRole("separator")).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "Haiku" })).toBeInTheDocument();
  });

  it("shows a message in place of the choices", async () => {
    const { user } = renderWithStore(
      <Subject message={{ text: "Could not list the models", tone: "error" }} />,
    );
    await user.click(screen.getByRole("button", { name: "Model: Opus" }));
    await screen.findByRole("menu");
    expect(screen.getByRole("alert")).toHaveTextContent("Could not list the models");
    expect(screen.queryByRole("menuitemradio")).not.toBeInTheDocument();
  });

  it("has the hover and the focus of the system", async () => {
    const { user } = renderWithStore(<Subject />);
    await user.tab();
    const trigger = screen.getByRole("button", { name: "Model: Opus" });
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveClass("hover:border-ink-3", "focus-visible:field-focus");
  });

  it("does not open while disabled and tells the reason", async () => {
    const { user } = renderWithStore(<Subject disabled disabledReason="The session is running" />);
    const trigger = screen.getByRole("button", { name: "Model: Opus" });
    expect(trigger).toHaveAttribute("aria-disabled", "true");
    expect(trigger).toHaveAccessibleDescription("The session is running");
    expect(trigger).toHaveClass("dashed-disabled");
    await user.click(trigger);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
