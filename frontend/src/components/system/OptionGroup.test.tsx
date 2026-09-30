import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OptionGroup, type OptionGroupProps, type OptionView } from "./OptionGroup";

const OPTIONS: OptionView[] = [
  { value: "comment", key: "1", title: "Comment", note: "Leave the findings only." },
  {
    value: "approve",
    key: "2",
    title: "Approve",
    note: "",
    disabledReason: "You can't approve your own pull request.",
  },
  {
    value: "request",
    key: "3",
    title: "Request changes",
    note: "Ask for changes.",
    badge: <span>Suggested</span>,
  },
];

function Subject(props: Partial<OptionGroupProps>) {
  return (
    <OptionGroup label="Verdict" value={null} options={OPTIONS} onChange={() => {}} {...props} />
  );
}

describe("OptionGroup", () => {
  it("is a radiogroup named by its label, one radio per option with its key, title and note", () => {
    render(<Subject />);
    const group = screen.getByRole("radiogroup", { name: "Verdict" });
    expect(group).toBeInTheDocument();
    const radio = screen.getByRole("radio", { name: /Comment/ });
    expect(radio).toHaveTextContent("1");
    expect(radio).toHaveTextContent("Leave the findings only.");
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("draws the badge after the title", () => {
    render(<Subject />);
    expect(screen.getByRole("radio", { name: /Request changes/ })).toHaveTextContent(
      "Request changesSuggested",
    );
  });

  it("checks the chosen option and none without a value", () => {
    const { rerender } = render(<Subject />);
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toHaveAttribute("aria-checked", "false");
    }
    rerender(<Subject value="request" />);
    expect(screen.getByRole("radio", { name: /Request changes/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("describes a disabled option by its reason and never chooses it", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Subject onChange={onChange} />);
    const approve = screen.getByRole("radio", { name: /Approve/ });
    expect(approve).toHaveAttribute("aria-disabled", "true");
    expect(approve).toHaveAccessibleDescription("You can't approve your own pull request.");
    await user.click(approve);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("chooses an option on click", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Subject onChange={onChange} />);
    await user.click(screen.getByRole("radio", { name: /Comment/ }));
    expect(onChange).toHaveBeenCalledWith("comment");
  });

  it("holds one Tab stop: the chosen option, else the first enabled one", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Subject />);
    await user.tab();
    expect(screen.getByRole("radio", { name: /Comment/ })).toHaveFocus();
    rerender(<Subject value="request" />);
    expect(screen.getByRole("radio", { name: /Request changes/ })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: /Comment/ })).toHaveAttribute("tabindex", "-1");
  });

  it("moves among the enabled options with the arrows, wrapping around", async () => {
    const user = userEvent.setup();
    render(<Subject />);
    await user.tab();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: /Request changes/ })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: /Comment/ })).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("radio", { name: /Request changes/ })).toHaveFocus();
  });

  it("chooses the focused option with Space and Enter", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Subject onChange={onChange} />);
    await user.tab();
    await user.keyboard(" ");
    expect(onChange).toHaveBeenLastCalledWith("comment");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("request");
  });

  it("leaves the digits to whoever uses the group", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Subject onChange={onChange} />);
    await user.tab();
    await user.keyboard("3");
    expect(onChange).not.toHaveBeenCalled();
  });
});
