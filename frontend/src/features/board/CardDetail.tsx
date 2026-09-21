import { ExternalLink as ExternalLinkIcon, TriangleAlert, X } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StartTaskAction } from "@/features/board/StartTaskAction";
import type { StartCard } from "@/features/board/useStartCard";
import { ExternalLink } from "@/features/chat/ExternalLink";
import { Markdown } from "@/features/chat/Markdown";
import { issueLabel, prStateLabel, stateLabel } from "@/lib/boards";
import { cn } from "@/lib/utils";
import type { Board, BoardCard, CardIssue, CardPullRequest } from "@/lib/wails";
import { asIssueState, asPullRequestState } from "@/lib/wails";
import { useAppStore, useArchivedTask, useTask } from "@/store/app-store";

export interface CardDetailProps {
  board: Board;
  card: BoardCard;
  start: StartCard;
  onClose: () => void;
  /** onSelect opens another card of the board in the detail. */
  onSelect: (key: string) => void;
  /** onDiscuss opens a discussion of this card alone. */
  onDiscuss: () => void;
}

const LINK_CLASS = "underline-offset-4 hover:underline";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function IssueLink({ issue }: { issue: CardIssue }) {
  return (
    <ExternalLink href={issue.url} className={LINK_CLASS}>
      {`${issueLabel(issue)} ${issue.title}`}
    </ExternalLink>
  );
}

function PullRequestLink({ pr }: { pr: CardPullRequest }) {
  return (
    <ExternalLink href={pr.url} className={LINK_CLASS}>
      {`${pr.repository}#${pr.number} · ${prStateLabel(asPullRequestState(pr.state))}`}
    </ExternalLink>
  );
}

/** CardDetail is everything the last reading found about one card, and Start task for it. */
export function CardDetail({ board, card, start, onClose, onSelect, onDiscuss }: CardDetailProps) {
  const openTask = useAppStore((state) => state.openTask);
  const openArchived = useAppStore((state) => state.openArchived);
  const task = useTask(card.activeTaskId === "" ? null : card.activeTaskId);
  const archived = useArchivedTask(card.archivedTaskId === "" ? null : card.archivedTaskId);
  const fields = card.fields ?? [];
  const assignees = card.assignees ?? [];
  const siblings = card.siblings ?? [];
  const dependencies = card.dependencies ?? [];
  const pullRequests = card.pullRequests ?? [];

  return (
    <aside
      aria-label={`Card ${issueLabel(card)}`}
      className="flex h-full min-w-0 flex-col gap-4 overflow-y-auto border-l p-4 text-sm"
    >
      <div className="flex items-start gap-2">
        <h2 className="min-w-0 flex-1 font-medium">{card.title}</h2>
        <Button variant="ghost" size="icon-xs" aria-label="Close card" onClick={onClose}>
          <X aria-hidden="true" />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
        <span className="tabular-nums">{issueLabel(card)}</span>
        <span>{card.repository}</span>
        <Badge variant="secondary">{stateLabel(asIssueState(card.state))}</Badge>
        {card.status !== "" && <Badge variant="outline">{card.status}</Badge>}
        <ExternalLink
          href={card.url}
          aria-label="Open on GitHub"
          className="inline-flex items-center hover:text-foreground"
        >
          <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
        </ExternalLink>
      </div>

      {fields.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          {fields.map((field) => (
            <div key={field.name} className="contents">
              <dt className="text-muted-foreground">{field.name}</dt>
              <dd>{field.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {assignees.length > 0 && (
        <Section title="Assignees">
          <p>{assignees.map((assignee) => assignee.login).join(", ")}</p>
        </Section>
      )}

      <div className="select-text">
        {card.body === "" ? (
          <p className="text-muted-foreground">No description.</p>
        ) : (
          <Markdown>{card.body}</Markdown>
        )}
      </div>

      {card.epic !== null && (
        <Section title="Epic">
          <IssueLink issue={card.epic} />
        </Section>
      )}
      {siblings.length > 0 && (
        <Section title="Siblings">
          <ul className="flex flex-col gap-1">
            {siblings.map((sibling) => {
              const text = `${issueLabel(sibling)} ${sibling.title} · ${
                sibling.status !== "" ? sibling.status : stateLabel(asIssueState(sibling.state))
              }`;
              return (
                <li key={sibling.key}>
                  {sibling.onBoard ? (
                    <button
                      type="button"
                      className={cn("text-left", LINK_CLASS)}
                      onClick={() => onSelect(sibling.key)}
                    >
                      {text}
                    </button>
                  ) : (
                    <ExternalLink href={sibling.url} className={LINK_CLASS}>
                      {text}
                    </ExternalLink>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      )}
      {dependencies.length > 0 && (
        <Section title="Dependencies">
          <ul className="flex flex-col gap-2">
            {dependencies.map((dependency) => (
              <li key={dependency.key} className="flex flex-col gap-0.5">
                <span className="flex items-center gap-1.5">
                  <IssueLink issue={dependency} />
                  {!dependency.satisfied && (
                    <span className="flex items-center gap-1 text-xs text-[var(--status-attention)]">
                      <TriangleAlert aria-hidden="true" className="size-3.5" />
                      Not satisfied
                    </span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  {[stateLabel(asIssueState(dependency.state)), dependency.status]
                    .filter((part) => part !== "")
                    .join(" · ")}
                </span>
                {(dependency.pullRequests ?? []).map((pr) => (
                  <span key={pr.url} className="text-xs">
                    <PullRequestLink pr={pr} />
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {pullRequests.length > 0 && (
        <Section title="Pull requests">
          <ul className="flex flex-col gap-1">
            {pullRequests.map((pr) => (
              <li key={pr.url}>
                <PullRequestLink pr={pr} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {task !== null && (
        <Section title="Task">
          <Button variant="outline" size="sm" className="w-fit" onClick={() => openTask(task.id)}>
            {task.name}
          </Button>
        </Section>
      )}
      {task === null && archived !== null && (
        <Section title="Task">
          <Button
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => openArchived(archived.id)}
          >
            {`Archived: ${archived.name}`}
          </Button>
        </Section>
      )}
      <StartTaskAction board={board} card={card} start={start} onDiscuss={onDiscuss} />
    </aside>
  );
}
