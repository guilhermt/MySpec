// biome-ignore-all lint/a11y/useSemanticElements: a cell of the CSS grid of the matrix, a gridcell by its role
import { Icon } from "@/components/system/Icon";
import { ICONS } from "@/components/system/icons";
import { Shimmer } from "@/components/system/Shimmer";
import { StateGlyph } from "@/components/system/StateGlyph";
import { Tooltip } from "@/components/system/Tooltip";
import type { CellGlyph, CellModel, CellTone } from "@/features/deploys/deploy-matrix";
import { SLOT_ATTRIBUTE } from "@/features/deploys/useDeployGridKeyboard";
import { cn } from "@/lib/utils";

/** WORD_TONES are the color and weight of the word of each tone. */
const WORD_TONES: Record<CellTone, string> = {
  quiet: "text-ink-3",
  strong: "font-semibold text-ink-1",
  github: "text-state-github",
  error: "text-state-error",
  neutral: "text-ink-2",
};

/** CELL is the box of a cell: two lines on a hairline, which the state and the focus change. */
const CELL =
  "relative flex min-h-(--size-ask) min-w-0 cursor-pointer flex-col justify-center gap-(--line-gap) rounded-sm px-(--space-2) py-(--space-1) text-(length:--text-ui) leading-(--leading-ui) outline-none transition-[background-color,box-shadow] duration-(--duration-fast) ease-standard focus-visible:focus-ring";

function GlyphOf({ glyph, stale }: { glyph: CellGlyph; stale: boolean }) {
  const quiet = stale ? "text-ink-4" : "";
  switch (glyph) {
    case "done":
      return <Icon icon={ICONS.done} size="sm" className="text-ink-4" />;
    case "promote":
      return <Icon icon={ICONS.promote} size="sm" className={quiet} />;
    case "pullRequest":
      return <Icon icon={ICONS.pullRequest} size="sm" className={quiet} />;
    case "shimmer":
      return <span className="size-(--glyph-sm) shrink-0" aria-hidden="true" />;
    case "work":
      return <StateGlyph state="work" size="sm" />;
    default:
      return <StateGlyph state={glyph} size="sm" />;
  }
}

export interface DeployCellProps {
  model: CellModel;
  /** environment is the name of the environment, shown before the second line when the column has no common name. */
  environment: string | null;
  tabIndex: 0 | -1;
  open: boolean;
  flash: boolean;
  onActivate: () => void;
}

/** DeployCell is what one environment of one repository says: a glyph and a word, and under them the second line. */
export function DeployCell({
  model,
  environment,
  tabIndex,
  open,
  flash,
  onActivate,
}: DeployCellProps) {
  const failed = model.glyph === "error";
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the grid owns the keyboard of its cells
    <div
      role="gridcell"
      tabIndex={tabIndex}
      aria-label={model.label}
      aria-selected={open}
      {...{ [SLOT_ATTRIBUTE]: model.key }}
      onClick={onActivate}
      className={cn(
        CELL,
        open
          ? "bg-brand-veil shadow-[inset_0_0_0_var(--border)_var(--brand-ring)]"
          : failed
            ? "shadow-[inset_var(--error-rail)_0_0_0_var(--state-error),inset_0_0_0_var(--border)_var(--line-1)] hover:bg-veil-hover active:bg-veil-press"
            : "shadow-[inset_0_0_0_var(--border)_var(--line-1)] hover:bg-veil-hover active:bg-veil-press",
        flash && "row-flash",
      )}
    >
      <span
        className={cn(
          "flex min-w-0 items-center gap-(--space-2)",
          WORD_TONES[model.tone],
          model.stale && "text-ink-3",
        )}
      >
        <GlyphOf glyph={model.glyph} stale={model.stale} />
        <span className="min-w-0 wrap-break-word">
          {model.glyph === "shimmer" ? <Shimmer>{model.word}</Shimmer> : model.word}
        </span>
        {model.failedMark && (
          <Tooltip content="Last deploy failed">
            <span className="inline-flex">
              <StateGlyph state="error" size="sm" />
            </span>
          </Tooltip>
        )}
      </span>
      {(model.meta !== "" || environment !== null) && (
        <span className="min-w-0 pl-[calc(var(--glyph-sm)+var(--space-2))] text-(length:--text-meta) leading-(--leading-meta) wrap-break-word text-ink-3">
          {environment !== null && (
            <span className="text-ink-4">
              {model.meta === "" ? environment : `${environment} · `}
            </span>
          )}
          {model.meta}
        </span>
      )}
    </div>
  );
}
