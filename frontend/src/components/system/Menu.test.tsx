import { screen } from "@testing-library/react";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import { Button } from "./Button";
import {
  type FilterCycle,
  Menu,
  MenuContent,
  MenuCycleItem,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuMessage,
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
