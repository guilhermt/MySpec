/**
 * Helpers of the computed-style suite (*.painted.test.tsx): the tests run in Chromium with the real
 * CSS and compare what an element paints with the token it should paint, resolved in the same theme.
 */

import type { CSSProperties } from "react";

/** THEMES are the two values of data-theme every painted test runs under. */
export const THEMES = ["light", "dark"] as const;

/** Theme is one value of data-theme. */
export type Theme = (typeof THEMES)[number];

/** setTheme puts the theme on the document element, as the app does. */
export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

/**
 * resolve returns what a CSS value computes to for a property, through a probe in the document, so
 * var(--token) resolves in the current theme and in the same notation getComputedStyle gives.
 */
export function resolve(value: string, property = "color"): string {
  const probe = document.createElement("div");
  probe.style.setProperty(property, value);
  document.body.append(probe);
  const computed = getComputedStyle(probe).getPropertyValue(property);
  probe.remove();
  return computed;
}

/** token resolves a color token: token("--surface-input"). */
export function token(name: `--${string}`): string {
  return resolve(`var(${name})`);
}

/** NONE is what a computed box-shadow reads when nothing is drawn. */
export const NONE = "none";

/** TRANSPARENT is what a transparent color computes to. */
export const TRANSPARENT = "rgba(0, 0, 0, 0)";

/** Paint is what a test expects an element to paint, one entry per property it checks. */
export interface Paint {
  background?: string;
  color?: string;
  border?: string;
  borderStyle?: string;
  shadow?: string;
  outline?: string;
  outlineStyle?: string;
  height?: string;
  fontSize?: string;
}

/** PROPERTIES maps each entry of Paint to the computed property it reads. */
const PROPERTIES: Record<keyof Paint, string> = {
  background: "background-color",
  color: "color",
  border: "border-top-color",
  borderStyle: "border-top-style",
  shadow: "box-shadow",
  outline: "outline-color",
  outlineStyle: "outline-style",
  height: "height",
  fontSize: "font-size",
};

/**
 * paintOf reads from an element the same entries a Paint names, so a test compares the two whole:
 * expect(paintOf(button, want)).toEqual(want).
 */
export function paintOf(element: Element, want: Paint): Paint {
  const style = getComputedStyle(element);
  const read: Paint = {};
  for (const key of Object.keys(want) as (keyof Paint)[]) {
    const value = style.getPropertyValue(PROPERTIES[key]);
    read[key] = key === "shadow" ? visibleShadows(value) : value;
  }
  return read;
}

/** EMPTY_LAYER matches a shadow layer with no offset, blur or spread, which draws nothing. */
const EMPTY_LAYER = /(^|\s)0px 0px 0px 0px(\s|$)/;

/**
 * visibleShadows drops the empty layers of a computed box-shadow: Tailwind writes every shadow as a
 * stack of its shadow variables, and only the layers that draw something tell what is painted.
 */
export function visibleShadows(value: string): string {
  const layers = value.split(/,(?![^(]*\))/).map((layer) => layer.trim());
  const visible = layers.filter((layer) => !EMPTY_LAYER.test(layer) && layer !== NONE);
  return visible.length > 0 ? visible.join(", ") : NONE;
}

/** focusRing is the paint of the system focus ring, outside the control. */
export function focusRing(): Paint {
  return { outline: token("--focus"), outlineStyle: "solid" };
}

/** dashedDisabled is the paint of a disabled control in every variant. */
export function dashedDisabled(): Paint {
  return {
    background: TRANSPARENT,
    color: token("--ink-4"),
    border: token("--line-3"),
    borderStyle: "dashed",
    shadow: NONE,
  };
}

/**
 * NARROW_MAIN is the main area of a 1100px window with the sidebar at its narrowest (288px): the
 * narrowest main area the app is drawn in.
 */
export const NARROW_MAIN = 812;

/** mainArea is the style of a wrapper that stands in for the main area, the container of @…/main. */
export function mainArea(width: number): CSSProperties {
  return { containerType: "inline-size", containerName: "main", width: `${width}px` };
}

/**
 * placeHeaderFits tells whether a place header keeps everything on one line: its height, nothing
 * past its edge, every button inside it, and the title cut rather than the band.
 */
export function placeHeaderFits(band: HTMLElement): boolean {
  const edge = band.getBoundingClientRect();
  const title = band.querySelector("h1");
  const inside = [...band.querySelectorAll("button")]
    .map((button) => button.getBoundingClientRect())
    .filter((box) => box.width > 0)
    .every(
      (box) =>
        box.left >= edge.left &&
        box.right <= edge.right &&
        box.top >= edge.top &&
        box.bottom <= edge.bottom,
    );
  return (
    edge.height === 48 &&
    band.scrollWidth <= band.clientWidth &&
    inside &&
    title !== null &&
    title.getBoundingClientRect().width > 0 &&
    title.scrollWidth > title.clientWidth
  );
}
