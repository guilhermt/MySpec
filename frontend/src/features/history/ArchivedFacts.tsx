import type { ReactNode } from "react";
import { ARCHIVED_FACTS, Fact } from "@/components/Facts";
import { Link } from "@/components/system/Link";
import { Tooltip } from "@/components/system/Tooltip";
import type { ArchivedFact } from "@/features/history/archived";
import { openExternal } from "@/store/actions";

// FactValue is the value of a fact, with the references inside it as the links that open on GitHub.
function FactValue({ fact }: { fact: ArchivedFact }) {
  const parts: ReactNode[] = [];
  let from = 0;
  for (const link of fact.links ?? []) {
    const at = fact.value.indexOf(link.text, from);
    if (at === -1) {
      continue;
    }
    parts.push(
      fact.value.slice(from, at),
      <Tooltip key={`${at}:${link.text}`} content={link.tooltip}>
        <Link
          href={link.href}
          external
          onClick={(event) => {
            event.preventDefault();
            void openExternal(link.href);
          }}
        >
          {link.text}
        </Link>
      </Tooltip>,
    );
    from = at + link.text.length;
  }
  parts.push(fact.value.slice(from));
  return <>{parts}</>;
}

export interface ArchivedFactsProps {
  facts: readonly ArchivedFact[];
}

/** ArchivedFacts are the facts of an archived item: a list of terms and values, the references as links. */
export function ArchivedFacts({ facts }: ArchivedFactsProps) {
  return (
    <dl className={ARCHIVED_FACTS}>
      {facts.map((fact) => (
        <Fact key={fact.label} label={fact.label}>
          <FactValue fact={fact} />
        </Fact>
      ))}
    </dl>
  );
}
