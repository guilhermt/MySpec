import { ExternalLink } from "@/components/ExternalLink";
import { LiveRegion } from "@/components/system/LiveRegion";
import { StateGlyph } from "@/components/system/StateGlyph";
import { failureLine } from "@/lib/images";
import type { CardImageFailure } from "@/lib/wails";

export interface CardImageFailuresProps {
  failures: CardImageFailure[];
}

/** CardImageFailures say which images of the cards couldn't be read, each with a link to it. */
export function CardImageFailures({ failures }: CardImageFailuresProps) {
  return (
    <LiveRegion
      kind="status"
      as="div"
      className="flex flex-col gap-(--space-1) text-(length:--text-meta) leading-(--leading-meta) text-ink-3"
    >
      {failures.map((failure) => (
        <span key={`${failure.issue}|${failure.url}|${failure.reason}`}>
          <StateGlyph state="blocked" className="mr-(--space-1-5) align-middle" />
          {failureLine(failure)}
          {failure.url !== "" && (
            <>
              {" "}
              <ExternalLink url={failure.url}>Open</ExternalLink>
            </>
          )}
        </span>
      ))}
    </LiveRegion>
  );
}
