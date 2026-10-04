import { screen, waitFor } from "@testing-library/react";
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
    expect(screen.getByRole("menuitemradio", { name: "Legacy · unavailable" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("marks an unavailable choice on the trigger", () => {
    renderWithStore(<Subject value="legacy" />);
    const trigger = screen.getByRole("button", { name: "Model: Legacy · unavailable" });
    expect(trigger).toHaveTextContent("Legacy · unavailable");
    expect(trigger.querySelector('[data-state="blocked"]')).not.toBeNull();
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

  it("takes the focus", async () => {
    const { user } = renderWithStore(<Subject />);
    await user.tab();
    expect(screen.getByRole("button", { name: "Model: Opus" })).toHaveFocus();
  });

  it("does not open while disabled and tells the reason", async () => {
    const { user } = renderWithStore(<Subject disabled disabledReason="The session is running" />);
    const trigger = screen.getByRole("button", { name: "Model: Opus" });
    expect(trigger).toHaveAttribute("aria-disabled", "true");
    expect(trigger).toHaveAccessibleDescription("The session is running");
    await user.click(trigger);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("shows the placeholder without a choice", () => {
    renderWithStore(<Subject value="" placeholder="Choose a model" size="sm" />);
    expect(screen.getByRole("button", { name: "Model: Choose a model" })).toHaveTextContent(
      "Choose a model",
    );
  });

  it("offers Try again when its message has a retry", async () => {
    const onRetry = vi.fn();
    const { user } = renderWithStore(
      <Subject message={{ text: "Could not list the models", tone: "error", onRetry }} />,
    );
    await user.click(screen.getByRole("button", { name: "Model: Opus" }));
    await user.click(await screen.findByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("keeps the saved choice as its name while the choices are read", () => {
    renderWithStore(<Subject loading />);
    const trigger = screen.getByRole("button", { name: "Model: Opus" });
    expect(trigger).toHaveAttribute("aria-busy", "true");
    expect(trigger).toHaveTextContent("Opus");
  });

  it("keeps its name and its choices as the trigger of the sidebar", async () => {
    const { user } = renderWithStore(<Subject variant="sidebar" />);
    await user.click(screen.getByRole("button", { name: "Model: Opus" }));
    await screen.findByRole("menu");
    expect(screen.getByRole("menuitemradio", { name: "Opus most capable" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("does not choose a disabled option and gives its reason", async () => {
    const onValueChange = vi.fn();
    const { user } = renderWithStore(
      <Subject
        value="opus"
        onValueChange={onValueChange}
        options={[
          { value: "opus", label: "Opus" },
          { value: "sonnet", label: "Sonnet", disabled: true, sub: "Not offered here" },
        ]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Model: Opus" }));
    await screen.findByRole("menu");
    const option = screen.getByRole("menuitemradio", { name: "Sonnet Not offered here" });
    expect(option).toHaveAttribute("aria-disabled", "true");
    await user.click(option);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("runs the action of a disabled option and keeps the menu open", async () => {
    const onAction = vi.fn();
    const onValueChange = vi.fn();
    const { user } = renderWithStore(
      <Subject
        value="opus"
        onValueChange={onValueChange}
        options={[
          { value: "opus", label: "Opus" },
          {
            value: "api",
            label: "acme/api",
            disabled: true,
            sub: "Not cloned",
            action: { label: "Clone", onAction },
          },
        ]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Model: Opus" }));
    await user.click(
      await screen.findByRole("menuitem", { name: "acme/api, not cloned. Enter clones it." }),
    );
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("runs the action of an option that is not disabled and closes the menu with Enter, without choosing it", async () => {
    const onAction = vi.fn();
    const onValueChange = vi.fn();
    const { user } = renderWithStore(
      <Subject
        value="opus"
        onValueChange={onValueChange}
        groups={[
          {
            label: "On GitHub",
            options: [
              {
                value: "existing-issue",
                label: "Existing issue…",
                action: { label: "Open", onAction, closes: true },
              },
            ],
          },
        ]}
        options={[{ value: "opus", label: "Opus" }]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Model: Opus" }));
    const item = await screen.findByRole("menuitem", { name: "Existing issue…. Enter opens it." });
    expect(item).not.toHaveAttribute("aria-disabled");
    item.focus();
    await user.keyboard("{Enter}");
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onValueChange).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });
});
