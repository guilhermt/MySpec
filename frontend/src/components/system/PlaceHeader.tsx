import { ArrowRight } from "lucide-react";
import type { ReactNode, Ref } from "react";
import { cn } from "@/lib/utils";
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
  /** progress is where the item stands, drawn after the title and never shrunk: the stepper of a task. */
  progress?: ReactNode;
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
 * Breadcrumb is the levels above the place. Below 1660px of main area the levels fold into …,
 * whose menu holds them.
 */
function Breadcrumb({ crumbs }: { crumbs: readonly PlaceCrumb[] }) {
  const hidden = crumbs.map((crumb) => crumb.label).join(" / ");
  return (
    <nav aria-label="Breadcrumb" className="flex shrink-0 items-center whitespace-nowrap">
      <ol className="flex items-center gap-(--space-1-5) @max-[1660px]/main:hidden">
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
      <span className="flex items-center gap-(--space-1-5) @min-[1660px]/main:hidden">
        <Menu>
          <MenuTrigger
            render={
              <IconButton label={`Show the hidden levels: ${hidden}`} icon={ICONS.more} size="sm" />
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
    </nav>
  );
}

/**
 * PlaceHeader is the band on top of a place: back and forward through the history, the breadcrumb,
 * the title, the progress of the item, and on the right what the place holds. Nothing in it wraps;
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
  progress,
  children,
}: PlaceHeaderProps) {
  // The line under the band is an inset shadow rather than a border, so it is drawn inside the
  // band and what the band centers stays on whole pixels.
  return (
    <header className="flex h-(--size-head) min-w-0 shrink-0 flex-nowrap items-center gap-(--space-2) px-(--space-3) shadow-[inset_0_calc(var(--border)*-1)_0_var(--line-1)]">
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
      {crumbs.length > 0 && <Breadcrumb crumbs={crumbs} />}
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
