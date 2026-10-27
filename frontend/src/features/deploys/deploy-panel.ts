import { keyNotice } from "@/features/deploys/deploy-matrix";
import {
  asDeployActionKind,
  asDeployAvailable,
  asDeployHealth,
  asDeployPhase,
  asDeployProblem,
  asDeployRunStatus,
  type DeployEnvironment,
  type DeployRepository,
  type DeployRun,
} from "@/lib/wails";
import { age, ageLong, duration, readMoment } from "@/lib/when";

/** PanelProblem is the strip of an environment that cannot be read: its branch or its workflow is gone. */
export interface PanelProblem {
  text: string;
}

/** PanelPullRequest is a pull request that goes in the deploy. */
export interface PanelPullRequest {
  number: number;
  title: string;
  url: string;
  author: string;
}

/** PanelChanges is the section Changes: what waits to be promoted, and the limit of the reading. */
export interface PanelChanges {
  summary: string;
  /** partial is said when more commits wait than a reading reads. */
  partial: string | null;
}

/** PanelPullRequestDeploy is the deploy pull request that is open, if one is. */
export interface PanelDeployPr {
  number: number;
  title: string;
  url: string;
  draft: boolean;
  age: string;
  /** others is said when more than one deploy pull request is open. */
  others: string | null;
}

/** PanelRunLine is a run as the section Deploy run tells it. */
export interface PanelRunLine {
  glyph: "done" | "error" | "github";
  word: string;
  detail: string;
}

/** PanelRun is the section Deploy run: the last run, the failed one when it is another, and the workflow. */
export interface PanelRun {
  last: PanelRunLine | null;
  failed: PanelRunLine | null;
  workflow: { name: string; url: string };
}

/** PanelLink is a destination of the section On GitHub. */
export interface PanelLink {
  label: string;
  url: string;
}

/** PanelModel is everything the panel of an environment draws, but its action. */
export interface PanelModel {
  /** first is the first environment: it has no promotion, so no action, changes or pull requests. */
  first: boolean;
  /** head is the strip of the panel: the accessible label, the reference, the repository and the way to GitHub. */
  head: { label: string; number: string; repository: string; url: string };
  problem: PanelProblem | null;
  /** readFailure is the line of a repository whose reading failed: the panel shows the reading before. */
  readFailure: { title: string; reason: string } | null;
  title: string;
  changes: PanelChanges | null;
  pullRequests: readonly PanelPullRequest[] | null;
  deployPr: PanelDeployPr | null;
  run: PanelRun;
  links: PanelLink[];
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function problemOf(env: DeployEnvironment): PanelProblem | null {
  switch (asDeployProblem(env.problem)) {
    case "branch_missing":
      return { text: `Branch ${env.branch} doesn't exist on GitHub.` };
    case "workflow_missing":
      return { text: `The workflow ${env.workflowName} no longer exists.` };
    default:
      return null;
  }
}

/** runLine is a run told by its status: how long it ran, or has been running, and when it started. */
function runLine(run: DeployRun, now: number): PanelRunLine {
  const status = asDeployRunStatus(run.status);
  const started = Date.parse(run.startedAt);
  const startedAt = Number.isNaN(started) ? "" : readMoment(run.startedAt, now);
  if (status === "queued") {
    return { glyph: "github", word: "Queued", detail: "Waiting to start" };
  }
  if (status === "running") {
    const length = Number.isNaN(started) ? "" : duration(now - started);
    return {
      glyph: "github",
      word: "Running",
      detail: length === "" ? "" : `Running for ${length}`,
    };
  }
  const ended = Date.parse(run.endedAt);
  const length = Number.isNaN(started) || Number.isNaN(ended) ? "" : duration(ended - started);
  const detail = [startedAt === "" ? "" : `Started ${startedAt}`, length]
    .filter(Boolean)
    .join(" · ");
  return {
    glyph: status === "failed" ? "error" : "done",
    word: status === "failed" ? "Failed" : "Succeeded",
    detail,
  };
}

function runOf(env: DeployEnvironment, now: number): PanelRun {
  const failed =
    env.failedRun === null
      ? null
      : {
          glyph: "error" as const,
          word: "Failed",
          detail: age(env.failedRun.endedAt, now),
        };
  return {
    last: env.lastRun === null ? null : runLine(env.lastRun, now),
    failed,
    workflow: { name: env.workflowName, url: env.workflowUrl },
  };
}

/** COMPARE_LIMIT is how many commits a reading compares, as the Go side reads them. */
const COMPARE_LIMIT = 100;

/** changesOf is the section Changes of an environment that has a previous one. */
function changesOf(env: DeployEnvironment, now: number): PanelChanges {
  const promotion = env.promotion;
  if (promotion === null || promotion.commits === 0) {
    return { summary: "Nothing to deploy.", partial: null };
  }
  const waiting = promotion.pendingSince;
  const since = waiting === "" ? "" : ageLong(waiting, now).replace(/ ago$/, "");
  const commits = plural(promotion.commits, "commit");
  return {
    summary:
      since === ""
        ? commits
        : `${commits} · waiting for ${since === "just now" ? "under a minute" : since}`,
    partial: promotion.partial
      ? `Showing the pull requests of the first ${COMPARE_LIMIT} of ${promotion.ahead} commits.`
      : null,
  };
}

function deployPrOf(env: DeployEnvironment, now: number): PanelDeployPr | null {
  const pr = env.promotion?.deployPr;
  if (pr === null || pr === undefined) {
    return null;
  }
  const others = env.promotion?.otherDeployPrs ?? 0;
  return {
    number: pr.number,
    title: pr.title,
    url: pr.url,
    draft: pr.draft,
    age: age(pr.createdAt, now),
    others:
      others > 0
        ? `${others} more deploy pull request${others === 1 ? " is" : "s are"} open.`
        : null,
  };
}

/** panelModel is what the panel of an environment shows of it. */
export function panelModel(
  repo: DeployRepository,
  env: DeployEnvironment,
  now: number,
): PanelModel {
  const first = env.position === 0;
  const pr = env.promotion?.deployPr ?? null;
  const run = env.lastRun ?? env.failedRun;
  const links: PanelLink[] = [];
  if (pr !== null) {
    links.push({ label: "Open the deploy pull request", url: pr.url });
  }
  if (run !== null && run.url !== "") {
    links.push({ label: "Open the run", url: run.url });
  }
  if (!first && env.compareUrl !== "") {
    links.push({ label: `Compare ${env.branch}...${env.previousBranch}`, url: env.compareUrl });
  }
  const url = first ? (run?.url ?? "") : (pr?.url ?? env.compareUrl);
  const since = repo.failure === null ? "" : age(repo.failure.failedAt, now);
  return {
    first,
    head: {
      label: first ? `${repo.name} · ${env.name}` : `Deploy ${repo.name} to ${env.name}`,
      number: first ? env.name : `${env.previousName} → ${env.name}`,
      repository: repo.fullName,
      url,
    },
    problem: problemOf(env),
    readFailure:
      repo.failure === null
        ? null
        : {
            title: `Couldn't read ${repo.name}${since === "" ? "" : ` · ${since}`}`,
            reason: repo.failure.message,
          },
    title: first ? env.name : `Deploy to ${env.name}`,
    changes: first ? null : changesOf(env, now),
    pullRequests: first ? null : (env.promotion?.pullRequests ?? []).slice(),
    deployPr: first ? null : deployPrOf(env, now),
    run: runOf(env, now),
    links,
  };
}

/** ActionModel is the action of the moment of an environment: the button, why it waits, or how it failed. */
export interface ActionModel {
  kind: "deploy" | "merge";
  label: string;
  /** shortcut is the key that does the action from the panel and from the matrix. */
  shortcut: "D";
  /** busy is the loading label of the button while the app acts; null when it does not. */
  busy: string | null;
  /** disabledReason is why there is no action now; null when there is one. */
  disabledReason: string | null;
  /** failure is what GitHub said when the last action failed; null when it did not. */
  failure: string | null;
  /** warning is about the environment before this one; it comes with an action that is available. */
  warning: string | null;
  /** draftNote is said of a pull request ready to merge that is still a draft. */
  draftNote: string | null;
}

function busyLabel(env: DeployEnvironment): string | null {
  switch (asDeployPhase(env.action?.phase ?? "")) {
    case "creating":
      return "Creating the pull request…";
    case "merging":
      return "Merging…";
    case "waiting_run":
      return "Waiting for the run…";
    case "running":
      return "Deploying…";
    default:
      return null;
  }
}

/**
 * actionModel is what the panel offers to do with an environment: null for the first, which receives
 * the pull requests of the tasks. Without an action available it says why, with the text D shows.
 */
export function actionModel(env: DeployEnvironment): ActionModel | null {
  if (env.position === 0) {
    return null;
  }
  const available = asDeployAvailable(env.available);
  const kind = available === "merge" || (available === "" && env.prReady) ? "merge" : "deploy";
  const health = asDeployHealth(env.previous);
  let warning: string | null = null;
  if (available !== "") {
    if (health === "failed") {
      warning = `${env.previousName}'s last deploy failed`;
    } else if (health === "deploying") {
      warning = `${env.previousName} is still deploying`;
    }
  }
  const action = env.action;
  return {
    kind,
    label: kind === "merge" ? "Merge" : `Deploy to ${env.name}`,
    shortcut: "D",
    busy: busyLabel(env),
    disabledReason: keyNotice(env),
    failure:
      action !== null && asDeployPhase(action.phase) === "failed"
        ? action.failure === ""
          ? `Couldn't ${asDeployActionKind(action.kind) === "merge" ? "merge" : "create the pull request"}.`
          : action.failure
        : null,
    warning,
    draftNote:
      kind === "merge" && env.promotion?.deployPr?.draft === true
        ? "This pull request is a draft. GitHub may refuse to merge it."
        : null,
  };
}
