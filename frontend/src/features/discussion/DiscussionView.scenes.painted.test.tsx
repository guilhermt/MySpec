import { within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { DiscussionView } from "@/features/discussion/DiscussionView";
import { GoneView } from "@/features/navigation/GoneView";
import { api, type DiscussionSummary } from "@/lib/wails";
import {
  type DiscussionFlags,
  type DiscussionScene,
  type DiscussionSceneName,
  discussionScene,
  fixDiscussionSceneClock,
} from "@/test/discussion-scenes";
import {
  capture,
  conversationEdges,
  cutTexts,
  edgesOf,
  footerPlaces,
  mainArea,
  NARROW_MAIN,
  offWholePixels,
  overlaps,
  placeHeaderOneLine,
  placeHeaderPieces,
  resolve,
  setTheme,
  settle,
  THEMES,
  visiblePrimaries,
  withoutTooltip,
} from "@/test/painted";
import { renderWithStore } from "@/test/render";
import { makeArchivedDiscussion } from "@/test/wails-mock";

// Only the boundary is replaced, as in the jsdom suite: no call reaches the runtime of Wails.
vi.mock("@/lib/wails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wails")>()),
  ...(await import("@/test/wails-mock")),
}));

/** WIDE_MAIN is the main area of a 2560px window; HALF_MAIN the one of a 1250px window with the sidebar open. */
const WIDE_MAIN = 2180;
const HALF_MAIN = 978;

/** DOCUMENT is discussion.md as the agent wrote it at 14:27 (disc.js, DOCX). */
const DOCUMENT = `## Context

Workspaces pay a flat price per plan. The gateway counts requests per workspace, in memory, and flushes a total every hour; the invoice reads the plan's price only.

## Problem

Heavy API users cost more than they pay, and there is no plan with an included volume and a price for what goes over it.

## Constraints

- acme/billing isn't cloned here: what the drafts say about it comes from the cards, not from its code.
- Nothing changes for current customers in this round.

## In scope

- Tiers as data, overage on the invoice, the plan picker, metering per API key.

## Out of scope

- Grandfathering, alerts (#474), overage per API key on the invoice.`;

/**
 * Case is a scene of the discussion with its flags, named as the mock's query names it:
 * "drafts?panel=Details"; gone is the page the discussion leaves once archived or deleted from it.
 */
type Case = {
  name: Exclude<DiscussionSceneName, "start">;
  flags: DiscussionFlags;
  label: string;
  gone?: "archived" | "deleted";
};

const scene = (name: Case["name"], flags: DiscussionFlags = {}, gone?: Case["gone"]): Case => {
  const on = Object.entries(flags).map(([flag, value]) =>
    value === true ? flag : `${flag}=${String(value)}`,
  );
  const label = on.length === 0 ? name : `${name}?${on.join("&")}`;
  return gone === undefined
    ? { name, flags, label }
    : { name, flags, label: `${label}-${gone}`, gone };
};

// CASES are the twelve scenes of the screen with the flags of the material (§1, pronto 1), and the
// page the discussion leaves: archived from done, deleted from drafts.
const CASES: Case[] = [
  scene("talk"),
  scene("talk", { error: true }),
  scene("unreadable"),
  scene("drafts"),
  scene("drafts", { edit: true }),
  scene("drafts", { delete: true }),
  scene("drafts", { panel: "Details" }),
  scene("drafts", { panel: "Documents" }),
  scene("drafts", { menu: true }),
  scene("rewrite"),
  scene("publish"),
  scene("publish", { after: true }),
  scene("published"),
  scene("published", { archive: true }),
  scene("partial-fail"),
  scene("epic"),
  scene("epic-off"),
  scene("many"),
  scene("many", { group: true }),
  scene("done"),
  scene("done", { archive: true }),
  scene("done", { panel: "Details" }),
  scene("done", { panel: "Documents" }),
  scene("archive-blocked"),
  scene("done", {}, "archived"),
  scene("drafts", {}, "deleted"),
];

// widthsOf are the main areas a case is drawn at; the ten drafts, Details of done and the edit of
// draft 3 at the narrowest one too, where the edit cuts the title of a folded draft and the value of
// Epic.
const widthsOf = ({ label }: Case) => [
  WIDE_MAIN,
  HALF_MAIN,
  ...(label === "many" || label === "done?panel=Details" || label === "drafts?edit"
    ? [NARROW_MAIN]
    : []),
];

/**
 * primaryOf is the primary the material asks of a case (§4.2, A primária em cada cena), on the top
 * layer: the dialog when one is open, else the screen; null for none.
 */
function primaryOf({ name, flags, gone }: Case): string | null {
  if (gone !== undefined) {
    // Rate limit per API key waits for an answer: the page leads to it.
    return "Next that needs you";
  }
  if (flags.archive === true) {
    return "Archive";
  }
  if (flags.group === true) {
    return "Group 2 drafts";
  }
  if (flags.delete === true || flags.edit === true) {
    return null;
  }
  switch (name) {
    // The Retry of the session names who it opens again, as the bar of a task does.
    case "talk":
      return flags.error === true ? "Retry" : null;
    case "published":
    case "done":
      return "Archive…";
    case "partial-fail":
      return "Retry";
    default:
      return null;
  }
}

// goneOf is the scene once the discussion left it: archived at the moment of the scene, with what
// it published, or deleted.
function goneOf(drawn: DiscussionScene, gone: NonNullable<Case["gone"]>): DiscussionScene {
  const { state, location, now } = drawn;
  const discussion = (state.discussions ?? []).find(
    (one): one is DiscussionSummary => location.kind === "discussion" && one.id === location.id,
  );
  if (discussion === undefined) {
    throw new Error("the scene draws no discussion");
  }
  const drafts = discussion.drafts ?? [];
  const archived = makeArchivedDiscussion({
    id: discussion.id,
    boardId: discussion.boardId,
    board: discussion.board,
    title: discussion.title,
    text: discussion.text,
    cards: discussion.cards ?? [],
    drafts,
    publishedCount: drafts.filter((draft) => draft.published).length,
    repositoryIds: [
      ...new Set(drafts.map((draft) => draft.repositoryId).filter((id) => id !== "")),
    ],
    createdAt: discussion.createdAt,
    archivedAt: new Date(now).toISOString(),
  });
  return {
    state: {
      ...state,
      discussions: [],
      discussionHistory: [
        ...(gone === "archived" ? [archived] : []),
        ...(state.discussionHistory ?? []),
      ],
    },
    location: {
      kind: "gone",
      item: "discussion",
      id: discussion.id,
      name: discussion.title,
      boardId: discussion.boardId,
    },
    transcripts: {},
    storage: {},
    now,
  };
}

// contextOf is the context the session of a scene opened with: the message that starts its conversation.
function contextOf(drawn: DiscussionScene): string {
  const entries = Object.values(drawn.transcripts).flatMap((transcript) => transcript.entries);
  return entries.find((entry) => entry.user?.prompt === true)?.user?.text ?? "";
}

// draw draws the screen of a scene in a main area of a width: the discussion, or the page of the
// discussion that left; and does what the scene has the user do.
async function draw(sceneOf: DiscussionScene, width: number) {
  const { location } = sceneOf;
  const view =
    location.kind === "gone" ? (
      <GoneView location={location} />
    ) : location.kind === "discussion" ? (
      <DiscussionView discussionId={location.id} />
    ) : null;
  if (view === null) {
    throw new Error("the scene is not a discussion");
  }
  if (location.kind === "gone") {
    // The page takes the focus as a click on the dialog left it, the way the mock draws it: the keys
    // of a test before would make the focus visible and open the tooltip of the page's primary.
    const spot = document.createElement("button");
    Object.assign(spot.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "8px",
      height: "8px",
    });
    document.body.append(spot);
    await userEvent.click(spot);
    spot.remove();
  }
  const { container, user } = renderWithStore(
    <div style={{ ...mainArea(width), height: "800px", display: "flex" }}>{view}</div>,
    { state: sceneOf.state, ui: { location, transcripts: sceneOf.transcripts } },
  );
  await sceneOf.after?.(user);
  await settle();
  const area = container.firstElementChild;
  if (!(area instanceof HTMLElement)) {
    throw new Error("the main area is not drawn");
  }
  // A modal dialog hides the screen under it from the tree the roles read.
  return { area, band: within(area).getByRole("banner", { hidden: true }), user };
}

// dialog is the dialog open over the screen, null when none is.
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"], [role="alertdialog"]');

/**
 * parts are what the screen draws in a box of its own, that must stand on whole pixels: each draft,
 * folded or open, the card of the drafts, each marker and entry of the conversation, the bar of the
 * request, the composer, the panel, the dialog, the ⋯ and the page of the discussion that left.
 */
function parts(area: HTMLElement, band: HTMLElement): Element[] {
  const open = dialog();
  const page = band.nextElementSibling;
  return [
    ...area.querySelectorAll("[data-decision-card], [data-card-item], article"),
    ...area.querySelectorAll('section[aria-label="Request"], [data-slot="composer"], aside'),
    ...document.querySelectorAll('[role="menu"]'),
    ...(page !== null && area.querySelector("[data-slot='conversation']") === null
      ? [page, ...page.children]
      : []),
    ...(open === null ? [] : [open]),
  ];
}

/** DRAFTS_MARKER names the markers that open a list of drafts: the publication, the folded round, the revision. */
const DRAFTS_MARKER = /^(Published|Publication stopped|Round \d+|Drafts revised) · /;

// labelOf is what a button says, without the keys it shows beside its name.
function labelOf(button: Element): string {
  const copy = button.cloneNode(true) as Element;
  for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) {
    hidden.remove();
  }
  return copy.textContent?.trim() ?? "";
}

describe.each(THEMES)("DiscussionView, the scenes in the %s theme", (theme) => {
  describe.each(CASES)("the $label scene", (one) => {
    const base = discussionScene(one.name, one.flags);
    const drawn = one.gone === undefined ? base : goneOf(base, one.gone);
    fixDiscussionSceneClock(drawn);

    beforeEach(() => {
      // Documents reads the document of the agent and the context the session opened with.
      const context = contextOf(base);
      vi.mocked(api.readDiscussionArtifact).mockImplementation((_id, name) =>
        Promise.resolve(name === "discussion.md" ? DOCUMENT : context),
      );
    });

    it.each(widthsOf(one))("draws it at the main area of %ipx", async (width) => {
      setTheme(theme);
      const { area, band, user } = await draw(drawn, width);

      // The header keeps one line, and nothing on it covers anything else.
      expect(placeHeaderOneLine(band)).toBe(true);
      expect(overlaps(placeHeaderPieces(band))).toBe(false);

      // Every box of the screen stands on whole pixels.
      expect(offWholePixels(parts(area, band))).toEqual([]);

      // The card, the bar and the composer stand on the edges of the conversation column.
      const column = area.querySelector('[data-slot="conversation"]');
      if (one.gone === undefined) {
        const holder = column?.closest<HTMLElement>(".overflow-clip");
        if (column === null || holder === null || holder === undefined) {
          throw new Error("the conversation column is not drawn");
        }
        const edges = conversationEdges(holder);
        expect(edgesOf(column)).toEqual(edges);
        const pieces = area.querySelectorAll(
          '[data-decision-card], section[aria-label="Request"], [data-slot="composer"]',
        );
        expect(pieces.length).toBeGreaterThan(0);
        for (const piece of pieces) {
          expect([piece.getAttribute("aria-label") ?? piece.tagName, edgesOf(piece)]).toEqual([
            piece.getAttribute("aria-label") ?? piece.tagName,
            edges,
          ]);
        }
      }

      // The head of the current draft, its kind and its title, stands in the visible area of the
      // conversation: a draft taller than it comes into view by its top.
      const current = area.querySelector<HTMLElement>(
        '[data-decision-card] [data-current][aria-expanded="true"]',
      );
      if (current !== null) {
        let scroller = current.parentElement;
        while (
          scroller !== null &&
          !["auto", "scroll"].includes(getComputedStyle(scroller).overflowY)
        ) {
          scroller = scroller.parentElement;
        }
        // The kind and, out of the edit, the title.
        const head = [
          ...current.querySelectorAll(
            ":scope > div > div:first-child, :scope > div > p:nth-child(2)",
          ),
        ];
        if (scroller === null || head.length === 0) {
          throw new Error("the current draft is not drawn in the conversation");
        }
        const view = scroller.getBoundingClientRect();
        const outside = head.filter((part) => {
          const box = part.getBoundingClientRect();
          return box.top < view.top || box.bottom > view.bottom;
        });
        expect(outside.map((part) => part.textContent)).toEqual([]);
      }

      // What the top layer cuts says its whole text in a tooltip: the title and the line 2 of a
      // folded draft, the value of a selector of Edit, the list of a marker. A modal dialog takes the
      // pointer from the screen under it, which the same scene without the dialog checks.
      const open = dialog();
      const cut =
        open !== null
          ? cutTexts(open)
          : [
              ...cutTexts(area),
              ...[...document.querySelectorAll<HTMLElement>('[role="menu"]')].flatMap((menu) =>
                cutTexts(menu),
              ),
            ];
      expect(await withoutTooltip(cut)).toEqual([]);

      // The top layer has one primary at most, the one the material asks of the scene.
      const primaries = visiblePrimaries(open ?? document).map(labelOf);
      const primary = primaryOf(one);
      expect(primaries).toEqual(primary === null ? [] : [primary]);

      // The page that the discussion leaves shows no tooltip of its focus.
      if (one.gone !== undefined) {
        expect(document.querySelector('[role="tooltip"]')).toBeNull();
      }
      await capture(`discussion-${one.label.replace(/[?=&]/g, "-")}-${width}-${theme}`, area);

      // The edit of draft 3 opened in the conversation with its fields: Add a dependency is in view,
      // and the listbox it opens stays inside the conversation, above the row when below has no room.
      if (one.flags.edit === true) {
        const viewOf = (element: Element) => {
          let box = element.parentElement;
          while (box !== null && !["auto", "scroll"].includes(getComputedStyle(box).overflowY)) {
            box = box.parentElement;
          }
          return (box ?? document.documentElement).getBoundingClientRect();
        };
        const inside = (element: Element) => {
          const view = viewOf(element);
          const box = element.getBoundingClientRect();
          return box.top >= view.top && box.bottom <= view.bottom;
        };
        // Body holds six lines at least, which the field sized to its content would not.
        const body = within(area).getByRole("textbox", { name: /^Body/ });
        expect(getComputedStyle(body).minHeight).toBe(
          resolve(
            "calc(var(--leading-body) * 6 + var(--space-2) * 2 + var(--border) * 2)",
            "min-height",
          ),
        );
        const add = within(area).getByRole("button", { name: /^Add a dependency/ });
        expect(inside(add)).toBe(true);
        // The row is taken near the bottom of the conversation, where the listbox has no room below.
        const scroller = add.closest<HTMLElement>('[data-slot="conversation"]')?.parentElement
          ?.parentElement;
        if (scroller !== null && scroller !== undefined) {
          const view = viewOf(add);
          scroller.scrollTop += add.getBoundingClientRect().bottom - (view.bottom - 48);
        }
        await user.click(add);
        const listbox = await within(area).findByRole("listbox", { name: "Depend on" });
        const picker = listbox.closest<HTMLElement>("[data-picker-place]");
        expect(picker).not.toBeNull();
        if (picker !== null) {
          expect(inside(picker)).toBe(true);
          const row = add.getBoundingClientRect();
          const placed = picker.getBoundingClientRect();
          expect(picker.dataset.pickerPlace).toBe("up");
          expect(placed.bottom).toBeLessThanOrEqual(row.top);
        }
        await user.keyboard("{Escape}");
      }

      // The conversation of the discussion ends with room as high as the way back to the end.
      if (one.gone === undefined) {
        const end = area.querySelector<HTMLElement>('[data-slot="conversation"]');
        expect(end === null ? "" : getComputedStyle(end).paddingBottom).toBe(
          resolve("calc(var(--space-4) + var(--size-control-sm))", "padding-bottom"),
        );
      }

      // The footer of the grouping keeps Cancel and Group 2 drafts where they are as the reason
      // goes: the title written, the button stops waiting for it.
      if (open !== null && one.flags.group === true) {
        const reason = "Name the epic to group the drafts.";
        expect(within(open).getByText(reason)).toBeInTheDocument();
        const before = footerPlaces(open, /^Group 2 drafts/);
        await user.type(within(open).getByRole("textbox", { name: /^Title of the epic/ }), "Tiers");
        expect(within(open).queryByText(reason)).toBeNull();
        expect(footerPlaces(open, /^Group 2 drafts/)).toEqual(before);
      }

      // The list a marker of the drafts opens, after the capture that draws them closed as the mock
      // does: it stands on whole pixels and says what it cuts.
      if (one.gone === undefined && Object.keys(one.flags).length === 0) {
        const markers = within(area).queryAllByRole("article", { name: DRAFTS_MARKER });
        for (const marker of markers) {
          await user.click(within(marker).getByRole("button", { expanded: false }));
        }
        await settle();
        const lists = [...area.querySelectorAll<HTMLElement>('[data-slot="marker-body"]')];
        expect(lists).toHaveLength(markers.length);
        const rows = lists.flatMap((list) => [...list.querySelectorAll("li")]);
        expect(offWholePixels([...lists, ...rows])).toEqual([]);
        expect(await withoutTooltip(lists.flatMap((list) => cutTexts(list)))).toEqual([]);
      }
    });
  });
});
