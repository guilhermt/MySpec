import { ChecksList } from "@/components/system/ChecksList";
import { useNow } from "@/features/attention/useNow";
import { checkDuration, checkRows, liveChecksHeader, prChecks } from "@/lib/pull-requests";
import type { PullRequest } from "@/lib/wails";
import { age, fullTime } from "@/lib/when";
import { openExternal } from "@/store/actions";

/** SECOND is how often the durations of the checks that run and the age of the reading are told again. */
const SECOND = 1000;

export interface LiveChecksProps {
  pr: PullRequest;
  /** fixed is the card at the end of the conversation of the review: one entry of its feed. */
  fixed?: boolean;
}

/**
 * LiveChecks is the wait for the checks of the pull request, read every minute: the header with the
 * count, checking GitHub before the first reading, when it was read, and a line per check.
 */
export function LiveChecks({ pr, fixed = false }: LiveChecksProps) {
  const now = useNow(SECOND, true);
  const rows = checkRows(prChecks(pr)).map((row) => ({
    ...row,
    duration: checkDuration(row, now),
  }));
  const reading = pr.checkedAt === "";
  const header = liveChecksHeader(pr.checks);
  const list = (
    <ChecksList
      summary={header}
      rows={rows}
      onOpen={(url) => void openExternal(url)}
      live={{
        header,
        age: reading ? "" : `checked ${age(pr.checkedAt, now)}`,
        ageTooltip: reading ? "" : fullTime(pr.checkedAt),
        reading,
      }}
    />
  );
  if (!fixed) {
    return list;
  }
  return (
    <article
      data-feed-item
      tabIndex={-1}
      aria-label={reading ? "checking GitHub" : header}
      className="rounded-md outline-none focus-visible:focus-ring"
    >
      {list}
    </article>
  );
}
