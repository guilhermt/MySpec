import { Button } from "./Button";
import { Icon } from "./Icon";
import {
  ITEM_ICONS,
  type ItemClock,
  ItemClockView,
  type ItemKind,
  type ItemTone,
  TONE_GLYPHS,
} from "./item-parts";
import { StateGlyph } from "./StateGlyph";
import { Tooltip } from "./Tooltip";

export interface ItemBlockProps {
  kind: ItemKind;
  name: string;
  /** line2 is what the item is doing, in its long form, with the tone of its glyph. */
  line2: { tone: ItemTone; text: string };
  clock: ItemClock | null;
  onOpen: () => void;
  /** openLabel names the button: "Open the task". */
  openLabel: string;
}

/**
 * ItemBlock is an item of the tree shown in a panel: its type, its name, what it is doing with the
 * clock, and Open. It is raised over the panel.
 */
export function ItemBlock({ kind, name, line2, clock, onOpen, openLabel }: ItemBlockProps) {
  return (
    <div className="flex items-center gap-(--space-3) rounded-md bg-surface-2 p-(--space-3) shadow-xs">
      <div className="flex min-w-0 flex-1 flex-col gap-(--space-0-5)">
        <div className="flex min-w-0 items-center gap-(--space-2)">
          <Icon icon={ITEM_ICONS[kind]} tone="active" />
          <Tooltip content={name}>
            <span className="min-w-0 truncate text-(length:--text-ui) leading-(--leading-ui) font-medium text-ink-1">
              {name}
            </span>
          </Tooltip>
        </div>
        <div className="flex min-w-0 items-center gap-(--space-2) text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
          <StateGlyph state={TONE_GLYPHS[line2.tone]} size="sm" />
          <span className="min-w-0 truncate">{line2.text}</span>
          {clock?.kind === "chip" && <ItemClockView clock={clock} />}
        </div>
      </div>
      <Button variant="secondary" size="sm" aria-label={openLabel} onClick={onOpen}>
        Open
      </Button>
    </div>
  );
}
