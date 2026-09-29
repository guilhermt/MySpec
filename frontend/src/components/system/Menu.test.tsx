import { screen } from "@testing-library/react";
import { Bot, Trash2 } from "lucide-react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import { Button } from "./Button";
import {
  actionItemLabel,
  type FilterCycle,
  Menu,
  MenuActionItem,
  MenuCheckboxItem,
  MenuContent,
  MenuCycleItem,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuMessage,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "./Menu";

function Subject() {
  const [state, setState] = useState<FilterCycle>("any");
  return (
    <Menu>
      <MenuTrigger render={<Button />}>Actions</MenuTrigger>
      <MenuContent>
        <MenuGroup>
          <MenuGroupLabel note="2 open">Task</MenuGroupLabel>
          <MenuItem shortcut="Ctrl+E" sub="in the editor">
            Edit
          </MenuItem>
          <MenuItem disabledReason="The step is running">Archive</MenuItem>
        </MenuGroup>
        <MenuSeparator />
        <MenuItem icon={Trash2} destructive>
          Delete
        </MenuItem>
        <MenuCycleItem label="dependabot" state={state} onStateChange={setState} />
      </MenuContent>
    </Menu>
  );
}

async function open() {
  const rendered = renderWithStore(<Subject />);
  await rendered.user.click(screen.getByRole("button", { name: "Actions" }));
  await screen.findByRole("menu");
  return rendered;
}

describe("Menu", () => {
  it("has a trigger that tells it opens a menu", async () => {
    const { user } = renderWithStore(<Subject />);
    const trigger = screen.getByRole("button", { name: "Actions" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    await screen.findByRole("menu");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("shows its items when opened", async () => {
    await open();
    expect(screen.getByRole("menuitem", { name: "Edit in the editor Ctrl+E" })).toBeInTheDocument();
    // The label is aria-hidden, read once through aria-labelledby, which jsdom does not follow to a
    // hidden node; the browser suite finds the group by its name.
    const group = screen.getByRole("group");
    expect(document.getElementById(group.getAttribute("aria-labelledby") ?? "")).toHaveTextContent(
      "Task 2 open",
    );
    expect(group).toContainElement(
      screen.getByRole("menuitem", { name: "Edit in the editor Ctrl+E" }),
    );
  });

  it("closes on Escape and gives the focus back to the trigger", async () => {
    const { user } = await open();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Actions" })).toHaveFocus();
  });

  it("disables an item and tells the reason", async () => {
    const onClick = vi.fn();
    const { user } = renderWithStore(
      <Menu>
        <MenuTrigger render={<Button />}>Actions</MenuTrigger>
        <MenuContent>
          <MenuItem disabledReason="The step is running" onClick={onClick}>
            Archive
          </MenuItem>
        </MenuContent>
      </Menu>,
    );
    await user.click(screen.getByRole("button", { name: "Actions" }));
    const item = await screen.findByRole("menuitem", { name: "Archive · The step is running" });
    expect(item).toHaveAttribute("aria-disabled", "true");
    await user.click(item);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("shows the key of an item", async () => {
    await open();
    expect(screen.getByText("Ctrl+E").tagName).toBe("KBD");
  });

  it("cycles a filter item and stays open", async () => {
    const { user } = await open();
    await user.click(
      screen.getByRole("menuitem", { name: "dependabot: no filter. Click to cycle." }),
    );
    const hidden = screen.getByRole("menuitem", { name: "dependabot: hidden. Click to cycle." });
    expect(hidden).toHaveTextContent("−dependabot");
    await user.click(hidden);
    expect(
      screen.getByRole("menuitem", { name: "dependabot: only this. Click to cycle." }),
    ).toHaveTextContent("+dependabot");
    await user.click(
      screen.getByRole("menuitem", { name: "dependabot: only this. Click to cycle." }),
    );
    expect(
      screen.getByRole("menuitem", { name: "dependabot: no filter. Click to cycle." }),
    ).toBeInTheDocument();
  });

  it("announces a message as a status, or as an alert on error", () => {
    renderWithStore(
      <>
        <MenuMessage>Loading branches…</MenuMessage>
        <MenuMessage tone="error">Could not list the branches</MenuMessage>
      </>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Loading branches…");
    expect(screen.getByRole("alert")).toHaveTextContent("Could not list the branches");
  });
});

function Choices({ onValueChange = () => {} }: { onValueChange?: (value: string) => void }) {
  const [value, setValue] = useState("opus");
  return (
    <Menu>
      <MenuTrigger render={<Button />}>Model</MenuTrigger>
      <MenuContent>
        <MenuRadioGroup
          value={value}
          onValueChange={(next: string) => {
            setValue(next);
            onValueChange(next);
          }}
        >
          <MenuRadioItem value="opus" icon={Bot}>
            Opus
          </MenuRadioItem>
          <MenuRadioItem value="sonnet" sub="faster">
            Sonnet
          </MenuRadioItem>
          <MenuRadioItem value="fable" unavailable>
            Fable
          </MenuRadioItem>
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}

describe("MenuRadioItem", () => {
  it("checks the chosen item of its group", async () => {
    const { user } = renderWithStore(<Choices />);
    await user.click(screen.getByRole("button", { name: "Model" }));
    expect(await screen.findByRole("menuitemradio", { name: "Opus" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("menuitemradio", { name: "Sonnet faster" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("chooses the item clicked", async () => {
    const onValueChange = vi.fn();
    const { user } = renderWithStore(<Choices onValueChange={onValueChange} />);
    await user.click(screen.getByRole("button", { name: "Model" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Sonnet faster" }));
    expect(onValueChange).toHaveBeenCalledWith("sonnet");
  });

  it("keeps an unavailable choice with ◇, not to be chosen again", async () => {
    const onValueChange = vi.fn();
    const { user } = renderWithStore(<Choices onValueChange={onValueChange} />);
    await user.click(screen.getByRole("button", { name: "Model" }));
    const item = await screen.findByRole("menuitemradio", { name: "◇ Fable · unavailable" });
    expect(item).toHaveAttribute("aria-disabled", "true");
    await user.click(item);
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe("MenuCheckboxItem", () => {
  function Filters({ onChange }: { onChange: (checked: boolean) => void }) {
    return (
      <Menu>
        <MenuTrigger render={<Button />}>Filter</MenuTrigger>
        <MenuContent>
          <MenuCheckboxItem checked onCheckedChange={onChange}>
            acme/api
          </MenuCheckboxItem>
          <MenuCheckboxItem checked={false} onCheckedChange={onChange}>
            acme/web
          </MenuCheckboxItem>
        </MenuContent>
      </Menu>
    );
  }

  it("is a menuitemcheckbox that says whether it is checked", async () => {
    const { user } = renderWithStore(<Filters onChange={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Filter" }));
    expect(await screen.findByRole("menuitemcheckbox", { name: "acme/api" })).toBeChecked();
    expect(screen.getByRole("menuitemcheckbox", { name: "acme/web" })).not.toBeChecked();
  });

  it("reports the choice and closes the menu", async () => {
    const onChange = vi.fn();
    const { user } = renderWithStore(<Filters onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Filter" }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: "acme/web" }));
    expect(onChange).toHaveBeenCalledWith(true, expect.anything());
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});

describe("MenuActionItem", () => {
  const action = { label: "Clone", onAction: vi.fn() };

  it("names the reason and what Enter does", () => {
    expect(actionItemLabel("acme/billing", "Not cloned", action)).toBe(
      "acme/billing, not cloned. Enter clones it.",
    );
    expect(actionItemLabel("acme/billing", undefined, action)).toBe(
      "acme/billing. Enter clones it.",
    );
  });

  it("acts on Enter and on a click, and the menu stays open", async () => {
    const onAction = vi.fn();
    const { user } = renderWithStore(
      <Menu>
        <MenuTrigger render={<Button />}>Repository</MenuTrigger>
        <MenuContent>
          <MenuActionItem
            label="acme/billing"
            sub="Not cloned"
            action={{ label: "Clone", onAction }}
          />
        </MenuContent>
      </Menu>,
    );
    await user.click(screen.getByRole("button", { name: "Repository" }));
    const item = await screen.findByRole("menuitem", {
      name: "acme/billing, not cloned. Enter clones it.",
    });
    expect(item).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onAction).toHaveBeenCalledTimes(1);
    await user.click(item);
    expect(onAction).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });
});
