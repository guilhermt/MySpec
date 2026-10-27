import { useState } from "react";
import { Badge } from "@/components/system/Badge";
import { Button } from "@/components/system/Button";
import { Icon } from "@/components/system/Icon";
import { ICONS } from "@/components/system/icons";
import { Link } from "@/components/system/Link";
import { ListPanel } from "@/components/system/ListPanel";
import { NoticeStrip } from "@/components/system/NoticeStrip";
import { PanelRow } from "@/components/system/PanelRow";
import { PanelSection } from "@/components/system/PanelSection";
import { StateGlyph } from "@/components/system/StateGlyph";
import { SunkenLine } from "@/components/system/SunkenLine";
import { useArrivedLater } from "@/components/system/useArrivedLater";
import { actionModel, type PanelRunLine, panelModel } from "@/features/deploys/deploy-panel";
import { cn } from "@/lib/utils";
import type { DeployEnvironment, DeployRepository } from "@/lib/wails";
import { deployInPlace, mergeInPlace, openExternal } from "@/store/actions";
import { useAppStore } from "@/store/app-store";

export interface DeployPanelProps {
  repo: DeployRepository;
  env: DeployEnvironment;
  now: number;
  onClose: () => void;
}

const META = "text-(length:--text-meta) leading-(--leading-meta)";

/** RunLine is a run: its glyph, its word and what is said of its time. */
function RunLine({ line }: { line: PanelRunLine }) {
  return (
    <div className={cn(META, "flex items-center gap-(--space-2) text-ink-2")}>
      {line.glyph === "done" ? (
        <Icon icon={ICONS.done} size="sm" className="text-ink-4" />
      ) : (
        <StateGlyph state={line.glyph} size="sm" />
      )}
      <span
        className={cn("font-medium", line.glyph === "error" ? "text-state-error" : "text-ink-1")}
      >
        {line.word}
      </span>
      {line.detail !== "" && <span className="text-ink-3">{line.detail}</span>}
    </div>
  );
}

/**
 * DeployPanel is the environment open in the matrix: what waits to be promoted and the pull requests
 * in it, the deploy pull request, the run, and the action that moves the code on. Never the commits.
 */
export function DeployPanel({ repo, env, now, onClose }: DeployPanelProps) {
  const go = useAppStore((state) => state.go);
  const model = panelModel(repo, env, now);
  const action = actionModel(env);
  // The refusal of a call that Go answers at once; the failure of GitHub arrives as the action.
  const [refusal, setRefusal] = useState<string | null>(null);
  const failure = refusal ?? action?.failure ?? null;
  const failureArrived = useArrivedLater(failure !== null);
  const problemArrived = useArrivedLater(model.problem !== null);
  const readArrived = useArrivedLater(model.readFailure !== null);

  const act = async () => {
    if (action === null) {
      return;
    }
    setRefusal(null);
    const message =
      action.kind === "merge"
        ? await mergeInPlace(repo.id, env.position)
        : await deployInPlace(repo.id, env.position);
    setRefusal(message);
  };
  const open = (url: string) => void openExternal(url);
  const { run } = model;

  return (
    <ListPanel
      label={model.head.label}
      number={model.head.number}
      repository={model.head.repository}
      url={model.head.url}
      onOpenExternal={(url) => {
        if (url !== "") {
          open(url);
        }
      }}
      onClose={onClose}
      scrollKey={`${repo.id}:${env.position}`}
      openShortcut="O"
    >
      <div className="flex flex-col gap-(--space-4) px-(--space-4) pt-(--space-3) pb-(--space-6)">
        {model.problem !== null && (
          <NoticeStrip
            title={model.problem.text}
            role={problemArrived ? "alert" : undefined}
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => go({ kind: "settings", section: "boards" })}
              >
                Edit the deploys in Settings…
              </Button>
            }
          />
        )}
        {model.readFailure !== null && (
          <NoticeStrip
            title={model.readFailure.title}
            reason={model.readFailure.reason}
            role={readArrived ? "alert" : undefined}
          />
        )}
        <h2 className="text-(length:--text-title) leading-(--leading-title) font-semibold text-ink-1">
          {model.title}
        </h2>
        {action !== null && (
          <div data-panel-actions="" className="flex flex-col gap-(--space-2)">
            <div className="flex flex-wrap items-center gap-(--space-2)">
              {action.busy !== null ? (
                <Button
                  variant="primary"
                  size="sm"
                  data-primary=""
                  loading
                  loadingLabel={action.busy}
                />
              ) : action.disabledReason !== null ? (
                <Button
                  variant="primary"
                  size="sm"
                  data-primary=""
                  disabled
                  disabledReason={action.disabledReason}
                  shortcut={action.shortcut}
                >
                  {action.label}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  data-primary=""
                  shortcut={action.shortcut}
                  onClick={() => void act()}
                >
                  {action.label}
                </Button>
              )}
            </div>
            {failure !== null && (
              <p
                {...(failureArrived ? { role: "alert" } : {})}
                className={cn(META, "break-words text-state-error")}
              >
                {failure}
              </p>
            )}
            {action.warning !== null && <SunkenLine icon="blocked">{action.warning}</SunkenLine>}
            {action.draftNote !== null && (
              <p className={cn(META, "text-ink-3")}>{action.draftNote}</p>
            )}
          </div>
        )}
        {model.changes !== null && (
          <PanelSection legend="Changes">
            <p className={cn(META, "text-ink-1")}>{model.changes.summary}</p>
            {model.changes.partial !== null && (
              <p className={cn(META, "text-ink-3")}>{model.changes.partial}</p>
            )}
          </PanelSection>
        )}
        {model.pullRequests !== null && (
          <PanelSection legend="Pull requests">
            {model.pullRequests.length === 0 ? (
              <p className={cn(META, "text-ink-3")}>No pull requests in this deploy.</p>
            ) : (
              model.pullRequests.map((pull) => (
                <PanelRow
                  key={pull.number}
                  glyph={<Icon icon={ICONS.pullRequest} size="sm" />}
                  meta={pull.author}
                  label={`Open pull request #${pull.number} ${pull.title} on GitHub`}
                  onClick={() => open(pull.url)}
                >
                  {`#${pull.number} ${pull.title}`}
                </PanelRow>
              ))
            )}
          </PanelSection>
        )}
        {model.deployPr !== null && (
          <PanelSection legend="Deploy pull request">
            <div className={cn(META, "flex flex-wrap items-center gap-(--space-2) text-ink-1")}>
              <span>{`#${model.deployPr.number} ${model.deployPr.title}`}</span>
              {model.deployPr.draft && <Badge>Draft</Badge>}
              <span className="text-ink-3">{model.deployPr.age}</span>
            </div>
            {model.deployPr.others !== null && (
              <p className={cn(META, "text-ink-3")}>{model.deployPr.others}</p>
            )}
          </PanelSection>
        )}
        <PanelSection legend="Deploy run">
          {run.last === null ? (
            <p className={cn(META, "text-ink-3")}>No deploy run yet.</p>
          ) : (
            <RunLine line={run.last} />
          )}
          {run.failed !== null && <RunLine line={run.failed} />}
          <p className={cn(META, "pt-(--space-1) text-ink-3")}>
            {"Workflow: "}
            {run.workflow.url === "" ? (
              run.workflow.name
            ) : (
              <Link
                href={run.workflow.url}
                external
                onClick={(event) => {
                  event.preventDefault();
                  open(run.workflow.url);
                }}
              >
                {run.workflow.name}
              </Link>
            )}
          </p>
        </PanelSection>
        {model.links.length > 0 && (
          <PanelSection legend="On GitHub">
            {model.links.map((link) => (
              <PanelRow
                key={link.label}
                glyph={<Icon icon={ICONS.external} size="sm" />}
                onClick={() => open(link.url)}
              >
                {link.label}
              </PanelRow>
            ))}
          </PanelSection>
        )}
      </div>
    </ListPanel>
  );
}
