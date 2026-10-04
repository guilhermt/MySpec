import { ArrowRight } from "lucide-react";
import { type ReactNode, type Ref, type RefObject, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { observeSize } from "./fits";
import { IconButton } from "./IconButton";
import { ICONS } from "./icons";
import { Menu, MenuContent, MenuItem, MenuText, MenuTrigger } from "./Menu";
import { Tooltip } from "./Tooltip";

export interface PlaceNav {
  /** title is where the button goes, for its tooltip. */
  title: string;
  onClick: () => void;
}

export interface PlaceCrumb {
  label: string;
  /** onOpen opens the level's place; a level without it is plain text. */
  onOpen?: () => void;
}

export interface PlaceHeaderProps {
  back: PlaceNav | null;
  forward: PlaceNav | null;
  crumbs: readonly PlaceCrumb[];
  title: string;
  titleRef: Ref<HTMLHeadingElement>;
  backRef: Ref<HTMLButtonElement>;
  forwardRef: Ref<HTMLButtonElement>;
  /** lead is what goes right before the title, never shrunk: the glyph of the kind of an archived item. */
  lead?: ReactNode;
  /** progress is where the item stands, drawn after the title and never shrunk: the stepper of a task, the tags of an archived item. */
  progress?: ReactNode;
  /** hasStepper tells that progress is a stepper: the levels fold below 1660px of main area to leave it room, where without one they fold only when the title doesn't fit. */
  hasStepper?: boolean;
  /** children is what the place holds on the right, in its order. */
  children?: ReactNode;
}

/** CRUMB_TEXT is the type of a breadcrumb level: 13px in the third ink. */
const CRUMB_TEXT = "text-(length:--text-meta) leading-(--leading-meta) text-ink-3";

/** Slash is the separator after a breadcrumb level, decoration only. */
function Slash() {
  return (
    <span aria-hidden="true" className="text-line-deco">
      /
    </span>
  );
}

/**
 * Breadcrumb is the levels above the place. Folded, they are a …, whose menu holds them. With a
 * stepper they fold below 1660px of main area; without, `folded` says when the title no longer fits.
 */
function Breadcrumb({
  crumbs,
  folded,
  probe,
}: {
  crumbs: readonly PlaceCrumb[];
  folded: boolean | null;
  probe: RefObject<HTMLOListElement | null>;
}) {
  const hidden = crumbs.map((crumb) => crumb.label).join(" / ");
  return (
    <nav aria-label="Breadcrumb" className="flex shrink-0 items-center whitespace-nowrap">
      {folded !== null && <LevelsProbe crumbs={crumbs} probe={probe} />}
      {folded !== true && (
        <ol
          className={cn(
            "flex items-center gap-(--space-1-5)",
            folded === null && "@max-[1660px]/main:hidden",
          )}
        >
          {crumbs.map((crumb) => (
            <li key={crumb.label} className="flex items-center gap-(--space-1-5)">
              {crumb.onOpen !== undefined ? (
                <button
                  type="button"
                  onClick={crumb.onOpen}
                  className={cn(
                    CRUMB_TEXT,
                    "rounded-xs outline-none hover:underline focus-visible:focus-ring",
                  )}
                >
                  {crumb.label}
                </button>
              ) : (
                <span className={CRUMB_TEXT}>{crumb.label}</span>
              )}
              <Slash />
            </li>
          ))}
        </ol>
      )}
      {folded !== false && (
        <span
          className={cn(
            "flex items-center gap-(--space-1-5)",
            folded === null && "@min-[1660px]/main:hidden",
          )}
        >
          <Menu>
            <MenuTrigger
              render={
                <IconButton
                  label={`Show the hidden levels: ${hidden}`}
                  icon={ICONS.more}
                  size="sm"
                />
              }
            />
            <MenuContent align="start">
              {/* A level that is not a place, like an epic, is text in the menu, not an item. */}
              {crumbs.map((crumb) =>
                crumb.onOpen !== undefined ? (
                  <MenuItem key={crumb.label} onClick={crumb.onOpen}>
                    {crumb.label}
                  </MenuItem>
                ) : (
                  <MenuText key={crumb.label}>{crumb.label}</MenuText>
                ),
              )}
            </MenuContent>
          </Menu>
          <Slash />
        </span>
      )}
    </nav>
  );
}

/** LevelsProbe is the whole breadcrumb, invisible and out of the flow, for its natural width. */
function LevelsProbe({
  crumbs,
  probe,
}: {
  crumbs: readonly PlaceCrumb[];
  probe: RefObject<HTMLOListElement | null>;
}) {
  return (
    <ol
      ref={probe}
      aria-hidden="true"
      className="pointer-events-none invisible fixed top-0 left-0 flex items-center gap-(--space-1-5) whitespace-nowrap"
    >
      {crumbs.map((crumb) => (
        <li key={crumb.label} className="flex items-center gap-(--space-1-5)">
          <span
            data-label={crumb.label}
            className={cn(CRUMB_TEXT, "after:content-[attr(data-label)]")}
          />
          <Slash />
        </li>
      ))}
    </ol>
  );
}

/** pixels reads a computed length, 0 where there is none. */
function pixels(value: string): number {
  return Number.parseFloat(value) || 0;
}

/**
 * useCrumbsFold tells whether the levels fold for a header without a stepper: when the title and the
 * whole breadcrumb no longer fit side by side. The room is the width of the header less what the
 * other pieces take, which doesn't depend on whether the levels are folded, so the answer never flips
 * back and forth. `levels` is an invisible copy of the whole breadcrumb that gives its natural width.
 */
function useCrumbsFold(
  header: RefObject<HTMLElement | null>,
  levels: RefObject<HTMLOListElement | null>,
  enabled: boolean,
  content: string,
): boolean {
  const [folded, setFolded] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new title or new levels are new widths to measure
  useLayoutEffect(() => {
    const element = header.current;
    if (!enabled || element === null) {
      return;
    }
    const check = () => {
      const style = getComputedStyle(element);
      let room = element.clientWidth - pixels(style.paddingLeft) - pixels(style.paddingRight);
      let pieces = 0;
      let title = 0;
      for (const child of element.children) {
        pieces += 1;
        if (child.tagName === "H1") {
          title = child.scrollWidth;
        } else if (child.tagName !== "NAV") {
          room -= (child as HTMLElement).offsetWidth;
        }
      }
      room -= (pieces - 1) * pixels(style.columnGap);
      setFolded(room < (levels.current?.scrollWidth ?? 0) + title);
    };
    check();
    return observeSize(element, check);
  }, [header, levels, enabled, content]);

  return enabled && folded;
}

/**
 * PlaceHeader is the band on top of a place: back and forward through the history, the breadcrumb,
 * what leads the title, the title, the progress of the item, and on the right what the place holds. Nothing in it wraps;
 * the title cuts last, with the whole name in its tooltip. Below 900px of main area the pieces on the
 * right draw closer.
 */
export function PlaceHeader({
  back,
  forward,
  crumbs,
  title,
  titleRef,
  backRef,
  forwardRef,
  lead,
  progress,
  hasStepper = false,
  children,
}: PlaceHeaderProps) {
  const band = useRef<HTMLElement>(null);
  const levels = useRef<HTMLOListElement>(null);
  const folded = useCrumbsFold(
    band,
    levels,
    !hasStepper && crumbs.length > 0,
    `${title}\n${crumbs.map((crumb) => crumb.label).join("/")}`,
  );
  // The line under the band is an inset shadow rather than a border, so it is drawn inside the
  // band and what the band centers stays on whole pixels.
  return (
    <header
      ref={band}
      className="flex h-(--size-head) min-w-0 shrink-0 flex-nowrap items-center gap-(--space-2) px-(--space-3) shadow-[inset_0_calc(var(--border)*-1)_0_var(--line-1)]"
    >
      {back !== null ? (
        <IconButton
          ref={backRef}
          label={`Back to ${back.title}`}
          icon={ICONS.back}
          shortcut="Alt+←"
          size="sm"
          onClick={back.onClick}
        />
      ) : (
        <IconButton
          ref={backRef}
          label="Back"
          icon={ICONS.back}
          size="sm"
          disabled
          disabledReason="Nothing to go back to"
        />
      )}
      {forward !== null && (
        <IconButton
          ref={forwardRef}
          label={`Forward to ${forward.title}`}
          icon={ArrowRight}
          shortcut="Alt+→"
          size="sm"
          onClick={forward.onClick}
        />
      )}
      {crumbs.length > 0 && (
        <Breadcrumb crumbs={crumbs} folded={hasStepper ? null : folded} probe={levels} />
      )}
      {lead !== undefined && <div className="flex shrink-0 items-center">{lead}</div>}
      <Tooltip content={title}>
        <h1
          ref={titleRef}
          tabIndex={-1}
          className="min-w-0 flex-[0_1_auto] truncate rounded-xs text-(length:--text-body) leading-(--leading-body) font-semibold text-ink-1 outline-none focus-visible:focus-ring"
        >
          {title}
        </h1>
      </Tooltip>
      {progress !== undefined && <div className="flex shrink-0 items-center">{progress}</div>}
      {children !== undefined && (
        <div className="ml-auto flex shrink-0 items-center gap-(--space-2) @max-[900px]/main:gap-(--space-1)">
          {children}
        </div>
      )}
    </header>
  );
}
