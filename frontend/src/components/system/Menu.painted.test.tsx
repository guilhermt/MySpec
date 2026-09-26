import { render, screen } from "@testing-library/react";
import { Trash2 } from "lucide-react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { paintOf, resolve, setTheme, THEMES, TRANSPARENT, token } from "@/test/painted";
import { Button } from "./Button";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "./Menu";

function Subject() {
  return (
    <Menu>
      <MenuTrigger render={<Button />}>Actions</MenuTrigger>
      <MenuContent>
        <MenuItem>Edit</MenuItem>
        <MenuItem disabledReason="The step is running">Archive</MenuItem>
        <MenuItem icon={Trash2} destructive>
          Delete
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

async function open() {
  render(<Subject />);
  await userEvent.click(screen.getByRole("button", { name: "Actions" }));
  return screen.findByRole("menu");
}

describe.each(THEMES)("Menu in the %s theme", (theme) => {
  it("floats on the top surface with the float shadow", async () => {
    setTheme(theme);
    const menu = await open();
    const want = {
      background: token("--surface-3"),
      color: token("--ink-1"),
      shadow: resolve("var(--shadow-float)", "box-shadow"),
    };
    expect(paintOf(menu, want)).toEqual(want);
  });

  it("highlights the item under the pointer with the veil", async () => {
    setTheme(theme);
    await open();
    const item = screen.getByRole("menuitem", { name: "Edit" });
    await userEvent.hover(item);
    const want = { background: token("--veil-hover"), color: token("--ink-1") };
    expect(paintOf(item, want)).toEqual(want);
  });

  it("paints the destructive item in the error ink, on the error veil when highlighted", async () => {
    setTheme(theme);
    await open();
    const item = screen.getByRole("menuitem", { name: "Delete" });
    expect(paintOf(item, { background: "", color: "" })).toEqual({
      background: TRANSPARENT,
      color: token("--state-error"),
    });
    await userEvent.hover(item);
    const want = { background: token("--state-error-veil"), color: token("--state-error") };
    expect(paintOf(item, want)).toEqual(want);
  });

  it("writes a disabled item in the faint ink", async () => {
    setTheme(theme);
    await open();
    const item = screen.getByRole("menuitem", { name: "Archive · The step is running" });
    expect(paintOf(item, { color: "" })).toEqual({ color: token("--ink-4") });
    expect(getComputedStyle(item).opacity).toBe("1");
  });
});
