import { render, screen } from "@testing-library/react";
import { Trash2 } from "lucide-react";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { paintOf, resolve, setTheme, THEMES, TRANSPARENT, token } from "@/test/painted";
import { Button } from "./Button";
import {
  Menu,
  MenuActionItem,
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "./Menu";

function Subject() {
  return (
    <Menu>
      <MenuTrigger render={<Button />}>Actions</MenuTrigger>
      <MenuContent>
        <MenuGroup>
          <MenuGroupLabel note="2 open">Task</MenuGroupLabel>
          <MenuItem>Edit</MenuItem>
          <MenuItem disabledReason="The step is running">Archive</MenuItem>
        </MenuGroup>
        <MenuItem icon={Trash2} destructive>
          Delete
        </MenuItem>
        <MenuRadioGroup value="opus">
          <MenuRadioItem value="opus">Opus</MenuRadioItem>
          <MenuRadioItem value="sonnet">Sonnet</MenuRadioItem>
          <MenuRadioItem value="fable" unavailable>
            Fable
          </MenuRadioItem>
          <MenuRadioItem value="haiku" disabled sub="Not offered">
            Haiku
          </MenuRadioItem>
        </MenuRadioGroup>
        <MenuActionItem
          label="acme/billing"
          sub="Clone failed"
          subTone="error"
          action={{ label: "Clone", onAction: () => {} }}
          disabled
        />
        <MenuActionItem label="Existing issue…" action={{ label: "Open", onAction: () => {} }} />
        <MenuRadioGroup value=""></MenuRadioGroup>
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

  it("checks the chosen item in the brand ink, and leaves the others without a check", async () => {
    setTheme(theme);
    await open();
    // The check is the first glyph of the item, in the indicator that stays mounted unchecked.
    const check = (name: string) =>
      screen.getByRole("menuitemradio", { name }).querySelector("svg")?.parentElement ?? null;
    const chosen = check("Opus");
    const other = check("Sonnet");
    expect(chosen).not.toBeNull();
    expect(other).not.toBeNull();
    if (chosen !== null && other !== null) {
      expect(paintOf(chosen, { color: "" })).toEqual({ color: token("--brand-ink") });
      expect(getComputedStyle(other).visibility).toBe("hidden");
    }
  });

  it("highlights a choice under the pointer with the veil", async () => {
    setTheme(theme);
    await open();
    const item = screen.getByRole("menuitemradio", { name: "Sonnet" });
    await userEvent.hover(item);
    const want = { background: token("--veil-hover"), color: token("--ink-1") };
    expect(paintOf(item, want)).toEqual(want);
  });

  it("writes an unavailable choice in the faint ink", async () => {
    setTheme(theme);
    await open();
    const item = screen.getByRole("menuitemradio", { name: "◇ Fable · unavailable" });
    expect(paintOf(item, { color: "" })).toEqual({ color: token("--ink-4") });
  });
  it("writes a disabled choice and an item with an action in the faint ink, the failed reason in error", async () => {
    setTheme(theme);
    await open();
    const choice = screen.getByRole("menuitemradio", { name: "Haiku Not offered" });
    expect(paintOf(choice, { color: "" })).toEqual({ color: token("--ink-4") });
    const item = screen.getByRole("menuitem", {
      name: "acme/billing, clone failed. Enter clones it.",
    });
    expect(paintOf(item, { color: "" })).toEqual({ color: token("--ink-4") });
    expect(getComputedStyle(screen.getByText("Clone failed")).color).toBe(token("--state-error"));
    expect(getComputedStyle(screen.getByText("Clone")).color).toBe(token("--ink-3"));
  });

  it("writes an item that is its action in the ink of any item, the action in the third ink", async () => {
    setTheme(theme);
    await open();
    const item = screen.getByRole("menuitem", { name: "Existing issue…. Enter opens it." });
    expect(paintOf(item, { color: "" })).toEqual({ color: token("--ink-1") });
    expect(getComputedStyle(screen.getByText("Open")).color).toBe(token("--ink-3"));
  });
});

describe("Menu in the browser", () => {
  it("names a group by its label", async () => {
    await open();
    await expect.element(page.getByRole("group", { name: "Task 2 open" })).toBeInTheDocument();
  });
});
