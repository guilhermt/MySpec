import { useState } from "react";
import { Button } from "@/components/system/Button";
import { ChecksList } from "@/components/system/ChecksList";
import { LiveRegion } from "@/components/system/LiveRegion";
import { Spinner } from "@/components/system/Spinner";
import { useNow } from "@/features/attention/useNow";
import {
  type ChecksReading,
  checkDuration,
  checkRows,
  liveChecksHeader,
} from "@/lib/pull-requests";
import { age, fullTime } from "@/lib/when";
import { openExternal } from "@/store/actions";

/** SECOND is how often the durations of the checks that run and the age of the reading are told again. */
const SECOND = 1000;

export interface LiveChecksProps {
  reading: ChecksReading;
  /** foot is what is still missing, at the foot of the block: the wait for the first pass. */
  foot?: string;
  /** onRefresh reads the pull request now; Refresh is in the header while it is given. */
  onRefresh?: () => Promise<void>;
  /** fixed is the card at the end of the conversation of the review: one entry of its feed. */
  fixed?: boolean;
}

/** Refresh reads the pull request out of the minute: Refresh, and Reading… while the promise runs. */
function Refresh({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const [running, setRunning] = useState(false);
  const press = async () => {
    setRunning(true);
    try {
      await onRefresh();
    } finally {
      setRunning(false);
    }
  };
  return (
    <>
      <LiveRegion
        kind="status"
        className="inline-flex items-center gap-(--space-1-5) text-(length:--text-meta) leading-(--leading-meta) text-ink-3"
      >
        {running && (
          <span className="inline-flex items-center gap-(--space-1-5) px-(--space-2)">
            <Spinner />
            Reading…
          </span>
        )}
      </LiveRegion>
      {!running && (
        <Button variant="ghost" size="xs" onClick={() => void press()}>
          Refresh
        </Button>
      )}
    </>
  );
}

/**
 * LiveChecks is the wait for the checks of the pull request, read every minute: the header with the
 * count, checking GitHub before the first reading, when it was read, and a line per check.
 */
export function LiveChecks({ reading, foot, onRefresh, fixed = false }: LiveChecksProps) {
  const now = useNow(SECOND, true);
  const rows = checkRows(reading).map((row) => ({
    ...row,
    duration: checkDuration(row, now),
  }));
  const unread = reading.checkedAt === "";
  const header = liveChecksHeader(reading.checks);
  const list = (
    <ChecksList
      summary={header}
      rows={rows}
      onOpen={(url) => void openExternal(url)}
      live={{
        header,
        age: unread ? "" : `checked ${age(reading.checkedAt, now)}`,
        ageTooltip: unread ? "" : fullTime(reading.checkedAt),
        reading: unread,
        ...(onRefresh !== undefined ? { action: <Refresh onRefresh={onRefresh} /> } : {}),
        ...(foot !== undefined ? { foot } : {}),
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
      aria-label={unread ? "checking GitHub" : header}
      className="rounded-md outline-none focus-visible:focus-ring"
    >
      {list}
    </article>
  );
}
