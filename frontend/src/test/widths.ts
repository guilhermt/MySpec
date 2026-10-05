/**
 * The sweep of the painted suite: every scene of the product is drawn in the whole shell, in each
 * window of the app, and proved against the checks that hold for any screen at any width.
 */

import { computeAccessibleName } from "dom-accessibility-api";
import { createElement, type ReactElement } from "react";
import { vi } from "vitest";
import { page } from "vitest/browser";
import { AppShell } from "@/app/AppShell";
import {
  conversationEdges,
  cutTexts,
  type Edges,
  edgesOf,
  offWholePixels,
  overlaps,
  placeHeaderPieces,
  settle,
  visiblePrimaries,
  withoutTooltip,
} from "@/test/painted";
import { renderWithStore, type StoreOptions } from "@/test/render";

/** WINDOWS are the widths of the window the sweep draws every scene at: 1100px to a 2560px monitor. */
export const WINDOWS = [1100, 1250, 1450, 2000, 2560] as const;

/** RAIL_WINDOWS are the windows the sweep also draws with the sidebar folded into its rail. */
export const RAIL_WINDOWS = [1100, 2560] as const;

/** WINDOW_HEIGHT is the height of the window of the sweep. */
export const WINDOW_HEIGHT = 1080;

/**
 * SWEEP_TIMEOUT is the time a scene may take: the pointer rests on every text it cuts, one by one,
 * and a narrow list cuts the title of each of its rows.
 */
export const SWEEP_TIMEOUT = 180_000;

/** atWindow puts the browser of the suite at a window of the app. */
export async function atWindow(width: number): Promise<void> {
  await page.viewport(width, WINDOW_HEIGHT);
}

// bornWithScreen are the alerts that were on screen the moment a scene was drawn, before the user did
// anything: an alert there was born with the text it announces, which no reader announces.
let bornWithScreen: string[] = [];

// rememberAlerts takes note of the alerts on screen as the scene is drawn.
function rememberAlerts(): void {
  bornWithScreen = [...document.body.querySelectorAll("[role=alert]")]
    .filter((element) => !element.hasAttribute("data-live-region"))
    .map(describe);
}

/** renderShell draws the whole shell, the sidebar included, with the state of a scene. */
export function renderShell({ rail = false, ...options }: StoreOptions & { rail?: boolean }) {
  const { container, user } = renderWithStore(createElement(AppShell), {
    ...options,
    ui: { ...options.ui, sidebarRail: rail },
  });
  const main = container.querySelector("main");
  if (main === null) {
    throw new Error("the shell draws no main area");
  }
  rememberAlerts();
  return { main, user };
}

/** renderPage draws a screen of the whole window that is not the shell: the start, the refused migration. */
export function renderPage(page: ReactElement, options: StoreOptions = {}) {
  const { container, user } = renderWithStore(page, options);
  rememberAlerts();
  return { main: container.querySelector("main") ?? document.body, user };
}

/**
 * LAID_OUT are what the layout positions on its own, and so must stand on whole pixels: the shell,
 * the headers, the rows of a conversation or a tree, the lists, the dialogs, the bar of the request
 * and the composer.
 */
const LAID_OUT = [
  "aside",
  "main",
  "header",
  "[role=feed] > *",
  "[data-slot=conversation]",
  "[role=tree] > *",
  "[role=dialog]",
  "[role=alertdialog]",
  ".list-panel",
  "[aria-label=Request]",
  "form",
].join(",");

/** ACTING are the elements that act, which must have a name for the reader. */
const ACTING = [
  "button",
  "a[href]",
  "input",
  "select",
  "textarea",
  ...[
    "tab",
    "menuitem",
    "menuitemcheckbox",
    "menuitemradio",
    "option",
    "radio",
    "checkbox",
    "switch",
    "treeitem",
    "link",
  ].map((role) => `[role=${role}]`),
].join(",");

// top is the layer a user can act on: the open dialog or menu, or else the whole document.
function top(): ParentNode {
  return (
    document.querySelector("[role=menu]") ??
    document.querySelector("[role=dialog], [role=alertdialog]") ??
    document.body
  );
}

// nameOfElement writes an element for a failure: its tag, its role, and its label or the start of its text.
function describe(element: Element): string {
  const role = element.getAttribute("role");
  const label =
    element.getAttribute("aria-label") ?? element.textContent?.trim().slice(0, 40) ?? "";
  return `${element.tagName.toLowerCase()}${role === null ? "" : `[${role}]`} ${label}`.trim();
}

// scrolledSideways are the page and the areas that scroll whose content is wider than they are.
function scrolledSideways(): string[] {
  const failures: string[] = [];
  const page = document.scrollingElement;
  if (page !== null && page.scrollWidth > window.innerWidth) {
    failures.push(`the page is ${page.scrollWidth}px wide in a window of ${window.innerWidth}px`);
  }
  for (const element of document.body.querySelectorAll<HTMLElement>("*")) {
    const { overflowX } = getComputedStyle(element);
    if (
      (overflowX === "auto" || overflowX === "scroll") &&
      element.scrollWidth > element.clientWidth
    ) {
      failures.push(
        `${describe(element)} holds ${element.scrollWidth}px in ${element.clientWidth}px`,
      );
    }
  }
  return failures;
}

// shown tells whether an element takes room on screen.
const shown = (element: Element) => element.getBoundingClientRect().width > 1;

// unnamed are the elements that act on screen with no accessible name.
function unnamed(): string[] {
  return [...document.body.querySelectorAll(ACTING)]
    .filter((element) => shown(element) && element.closest("[aria-hidden=true], [inert]") === null)
    .filter((element) => computeAccessibleName(element).trim() === "")
    .map(describe);
}

// liveRegions are the alerts a scene was born with and the statuses that are not a LiveRegion.
function liveRegions(): string[] {
  const alerts = bornWithScreen.map((name) => `alert born with the screen: ${name}`);
  const statuses = [...document.body.querySelectorAll("[role=status]")]
    .filter((element) => !element.hasAttribute("data-live-region"))
    .map((element) => `status that is not a live region: ${describe(element)}`);
  return [...alerts, ...statuses];
}

// columnEdges are where the conversation, the bar of the request and the composer stand when the
// screen has a feed; the three share the edges the column has in the main area.
function columnsApart(main: HTMLElement): string[] {
  const column = main.querySelector<HTMLElement>("[data-slot=conversation]");
  if (column === null || main.querySelector("[role=feed]") === null) {
    return [];
  }
  const pieces = [
    column,
    ...main.querySelectorAll<HTMLElement>("section[aria-label=Request], [data-slot=composer]"),
  ];
  const beside = main.querySelector("aside") !== null;
  const want: Edges = beside ? edgesOf(column) : conversationEdges(main);
  return pieces
    .filter((piece) => {
      const edges = edgesOf(piece);
      return edges.left !== want.left || edges.right !== want.right;
    })
    .map(describe);
}

// POPUP_MS is how long a scene waits for a popup that may still be mounting.
const POPUP_MS = 400;

// menuOpened waits for the menu a trigger says it opened: it mounts a frame after the click, and a
// check that starts before it would find the page under a menu that was not there yet.
async function menuOpened(): Promise<void> {
  await vi
    .waitFor(
      () => {
        const opening = document.querySelector('[aria-haspopup="menu"][aria-expanded="true"]');
        if (opening !== null && document.querySelector("[role=menu]") === null) {
          throw new Error("the menu is not on screen yet");
        }
      },
      { timeout: 5000 },
    )
    .catch(() => undefined);
}

/**
 * proveScene runs every check of a scene and returns what failed, by check, empty when nothing did.
 * The checks that rest the pointer on the text a screen cuts come last, since they move the pointer.
 */
export async function proveScene(main: HTMLElement): Promise<Record<string, string[]>> {
  await settle();
  await menuOpened();
  // A popup a click opened mounts a frame or two later, and under load a few more.
  await new Promise((done) => setTimeout(done, POPUP_MS));
  const failed: Record<string, string[]> = {};
  const record = (check: string, names: string[]) => {
    if (names.length > 0) {
      failed[check] = names;
    }
  };
  const layer = top();

  record("horizontal scroll", scrolledSideways());
  record("whole pixels", offWholePixels(document.body.querySelectorAll(LAID_OUT)));
  const primaries = visiblePrimaries(layer).map(describe);
  record("one primary", primaries.length > 1 ? primaries : []);
  const band = main.querySelector<HTMLElement>("header");
  if (band !== null && overlaps(placeHeaderPieces(band))) {
    record("header pieces", [describe(band)]);
  }
  record("column edges", columnsApart(main));
  record("names", unnamed());
  record("live regions", liveRegions());
  record("cut text without a tooltip", await withoutTooltip(cutTexts(layer)));
  return failed;
}
