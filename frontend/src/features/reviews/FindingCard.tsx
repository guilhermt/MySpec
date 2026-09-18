import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { findingLocation, placementLabel } from "@/features/reviews/review-status";
import { useFindingText } from "@/features/reviews/useFindingText";
import { asFindingDecision, type ReviewFinding } from "@/lib/wails";
import { decideFinding, openFindingInEditor, saveFindingText } from "@/store/actions";

export interface FindingCardProps {
  reviewId: string;
  pass: number;
  /** revision is the report the finding came from, which drops the draft when it changes. */
  revision: number;
  finding: ReviewFinding;
  /** published is a pass already sent to GitHub: nothing about it changes any more. */
  published: boolean;
}

/** FindingCard is one finding of a report, as the user decides on it. */
export function FindingCard({ reviewId, pass, revision, finding, published }: FindingCardProps) {
  const anchored = finding.path !== "";
  const decision = asFindingDecision(finding.decision);
  const text = useFindingText(
    reviewId,
    pass,
    finding.number,
    finding.text,
    revision,
    (next) => void saveFindingText(reviewId, pass, finding.number, next),
    true,
  );
  const label = `Finding ${finding.number}`;

  return (
    <li className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-sm font-medium tabular-nums">{`${finding.number}.`}</span>
        {anchored ? (
          <button
            type="button"
            onClick={() => void openFindingInEditor(reviewId, pass, finding.number)}
            className="min-w-0 truncate rounded-md font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {findingLocation(finding)}
          </button>
        ) : (
          <span className="font-mono text-xs text-muted-foreground">
            {findingLocation(finding)}
          </span>
        )}
        <span className="flex-1" />
        {published && (
          <span className="shrink-0 text-xs text-muted-foreground">
            {placementLabel(finding.placement)}
          </span>
        )}
      </div>

      {published ? (
        <p className="text-sm whitespace-pre-wrap">{text.value}</p>
      ) : (
        <>
          <Textarea
            aria-label={label}
            rows={3}
            value={text.value}
            onChange={(event) => text.onChange(event.target.value)}
            onBlur={text.onBlur}
            className="max-h-72 field-sizing-content text-sm"
          />
          <ToggleGroup
            aria-label={`${label} decision`}
            size="sm"
            value={decision === "" ? [] : [decision]}
            onValueChange={(next: string[]) => {
              const [value] = next;
              void decideFinding(
                reviewId,
                pass,
                finding.number,
                value === undefined ? "" : asFindingDecision(value),
              );
            }}
          >
            <ToggleGroupItem value="approved">Approve</ToggleGroupItem>
            <ToggleGroupItem value="discarded">Discard</ToggleGroupItem>
          </ToggleGroup>
        </>
      )}
    </li>
  );
}
