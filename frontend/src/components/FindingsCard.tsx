import { type ReactNode, useRef, useState } from "react";
import { DecisionCard, type DecisionCardItem } from "@/components/system/DecisionCard";
import { Finding, type FindingDecision, type FindingView } from "@/components/system/Finding";
import { textKey, useEditedText } from "@/components/useEditedText";
import type { ReviewFinding } from "@/lib/wails";
import { openExternal } from "@/store/actions";

/** Attempt is what the user asked of a finding: the decision or the text, kept to try it again. */
type Attempt = { kind: "decision"; decision: FindingDecision } | { kind: "text"; text: string };

/**
 * Standing is where the last ask of one kind about a finding stands: under way, or failed. The
 * decision and the text each have their own, so one never clears or hides the other.
 */
interface Standing {
  saving: boolean;
  failed: Attempt | null;
}

/** Standings are the standing of the decision and of the text of one finding. */
type Standings = Record<Attempt["kind"], Standing>;

const IDLE: Standing = { saving: false, failed: null };
const ALL_IDLE: Standings = { decision: IDLE, text: IDLE };

interface CardFindingProps {
  owner: string;
  pass: number;
  revision: number;
  currentRevision: () => number | null;
  finding: ReviewFinding;
  model: FindingView;
  current: boolean;
  standings: Standings;
  editNote: string;
  openEditor: (number: number) => void;
  renderText: (text: string) => ReactNode;
  onAsk: (attempt: Attempt) => void;
}

// CardFinding joins the Finding of the system to its owner: the text as it is edited, the
// decision, the ways to open the line. It is keyed by the number of its finding, so a report written
// again keeps the editing open of a finding that did not change.
function CardFinding({
  owner,
  pass,
  revision,
  currentRevision,
  finding,
  model,
  current,
  standings,
  editNote,
  openEditor,
  renderText,
  onAsk,
}: CardFindingProps) {
  const [editing, setEditing] = useState(false);
  const text = useEditedText(
    textKey(owner, pass, finding.number),
    finding.text,
    revision,
    (next) => onAsk({ kind: "text", text: next }),
    true,
    currentRevision,
  );

  // A report written again closes the editing of a finding whose text is not the one it was.
  const [seen, setSeen] = useState({ revision, text: finding.text });
  if (seen.revision !== revision || seen.text !== finding.text) {
    setSeen({ revision, text: finding.text });
    if (seen.revision !== revision && seen.text !== finding.text) {
      setEditing(false);
    }
  }

  const common = {
    model,
    current,
    onOpenLine: () => {
      if (model.location.kind === "anchored") {
        void openExternal(model.location.url);
      }
    },
    onOpenEditor: () => openEditor(finding.number),
    renderText,
  };
  if (model.disabled !== null) {
    return <Finding {...common} />;
  }

  // Either save under way shows; a failed decision shows before a failed text, and Try again asks
  // again the one shown.
  const failed = standings.decision.failed ?? standings.text.failed;

  return (
    <Finding
      {...common}
      editNote={editNote}
      editing={editing}
      draft={text.value}
      saving={standings.decision.saving || standings.text.saving}
      error={failed?.kind ?? null}
      onDecide={(decision) => onAsk({ kind: "decision", decision })}
      onEdit={() => setEditing(true)}
      onDraftChange={text.onChange}
      onDraftBlur={text.onBlur}
      onDone={() => setEditing(false)}
      onRetry={() => {
        if (failed !== null) {
          onAsk(failed);
        }
      }}
    />
  );
}

export interface FindingsCardProps {
  /** owner is the id of the review or of the task: with the pass, it keys the texts being edited. */
  owner: string;
  pass: number;
  /** revision is the report the pass stands at; a new one drops what was typed on the old. */
  revision: number;
  /** currentRevision is the revision of the pass in the store now, null once it is gone. */
  currentRevision: () => number | null;
  findings: readonly ReviewFinding[];
  views: readonly FindingView[];
  /** editNote is what the editing says of where the text goes. */
  editNote: string;
  /** disabled is the card of a pass behind: no decision and no Edit. */
  disabled: boolean;
  decide: (number: number, decision: FindingDecision) => Promise<string | null>;
  saveText: (number: number, text: string) => Promise<string | null>;
  openEditor: (number: number) => void;
  renderText: (text: string) => ReactNode;
  onLeave: (by: -1 | 1) => void;
}

/**
 * FindingsCard is the card of findings the conversation holds after the report of the pass being
 * decided: the findings in the order of the report, decided with A and D and edited in place.
 */
export function FindingsCard({
  owner,
  pass,
  revision,
  currentRevision,
  findings,
  views,
  editNote,
  disabled,
  decide,
  saveText,
  openEditor,
  renderText,
  onLeave,
}: FindingsCardProps) {
  const [standings, setStandings] = useState<Record<number, Standings>>({});
  // asked counts the asks of each kind about each finding, so only the latest one settles its
  // standing: an earlier save that ends later neither clears the saving nor brings back a failure.
  const asked = useRef(new Map<string, number>());
  const items: DecisionCardItem[] = views.map((view) => ({
    id: view.id,
    decided: disabled || view.decision !== "",
    disabled,
  }));

  const settle = (number: number, kind: Attempt["kind"], standing: Standing) =>
    setStandings((all) => ({
      ...all,
      [number]: { ...(all[number] ?? ALL_IDLE), [kind]: standing },
    }));

  const ask = async (number: number, attempt: Attempt) => {
    const key = `${number}:${attempt.kind}`;
    const turn = (asked.current.get(key) ?? 0) + 1;
    asked.current.set(key, turn);
    settle(number, attempt.kind, { saving: true, failed: null });
    const failure =
      attempt.kind === "decision"
        ? await decide(number, attempt.decision)
        : await saveText(number, attempt.text);
    if (asked.current.get(key) === turn) {
      settle(number, attempt.kind, { saving: false, failed: failure === null ? null : attempt });
    }
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
      label={`Findings of pass ${pass}`}
      items={items}
      onDecide={onDecide}
      onLeave={onLeave}
      renderItem={(item, current) => {
        const finding = findings.find((each) => String(each.number) === item.id);
        const model = views.find((view) => view.id === item.id);
        if (finding === undefined || model === undefined) {
          return null;
        }
        return (
          <CardFinding
            key={finding.number}
            owner={owner}
            pass={pass}
            revision={revision}
            currentRevision={currentRevision}
            finding={finding}
            model={model}
            current={current}
            standings={standings[finding.number] ?? ALL_IDLE}
            editNote={editNote}
            openEditor={openEditor}
            renderText={renderText}
            onAsk={(attempt) => void ask(finding.number, attempt)}
          />
        );
      }}
    />
  );
}
