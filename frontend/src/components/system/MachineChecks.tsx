import { CopyButton } from "./CopyButton";
import { StateGlyph } from "./StateGlyph";
import { Tag } from "./Tag";

export interface MachineItemView {
  id: string;
  title: string;
  text: string;
  /** command is what to run to fix it, "" when there is none. */
  command: string;
}

export interface MachineChecksProps {
  items: readonly MachineItemView[];
}

/** MachineChecks is what the machine lacks, one item each: what is wrong and, when there is one, the command that fixes it. */
export function MachineChecks({ items }: MachineChecksProps) {
  return (
    <ul className="m-0 flex list-none flex-col gap-(--space-2) p-0">
      {items.map((item) => (
        <li key={item.id} className="grid grid-cols-[var(--icon)_1fr] gap-x-(--space-2)">
          <span className="flex h-(--leading-ui) items-center justify-center">
            <StateGlyph state="blocked" />
          </span>
          <div className="min-w-0">
            <p className="m-0 text-(length:--text-ui) leading-(--leading-ui) font-medium text-ink-1">
              {item.title}
            </p>
            <p className="m-0 text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
              {item.text}
            </p>
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
