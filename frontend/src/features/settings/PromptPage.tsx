import { type ReactElement, useEffect, useId, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/system/Badge";
import { Button } from "@/components/system/Button";
import { ICONS } from "@/components/system/icons";
import { NoticeStrip } from "@/components/system/NoticeStrip";
import { Placeholder } from "@/components/system/Placeholder";
import { Skeleton, SkeletonBar } from "@/components/system/Skeleton";
import { Tooltip } from "@/components/system/Tooltip";
import { Markdown } from "@/features/chat/Markdown";
import {
  editedLabel,
  linesText,
  PLACEHOLDERS,
  promptMeta,
  withPlaceholderCode,
} from "@/features/settings/prompts";
import { ResetPromptDialog } from "@/features/settings/ResetPromptDialog";
import { SettingsPage } from "@/features/settings/SettingsPage";
import type { PromptState } from "@/features/settings/usePrompt";
import type { Prompt, PromptStage } from "@/lib/wails";
import { fullTime } from "@/lib/when";
import { useAppStore } from "@/store/app-store";

export interface PromptPageProps {
  stage: PromptStage;
  state: PromptState;
  /** onRetry reads the prompt again, after a failed reading. */
  onRetry: () => void;
  /** onReset takes the default prompt that came back from the reset. */
  onReset: (prompt: Prompt) => void;
  /** focus is where the focus goes when the page opens: its title, or Edit on the way back from the editor. */
  focus: "title" | "edit";
}

// drawPlaceholder draws the placeholders the product knows and leaves any other code as it is.
function drawPlaceholder(code: string) {
  if (!Object.hasOwn(PLACEHOLDERS, code)) {
    return null;
  }
  return (
    <Tooltip content="Filled when the session starts">
      <span>
        <Placeholder>{code}</Placeholder>
      </span>
    </Tooltip>
  );
}

const LOADING_WIDTHS = ["w-1/2", "w-full", "w-3/4"];

/**
 * PromptPage is one prompt, rendered with its placeholders drawn, and the way into its edit and its
 * reset. While the prompt is read, or when the reading failed, Edit and Reset to default… wait.
 */
export function PromptPage({ stage, state, onRetry, onReset, focus }: PromptPageProps) {
  const { name, description } = promptMeta(stage);
  const startPromptEdit = useAppStore((store) => store.startPromptEdit);
  const setPromptReturn = useAppStore((store) => store.setPromptReturn);
  const selectSettingsSection = useAppStore((store) => store.selectSettingsSection);
  const [resetting, setResetting] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const edit = useRef<HTMLButtonElement>(null);
  const reasonId = useId();
  const prompt = state.status === "ready" ? state.prompt : null;
  const reason =
    state.status === "loading"
      ? "Reading the prompt…"
      : state.status === "failed"
        ? state.message
        : "";
  const text = useMemo(() => (prompt === null ? "" : withPlaceholderCode(prompt.text)), [prompt]);

  // The page opens on its title when it came from the list, and on Edit when it came back from the
  // editor or from a reset; a page that came from the navigation leaves the focus there.
  const focusEdit = useRef(focus === "edit");
  useEffect(() => {
    if (focus === "title" && !document.activeElement?.closest("nav")) {
      title.current?.focus();
    }
  }, [focus]);
  useEffect(() => {
    if (focusEdit.current && prompt !== null) {
      focusEdit.current = false;
      // The dialog gives the focus back to Reset to default…, which is gone by now: Edit takes it after.
      setTimeout(() => edit.current?.focus(), 0);
    }
  }, [prompt]);

  const back = () => {
    setPromptReturn(stage);
    selectSettingsSection("prompts");
  };

  const reset = (next: Prompt) => {
    focusEdit.current = true;
    onReset(next);
  };

  // While the prompt is read, or when the reading failed, both actions wait, with the reason.
  const waiting = prompt === null;
  const held = (button: ReactElement) =>
    waiting ? <Tooltip content={reason}>{button}</Tooltip> : button;
  const actions = (
    <div className="flex shrink-0 items-center gap-(--space-1-5)">
      {held(
        <Button
          ref={edit}
          variant="secondary"
          size="sm"
          {...(waiting ? { disabled: true, reasonId } : {})}
          onClick={() => prompt !== null && startPromptEdit(stage, prompt.text)}
        >
          Edit
        </Button>,
      )}
      {(waiting || prompt.modified) &&
        held(
          <Button
            variant="ghost"
            size="sm"
            {...(waiting ? { disabled: true, reasonId } : {})}
            onClick={() => setResetting(true)}
          >
            Reset to default…
          </Button>,
        )}
    </div>
  );

  return (
    <div className="flex min-w-0 flex-col gap-(--space-4)">
      <div>
        <Button variant="ghost" size="xs" icon={ICONS.back} onClick={back}>
          Prompts
        </Button>
      </div>
      <SettingsPage
        title={name}
        sentence={
          prompt?.modified === true
            ? `${description} ${linesText(prompt.lines, prompt.defaultLines)}`
            : description
        }
        action={actions}
        titleRef={title}
        {...(prompt?.modified === true
          ? {
              badge: (
                <Tooltip content={fullTime(prompt.editedAt)}>
                  <span>
                    <Badge variant="edited">{editedLabel(prompt.editedAt, Date.now())}</Badge>
                  </span>
                </Tooltip>
              ),
            }
          : {})}
      >
        {waiting && (
          <span id={reasonId} className="sr-only">
            {reason}
          </span>
        )}
        {state.status === "loading" && (
          <Skeleton label="Reading the prompt…">
            {LOADING_WIDTHS.map((width) => (
              <SkeletonBar key={width} className={width} />
            ))}
          </Skeleton>
        )}
        {state.status === "failed" && (
          <NoticeStrip
            role="alert"
            title={`Couldn't read the ${name} prompt`}
            reason={state.message}
            action={
              <Button variant="ghost" size="sm" onClick={onRetry}>
                Try again
              </Button>
            }
          />
        )}
        {prompt !== null && (
          <div className="flex flex-col gap-(--space-3)">
            <div className="rounded-md px-(--space-6) py-(--space-5) shadow-[inset_0_0_0_var(--border)_var(--line-1)] select-text">
              <Markdown className="ui-headings" renderInlineCode={drawPlaceholder}>
                {text}
              </Markdown>
            </div>
            <p className="text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
              MySpec fills the placeholders when a session starts. A session that is running keeps
              the prompt it started with.
            </p>
          </div>
        )}
      </SettingsPage>
      <ResetPromptDialog
        stage={stage}
        open={resetting}
        onOpenChange={setResetting}
        onReset={reset}
      />
    </div>
  );
}
