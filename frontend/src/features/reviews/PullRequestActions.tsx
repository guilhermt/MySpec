import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/system/Button";
import { ItemBlock } from "@/components/system/ItemBlock";
import { ICONS } from "@/components/system/icons";
import { Tooltip } from "@/components/system/Tooltip";
import { type PanelAction, panelReason } from "@/features/reviews/pr-panel";
import { reviewRow, taskRow } from "@/features/sidebar/sidebar-tree";
import { messageOf } from "@/lib/errors";
import { cn } from "@/lib/utils";
import type { PullRequestRow, State } from "@/lib/wails";
import { changeRepositoryPath, cloneRepository } from "@/store/actions";
import { useAppStore } from "@/store/app-store";

export interface PullRequestActionsProps {
  row: PullRequestRow;
  action: PanelAction;
  reference: string;
  app: State;
  now: number;
}

const REASON = "text-(length:--text-meta) leading-(--leading-meta)";

/**
 * PullRequestActions is what the panel of a pull request offers to do with it, by its case, with the
 * reason of the case under it: Start review, the block of its review or of its task, Change path…
 * when the clone is missing, and the clone itself.
 */
export function PullRequestActions({ row, action, reference, app, now }: PullRequestActionsProps) {
  const root = useRef<HTMLDivElement>(null);
  const openStartReview = useAppStore((state) => state.openStartReview);
  const openReview = useAppStore((state) => state.openReview);
  const openTask = useAppStore((state) => state.openTask);
  const setPendingReview = useAppStore((state) => state.setPendingReview);
  const reasonId = `pull-reason-${row.key}`;
  const [failure, setFailure] = useState<string | null>(null);
  // Change path… that worked moves the focus to the Start review the pull request gets.
  const focusAfterPath = useRef(false);
  const reason = panelReason(action);

  useEffect(() => {
    if (focusAfterPath.current && action.kind === "start") {
      focusAfterPath.current = false;
      root.current?.querySelector<HTMLElement>("[data-primary]")?.focus();
    }
  }, [action.kind]);

  const start = () => openStartReview({ repositoryId: row.repositoryId, number: row.number });

  const changePath = async () => {
    setFailure(null);
    try {
      // A cancelled chooser leaves the panel as it was, and the focus where it is.
      focusAfterPath.current = await changeRepositoryPath(row.repositoryId);
    } catch (error) {
      setFailure(messageOf(error));
    }
  };

  const clone = async () => {
    setFailure(null);
    try {
      if (await cloneRepository(row.repositoryId)) {
        setPendingReview({ repositoryId: row.repositoryId, number: row.number });
      }
    } catch (error) {
      setFailure(messageOf(error));
    }
  };

  const common = { variant: "primary", size: "sm", "data-primary": "" } as const;
  const describedBy = reason === null ? {} : { reasonId };
  let control: React.ReactNode = null;
  let block: React.ReactNode = null;
  switch (action.kind) {
    case "start":
    case "start-own":
      control = (
        <Button {...common} shortcut="R" {...describedBy} onClick={start}>
          Start review
        </Button>
      );
      break;
    case "fork":
      control = (
        <Button {...common} disabled {...describedBy}>
          Start review
        </Button>
      );
      break;
    case "clone-missing":
      control = (
        <>
          <Button {...common} disabled {...describedBy}>
            Start review
          </Button>
          <Button size="sm" onClick={() => void changePath()}>
            Change path…
          </Button>
        </>
      );
      break;
    case "clone":
      if (action.state === "cloning") {
        control = (
          <Button
            {...common}
            loading
            loadingLabel={`Cloning ${action.repository}…`}
            {...describedBy}
          />
        );
      } else if (action.state === "failed") {
        control = (
          <Button {...common} shortcut="R" {...describedBy} onClick={() => void clone()}>
            Try the clone again
          </Button>
        );
      } else {
        control = (
          <Tooltip content="Clone, then open the start dialog · R">
            <Button
              {...common}
              icon={ICONS.clone}
              shortcut="R"
              {...describedBy}
              onClick={() => void clone()}
            >
              Clone and continue
            </Button>
          </Tooltip>
        );
      }
      break;
    case "review": {
      const item = reviewRow(action.review, now);
      block = (
        <ItemBlock
          kind={item.itemKind}
          name={`Review of ${reference}`}
          line2={{ tone: item.tone, text: item.line2.long }}
          clock={item.clock}
          openLabel="Open review"
          openText="Open review"
          primary={item.waiting}
          shortcut="R"
          onOpen={() => openReview(action.review.id)}
        />
      );
      break;
    }
    case "task": {
      if (action.task !== null) {
        const item = taskRow(app, action.task, now);
        block = (
          <ItemBlock
            kind={item.itemKind}
            name={item.name}
            line2={{ tone: item.tone, text: item.line2.long }}
            clock={item.clock}
            openLabel="Open task"
            openText="Open task"
            primary={item.waiting}
            shortcut="R"
            onOpen={() => openTask(action.taskId)}
          />
        );
      }
      break;
    }
  }

  // A failed clone says its reason in the error ink, as the message of gh has it.
  const reasonError = action.kind === "clone" && action.state === "failed";
  return (
    <div ref={root} data-panel-actions="" className="flex flex-col gap-(--space-2)">
      {block}
      {control !== null && (
        <div className="flex flex-wrap items-center gap-(--space-2)">{control}</div>
      )}
      {reason !== null && (
        <p
          id={reasonId}
          {...(reasonError ? { role: "alert" } : {})}
          className={cn(REASON, "break-words", reasonError ? "text-state-error" : "text-ink-2")}
        >
          {reason}
        </p>
      )}
      {failure !== null && (
        <p role="alert" className={cn(REASON, "break-words text-state-error")}>
          {failure}
        </p>
      )}
    </div>
  );
}
