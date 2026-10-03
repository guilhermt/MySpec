import * as AttentionService from "@bindings/attentionservice";
import * as BoardService from "@bindings/boardservice";
import * as DiscussionService from "@bindings/discussionservice";
import type {
  ActionEntry,
  ActionOutput,
  ArchivedDiscussion,
  ArchivedPR,
  ArchivedReview,
  ArchivedStep,
  ArchivedTask,
  AssistantEntry,
  Board,
  BoardCard,
  BoardFailure,
  BoardPreview,
  BoardRemoval,
  BoardRepositoryChoice,
  BoardRepositoryOption,
  BoardStatus,
  BranchPreview,
  CardAssignee,
  CardDependency,
  CardField,
  CardIssue,
  CardPullRequest,
  CardRelated,
  CatalogModel,
  CloseResult,
  CloseStep,
  CreateTaskCard,
  CreateTaskRequest,
  DeletePreview,
  DeleteResult,
  DiscussionCard,
  DiscussionContextRequest,
  DiscussionRepository,
  DiscussionSummary,
  Draft,
  DraftBefore,
  DraftCurrent,
  DraftDependency,
  DraftHold,
  DraftRef,
  Entry,
  ErrorEntry,
  Leftover,
  Machine,
  MarkerCommit,
  MarkerEntry,
  Migration,
  MigrationCase,
  MigrationTask,
  ModelCatalog,
  PermissionEntry,
  Place,
  PlanProblem,
  PRBlock,
  PRCheck,
  PRDraft,
  PRPreview,
  PRReport,
  PRTrouble,
  Prompt,
  PromptListing,
  PullCard,
  PullLabel,
  PullRequest,
  PullRequestRow,
  PullReview,
  PullsFailure,
  Question,
  QuestionEntry,
  QuestionOption,
  Repository,
  RepositoryCandidate,
  Review,
  ReviewCenter,
  ReviewFile,
  ReviewFilters,
  ReviewFinding,
  ReviewPass,
  ReviewSummary,
  SaveBoardRequest,
  Situation,
  SituationOpen,
  SituationStarted,
  StageModel,
  StartDiscussionRequest,
  StartReviewRequest,
  Startup,
  StartupFailure,
  StartupStep,
  State,
  Step,
  StepBlock,
  StepReport,
  StepReviewer,
  TaskCard,
  TaskConversation,
  TaskStageModel,
  TaskSummary,
  Transcript,
  TranscriptEvent,
  UserEntry,
  WorktreePreview,
  WritingDiscussion,
} from "@bindings/models";
import * as RepositoryService from "@bindings/repositoryservice";
import * as ReviewService from "@bindings/reviewservice";
import * as SettingsService from "@bindings/settingsservice";
import * as StartupService from "@bindings/startupservice";
import * as StateService from "@bindings/stateservice";
import * as TaskService from "@bindings/taskservice";
import { Browser, Events } from "@wailsio/runtime";

export type {
  ActionEntry,
  ActionOutput,
  ArchivedDiscussion,
  ArchivedPR,
  ArchivedReview,
  ArchivedStep,
  ArchivedTask,
  AssistantEntry,
  Board,
  BoardCard,
  BoardFailure,
  BoardPreview,
  BoardRemoval,
  BoardRepositoryChoice,
  BoardRepositoryOption,
  BoardStatus,
  BranchPreview,
  CardAssignee,
  CardDependency,
  CardField,
  CardIssue,
  CardPullRequest,
  CardRelated,
  CatalogModel,
  CloseResult,
  CloseStep,
  CreateTaskCard,
  CreateTaskRequest,
  DeletePreview,
  DeleteResult,
  DiscussionCard,
  DiscussionContextRequest,
  DiscussionRepository,
  DiscussionSummary,
  Draft,
  DraftBefore,
  DraftCurrent,
  DraftDependency,
  DraftHold,
  DraftRef,
  Entry,
  ErrorEntry,
  Leftover,
  Machine,
  MarkerCommit,
  MarkerEntry,
  Migration,
  MigrationCase,
  MigrationTask,
  ModelCatalog,
  PermissionEntry,
  Place,
  PlanProblem,
  PRBlock,
  PRCheck,
  PRDraft,
  PRPreview,
  PRReport,
  PRTrouble,
  Prompt,
  PromptListing,
  PullCard,
  PullLabel,
  PullRequest,
  PullRequestRow,
  PullReview,
  PullsFailure,
  Question,
  QuestionEntry,
  QuestionOption,
  Repository,
  RepositoryCandidate,
  Review,
  ReviewCenter,
  ReviewFile,
  ReviewFilters,
  ReviewFinding,
  ReviewPass,
  ReviewSummary,
  SaveBoardRequest,
  Situation,
  SituationOpen,
  SituationStarted,
  StageModel,
  StartDiscussionRequest,
  StartReviewRequest,
  Startup,
  StartupFailure,
  StartupStep,
  State,
  Step,
  StepBlock,
  StepReport,
  StepReviewer,
  TaskCard,
  TaskConversation,
  TaskStageModel,
  TaskSummary,
  Transcript,
  TranscriptEvent,
  UserEntry,
  WorktreePreview,
  WritingDiscussion,
};

export type ThemePreference = "system" | "light" | "dark";
/** TaskMode is how a task is conducted: the structured flow, or One-Shot. */
export type TaskMode = "structured" | "one_shot";
export type TaskStage = "prd" | "tech_spec" | "plan" | "one_shot" | "implementation" | "pr";

/** ModelStage is a stage that carries a model and an effort of its own. */
export type ModelStage =
  | "prd"
  | "tech_spec"
  | "plan"
  | "one_shot"
  | "implementation"
  | "step_review"
  | "pr"
  | "pr_review"
  | "discussion";

/** CatalogFailure is why the app has no catalog of models: "" when it has one or is still reading. */
export type CatalogFailure = "" | "not_found" | "unsupported" | "failed";

/** PromptStage names one of the prompts the settings show, in workflow order. */
export type PromptStage =
  | "prd"
  | "tech_spec"
  | "plan"
  | "one_shot"
  | "step_review"
  | "commit"
  | "pr"
  | "pr_review"
  | "discussion";

export type StepStatus =
  | "not_started"
  | "preparing"
  | "blocked"
  | "implementing"
  | "agent_review"
  | "addressing_review"
  | "awaiting_review"
  | "in_review"
  | "ready_to_approve"
  | "nothing_to_commit"
  | "review_failed"
  | "committing"
  | "done";
/** PRStatus is where the pull request of a task stands in the PR stage. */
export type PRStatus =
  | "preparing"
  | "blocked"
  | "drafting"
  | "draft_ready"
  | "awaiting_reply"
  | "opening"
  | "reviewing"
  | "waiting_checks"
  | "awaiting_decision"
  | "in_review"
  | "ready_to_approve"
  | "committing"
  | "done"
  | "trouble"
  | "merged"
  | "pr_closed"
  | "closing"
  | "closed";

/** CloseOutcome is what became of one part of the closing of a task. */
export type CloseOutcome = "done" | "skipped" | "failed";

/** CloseSkipReason is why one part of the closing was left alone. */
export type CloseSkipReason =
  | "missing"
  | "not_merged"
  | "not_checked_out"
  | "dirty"
  | "no_upstream"
  | "diverged"
  | "up_to_date";

/** PRBlockReason is why the PR stage of a task cannot go on. */
export type PRBlockReason =
  | "gh_missing"
  | "gh_unauthenticated"
  | "gh_failed"
  | "git_failed"
  | "no_worktree";

/** PRState is what GitHub last said about a pull request; "" before it is read. */
export type PRState = "open" | "merged" | "closed" | "";
/** CheckState is where a check of a pull request stands at the last reading. */
export type CheckState = "passed" | "skipped" | "neutral" | "failed" | "running" | "queued";
export type ReviewFileKind = "added" | "modified" | "deleted" | "renamed" | "untracked";
export type BlockReason =
  | "dirty_worktree"
  | "fetch_failed"
  | "no_base_branch"
  | "path_exists"
  | "branch_exists"
  | "git_failed"
  | "clone_missing";
export type SessionStatus =
  | "working"
  | "waiting"
  | "needs_permission"
  | "needs_answer"
  | "paused"
  | "error";
export type EntryKind =
  | "user"
  | "assistant"
  | "action"
  | "permission"
  | "question"
  | "marker"
  | "error";
export type ActionStatus = "running" | "done" | "error" | "interrupted";
export type PermissionStatus = "pending" | "allowed" | "allowed_session" | "denied" | "cancelled";
export type MarkerType =
  | "prd_written"
  | "prd_updated"
  | "tech_spec_written"
  | "tech_spec_updated"
  | "plan_written"
  | "plan_updated"
  | "one_shot_written"
  | "one_shot_updated"
  | "pr_review_written"
  | "pr_review_revised"
  | "findings_decided"
  | "review_published"
  | "new_commits"
  | "step_review_started"
  | "step_review_written"
  | "review_started"
  | "discussion_started"
  | "discussion_document"
  | "drafts_written"
  | "drafts_revised"
  | "drafts_unreadable"
  | "drafts_published"
  | "stage_started"
  | "step_started"
  | "compacted"
  | "interrupted"
  | "retried"
  | "committed"
  | "pr_opened"
  | "checks_read"
  | "draft_approved"
  | "changes_approved"
  | "paused"
  | "plan_invalid";
/** AppKind is which message of the workflow the app sent; "" for any other message. */
export type AppKind =
  | ""
  | "report"
  | "pass"
  | "commit"
  | "commit_all"
  | "commit_push"
  | "correction"
  | "open"
  | "pr_pass"
  | "apply";
/** InterruptedBy is who cut a text, an action or a turn short; "" when nobody did. */
export type InterruptedBy = "" | "user" | "crash";
/** RetryReason is why an API call the CLI retries failed; "" without a retry. */
export type RetryReason = "" | "overloaded" | "rate_limit" | "server" | "connection" | "other";
export type ErrorKind =
  | "process_exit"
  | "start_failed"
  | "not_found"
  | "not_logged_in"
  | "turn_error";
export type PermissionDecision = "allow" | "allow_session" | "deny";
export type TranscriptEventKind = "entry" | "text" | "remove" | "reset";

/** SituationKind is what a situation asks of the user. */
export type SituationKind =
  | "session_error"
  | "step_blocked"
  | "worktree_unreadable"
  | "pr_blocked"
  | "plan_invalid"
  | "pr_closed"
  | "permission"
  | "question"
  | "reply"
  | "ready_to_continue"
  | "step_review"
  | "step_empty"
  | "draft"
  | "findings"
  | "changes_review"
  | "merge"
  | "review_report"
  | "new_commits"
  | "pr_trouble"
  | "drafts"
  | "epic_cant_publish"
  | "epic_discarded"
  | "ready_to_archive"
  | "publish_failed"
  | "pass_blocked";

/** SituationGroup is how urgent a situation is, from the most urgent. */
export type SituationGroup = "error" | "waiting" | "closing";

/** SituationForm is the shape of the kinds that have more than one. */
export type SituationForm =
  | ""
  | "review"
  | "staged"
  | "approve"
  | "merge"
  | "close"
  | "decide"
  | "publish"
  | "apply"
  | "checks"
  | "conflict"
  | "checks_conflict";

/** PlaceKind is the part of an item a situation is in: of a task, or a review or a discussion of its own. */
export type PlaceKind = "stage" | "step" | "step_review" | "pr" | "review" | "discussion";

/** ReviewMode is who reviews the steps: the user, or an agent. */
export type ReviewMode = "manual" | "agent";

/** ReviewFallback is why a step that started under the agent review is reviewed by the user; "" while its mode holds. */
export type ReviewFallback = "" | "taken_over" | "rounds_exhausted" | "commit_failed";

/** MigrationCaseKind is what kept a task from being carried over by the migration. */
export type MigrationCaseKind = "root_task" | "no_origin" | "name_conflict";

/** CardAction is what Start task does for a card. */
export type CardAction =
  | "start"
  | "clone"
  | "clone_missing"
  | "add_to_board"
  | "other_board"
  | "has_task"
  | "closed";

/** BoardFailureReason is why the last reading of a board failed. */
export type BoardFailureReason =
  | "gh_missing"
  | "gh_unauthenticated"
  | "missing_scope"
  | "not_found"
  | "rate_limited"
  | "failed";

/** RepositoryLinkKind is how a repository of a board ties to the app. */
export type RepositoryLinkKind = "registered" | "clone" | "uncloned" | "other_board";

/** IssueState is whether an issue is open or closed. */
export type IssueState = "open" | "closed";

/** PullRequestState is what GitHub says of a pull request linked to an issue. */
export type PullRequestState = "open" | "merged" | "closed";

/** PullReviewMode is what a review of a pull request does with the findings the user approves: publish them, or fix them. */
export type PullReviewMode = "publish" | "apply";

/** PullReviewStatus is where a review of a pull request stands. */
export type PullReviewStatus =
  | "reviewing"
  | "waiting_checks"
  | "pass_blocked"
  | "awaiting_reply"
  | "awaiting_decision"
  | "ready_to_publish"
  | "publish_failed"
  | "published"
  | "new_commits"
  | "ready_to_apply"
  | "applying"
  | "in_review"
  | "ready_to_approve"
  | "committing"
  | "ready_to_merge"
  | "trouble";

/** ReviewVerdict is what a published review says of the pull request. */
export type ReviewVerdict = "approve" | "request_changes" | "comment";

/** FindingDecision is what the user decided about a finding; "" while they have not. */
export type FindingDecision = "" | "approved" | "discarded";

/** FindingPlacement is where a finding went when its pass was published; "" when it was not published. */
export type FindingPlacement = "" | "inline" | "body";

/** PullRequestAction is what the Reviews view offers for one pull request. */
export type PullRequestAction =
  | "review"
  | "open_review"
  | "open_task"
  | "clone"
  | "clone_missing"
  | "fork";

/** YourReviewState is the state of the last review the account of gh submitted on a pull request. */
export type YourReviewState = "approved" | "changes_requested" | "commented" | "dismissed";

/** Mergeable is whether GitHub says the branch of a pull request merges clean into its base; "" while unread. */
export type Mergeable = "mergeable" | "conflicting" | "unknown" | "";

/** PullRequestOutcome is what became of the pull request of an archived review. */
export type PullRequestOutcome = "merged" | "closed";

/** DiscussionStatus is where a discussion of a demand of a board stands. */
export type DiscussionStatus =
  | "discussing"
  | "awaiting_drafts"
  | "deciding"
  | "publishing"
  | "publish_failed"
  | "epic_discarded"
  | "epic_cant_publish"
  | "ready_to_archive";

/** DraftKind is what a draft does on GitHub: a new card, an update of one, or an epic over them. */
export type DraftKind = "new" | "update" | "epic";

/** DraftSource is who the draft came from: the agent, or the user. */
export type DraftSource = "agent" | "user";

/** DraftDecision is what the user decided about a draft; "" while they have not. */
export type DraftDecision = "" | "approved" | "discarded";

/** DraftOutcome is what the publication of a draft did on GitHub; "" when it published nothing. */
export type DraftOutcome = "" | "created" | "updated";

/** DependencyDrop is why a dependency of a draft went nowhere; "" while it holds. */
export type DependencyDrop = "" | "discarded" | "unavailable";

/** HoldReason is what keeps an approved draft out of the next publication; "" when nothing does. */
export type HoldReason = "" | "epic_discarded" | "cards" | "epic_short" | "epic" | "draft";

/** REVIEW_STAGE is the stage of the conversation of a review: a review has one. */
export const REVIEW_STAGE = "review";

/** DISCUSSION_STAGE is the stage of the conversation of a discussion: a discussion has one. */
export const DISCUSSION_STAGE = "discussion";

/** sessionKey identifies one conversation: a task and the stage it belongs to. */
export function sessionKey(taskId: string, stage: string): string {
  return `${taskId}|${stage}`;
}

export function asThemePreference(value: string): ThemePreference {
  switch (value) {
    case "light":
    case "dark":
    case "system":
      return value;
    default:
      return "system";
  }
}

/** StartupPhase is where the startup of the app stands. */
export type StartupPhase = "starting" | "failed" | "ready";
/** StartupStepId is a step that holds the first screen. */
export type StartupStepId = "data" | "clones";
export type StartupStepState = "todo" | "running" | "done";
/** StartupCase is why the startup failed. */
export type StartupCase = "permission" | "disk_full" | "other";

export function asStartupPhase(value: string): StartupPhase {
  switch (value) {
    case "starting":
    case "failed":
    case "ready":
      return value;
    default:
      return "starting";
  }
}

export function asStartupStepId(value: string): StartupStepId {
  return value === "clones" ? "clones" : "data";
}

export function asStartupStepState(value: string): StartupStepState {
  switch (value) {
    case "running":
    case "done":
      return value;
    default:
      return "todo";
  }
}

export function asStartupCase(value: string): StartupCase {
  switch (value) {
    case "permission":
    case "disk_full":
      return value;
    default:
      return "other";
  }
}

/** ReleaseKind is where a repository unchecked from its board goes; "" outside an edit of its own board. */
export type ReleaseKind = "" | "no_board" | "leave";

export function asReleaseKind(value: string): ReleaseKind {
  switch (value) {
    case "no_board":
    case "leave":
      return value;
    default:
      return "";
  }
}

/** ClaudeCheck is what the check of the machine found of the claude CLI. */
export type ClaudeCheck = "found" | "not_found" | "unknown";

export function asClaudeCheck(value: string): ClaudeCheck {
  switch (value) {
    case "found":
    case "not_found":
      return value;
    default:
      return "unknown";
  }
}

/** GHCheck is what the check of the machine found of gh and its login. */
export type GHCheck = "ready" | "not_installed" | "signed_out" | "unknown";

export function asGHCheck(value: string): GHCheck {
  switch (value) {
    case "ready":
    case "not_installed":
    case "signed_out":
      return value;
    default:
      return "unknown";
  }
}

export function asTaskMode(value: string): TaskMode {
  switch (value) {
    case "structured":
    case "one_shot":
      return value;
    default:
      return "structured";
  }
}

export function asTaskStage(value: string): TaskStage {
  switch (value) {
    case "prd":
    case "tech_spec":
    case "plan":
    case "one_shot":
    case "implementation":
    case "pr":
      return value;
    default:
      return "prd";
  }
}

export function asModelStage(value: string): ModelStage {
  switch (value) {
    case "prd":
    case "tech_spec":
    case "plan":
    case "one_shot":
    case "implementation":
    case "step_review":
    case "pr":
    case "pr_review":
    case "discussion":
      return value;
    default:
      return "prd";
  }
}

export function asCatalogFailure(value: string): CatalogFailure {
  switch (value) {
    case "not_found":
    case "unsupported":
    case "failed":
      return value;
    default:
      return "";
  }
}

export function asPromptStage(value: string): PromptStage {
  switch (value) {
    case "prd":
    case "tech_spec":
    case "plan":
    case "one_shot":
    case "step_review":
    case "commit":
    case "pr":
    case "pr_review":
    case "discussion":
      return value;
    default:
      return "prd";
  }
}

export function asStepStatus(value: string): StepStatus {
  switch (value) {
    case "not_started":
    case "preparing":
    case "blocked":
    case "implementing":
    case "agent_review":
    case "addressing_review":
    case "awaiting_review":
    case "in_review":
    case "ready_to_approve":
    case "nothing_to_commit":
    case "review_failed":
    case "committing":
    case "done":
      return value;
    default:
      return "not_started";
  }
}

export function asPRStatus(value: string): PRStatus {
  switch (value) {
    case "preparing":
    case "blocked":
    case "drafting":
    case "draft_ready":
    case "awaiting_reply":
    case "opening":
    case "reviewing":
    case "waiting_checks":
    case "awaiting_decision":
    case "in_review":
    case "ready_to_approve":
    case "committing":
    case "done":
    case "trouble":
    case "merged":
    case "pr_closed":
    case "closing":
    case "closed":
      return value;
    default:
      return "preparing";
  }
}

export function asCloseOutcome(value: string): CloseOutcome {
  switch (value) {
    case "done":
    case "skipped":
    case "failed":
      return value;
    default:
      return "failed";
  }
}

export function asCloseSkipReason(value: string): CloseSkipReason {
  switch (value) {
    case "missing":
    case "not_merged":
    case "not_checked_out":
    case "dirty":
    case "no_upstream":
    case "diverged":
    case "up_to_date":
      return value;
    default:
      return "missing";
  }
}

export function asPRBlockReason(value: string): PRBlockReason {
  switch (value) {
    case "gh_missing":
    case "gh_unauthenticated":
    case "gh_failed":
    case "git_failed":
    case "no_worktree":
      return value;
    default:
      return "gh_failed";
  }
}

export function asPRState(value: string): PRState {
  switch (value) {
    case "open":
    case "merged":
    case "closed":
      return value;
    default:
      return "";
  }
}

export function asCheckState(value: string): CheckState {
  switch (value) {
    case "passed":
    case "skipped":
    case "neutral":
    case "failed":
    case "running":
    case "queued":
      return value;
    default:
      return "queued";
  }
}

export function asReviewFileKind(value: string): ReviewFileKind {
  switch (value) {
    case "added":
    case "modified":
    case "deleted":
    case "renamed":
    case "untracked":
      return value;
    default:
      return "modified";
  }
}

export function asBlockReason(value: string): BlockReason {
  switch (value) {
    case "dirty_worktree":
    case "fetch_failed":
    case "no_base_branch":
    case "path_exists":
    case "branch_exists":
    case "git_failed":
    case "clone_missing":
      return value;
    default:
      return "git_failed";
  }
}

export function asSessionStatus(value: string): SessionStatus {
  switch (value) {
    case "working":
    case "waiting":
    case "needs_permission":
    case "needs_answer":
    case "paused":
    case "error":
      return value;
    default:
      return "waiting";
  }
}

export function asEntryKind(value: string): EntryKind {
  switch (value) {
    case "user":
    case "assistant":
    case "action":
    case "permission":
    case "question":
    case "marker":
    case "error":
      return value;
    default:
      return "marker";
  }
}

export function asActionStatus(value: string): ActionStatus {
  switch (value) {
    case "running":
    case "done":
    case "error":
    case "interrupted":
      return value;
    default:
      return "done";
  }
}

export function asPermissionStatus(value: string): PermissionStatus {
  switch (value) {
    case "pending":
    case "allowed":
    case "allowed_session":
    case "denied":
    case "cancelled":
      return value;
    default:
      return "cancelled";
  }
}

export function asMarkerType(value: string): MarkerType {
  switch (value) {
    case "prd_written":
    case "prd_updated":
    case "tech_spec_written":
    case "tech_spec_updated":
    case "plan_written":
    case "plan_updated":
    case "one_shot_written":
    case "one_shot_updated":
    case "pr_review_written":
    case "pr_review_revised":
    case "findings_decided":
    case "review_published":
    case "new_commits":
    case "step_review_started":
    case "step_review_written":
    case "review_started":
    case "discussion_started":
    case "discussion_document":
    case "drafts_written":
    case "drafts_revised":
    case "drafts_unreadable":
    case "drafts_published":
    case "stage_started":
    case "step_started":
    case "compacted":
    case "interrupted":
    case "retried":
    case "committed":
    case "pr_opened":
    case "checks_read":
    case "draft_approved":
    case "changes_approved":
    case "paused":
    case "plan_invalid":
      return value;
    default:
      return "compacted";
  }
}

export function asAppKind(value: string): AppKind {
  switch (value) {
    case "report":
    case "pass":
    case "commit":
    case "commit_all":
    case "commit_push":
    case "correction":
    case "open":
    case "pr_pass":
    case "apply":
      return value;
    default:
      return "";
  }
}

export function asInterruptedBy(value: string): InterruptedBy {
  switch (value) {
    case "user":
    case "crash":
      return value;
    default:
      return "";
  }
}

export function asRetryReason(value: string): RetryReason {
  switch (value) {
    case "":
    case "overloaded":
    case "rate_limit":
    case "server":
    case "connection":
      return value;
    default:
      return "other";
  }
}

export function asErrorKind(value: string): ErrorKind {
  switch (value) {
    case "process_exit":
    case "start_failed":
    case "not_found":
    case "not_logged_in":
    case "turn_error":
      return value;
    default:
      return "turn_error";
  }
}

export function asTranscriptEventKind(value: string): TranscriptEventKind {
  switch (value) {
    case "entry":
    case "text":
    case "remove":
    case "reset":
      return value;
    default:
      return "reset";
  }
}

export function asSituationKind(value: string): SituationKind {
  switch (value) {
    case "session_error":
    case "step_blocked":
    case "worktree_unreadable":
    case "pr_blocked":
    case "plan_invalid":
    case "pr_closed":
    case "permission":
    case "question":
    case "reply":
    case "ready_to_continue":
    case "step_review":
    case "step_empty":
    case "draft":
    case "findings":
    case "changes_review":
    case "merge":
    case "review_report":
    case "new_commits":
    case "pr_trouble":
    case "drafts":
    case "epic_cant_publish":
    case "epic_discarded":
    case "ready_to_archive":
    case "publish_failed":
    case "pass_blocked":
      return value;
    default:
      return "reply";
  }
}

export function asSituationGroup(value: string): SituationGroup {
  switch (value) {
    case "error":
    case "waiting":
    case "closing":
      return value;
    default:
      return "waiting";
  }
}

export function asSituationForm(value: string): SituationForm {
  switch (value) {
    case "":
    case "review":
    case "staged":
    case "approve":
    case "merge":
    case "close":
    case "decide":
    case "publish":
    case "apply":
    case "checks":
    case "conflict":
    case "checks_conflict":
      return value;
    default:
      return "";
  }
}

export function asPlaceKind(value: string): PlaceKind {
  switch (value) {
    case "stage":
    case "step":
    case "step_review":
    case "pr":
    case "review":
    case "discussion":
      return value;
    default:
      return "stage";
  }
}

export function asReviewMode(value: string): ReviewMode {
  switch (value) {
    case "manual":
    case "agent":
      return value;
    default:
      return "manual";
  }
}

export function asReviewFallback(value: string): ReviewFallback {
  switch (value) {
    case "":
    case "taken_over":
    case "rounds_exhausted":
    case "commit_failed":
      return value;
    default:
      return "";
  }
}

export function asMigrationCaseKind(value: string): MigrationCaseKind {
  switch (value) {
    case "root_task":
    case "no_origin":
    case "name_conflict":
      return value;
    default:
      return "root_task";
  }
}

export function asCardAction(value: string): CardAction {
  switch (value) {
    case "start":
    case "clone":
    case "clone_missing":
    case "add_to_board":
    case "other_board":
    case "has_task":
    case "closed":
      return value;
    default:
      return "add_to_board";
  }
}

export function asBoardFailureReason(value: string): BoardFailureReason {
  switch (value) {
    case "gh_missing":
    case "gh_unauthenticated":
    case "missing_scope":
    case "not_found":
    case "rate_limited":
    case "failed":
      return value;
    default:
      return "failed";
  }
}

export function asRepositoryLinkKind(value: string): RepositoryLinkKind {
  switch (value) {
    case "registered":
    case "clone":
    case "uncloned":
    case "other_board":
      return value;
    default:
      return "uncloned";
  }
}

export function asIssueState(value: string): IssueState {
  switch (value) {
    case "open":
    case "closed":
      return value;
    default:
      return "open";
  }
}

export function asPullRequestState(value: string): PullRequestState {
  switch (value) {
    case "open":
    case "merged":
    case "closed":
      return value;
    default:
      return "open";
  }
}

export function asPullReviewMode(value: string): PullReviewMode {
  switch (value) {
    case "publish":
    case "apply":
      return value;
    default:
      return "publish";
  }
}

export function asPullReviewStatus(value: string): PullReviewStatus {
  switch (value) {
    case "reviewing":
    case "waiting_checks":
    case "pass_blocked":
    case "awaiting_reply":
    case "awaiting_decision":
    case "ready_to_publish":
    case "publish_failed":
    case "published":
    case "new_commits":
    case "ready_to_apply":
    case "applying":
    case "in_review":
    case "ready_to_approve":
    case "committing":
    case "ready_to_merge":
    case "trouble":
      return value;
    default:
      return "reviewing";
  }
}

export function asReviewVerdict(value: string): ReviewVerdict {
  switch (value) {
    case "approve":
    case "request_changes":
    case "comment":
      return value;
    // Comment is the verdict that judges nothing, which is what an unknown one
    // is worth.
    default:
      return "comment";
  }
}

export function asFindingDecision(value: string): FindingDecision {
  switch (value) {
    case "":
    case "approved":
    case "discarded":
      return value;
    default:
      return "";
  }
}

export function asFindingPlacement(value: string): FindingPlacement {
  switch (value) {
    case "":
    case "inline":
    case "body":
      return value;
    default:
      return "";
  }
}

export function asPullRequestAction(value: string): PullRequestAction {
  switch (value) {
    case "review":
    case "open_review":
    case "open_task":
    case "clone":
    case "clone_missing":
    case "fork":
      return value;
    // A fork is the action that does nothing, which is the safe answer to an
    // action the app does not know.
    default:
      return "fork";
  }
}

export function asYourReviewState(value: string): YourReviewState {
  switch (value) {
    case "approved":
    case "changes_requested":
    case "commented":
    case "dismissed":
      return value;
    // Commented claims the least of a review the app cannot place.
    default:
      return "commented";
  }
}

export function asMergeable(value: string): Mergeable {
  switch (value) {
    case "mergeable":
    case "conflicting":
    case "unknown":
      return value;
    default:
      return "";
  }
}

export function asPullRequestOutcome(value: string): PullRequestOutcome {
  switch (value) {
    case "merged":
    case "closed":
      return value;
    // Closed claims the least of a pull request the app cannot place.
    default:
      return "closed";
  }
}

export function asDiscussionStatus(value: string): DiscussionStatus {
  switch (value) {
    case "discussing":
    case "awaiting_drafts":
    case "deciding":
    case "publishing":
    case "publish_failed":
    case "epic_discarded":
    case "epic_cant_publish":
    case "ready_to_archive":
      return value;
    default:
      return "discussing";
  }
}

export function asDraftKind(value: string): DraftKind {
  switch (value) {
    case "new":
    case "update":
    case "epic":
      return value;
    default:
      return "new";
  }
}

export function asDraftSource(value: string): DraftSource {
  switch (value) {
    case "agent":
    case "user":
      return value;
    default:
      return "agent";
  }
}

export function asDraftDecision(value: string): DraftDecision {
  switch (value) {
    case "":
    case "approved":
    case "discarded":
      return value;
    default:
      return "";
  }
}

export function asDraftOutcome(value: string): DraftOutcome {
  switch (value) {
    case "":
    case "created":
    case "updated":
      return value;
    default:
      return "";
  }
}

export function asDependencyDrop(value: string): DependencyDrop {
  switch (value) {
    case "":
    case "discarded":
    case "unavailable":
      return value;
    default:
      return "";
  }
}

export function asHoldReason(value: string): HoldReason {
  switch (value) {
    case "epic_discarded":
    case "cards":
    case "epic_short":
    case "epic":
    case "draft":
      return value;
    default:
      return "";
  }
}

export const api = {
  getStartup: (): Promise<Startup> => StartupService.GetStartup(),
  tryStartupAgain: (): Promise<void> => StartupService.TryAgain(),
  getState: (): Promise<State> => StateService.GetState(),
  scanRepositories: async (): Promise<RepositoryCandidate[]> =>
    (await RepositoryService.ScanRepositories()) ?? [],
  addRepository: (path: string): Promise<void> => RepositoryService.AddRepository(path),
  browseRepository: (): Promise<boolean> => RepositoryService.BrowseRepository(),
  changeRepositoryPath: (id: string): Promise<boolean> =>
    RepositoryService.ChangeRepositoryPath(id),
  removeRepository: (id: string): Promise<void> => RepositoryService.RemoveRepository(id),
  setRepositoryFilter: (id: string): Promise<void> => RepositoryService.SetRepositoryFilter(id),
  cloneRepository: (id: string): Promise<boolean> => RepositoryService.CloneRepository(id),
  chooseCloneFolder: (): Promise<void> => RepositoryService.ChooseCloneFolder(),
  setReviewInstructions: (id: string, text: string): Promise<void> =>
    RepositoryService.SetReviewInstructions(id, text),

  previewBoard: (url: string): Promise<BoardPreview> => BoardService.PreviewBoard(url),
  previewEditBoard: (id: string): Promise<BoardPreview> => BoardService.PreviewEditBoard(id),
  checkBoardRepository: (boardId: string, fullName: string): Promise<BoardRepositoryOption> =>
    BoardService.CheckBoardRepository(boardId, fullName),
  addBoard: (url: string, req: SaveBoardRequest): Promise<void> => BoardService.AddBoard(url, req),
  updateBoard: (id: string, req: SaveBoardRequest): Promise<void> =>
    BoardService.UpdateBoard(id, req),
  previewRemoveBoard: (id: string): Promise<BoardRemoval> => BoardService.PreviewRemoveBoard(id),
  removeBoard: (id: string): Promise<void> => BoardService.RemoveBoard(id),
  refreshBoard: (id: string): Promise<void> => BoardService.RefreshBoard(id),
  refreshCard: (boardId: string, key: string): Promise<void> =>
    BoardService.RefreshCard(boardId, key),
  cardContext: (boardId: string, key: string): Promise<string> =>
    BoardService.CardContext(boardId, key),
  addRepositoryToBoard: (boardId: string, choice: BoardRepositoryChoice): Promise<void> =>
    BoardService.AddRepositoryToBoard(boardId, choice),
  setTheme: (preference: ThemePreference): Promise<void> => SettingsService.SetTheme(preference),
  setModelDefault: (stage: ModelStage, model: string, effort: string): Promise<void> =>
    SettingsService.SetModelDefault(stage, model, effort),
  setReviewModeDefault: (mode: ReviewMode): Promise<void> =>
    SettingsService.SetReviewModeDefault(mode),
  getPrompt: (stage: PromptStage): Promise<Prompt> => SettingsService.GetPrompt(stage),
  savePrompt: (stage: PromptStage, text: string): Promise<Prompt> =>
    SettingsService.SavePrompt(stage, text),
  restorePrompt: (stage: PromptStage): Promise<Prompt> => SettingsService.RestorePrompt(stage),
  listPrompts: async (): Promise<PromptListing[]> => (await SettingsService.ListPrompts()) ?? [],
  checkMachine: (): Promise<Machine> => SettingsService.CheckMachine(),

  createTask: (req: CreateTaskRequest): Promise<string> => TaskService.CreateTask(req),
  deleteTask: (taskId: string): Promise<DeleteResult> => TaskService.DeleteTask(taskId),
  previewDelete: (taskId: string): Promise<DeletePreview> => TaskService.PreviewDelete(taskId),
  getTranscript: (taskId: string, stage: string): Promise<Transcript> =>
    TaskService.GetTranscript(taskId, stage),
  getActionOutput: (itemId: string, stage: string, entryId: string): Promise<ActionOutput> =>
    TaskService.GetActionOutput(itemId, stage, entryId),
  sendMessage: (taskId: string, stage: string, text: string): Promise<void> =>
    TaskService.SendMessage(taskId, stage, text),
  removePending: (taskId: string, stage: string, entryId: string): Promise<void> =>
    TaskService.RemovePending(taskId, stage, entryId),
  interrupt: (taskId: string, stage: string): Promise<void> => TaskService.Interrupt(taskId, stage),
  pause: (taskId: string, stage: string): Promise<void> => TaskService.Pause(taskId, stage),
  resume: (taskId: string, stage: string): Promise<void> => TaskService.Resume(taskId, stage),
  retry: (taskId: string, stage: string): Promise<void> => TaskService.Retry(taskId, stage),
  answerPermission: (
    taskId: string,
    stage: string,
    requestId: string,
    decision: PermissionDecision,
    message: string,
  ): Promise<void> => TaskService.AnswerPermission(taskId, stage, requestId, decision, message),
  answerQuestion: (
    taskId: string,
    stage: string,
    requestId: string,
    answers: Record<string, string>,
  ): Promise<void> => TaskService.AnswerQuestion(taskId, stage, requestId, answers),
  readArtifact: (taskId: string, name: string): Promise<string> =>
    TaskService.ReadArtifact(taskId, name),
  backToStage: (taskId: string, stage: TaskStage): Promise<void> =>
    TaskService.BackToStage(taskId, stage),
  discardStage: (taskId: string, stage: TaskStage): Promise<void> =>
    TaskService.DiscardStage(taskId, stage),
  continueStage: (taskId: string): Promise<void> => TaskService.ContinueStage(taskId),
  retryStep: (taskId: string): Promise<void> => TaskService.RetryStep(taskId),
  cleanAndStartStep: (taskId: string): Promise<void> => TaskService.CleanAndStartStep(taskId),
  discardStep: (taskId: string, cleanWorktree: boolean): Promise<void> =>
    TaskService.DiscardStep(taskId, cleanWorktree),
  setStageModel: (
    taskId: string,
    stage: ModelStage,
    model: string,
    effort: string,
  ): Promise<void> => TaskService.SetStageModel(taskId, stage, model, effort),
  setStepModel: (taskId: string, step: number, model: string, effort: string): Promise<void> =>
    TaskService.SetStepModel(taskId, step, model, effort),
  setSessionModel: (taskId: string, stage: string, model: string, effort: string): Promise<void> =>
    TaskService.SetSessionModel(taskId, stage, model, effort),
  setReviewMode: (taskId: string, mode: ReviewMode): Promise<void> =>
    TaskService.SetReviewMode(taskId, mode),
  setStepReviewMode: (taskId: string, step: number, mode: ReviewMode): Promise<void> =>
    TaskService.SetStepReviewMode(taskId, step, mode),
  clearStepReviewMode: (taskId: string, step: number): Promise<void> =>
    TaskService.ClearStepReviewMode(taskId, step),
  reviewStepMyself: (taskId: string): Promise<void> => TaskService.ReviewStepMyself(taskId),
  approveStep: (taskId: string): Promise<void> => TaskService.ApproveStep(taskId),
  openPR: (taskId: string, title: string, body: string): Promise<void> =>
    TaskService.OpenPR(taskId, title, body),
  approvePR: (taskId: string): Promise<void> => TaskService.ApprovePR(taskId),
  decidePRFinding: (
    taskId: string,
    pass: number,
    number: number,
    decision: FindingDecision,
  ): Promise<void> => TaskService.DecidePRFinding(taskId, pass, number, decision),
  setPRFindingText: (taskId: string, pass: number, number: number, text: string): Promise<void> =>
    TaskService.SetPRFindingText(taskId, pass, number, text),
  approveRestOfPRFindings: (taskId: string, pass: number): Promise<void> =>
    TaskService.ApproveRestOfPRFindings(taskId, pass),
  applyPRFindings: (taskId: string): Promise<void> => TaskService.ApplyPRFindings(taskId),
  openPRFindingInEditor: (taskId: string, pass: number, number: number): Promise<void> =>
    TaskService.OpenPRFindingInEditor(taskId, pass, number),
  reviewAgain: (taskId: string): Promise<void> => TaskService.ReviewAgain(taskId),
  discardDraft: (taskId: string): Promise<void> => TaskService.DiscardDraft(taskId),
  retryPR: (taskId: string): Promise<void> => TaskService.RetryPR(taskId),
  refreshPR: (taskId: string): Promise<void> => TaskService.RefreshPR(taskId),
  closeTask: (taskId: string): Promise<void> => TaskService.CloseTask(taskId),
  openInEditor: (taskId: string): Promise<void> => TaskService.OpenInEditor(taskId),
  openFileInEditor: (taskId: string, path: string): Promise<void> =>
    TaskService.OpenFileInEditor(taskId, path),
  openExternal: (url: string): Promise<void> => Browser.OpenURL(url),

  refreshPullRequests: (): Promise<void> => ReviewService.RefreshPullRequests(),
  setReviewFilters: (filters: ReviewFilters): Promise<void> =>
    ReviewService.SetReviewFilters(filters),
  startReview: (req: StartReviewRequest): Promise<string> => ReviewService.StartReview(req),
  // The review of the pull request of a task already answers to reviewAgain.
  askReviewAgain: (id: string, instructions: string): Promise<void> =>
    ReviewService.ReviewAgain(id, instructions),
  decideFinding: (
    id: string,
    pass: number,
    number: number,
    decision: FindingDecision,
  ): Promise<void> => ReviewService.DecideFinding(id, pass, number, decision),
  setFindingText: (id: string, pass: number, number: number, text: string): Promise<void> =>
    ReviewService.SetFindingText(id, pass, number, text),
  setReviewSummary: (id: string, pass: number, text: string): Promise<void> =>
    ReviewService.SetReviewSummary(id, pass, text),
  publishReview: (id: string, verdict: ReviewVerdict, withSummary: boolean): Promise<void> =>
    ReviewService.PublishReview(id, verdict, withSummary),
  refreshReviewPR: (id: string): Promise<void> => ReviewService.RefreshPR(id),
  applyReview: (id: string): Promise<void> => ReviewService.ApplyReview(id),
  approveReview: (id: string): Promise<void> => ReviewService.ApproveReview(id),
  approveRestOfFindings: (id: string, pass: number): Promise<void> =>
    ReviewService.ApproveRestOfFindings(id, pass),
  deleteReview: (id: string): Promise<DeleteResult> => ReviewService.DeleteReview(id),
  readReviewArtifact: (id: string, name: string): Promise<string> =>
    ReviewService.ReadReviewArtifact(id, name),
  openReviewInEditor: (id: string): Promise<void> => ReviewService.OpenReviewInEditor(id),
  openFindingInEditor: (id: string, pass: number, number: number): Promise<void> =>
    ReviewService.OpenFindingInEditor(id, pass, number),

  startDiscussion: (req: StartDiscussionRequest): Promise<string> =>
    DiscussionService.StartDiscussion(req),
  discussionContext: (req: DiscussionContextRequest): Promise<string> =>
    DiscussionService.DiscussionContext(req),
  setDraftText: (id: string, draftId: string, title: string, body: string): Promise<void> =>
    DiscussionService.SetDraftText(id, draftId, title, body),
  setDraftRepository: (id: string, draftId: string, repositoryId: string): Promise<void> =>
    DiscussionService.SetDraftRepository(id, draftId, repositoryId),
  setDraftModule: (id: string, draftId: string, module: string): Promise<void> =>
    DiscussionService.SetDraftModule(id, draftId, module),
  setDraftEpic: (id: string, draftId: string, ref: string): Promise<void> =>
    DiscussionService.SetDraftEpic(id, draftId, ref),
  addDraftDependency: (id: string, draftId: string, ref: string): Promise<void> =>
    DiscussionService.AddDraftDependency(id, draftId, ref),
  removeDraftDependency: (id: string, draftId: string, ref: string): Promise<void> =>
    DiscussionService.RemoveDraftDependency(id, draftId, ref),
  decideDraft: (id: string, draftId: string, decision: DraftDecision): Promise<void> =>
    DiscussionService.DecideDraft(id, draftId, decision),
  groupIntoEpic: (
    id: string,
    draftIds: string[],
    title: string,
    repositoryId: string,
  ): Promise<string> => DiscussionService.GroupIntoEpic(id, draftIds, title, repositoryId),
  retryPublish: (id: string, draftId: string): Promise<void> =>
    DiscussionService.RetryPublish(id, draftId),
  archiveDiscussion: (id: string): Promise<void> => DiscussionService.ArchiveDiscussion(id),
  deleteDiscussion: (id: string): Promise<void> => DiscussionService.DeleteDiscussion(id),
  readDiscussionArtifact: (id: string, name: string): Promise<string> =>
    DiscussionService.ReadDiscussionArtifact(id, name),

  viewSituation: (id: string): Promise<void> => AttentionService.ViewSituation(id),
};

export function onStartupChanged(handler: (startup: Startup) => void): () => void {
  return Events.On("startup:changed", (event) => handler(event.data));
}

export function onStateChanged(handler: (state: State) => void): () => void {
  return Events.On("state:changed", (event) => handler(event.data));
}

export function onTranscriptChanged(handler: (event: TranscriptEvent) => void): () => void {
  return Events.On("transcript:changed", (event) => handler(event.data));
}

export function onSituationStarted(handler: (event: SituationStarted) => void): () => void {
  return Events.On("situation:started", (event) => handler(event.data));
}

export function onSituationOpen(handler: (event: SituationOpen) => void): () => void {
  return Events.On("situation:open", (event) => handler(event.data));
}
