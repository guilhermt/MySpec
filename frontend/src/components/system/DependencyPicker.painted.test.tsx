import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import {
  cutTexts,
  offWholePixels,
  paintOf,
  resolve,
  setTheme,
  THEMES,
  token,
  withoutTooltip,
} from "@/test/painted";
import { DependencyPicker, type DependencyPickerProps } from "./DependencyPicker";

const LONG =
  "#476 Usage alerts at 80% of the plan, by email and in the dashboard, for every workspace";

function draw(props: Partial<DependencyPickerProps> = {}) {
  render(
    <DependencyPicker
      chosen={["acme/billing#474"]}
      recorded={[]}
      drafts={[{ value: "d1", label: "Overage on the monthly invoice", sub: "acme/billing" }]}
      cards={[
        { value: "acme/billing#474", label: "#474 Invoice in PDF", sub: "" },
        { value: "acme/billing#476", label: LONG, sub: "" },
      ]}
      onToggle={async () => "A draft can't depend on itself."}
      onClose={() => {}}
      {...props}
    />,
  );
  const listbox = screen.getByRole("listbox", { name: "Depend on" });
  const search = screen.getByRole("combobox", { name: "Search drafts and cards" });
  // The surface holds the search and the listbox.
  const surface = listbox.parentElement as HTMLElement;
  return { listbox, search, surface };
}

describe.each(THEMES)("DependencyPicker in the %s theme", (theme) => {
  it("is a sheet of --size-popover on the top surface with the float shadow", () => {
    setTheme(theme);
    const { surface } = draw();
    const want = {
      background: token("--surface-3"),
      color: token("--ink-1"),
      shadow: resolve("var(--shadow-float)", "box-shadow"),
    };
    expect(paintOf(surface, want)).toEqual(want);
    expect(getComputedStyle(surface).borderTopLeftRadius).toBe(
      resolve("var(--radius-lg)", "border-top-left-radius"),
    );
    expect(`${surface.offsetWidth}px`).toBe(resolve("var(--size-popover)", "width"));
  });

  it("draws the search as an input with the focus on its border and the halo", () => {
    setTheme(theme);
    const { search } = draw();
    const field = search.parentElement as HTMLElement;
    const want = {
      background: token("--surface-input"),
      border: token("--focus"),
      shadow: resolve("0 0 0 var(--halo) var(--focus-halo)", "box-shadow"),
    };
    expect(paintOf(field, want)).toEqual(want);
    expect(paintOf(search, { color: "" })).toEqual({ color: token("--ink-1") });
  });

  it("heads the groups in caps in the third ink", () => {
    setTheme(theme);
    draw();
    const label = screen.getByText("Cards of the board");
    expect(paintOf(label, { color: "" })).toEqual({ color: token("--ink-3") });
    expect(getComputedStyle(label).textTransform).toBe("uppercase");
  });

  it("checks the chosen in the brand ink and the sub in the third ink", () => {
    setTheme(theme);
    draw();
    const chosen = screen.getByRole("option", { name: "#474 Invoice in PDF" });
    const check = chosen.querySelector("svg") as SVGElement;
    expect(paintOf(check, { color: "" })).toEqual({ color: token("--brand-ink") });
    expect(getComputedStyle(check).visibility).toBe("visible");
    const other = screen.getByRole("option", { name: LONG });
    expect(getComputedStyle(other.querySelector("svg") as SVGElement).visibility).toBe("hidden");
    expect(paintOf(screen.getByText("acme/billing"), { color: "" })).toEqual({
      color: token("--ink-3"),
    });
  });

  it("highlights the option under the pointer with the veil", async () => {
    setTheme(theme);
    draw();
    const option = screen.getByRole("option", { name: "#474 Invoice in PDF" });
    await userEvent.hover(option);
    expect(paintOf(option, { background: "" })).toEqual({ background: token("--veil-hover") });
  });

  it("writes a refusal in the error ink", async () => {
    setTheme(theme);
    draw();
    await userEvent.click(screen.getByRole("option", { name: "#474 Invoice in PDF" }));
    const alert = await screen.findByRole("alert");
    expect(paintOf(alert, { color: "" })).toEqual({ color: token("--state-error") });
  });

  it("writes No card matches. in the third ink", async () => {
    setTheme(theme);
    const { search } = draw();
    await userEvent.type(search, "zzz");
    expect(paintOf(screen.getByText("No card matches."), { color: "" })).toEqual({
      color: token("--ink-3"),
    });
  });

  it("stands on whole pixels and says a cut title whole in a tooltip", async () => {
    setTheme(theme);
    const { surface, listbox } = draw();
    await userEvent.click(screen.getByRole("option", { name: "#474 Invoice in PDF" }));
    await screen.findByRole("alert");
    const boxes = [
      surface,
      ...surface.querySelectorAll('[role="combobox"], [role="alert"], [role="group"]'),
      listbox,
      ...listbox.querySelectorAll('[role="option"], [role="group"] > :first-child'),
    ];
    expect(offWholePixels(boxes)).toEqual([]);
    const cut = cutTexts(listbox);
    expect(cut.map((element) => element.textContent)).toEqual([LONG]);
    expect(await withoutTooltip(cut)).toEqual([]);
  });
});
