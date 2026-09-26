import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { focusRing, paintOf, setTheme, THEMES, token } from "@/test/painted";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./Collapsible";

function Subject() {
  return (
    <Collapsible>
      <CollapsibleTrigger>Details</CollapsibleTrigger>
      <CollapsibleContent>The plan has 4 steps.</CollapsibleContent>
    </Collapsible>
  );
}

describe.each(THEMES)("Collapsible in the %s theme", (theme) => {
  it("writes its trigger in the second ink, the first on hover", async () => {
    setTheme(theme);
    render(<Subject />);
    const trigger = screen.getByRole("button", { name: "Details" });
    expect(paintOf(trigger, { color: "" })).toEqual({ color: token("--ink-2") });
    await userEvent.hover(trigger);
    expect(paintOf(trigger, { color: "" })).toEqual({ color: token("--ink-1") });
  });

  it("shows the focus ring", async () => {
    setTheme(theme);
    render(<Subject />);
    await userEvent.tab();
    const want = focusRing();
    expect(paintOf(screen.getByRole("button", { name: "Details" }), want)).toEqual(want);
  });
});
