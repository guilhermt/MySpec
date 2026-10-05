import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NONE, paintOf, resolve, setTheme, THEMES, token } from "@/test/painted";
import { OtherConversationBar, RequestBar, type RequestForm } from "./RequestBar";

/** GROUNDS are the ground each form paints, and whether it carries the error rail. */
const GROUNDS: [RequestForm, `--${string}`, boolean][] = [
  ["quiet", "--surface-0", false],
  ["tinted", "--state-wait-veil", false],
  ["decision", "--state-wait-veil", false],
  ["error", "--state-error-veil", true],
  ["closing", "--surface-0", false],
];

/** LABELS are the ink of the label of each form. */
const LABELS: [RequestForm, `--${string}`][] = [
  ["quiet", "--ink-1"],
  ["tinted", "--state-wait"],
  ["decision", "--state-wait"],
  ["error", "--state-error"],
  ["closing", "--state-close"],
];

/** STATUS leaves out the status of the bar, which says the label again for the reader. */
const STATUS = "[role=status]";

function rail(): string {
  return resolve("inset var(--error-rail) 0 0 var(--state-error)", "box-shadow");
}

function requestBar(form: RequestForm) {
  render(
    <RequestBar
      form={form}
      glyph="wait"
      label="Question"
      place="Reviewer"
      status="Question from the Reviewer"
      actions={null}
    />,
  );
  return screen.getByRole("region", { name: "Request" });
}

describe.each(THEMES)("RequestBar in the %s theme", (theme) => {
  it.each(GROUNDS)("paints the %s form on %s", (form, ground, railed) => {
    setTheme(theme);
    const want = { background: token(ground), shadow: railed ? rail() : NONE };
    expect(paintOf(requestBar(form), want)).toEqual(want);
  });

  it("lifts the toasts of the main area above itself, without a composer under it", () => {
    setTheme(theme);
    const { container } = render(
      <div className="main-area flex h-150 flex-col justify-end">
        <RequestBar
          form="quiet"
          glyph="blocked"
          label="Step 3 blocked"
          place="Implementer"
          status="Step 3 blocked"
          actions={null}
        />
      </div>,
    );
    const main = container.querySelector<HTMLElement>(".main-area");
    if (main === null) {
      throw new Error("the main area is not drawn");
    }
    const bar = screen.getByRole("region", { name: "Request" }).getBoundingClientRect();

    const lift = Math.ceil(main.getBoundingClientRect().bottom - bar.top);
    expect(lift).toBeGreaterThan(0);
    expect(main.style.getPropertyValue("--toast-lift")).toBe(`${lift}px`);
  });

  it.each(LABELS)("writes the label of the %s form in %s", (form, ink) => {
    setTheme(theme);
    requestBar(form);
    const want = { color: token(ink) };
    expect(paintOf(screen.getByText("Question"), want)).toEqual(want);
  });

  it("waits on the quiet ground when the other conversation asks", () => {
    setTheme(theme);
    render(
      <OtherConversationBar
        failed={false}
        label="The reviewer waits · Question"
        onGo={() => {}}
        goLabel="Go to reviewer"
      />,
    );
    const want = { background: token("--surface-0"), shadow: NONE };
    expect(paintOf(screen.getByRole("region", { name: "Request" }), want)).toEqual(want);
    const label = { color: token("--ink-2") };
    expect(
      paintOf(screen.getByText("The reviewer waits · Question", { ignore: STATUS }), label),
    ).toEqual(label);
  });

  it("carries the rail and the error ink when the other conversation failed", () => {
    setTheme(theme);
    render(
      <OtherConversationBar
        failed
        label="Session error · Reviewer · pass 2"
        onGo={() => {}}
        goLabel="Go to reviewer"
      />,
    );
    const want = { background: token("--surface-0"), shadow: rail() };
    expect(paintOf(screen.getByRole("region", { name: "Request" }), want)).toEqual(want);
    const label = { color: token("--state-error") };
    expect(
      paintOf(screen.getByText("Session error · Reviewer · pass 2", { ignore: STATUS }), label),
    ).toEqual(label);
  });
});
