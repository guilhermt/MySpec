import { Search } from "lucide-react";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";
import { ICONS } from "./icons";
import { MENU_ITEM } from "./Menu";
import { Tooltip } from "./Tooltip";

/** DependencyOption is a draft or a card that can be depended on; sub is "" when there is none. */
export interface DependencyOption {
  value: string;
  label: string;
  sub: string;
}

export interface DependencyPickerProps {
  /** chosen are the values already depended on; recorded ones can't be taken out. */
  chosen: readonly string[];
  recorded: readonly string[];
  /** drafts are the group "Drafts of this discussion". */
  drafts: readonly DependencyOption[];
  /** cards are the group "Cards of the board", all of them; the picker filters and cuts them. */
  cards: readonly DependencyOption[];
  /** onToggle adds or takes out a value; it answers the refusal, null when it went through. */
  onToggle: (value: string) => Promise<string | null>;
  onClose: () => void;
}

/** CARDS_SHOWN is how many cards of the board the picker shows after the search. */
export const CARDS_SHOWN = 20;

/** ISSUE_REF is a search that names an issue by owner/name#N, which can be depended on as typed. */
const ISSUE_REF = /^[\w.-]+\/[\w.-]+#\d+$/;

/** GROUP_LABEL is the caps heading of a group, as MenuGroupLabel draws it. */
const GROUP_LABEL =
  "px-2 pt-1 pb-0.5 text-(length:--text-caps) leading-(--leading-caps) font-bold tracking-(--tracking-caps) uppercase text-ink-3";

interface Group {
  label: string;
  options: readonly DependencyOption[];
}

/** pickerModel is what the picker shows for a search: the groups that have options, and the typed issue. */
function pickerModel(
  search: string,
  drafts: readonly DependencyOption[],
  cards: readonly DependencyOption[],
): { groups: Group[]; typed: DependencyOption | null } {
  const query = search.trim().toLowerCase();
  const matches = (option: DependencyOption) =>
    option.label.toLowerCase().includes(query) || option.value.toLowerCase() === query;
  const groups = [
    { label: "Drafts of this discussion", options: drafts.filter(matches) },
    { label: "Cards of the board", options: cards.filter(matches).slice(0, CARDS_SHOWN) },
  ].filter((group) => group.options.length > 0);
  const ref = search.trim();
  const known = [...drafts, ...cards].some((option) => option.value === ref);
  const typed =
    ISSUE_REF.test(ref) && !known ? { value: ref, label: `Depend on ${ref}`, sub: "" } : null;
  return { groups, typed };
}

/**
 * DependencyPicker is the listbox, open in place, that chooses what a draft depends on: the drafts
 * of the discussion and the cards of the board, under a search that keeps the focus, and an issue
 * typed as owner/name#N. Choosing a chosen value takes it out, unless it is recorded on GitHub.
 */
export function DependencyPicker({
  chosen,
  recorded,
  drafts,
  cards,
  onToggle,
  onClose,
}: DependencyPickerProps) {
  const id = useId();
  const search = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const pending = useRef(false);

  useEffect(() => {
    search.current?.focus();
  }, []);

  const { groups, typed } = pickerModel(query, drafts, cards);
  const options = [...groups.flatMap((group) => group.options), ...(typed ? [typed] : [])];
  const optionId = (value: string) => `${id}-${options.findIndex((o) => o.value === value)}`;
  const activeIndex = options.findIndex((option) => option.value === active);

  useEffect(() => {
    if (activeIndex < 0) return;
    document.getElementById(`${id}-${activeIndex}`)?.scrollIntoView?.({ block: "nearest" });
  }, [id, activeIndex]);

  const toggle = async (value: string) => {
    if (pending.current || (chosen.includes(value) && recorded.includes(value))) return;
    pending.current = true;
    try {
      setRefusal(await onToggle(value));
    } finally {
      pending.current = false;
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (options.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      const from = activeIndex < 0 && step < 0 ? 0 : activeIndex;
      setActive(options[(from + step + options.length) % options.length]?.value ?? null);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (activeIndex >= 0 && active !== null) void toggle(active);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  };

  const option = (item: DependencyOption) => {
    const selected = chosen.includes(item.value);
    const locked = selected && recorded.includes(item.value);
    return (
      // biome-ignore lint/a11y/useKeyWithClickEvents: the keyboard reaches the option through the search, by aria-activedescendant
      // biome-ignore lint/a11y/useFocusableInteractive: the search keeps the focus and points at the active option
      <div
        key={item.value}
        id={optionId(item.value)}
        role="option"
        aria-selected={selected}
        {...(locked ? { "aria-disabled": true } : {})}
        {...(item.value === active ? { "data-highlighted": "" } : {})}
        // The search keeps the focus: a press on an option does not take it.
        onMouseDown={(event) => event.preventDefault()}
        onMouseMove={() => setActive(item.value)}
        onClick={() => void toggle(item.value)}
        className={cn(
          "flex cursor-default items-center outline-none select-none",
          MENU_ITEM,
          "data-highlighted:bg-veil-hover",
        )}
      >
        <Icon icon={ICONS.done} tone="active" className={cn(!selected && "invisible")} />
        <Tooltip content={item.label}>
          <span className="min-w-0 truncate">{item.label}</span>
        </Tooltip>
        {item.sub !== "" && " "}
        {item.sub !== "" && (
          <span className="shrink-0 whitespace-nowrap text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
            {item.sub}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="flex max-h-full w-(--size-popover) max-w-full flex-col gap-0.5 rounded-lg bg-surface-3 p-1 text-(length:--text-ui) leading-(--leading-ui) text-ink-1 shadow-float">
      <div className="flex h-(--size-control-sm) shrink-0 items-center gap-1.5 rounded-sm border border-line-3 bg-surface-input pr-1 pl-2 not-focus-within:hover:border-ink-3 focus-within:field-focus">
        <Icon icon={Search} size="sm" tone="muted" />
        <input
          ref={search}
          type="text"
          role="combobox"
          aria-label="Search drafts and cards"
          aria-expanded="true"
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          {...(activeIndex >= 0 ? { "aria-activedescendant": `${id}-${activeIndex}` } : {})}
          {...(refusal !== null ? { "aria-describedby": `${id}-refusal` } : {})}
          placeholder="#474 or a title"
          value={query}
          onChange={(event) => {
            const next = event.target.value;
            setQuery(next);
            // As the search narrows the list, its first option is the one Enter chooses.
            const model = pickerModel(next, drafts, cards);
            const first = model.groups[0]?.options[0] ?? model.typed;
            setActive(next.trim() === "" ? null : (first?.value ?? null));
          }}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 border-0 bg-transparent text-(length:--text-meta) leading-(--leading-meta) text-ink-1 placeholder:text-ink-4 outline-none"
        />
      </div>
      {refusal !== null && (
        <div
          id={`${id}-refusal`}
          role="alert"
          className="px-2 py-0.5 text-(length:--text-meta) leading-(--leading-meta) text-state-error"
        >
          {refusal}
        </div>
      )}
      {options.length === 0 && (
        <div className="px-2 py-1.5 text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
          No card matches.
        </div>
      )}
      <div
        id={`${id}-list`}
        role="listbox"
        aria-label="Depend on"
        aria-multiselectable="true"
        className="relative flex min-h-0 flex-col gap-0.5 overflow-y-auto"
      >
        {groups.map((group, index) => (
          // biome-ignore lint/a11y/useSemanticElements: a fieldset can't sit in a listbox, whose groups are role group
          <div
            key={group.label}
            role="group"
            aria-labelledby={`${id}-group-${index}`}
            className="flex flex-col gap-0.5"
          >
            <div id={`${id}-group-${index}`} className={GROUP_LABEL}>
              {group.label}
            </div>
            {group.options.map(option)}
          </div>
        ))}
        {typed !== null && option(typed)}
      </div>
    </div>
  );
}
