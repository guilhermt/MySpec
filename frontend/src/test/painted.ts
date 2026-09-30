/**
 * Helpers of the computed-style suite (*.painted.test.tsx): the tests run in Chromium with the real
 * CSS and compare what an element paints with the token it should paint, resolved in the same theme.
 */

import type { CSSProperties } from "react";
import { inject, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

declare module "vitest" {
  export interface ProvidedContext {
    /** captureDir is where capture saves its screenshots: frontend/captures with MYSPEC_CAPTURES=1, "" without. */
    captureDir: string;
  }
}

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
 * placeHeaderOneLine tells whether a place header keeps everything on one line: its height, nothing
 * past its edge and every button inside it.
 */
export function placeHeaderOneLine(band: HTMLElement): boolean {
  const edge = band.getBoundingClientRect();
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
  return edge.height === 48 && band.scrollWidth <= band.clientWidth && inside;
}

/**
 * placeHeaderFits tells whether a place header keeps everything on one line with the title cut
 * rather than the band.
 */
export function placeHeaderFits(band: HTMLElement): boolean {
  const title = band.querySelector("h1");
  return (
    placeHeaderOneLine(band) &&
    title !== null &&
    title.getBoundingClientRect().width > 0 &&
    title.scrollWidth > title.clientWidth
  );
}

/** shows tells whether an element takes room on screen: a visually hidden one keeps a pixel at most. */
function shows(element: Element): boolean {
  return element.getBoundingClientRect().width > 1;
}

/** MARKS are the signs stepperText writes for a stage that is not the current one. */
const MARKS: Record<string, string> = { done: "✓", upcoming: "○" };

/**
 * stepperText is what a stepper shows, read off the screen: ✓ for a done stage and ○ for one to come,
 * each with its name when the name shows, and the visible words of the pill, without what only the
 * reader hears: "✓ ✓ ✓ Implementation 3/7 ○ PR ○ PR review ○ Closing".
 */
export function stepperText(stepper: HTMLElement): string {
  return [...stepper.querySelectorAll(":scope > li")]
    .map((stage) => {
      const folded = stage.querySelector("[data-stage]");
      const mark = folded === null ? "" : (MARKS[folded.getAttribute("data-stage") ?? ""] ?? "");
      return [mark, visibleText(stage)].filter((part) => part !== "").join(" ");
    })
    .join(" ");
}

// visibleText joins the text of an element that shows on screen, one piece per text node.
function visibleText(element: Element): string {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const pieces: string[] = [];
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (parent !== null && shows(parent) && ancestorsShow(parent, element)) {
      pieces.push(node.textContent ?? "");
    }
  }
  return pieces.join(" ").replace(/\s+/g, " ").trim();
}

// ancestorsShow tells whether every element from one up to a root takes room on screen.
function ancestorsShow(from: Element, root: Element): boolean {
  for (let current: Element | null = from; current !== null; current = current.parentElement) {
    if (!shows(current)) {
      return false;
    }
    if (current === root) {
      return true;
    }
  }
  return true;
}

/**
 * placeHeaderPieces are the parts of a place header that must never cover one another: what sits on
 * the band, and each piece of its right, the last part.
 */
export function placeHeaderPieces(band: HTMLElement): Element[] {
  const parts = [...band.children];
  const right = parts.at(-1);
  return right === undefined ? parts : [...parts.slice(0, -1), ...right.children];
}

/** overlaps tells whether any two of the elements that show on screen cover one another. */
export function overlaps(elements: readonly Element[]): boolean {
  const boxes = elements.filter(shows).map((element) => element.getBoundingClientRect());
  return boxes.some((box, index) =>
    boxes
      .slice(index + 1)
      .some(
        (other) =>
          box.left < other.right &&
          other.left < box.right &&
          box.top < other.bottom &&
          other.top < box.bottom,
      ),
  );
}

/**
 * CONVERSATION_MEASURE is the widest the conversation column is, in pixels, as the material fixes
 * it: a number, not the token, so a token that drifts fails the proof.
 */
export const CONVERSATION_MEASURE = 960;

/** CONVERSATION_GUTTER is what the column keeps free on each side of the main area: --space-6. */
export const CONVERSATION_GUTTER = 24;

/** Edges are the left and the right edge of a box, in pixels of the page. */
export interface Edges {
  left: number;
  right: number;
}

/**
 * conversationEdges are where the conversation column stands in a main area: min(960, area − 48)
 * wide, the margin that centres it rounded down to the pixel, so both edges are whole pixels.
 */
export function conversationEdges(area: HTMLElement): Edges {
  const box = area.getBoundingClientRect();
  const inner = box.width - 2 * CONVERSATION_GUTTER;
  const left =
    box.left + CONVERSATION_GUTTER + Math.max(0, Math.floor((inner - CONVERSATION_MEASURE) / 2));
  return { left, right: left + Math.min(CONVERSATION_MEASURE, inner) };
}

/** edgesOf are the left and the right edge of an element. */
export function edgesOf(element: Element): Edges {
  const { left, right } = element.getBoundingClientRect();
  return { left, right };
}

/** innerEdgesOf are the edges of the content box of an element: its box less its side paddings. */
export function innerEdgesOf(element: Element): Edges {
  const { left, right } = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return {
    left: left + parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth),
    right: right - parseFloat(style.paddingRight) - parseFloat(style.borderRightWidth),
  };
}

/**
 * settle waits for the animations of the page that end, so a box is measured where it stays; one
 * that repeats forever, like a spinner or a shimmer, is not waited for.
 */
export async function settle(): Promise<void> {
  const ending = document
    .getAnimations()
    .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity);
  await Promise.allSettled(ending.map((animation) => animation.finished));
}

/** nameOf is what names an element in a failure: its label, else the start of its text. */
function nameOf(element: Element): string {
  return element.getAttribute("aria-label") ?? element.textContent?.trim().slice(0, 48) ?? "";
}

/** offWholePixels are the names of the elements whose left or right edge is not on a whole pixel. */
export function offWholePixels(elements: Iterable<Element>): string[] {
  return [...elements]
    .filter((element) => {
      const { left, right } = edgesOf(element);
      return !Number.isInteger(left) || !Number.isInteger(right);
    })
    .map(nameOf);
}

/**
 * visiblePrimaries are the primary buttons that take room on screen, whatever the Button of the
 * system marks with data-variant.
 */
export function visiblePrimaries(root: ParentNode = document): Element[] {
  return [...root.querySelectorAll('[data-variant="primary"]')].filter(shows);
}

/** cutTexts are the elements under a root that cut their text with an ellipsis. */
export function cutTexts(root: ParentNode = document): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>("*")].filter(
    (element) =>
      getComputedStyle(element).textOverflow === "ellipsis" &&
      element.scrollWidth > element.clientWidth,
  );
}

/**
 * withoutTooltip are the names of the elements that say nothing when the pointer rests on them:
 * a text the screen cuts must have its whole text in a tooltip.
 */
export async function withoutTooltip(elements: readonly HTMLElement[]): Promise<string[]> {
  const missing: string[] = [];
  for (const element of elements) {
    await userEvent.hover(element);
    const shown = await vi
      .waitFor(
        () => {
          if (document.querySelector('[role="tooltip"]') === null) {
            throw new Error("no tooltip");
          }
        },
        { timeout: 1500 },
      )
      .then(
        () => true,
        () => false,
      );
    if (!shown) {
      missing.push(nameOf(element));
    }
    await userEvent.unhover(element);
    // The tooltip that closes must be gone before the next element, or it would count for that one.
    await vi.waitFor(
      () => {
        if (document.querySelector('[role="tooltip"]') !== null) {
          throw new Error(`the tooltip of ${nameOf(element)} is still open`);
        }
      },
      { timeout: 1500 },
    );
  }
  return missing;
}

/** capture saves a screenshot of an element for the pull request, only when MYSPEC_CAPTURES=1. */
export async function capture(name: string, element: HTMLElement): Promise<void> {
  const dir = inject("captureDir");
  if (dir === "") return;
  // The viewport grows to hold the whole element, which a wide main area passes, and then goes back.
  const { innerWidth, innerHeight } = window;
  const box = element.getBoundingClientRect();
  await page.viewport(
    Math.max(innerWidth, Math.ceil(box.right + window.scrollX)),
    Math.max(innerHeight, Math.ceil(box.bottom + window.scrollY)),
  );
  try {
    await page.screenshot({ path: `${dir}/${name}.png`, element });
  } finally {
    await page.viewport(innerWidth, innerHeight);
  }
}

/**
 * inkRuns are the widths, in CSS pixels, of the runs a screenshot of an element paints across its
 * middle row, each run a stretch of pixels that differ from the one at the top left corner, which is
 * the background. It measures a shape the computed style can't give, as the bars of a gradient.
 */
export async function inkRuns(element: HTMLElement): Promise<number[]> {
  const shot = await page.screenshot({ element, save: false });
  const image = new Image();
  image.src = `data:image/png;base64,${shot}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("no 2d context to read the screenshot");
  }
  context.drawImage(image, 0, 0);
  const background = context.getImageData(0, 0, 1, 1).data;
  const row = context.getImageData(0, Math.floor(image.height / 2), image.width, 1).data;
  const scale = image.width / element.getBoundingClientRect().width;
  const runs: number[] = [];
  let run = 0;
  for (let x = 0; x < image.width; x++) {
    const distance = [0, 1, 2].reduce(
      (sum, channel) => sum + Math.abs((row[x * 4 + channel] ?? 0) - (background[channel] ?? 0)),
      0,
    );
    if (distance > 24) {
      run++;
    } else if (run > 0) {
      runs.push(run / scale);
      run = 0;
    }
  }
  if (run > 0) {
    runs.push(run / scale);
  }
  return runs;
}
