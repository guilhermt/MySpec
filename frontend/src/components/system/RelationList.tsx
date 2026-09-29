import type { MouseEvent } from "react";
import { Link } from "./Link";

/** RelationItem is one relation: a card, a dependency or a pull request on GitHub. */
export interface RelationItem {
  key: string;
  /** number is the reference, #412 or acme/web#88. */
  number: string;
  title: string;
  /** meta is what follows on the right: the status of a card, the state of a pull request. */
  meta: string;
  url: string;
  /** cardKey is the key of a card of the board reading: the relation opens it in the panel, not on GitHub. */
  cardKey?: string;
  /** warning says what is wrong with the relation: "Not satisfied". */
  warning?: string;
}

/** RelationGroup is a titled group of relations: Epic, Cards of the epic · 3, Dependencies. */
export interface RelationGroup {
  label: string;
  items: readonly RelationItem[];
}

export interface RelationListProps {
  groups: readonly RelationGroup[];
  /** onOpen opens a relation in the browser. */
  onOpen: (url: string) => void;
  /** onOpenCard opens a relation with a cardKey. */
  onOpenCard?: (key: string) => void;
}

/**
 * RelationList is the relations of a card in groups, each group only with items: a relation is an
 * external link, or, when it is a card of the reading, a link that opens the card in the panel, with
 * its meta on the right and a warning after ◇.
 */
export function RelationList({ groups, onOpen, onOpenCard }: RelationListProps) {
  return (
    <div className="flex flex-col gap-(--space-4)">
      {groups
        .filter((group) => group.items.length > 0)
        .map((group) => (
          <section key={group.label} aria-label={group.label} className="flex flex-col">
            <h3 className="pb-(--space-1) text-(length:--text-caps) leading-(--leading-caps) font-bold tracking-(--tracking-caps) text-ink-3 uppercase">
              {group.label}
            </h3>
            <ul className="flex flex-col">
              {group.items.map((item) => (
                <li
                  key={item.key}
                  className="flex min-h-(--size-control-sm) items-center gap-(--space-2) text-(length:--text-meta) leading-(--leading-meta)"
                >
                  <Link
                    {...(item.cardKey !== undefined && onOpenCard !== undefined
                      ? {
                          href: "#",
                          onClick: (event: MouseEvent) => {
                            event.preventDefault();
                            onOpenCard(item.cardKey as string);
                          },
                        }
                      : {
                          href: item.url,
                          external: true,
                          onClick: (event: MouseEvent) => {
                            event.preventDefault();
                            onOpen(item.url);
                          },
                        })}
                    className="min-w-0 gap-(--space-1-5)"
                  >
                    <span className="font-mono text-(length:--text-micro)">{item.number}</span>{" "}
                    <span className="truncate">{item.title}</span>
                  </Link>
                  <span className="ml-auto flex shrink-0 items-center gap-(--space-2) whitespace-nowrap">
                    {item.meta !== "" && (
                      <span className="text-(length:--text-micro) leading-(--leading-micro) text-ink-3 tabular-nums">
                        {item.meta}
                      </span>
                    )}
                    {item.warning !== undefined && (
                      <span className="text-state-notice">
                        <span aria-hidden="true">◇ </span>
                        {item.warning}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
    </div>
  );
}
