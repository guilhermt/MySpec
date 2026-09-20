import { ChevronsUpDown, ExternalLink as ExternalLinkIcon, LoaderCircle } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ExternalLink } from "@/features/chat/ExternalLink";
import { DependencyList } from "@/features/discussion/DependencyList";
import { DraftDiff } from "@/features/discussion/DraftDiff";
import {
  dependencyLabel,
  isPublishing,
  kindLabel,
  outcomeLabel,
  refKey,
  refValue,
  repositoryOf,
  waitsLabel,
} from "@/features/discussion/discussion-status";
import { type DraftField, storedDraft, useDraftText } from "@/features/discussion/useDraftText";
import { formatDate } from "@/features/history/history-format";
import { STALE_CARD_MS } from "@/lib/boards";
import { messageOf } from "@/lib/errors";
import { cn } from "@/lib/utils";
import type { DiscussionSummary, Draft, DraftRef } from "@/lib/wails";
import { asDraftDecision, asDraftKind } from "@/lib/wails";
import {
  decideDraft,
  refreshCard,
  retryPublish,
  saveDraftText,
  setDraftEpic,
  setDraftModule,
  setDraftRepository,
} from "@/store/actions";

export interface DraftCardProps {
  discussion: DiscussionSummary;
  draft: Draft;
}

// The body of an update reads either as the text the user leaves or as what it
// does to the card.
type BodyTab = "edit" | "changes";

// A line of a card: what it is, and the control that holds it.
function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      {htmlFor === undefined ? (
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      ) : (
        <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
          {label}
        </Label>
      )}
      {children}
    </div>
  );
}

// What the card of an update has now, when the draft leaves it different.
function Current({ text }: { text: string }) {
  return <span className="text-xs text-muted-foreground">{`Current: ${text}`}</span>;
}

// The epic a draft sits under, in the words of the picker.
function epicLabel(epic: DraftRef | null): string {
  return epic === null ? "No epic" : dependencyLabel(epic);
}

// The reference the Go side takes an epic by; "" for a card under none.
function epicRef(epic: DraftRef | null): string {
  return epic === null ? "" : refValue(epic);
}

// What the epic points at, so that two ways of writing the same issue are one.
function epicKey(epic: DraftRef | null): string {
  return epic === null ? "" : refKey(epic);
}

/** DraftCard is one draft of a discussion: what it writes on GitHub, as the user leaves it. */
export function DraftCard({ discussion, draft }: DraftCardProps) {
  const titleId = useId();
  const bodyId = useId();
  const kind = asDraftKind(draft.kind);
  const isUpdate = kind === "update";
  const isCard = kind !== "epic";
  // A publication that started is the end of it: nothing about the draft
  // changes any more, whether every step of it is done or not.
  const readOnly = draft.published || draft.outcome !== "";
  const label = `Draft ${draft.title}`;
  const [bodyTab, setBodyTab] = useState<BodyTab>("edit");
  const [epicIssue, setEpicIssue] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  // The two texts travel to the Go side together, so the one that is not being
  // edited goes as the store has it now, not as this render saw it: a save of
  // the body never puts back a title the user changed a moment before, and the
  // other way round.
  const saveText = (field: DraftField, next: string) => {
    const stored = storedDraft(discussion.id, draft.id) ?? draft;
    void saveDraftText(
      discussion.id,
      draft.id,
      field === "title" ? next : stored.title,
      field === "body" ? next : stored.body,
    );
  };

  const title = useDraftText(
    discussion.id,
    draft.id,
    "title",
    draft.title,
    draft.revision,
    (next) => saveText("title", next),
  );
  const body = useDraftText(discussion.id, draft.id, "body", draft.body, draft.revision, (next) =>
    saveText("body", next),
  );

  // The reading of the card an update changes is refreshed once per revision of
  // the draft: what it says it changes has to be what the card has now.
  const card = draft.card;
  const current = draft.current;
  const stale =
    current !== null && card !== null && Date.now() - Date.parse(current.readAt) > STALE_CARD_MS;
  const refreshedFor = useRef<number | null>(null);
  useEffect(() => {
    if (!stale || card === null || refreshedFor.current === draft.revision) {
      return;
    }
    refreshedFor.current = draft.revision;
    setRefreshing(true);
    setRefreshError(null);
    void refreshCard(discussion.boardId, card.key)
      .catch((failure: unknown) => {
        // The message is a sentence of its own; the notice wraps it in another.
        setRefreshError(messageOf(failure).replace(/\.$/, ""));
      })
      .finally(() => setRefreshing(false));
  }, [stale, card, draft.revision, discussion.boardId]);

  const repository = repositoryOf(draft, discussion);
  const repositoryLabel = repository?.fullName ?? draft.repository;
  const epics = (discussion.drafts ?? []).filter(
    (each) => asDraftKind(each.kind) === "epic" && each.id !== draft.id,
  );
  const moduleOptions = discussion.moduleOptions ?? [];
  const publishing = isPublishing(draft, discussion.drafts ?? [], discussion.status);

  return (
    <article
      aria-label={label}
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-3",
        draft.decision === "discarded" && "opacity-60",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{kindLabel(draft)}</Badge>
        {isUpdate && card !== null && (
          <ExternalLink
            href={card.url}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            {`${card.repository}#${card.number}`}
            <ExternalLinkIcon aria-hidden="true" className="size-3" />
          </ExternalLink>
        )}
        <span className="flex-1" />
        {/* The issue is recorded as soon as it exists, so an outcome and a
            failure of a later step of the same publication stand together. */}
        {draft.outcome !== "" && (
          <span className="flex items-center gap-1.5 text-xs">
            {outcomeLabel(draft)}
            <ExternalLink
              href={draft.url}
              className="underline-offset-4 hover:underline"
            >{`${draft.repository}#${draft.number}`}</ExternalLink>
          </span>
        )}
        {draft.publishError !== "" && (
          <span className="flex items-center gap-1.5 text-xs text-destructive">
            {draft.publishError}
            <Button
              variant="outline"
              size="xs"
              onClick={() => void retryPublish(discussion.id, draft.id)}
            >
              Retry
            </Button>
          </span>
        )}
        {draft.outcome === "" &&
          draft.publishError === "" &&
          (publishing ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
              Publishing…
            </span>
          ) : draft.waits !== "" ? (
            <span className="text-xs text-[var(--status-attention)]">{waitsLabel(draft)}</span>
          ) : (
            isCard &&
            draft.hint !== "" && <span className="text-xs text-muted-foreground">{draft.hint}</span>
          ))}
      </div>

      <Field label="Repository">
        {!readOnly && !isUpdate ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="xs" className="w-full justify-between" />}
              aria-label={`Repository: ${repositoryLabel}`}
            >
              <span className="min-w-0 truncate text-left">{repositoryLabel}</span>
              <ChevronsUpDown aria-hidden="true" className="text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuRadioGroup
                value={draft.repositoryId}
                onValueChange={(id) => void setDraftRepository(discussion.id, draft.id, id)}
              >
                {(discussion.repositories ?? []).map((each) => (
                  <DropdownMenuRadioItem key={each.id} value={each.id}>
                    {each.fullName}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="text-sm">{repositoryLabel}</span>
        )}
        {draft.repositoryId === "" && (
          <span className="text-xs text-[var(--status-attention)]">
            {`${draft.repository} is no longer managed by the board.`}
          </span>
        )}
      </Field>

      {isCard && moduleOptions.length > 0 && (
        <Field label="Module">
          {readOnly ? (
            <span className="text-sm">{draft.module === "" ? "No module" : draft.module}</span>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" size="xs" className="w-full justify-between" />}
                aria-label={`Module: ${draft.module === "" ? "No module" : draft.module}`}
              >
                <span className="min-w-0 truncate text-left">
                  {draft.module === "" ? "No module" : draft.module}
                </span>
                <ChevronsUpDown aria-hidden="true" className="text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuRadioGroup
                  value={draft.module}
                  onValueChange={(name) => void setDraftModule(discussion.id, draft.id, name)}
                >
                  <DropdownMenuRadioItem value="">No module</DropdownMenuRadioItem>
                  {moduleOptions.map((name) => (
                    <DropdownMenuRadioItem key={name} value={name}>
                      {name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {current !== null && current.module !== draft.module && (
            <Current text={current.module === "" ? "none" : current.module} />
          )}
        </Field>
      )}

      {isCard && (
        <Field label="Epic">
          {readOnly ? (
            <span className="text-sm">{epicLabel(draft.epic)}</span>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" size="xs" className="w-full justify-between" />}
                aria-label={`Epic: ${epicLabel(draft.epic)}`}
              >
                <span className="min-w-0 truncate text-left">{epicLabel(draft.epic)}</span>
                <ChevronsUpDown aria-hidden="true" className="text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuRadioGroup
                  value={epicRef(draft.epic)}
                  onValueChange={(ref) => void setDraftEpic(discussion.id, draft.id, ref)}
                >
                  <DropdownMenuRadioItem value="">No epic</DropdownMenuRadioItem>
                  {epics.map((epic) => (
                    <DropdownMenuRadioItem key={epic.id} value={epic.id}>
                      {epic.title === "" ? epic.id : epic.title}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setEpicIssue("")}>
                  Existing issue…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {epicIssue !== null && !readOnly && (
            <Input
              aria-label="Epic issue"
              placeholder="owner/name#N"
              value={epicIssue}
              autoFocus
              onChange={(event) => setEpicIssue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  setEpicIssue(null);
                  return;
                }
                if (event.key !== "Enter") {
                  return;
                }
                event.preventDefault();
                // Enter over nothing asks for no epic: the field goes away.
                if (epicIssue.trim() !== "") {
                  void setDraftEpic(discussion.id, draft.id, epicIssue.trim());
                }
                setEpicIssue(null);
              }}
              className="h-7 text-xs"
            />
          )}
          {current !== null && epicKey(current.epic) !== epicKey(draft.epic) && (
            <Current text={epicLabel(current.epic)} />
          )}
        </Field>
      )}

      <Field label="Title" htmlFor={readOnly ? undefined : titleId}>
        {readOnly ? (
          <span className="text-sm font-medium">{title.value}</span>
        ) : (
          <Input
            id={titleId}
            value={title.value}
            onChange={(event) => title.onChange(event.target.value)}
            onBlur={title.onBlur}
          />
        )}
        {current !== null && current.title !== title.value && <Current text={current.title} />}
      </Field>

      <Field label="Body" htmlFor={readOnly || bodyTab === "changes" ? undefined : bodyId}>
        {isUpdate && (
          <ToggleGroup
            aria-label={`${label} body`}
            size="sm"
            value={[bodyTab]}
            onValueChange={(next: string[]) => {
              const [value] = next;
              if (value === "edit" || value === "changes") {
                setBodyTab(value);
              }
            }}
          >
            <ToggleGroupItem value="edit">Edit</ToggleGroupItem>
            <ToggleGroupItem value="changes">Changes</ToggleGroupItem>
          </ToggleGroup>
        )}
        {isUpdate && bodyTab === "changes" ? (
          <DraftDiff current={current?.body ?? ""} next={body.value} />
        ) : readOnly ? (
          <p className="text-sm whitespace-pre-wrap">{body.value}</p>
        ) : (
          <Textarea
            id={bodyId}
            rows={4}
            value={body.value}
            onChange={(event) => body.onChange(event.target.value)}
            onBlur={body.onBlur}
            className="max-h-72 field-sizing-content text-sm"
          />
        )}
      </Field>

      {isCard && (
        <Field label="Dependencies">
          <DependencyList discussionId={discussion.id} draft={draft} readOnly={readOnly} />
        </Field>
      )}

      {isUpdate && current === null && (
        <p className="text-xs text-[var(--status-attention)]">
          This card isn't in the last reading of the board.
        </p>
      )}
      {refreshing && (
        <p role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
          Refreshing the card…
        </p>
      )}
      {refreshError !== null && (
        <p role="alert" className="text-xs text-[var(--status-attention)]">
          {`Couldn't refresh the card: ${refreshError}. The draft shows the last reading.`}
        </p>
      )}

      {(draft.warnings ?? []).map((warning) => (
        <p key={warning} className="text-xs text-[var(--status-attention)]">
          {warning}
        </p>
      ))}

      {readOnly ? (
        draft.publishedAt !== "" && (
          <span className="text-xs text-muted-foreground">
            {`Published ${formatDate(draft.publishedAt)}`}
          </span>
        )
      ) : (
        <ToggleGroup
          aria-label={`${label} decision`}
          size="sm"
          value={draft.decision === "" ? [] : [draft.decision]}
          onValueChange={(next: string[]) => {
            const [value] = next;
            void decideDraft(
              discussion.id,
              draft.id,
              value === undefined ? "" : asDraftDecision(value),
            );
          }}
        >
          <ToggleGroupItem value="approved">Approve</ToggleGroupItem>
          <ToggleGroupItem value="discarded">Discard</ToggleGroupItem>
        </ToggleGroup>
      )}
    </article>
  );
}
