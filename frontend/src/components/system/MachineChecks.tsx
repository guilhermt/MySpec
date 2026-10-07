import { CopyButton } from "./CopyButton";
import { Icon } from "./Icon";
import { ICONS } from "./icons";
import { StateGlyph } from "./StateGlyph";
import { Tag } from "./Tag";

export interface MachineItemView {
  id: string;
  /** result draws the glyph: ok the check mark, missing ◇, unchecked the empty circle. */
  result: "ok" | "missing" | "unchecked";
  title: string;
  /** text is what to do or what is known; "" for none. */
  text: string;
  /** command is what to run to fix it, "" when there is none. */
  command: string;
  /** detail is what the tool said, in mono, "" for none. */
  detail: string;
}

export interface MachineChecksProps {
  items: readonly MachineItemView[];
}

const RESULT_TEXT = { ok: "OK: ", missing: "Missing: ", unchecked: "Not checked: " } as const;

function Glyph({ result }: { result: MachineItemView["result"] }) {
  switch (result) {
    case "ok":
      return <Icon icon={ICONS.done} tone="muted" className="size-(--glyph)" />;
    case "missing":
      return <StateGlyph state="blocked" />;
    case "unchecked":
      return <StateGlyph state="todo" />;
  }
}

/**
 * MachineChecks lists items of the check of the machine, one each: its result, what it is, what to do or
 * what is known, and, when there is one, the command that fixes it.
 */
export function MachineChecks({ items }: MachineChecksProps) {
  return (
    <ul className="m-0 flex list-none flex-col gap-(--space-2) p-0">
      {items.map((item) => (
        <li key={item.id} className="grid grid-cols-[var(--icon)_1fr] gap-x-(--space-2)">
          <span aria-hidden="true" className="flex h-(--leading-ui) items-center justify-center">
            <Glyph result={item.result} />
          </span>
          <div className="min-w-0">
            <p className="m-0 text-(length:--text-ui) leading-(--leading-ui) font-medium text-ink-1">
              <span className="sr-only">{RESULT_TEXT[item.result]}</span>
              {item.title}
            </p>
            {item.text !== "" && (
              <p className="m-0 text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
                {item.text}
              </p>
            )}
            {item.detail !== "" && (
              <p className="m-0 font-mono text-(length:--text-micro) leading-(--leading-micro) text-ink-3 select-text break-words">
                {item.detail}
              </p>
            )}
            {item.command !== "" && (
              <div className="mt-(--space-1) flex items-center gap-(--space-1)">
                <Tag>{item.command}</Tag>
                <CopyButton variant="icon" label={`Copy ${item.command}`} text={item.command} />
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
