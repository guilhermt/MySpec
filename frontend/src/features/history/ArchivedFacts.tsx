import { ARCHIVED_FACTS, Fact } from "@/components/Facts";
import { Link } from "@/components/system/Link";
import { Tooltip } from "@/components/system/Tooltip";
import type { ArchivedFact } from "@/features/history/archived";
import { openExternal } from "@/store/actions";

// FactValue is the value of a fact, with the reference inside it as the link that opens on GitHub.
function FactValue({ fact }: { fact: ArchivedFact }) {
  const { link } = fact;
  const at = link === undefined ? -1 : fact.value.indexOf(link.text);
  if (link === undefined || at === -1) {
    return fact.value;
  }
  return (
    <>
      {fact.value.slice(0, at)}
      <Tooltip content={link.tooltip}>
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
      </Tooltip>
      {fact.value.slice(at + link.text.length)}
    </>
  );
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
