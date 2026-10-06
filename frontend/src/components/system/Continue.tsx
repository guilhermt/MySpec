import type { Ref } from "react";
import { CutText } from "./CutText";
import { Icon } from "./Icon";
import {
  ITEM_ICONS,
  type ItemClock,
  ItemClockView,
  type ItemKind,
  type ItemTone,
  TONE_GLYPHS,
} from "./item-parts";
import { Kbd } from "./Kbd";
import { StateGlyph } from "./StateGlyph";
import { Tooltip } from "./Tooltip";

export interface ContinueView {
  /** row is the item as the tree draws it. */
  row: {
    itemKind: ItemKind;
    name: string;
    tone: ItemTone;
    line2: { long: string };
    clock: ItemClock | null;
  };
  /** crumbs is where the item lives: "Platform Roadmap / API hardening". */
  crumbs: string;
  /** label is the accessible name: "Continue: <item>. <crumbs>". */
  label: string;
}

export interface ContinueProps {
  model: ContinueView;
  buttonRef?: Ref<HTMLButtonElement>;
  onOpen: () => void;
}

/**
 * Continue is the button of the Home that goes back to the item the person was in: its type and name,
 * what it is doing, its clock and where it lives, with Enter on the right. It is raised over the floor.
 */
export function Continue({ model, buttonRef, onOpen }: ContinueProps) {
  const { row, crumbs } = model;
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={model.label}
      onClick={onOpen}
      className="flex w-full min-w-0 cursor-pointer items-center gap-(--space-3) rounded-lg bg-surface-2 px-(--space-4) py-(--space-3) text-left shadow-xs outline-none transition-[background-color] duration-(--duration-fast) ease-standard hover:bg-surface-2-hover active:bg-surface-2-press focus-visible:focus-ring"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-(--space-1)">
        <span className="flex min-w-0 items-center gap-(--space-2)">
          <Icon icon={ITEM_ICONS[row.itemKind]} tone="active" />
          <Tooltip content={row.name}>
            <span className="min-w-0 truncate text-(length:--text-body) leading-(--leading-body) font-semibold text-ink-1">
              {row.name}
            </span>
          </Tooltip>
        </span>
        <span className="flex min-w-0 items-center gap-(--space-2) text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
          <StateGlyph state={TONE_GLYPHS[row.tone]} size="sm" />
          <CutText text={row.line2.long} />
          {row.clock !== null && <ItemClockView clock={row.clock} />}
          {crumbs !== "" && (
            <Tooltip content={crumbs}>
              <span className="min-w-0 truncate">{`· ${crumbs}`}</span>
            </Tooltip>
          )}
        </span>
      </span>
      <span aria-hidden="true">
        <Kbd>Enter</Kbd>
      </span>
    </button>
  );
}
