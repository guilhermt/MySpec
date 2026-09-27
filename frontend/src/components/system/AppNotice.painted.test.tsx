import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { paintOf, resolve, setTheme, THEMES, token } from "@/test/painted";
import { AppNotice } from "./AppNotice";

function notice() {
  render(
    <AppNotice
      label="Couldn't pause add-login"
      detail="no session. Try again."
      onDismiss={() => {}}
    />,
  );
  return screen.getByRole("alert");
}

describe.each(THEMES)("AppNotice in the %s theme", (theme) => {
  it("rests on the error veil with the error rail", () => {
    setTheme(theme);
    const want = {
      background: token("--state-error-veil"),
      shadow: resolve("inset var(--error-rail) 0 0 var(--state-error)", "box-shadow"),
    };
    expect(paintOf(notice(), want)).toEqual(want);
  });

  it("writes the action in the error ink and the detail in the second ink", () => {
    setTheme(theme);
    notice();
    const label = { color: token("--state-error") };
    const detail = { color: token("--ink-2") };
    expect(paintOf(screen.getByText("Couldn't pause add-login"), label)).toEqual(label);
    expect(paintOf(screen.getByText("no session. Try again."), detail)).toEqual(detail);
  });
});
