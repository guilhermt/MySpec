import { useState } from "react";
import { DecisionCard, type DecisionCardItem } from "@/components/system/DecisionCard";
import { Finding, type FindingDecision, type FindingView } from "@/components/system/Finding";
import { Markdown } from "@/features/chat/Markdown";
import { stepFeed } from "@/features/chat/useFeed";
import { findingViews } from "@/features/reviews/review-conversation";
import { useFindingText } from "@/features/reviews/useFindingText";
import type { ReviewFinding, ReviewPass, ReviewSummary } from "@/lib/wails";
import {
  decideFindingInPlace,
  openExternal,
  openFindingInEditor,
  saveFindingTextInPlace,
} from "@/store/actions";

/** Attempt is what the user asked of a finding: the decision or the text, kept to try it again. */
type Attempt = { kind: "decision"; decision: FindingDecision } | { kind: "text"; text: string };

/** Standing is where the last asks of a finding stand: one under way, or the one that failed. */
interface Standing {
  saving: boolean;
  failed: Attempt | null;
}

const IDLE: Standing = { saving: false, failed: null };

const EDIT_NOTES = {
  publish: "Saved as you type. It goes to GitHub as you leave it.",
  apply: "Saved as you type. It goes to the agent as you leave it.",
};

interface CardFindingProps {
  review: ReviewSummary;
  pass: ReviewPass;
  finding: ReviewFinding;
  model: FindingView;
  current: boolean;
  standing: Standing;
  onAsk: (attempt: Attempt) => void;
}

// CardFinding joins the Finding of the system to the review: the text as it is edited, the
// decision, the ways to open the line. It is keyed by the number of its finding, so a report written
// again keeps the editing open of a finding that did not change.
function CardFinding({ review, pass, finding, model, current, standing, onAsk }: CardFindingProps) {
  const [editing, setEditing] = useState(false);
  const text = useFindingText(
    review.id,
    pass.pass,
    finding.number,
    finding.text,
    pass.revision,
    (next) => onAsk({ kind: "text", text: next }),
    true,
  );

  // A report written again closes the editing of a finding whose text is not the one it was.
  const [seen, setSeen] = useState({ revision: pass.revision, text: finding.text });
  if (seen.revision !== pass.revision || seen.text !== finding.text) {
    setSeen({ revision: pass.revision, text: finding.text });
    if (seen.revision !== pass.revision && seen.text !== finding.text) {
      setEditing(false);
    }
  }

  return (
    <Finding
      model={model}
      current={current}
      editNote={EDIT_NOTES[review.mode === "apply" ? "apply" : "publish"]}
      editing={editing}
      draft={text.value}
      saving={standing.saving}
      error={standing.failed?.kind ?? null}
      onDecide={(decision) => onAsk({ kind: "decision", decision })}
      onEdit={() => setEditing(true)}
      onDraftChange={text.onChange}
      onDraftBlur={text.onBlur}
      onDone={() => setEditing(false)}
      onOpenLine={() => {
        if (model.location.kind === "anchored") {
          void openExternal(model.location.url);
        }
      }}
      onOpenEditor={() => void openFindingInEditor(review.id, pass.pass, finding.number)}
      onRetry={() => {
        if (standing.failed !== null) {
          onAsk(standing.failed);
        }
      }}
      renderText={(value) => <Markdown cutCode>{value}</Markdown>}
    />
  );
}

export interface FindingsCardProps {
  review: ReviewSummary;
  pass: ReviewPass;
}

/**
 * FindingsCard is the card of findings the conversation holds after the report of the pass being
 * decided: the findings in the order of the report, decided with A and D and edited in place.
 */
export function FindingsCard({ review, pass }: FindingsCardProps) {
  const findings = pass.findings ?? [];
  const [standings, setStandings] = useState<Record<number, Standing>>({});
  const views = findingViews(review, pass, Date.now());
  const items: DecisionCardItem[] = views.map((view) => ({
    id: view.id,
    decided: view.decision !== "",
    disabled: false,
  }));

  const ask = async (number: number, attempt: Attempt) => {
    setStandings((all) => ({ ...all, [number]: { saving: true, failed: null } }));
    const failure =
      attempt.kind === "decision"
        ? await decideFindingInPlace(review.id, pass.pass, number, attempt.decision)
        : await saveFindingTextInPlace(review.id, pass.pass, number, attempt.text);
    setStandings((all) => ({
      ...all,
      [number]: { saving: false, failed: failure === null ? null : attempt },
    }));
  };

  const onDecide = (id: string, key: "approve" | "discard"): "advance" | "stay" => {
    const finding = findings.find((each) => String(each.number) === id);
    if (finding === undefined) {
      return "stay";
    }
    const decision: FindingDecision = key === "approve" ? "approved" : "discarded";
    // The same key again takes the decision back, and stays where it is.
    const undo = finding.decision === decision;
    void ask(finding.number, { kind: "decision", decision: undo ? "" : decision });
    return undo ? "stay" : "advance";
  };

  return (
    <DecisionCard
      title="Findings"
      count={findings.length}
      label={`Findings of pass ${pass.pass}`}
      items={items}
      onDecide={onDecide}
      onLeave={(by) => {
        const card = document.querySelector<HTMLElement>("[data-decision-card]");
        if (card !== null) {
          stepFeed(card, by);
        }
      }}
      renderItem={(item, current) => {
        const finding = findings.find((each) => String(each.number) === item.id);
        const model = views.find((view) => view.id === item.id);
        if (finding === undefined || model === undefined) {
          return null;
        }
        return (
          <CardFinding
            key={finding.number}
            review={review}
            pass={pass}
            finding={finding}
            model={model}
            current={current}
            standing={standings[finding.number] ?? IDLE}
            onAsk={(attempt) => void ask(finding.number, attempt)}
          />
        );
      }}
    />
  );
}
