// Package bindings exposes the app services to the frontend and owns the state
// snapshot they exchange.
package bindings

// EventStateChanged carries a whole State every time anything changes.
const EventStateChanged = "state:changed"

// Repository is a registered repository, with what the app knows about its
// clone and its tasks.
type Repository struct {
	ID            string `json:"id"`
	Owner         string `json:"owner"`
	Name          string `json:"name"`
	FullName      string `json:"fullName"` // owner/name
	Path          string `json:"path"`
	Missing       bool   `json:"missing"` // the clone was not at Path at the last check; always false while Cloned is false
	ActiveTasks   int    `json:"activeTasks"`
	ArchivedTasks int    `json:"archivedTasks"`
	Cloned        bool   `json:"cloned"`     // tied to a clone; false for a repository registered without one
	BoardID       string `json:"boardId"`    // "" without a board
	Cloning       bool   `json:"cloning"`    // a clone runs now
	CloneError    string `json:"cloneError"` // what gh said when the last clone failed; "" otherwise
	// ReviewInstructions are added to every pull request review of the
	// repository; "" when the user wrote none.
	ReviewInstructions string `json:"reviewInstructions"`
	ActiveReviews      int    `json:"activeReviews"`
	ArchivedReviews    int    `json:"archivedReviews"`
}

// RepositoryCandidate is a clone of a GitHub repository the scan found under
// the home folder.
type RepositoryCandidate struct {
	Owner      string `json:"owner"`
	Name       string `json:"name"`
	FullName   string `json:"fullName"` // owner/name
	Path       string `json:"path"`
	Registered bool   `json:"registered"` // the repository is registered, at this path or another
}

// MigrationTask is one task a refused migration is about.
type MigrationTask struct {
	Name      string `json:"name"`
	Workspace string `json:"workspace"`
	Path      string `json:"path"` // the clone; "" for a task at the root of its workspace
}

// MigrationCase is one reason the migration was refused.
type MigrationCase struct {
	// Kind is root_task, no_origin or name_conflict, a string for the same
	// reason as State.Theme.
	Kind       string          `json:"kind"`
	Repository string          `json:"repository"` // no_origin: the path of the clone; name_conflict: owner/name
	Detail     string          `json:"detail"`     // no_origin: why the clone was refused
	Tasks      []MigrationTask `json:"tasks"`      // never nil
}

// Migration is a migration of the data that was refused, with what to resolve.
type Migration struct {
	Cases []MigrationCase `json:"cases"` // never nil
}

// State is everything the interface renders, produced by Go and never derived
// on the frontend.
type State struct {
	// Migration is set when the data could not be migrated; every other field
	// is then empty.
	Migration *Migration `json:"migration"`
	// Repositories are the registered repositories, by owner/name, ignoring
	// case; never nil.
	Repositories []Repository `json:"repositories"`
	// RepositoryFilter is the id of the repository the task list and the history
	// show; "" for all of them.
	RepositoryFilter string `json:"repositoryFilter"`
	// Theme is system, light or dark. It stays a string so the generated
	// bindings leave the narrowing to the frontend union types instead of
	// emitting a TypeScript enum.
	Theme      string `json:"theme"`
	SystemDark bool   `json:"systemDark"`
	// ModelDefaults are the choices a new task starts each stage with, in workflow
	// order; never nil.
	ModelDefaults []StageModel `json:"modelDefaults"`
	// ModelCatalog is what the installed Claude Code offers, which every picker
	// lists.
	ModelCatalog ModelCatalog `json:"modelCatalog"`
	// ReviewModeDefault is manual or agent: who reviews the steps of a new
	// task, a string for the same reason as State.Theme.
	ReviewModeDefault string `json:"reviewModeDefault"`
	// Tasks are the active tasks of every repository, in creation order; never
	// nil.
	Tasks []TaskSummary `json:"tasks"`
	// History are the archived tasks of every repository, newest first; never
	// nil.
	History []ArchivedTask `json:"history"`
	// Boards are the registered boards, by title ignoring case; never nil.
	Boards []Board `json:"boards"`
	// ReviewCenter is the Reviews view: the open pull requests of the
	// registered repositories and the filters they are shown through.
	ReviewCenter ReviewCenter `json:"reviewCenter"`
	// Reviews are the active reviews of pull requests, in creation order;
	// never nil.
	Reviews []ReviewSummary `json:"reviews"`
	// ReviewHistory are the reviews whose pull request was merged or closed,
	// newest first; never nil.
	ReviewHistory []ArchivedReview `json:"reviewHistory"`
	// Discussions are the active discussions of every board, in creation
	// order; never nil.
	Discussions []DiscussionSummary `json:"discussions"`
	// DiscussionHistory are the archived discussions, newest first; never nil.
	DiscussionHistory []ArchivedDiscussion `json:"discussionHistory"`
	// CloneFolder is where new clones go; "" until chosen.
	CloneFolder string `json:"cloneFolder"`
}

// EventTranscriptChanged carries one TranscriptEvent every time a conversation
// changes.
const EventTranscriptChanged = "transcript:changed"

// StepBlock is why a step is blocked.
type StepBlock struct {
	// Reason is dirty_worktree, fetch_failed, no_base_branch, path_exists,
	// branch_exists, git_failed or clone_missing, a string for the same reason
	// as State.Theme.
	Reason string `json:"reason"`
	Detail string `json:"detail"` // what git said, or the status lines of a dirty worktree
	Files  int    `json:"files"`  // dirty worktree only
}

// ReviewFile is one changed file of the worktree of a step under review.
type ReviewFile struct {
	Path string `json:"path"`
	// Kind is added, modified, deleted, renamed or untracked, a string for the
	// same reason as State.Theme.
	Kind    string `json:"kind"`
	Staged  bool   `json:"staged"`  // nothing of it is left outside the index
	Partial bool   `json:"partial"` // part of it is in the index and part is not
}

// Review is how far the review of a step has got.
type Review struct {
	Files   []ReviewFile `json:"files"` // never nil
	Staged  int          `json:"staged"`
	Total   int          `json:"total"`
	Percent int          `json:"percent"`
	Error   string       `json:"error"` // what git said when the worktree could not be read
}

// Step is one step of the plan of a task.
type Step struct {
	Number int    `json:"number"`
	File   string `json:"file"` // name inside steps/, the artifact is "steps/" + File; one-shot.md for the single step of a One-Shot task
	Title  string `json:"title"`
	// Status is not_started, preparing, blocked, implementing, agent_review,
	// addressing_review, awaiting_review, in_review, ready_to_approve,
	// nothing_to_commit, review_failed, committing or done, a string for the
	// same reason as State.Theme.
	Status string `json:"status"`
	// Phase is fetching, creating or checking while preparing; "" otherwise.
	Phase        string     `json:"phase"`
	Block        *StepBlock `json:"block"`        // blocked only
	WorktreePath string     `json:"worktreePath"` // "" until the worktree of the task exists

	Review        *Review `json:"review"`        // the review states and committing only
	CommitSHA     string  `json:"commitSha"`     // done only
	CommitSubject string  `json:"commitSubject"` // done only
	CommittedAt   string  `json:"committedAt"`   // done only: the committer date, RFC 3339; "" when unknown
	CommitFailed  bool    `json:"commitFailed"`  // the last approval ended without a commit

	Model         string `json:"model"` // what the step runs with, or will run with
	Effort        string `json:"effort"`
	Adjusted      bool   `json:"adjusted"`      // not started, with a choice of its own instead of the one of implementation
	ModelEditable bool   `json:"modelEditable"` // not started: its choice can still change

	// ReviewMode is manual or agent: who reviews the step, the mode it will
	// start with or the one it is reviewed with, a string for the same reason
	// as State.Theme.
	ReviewMode         string `json:"reviewMode"`
	ReviewModeAdjusted bool   `json:"reviewModeAdjusted"` // not started, with a mode of its own instead of the one of the task
	ReviewModeEditable bool   `json:"reviewModeEditable"` // not started: its mode can still change
	// ReviewFallback is taken_over, rounds_exhausted or commit_failed: why a
	// step that started under the agent review is reviewed by the user; ""
	// while its mode holds.
	ReviewFallback string        `json:"reviewFallback"`
	ReviewPass     int           `json:"reviewPass"`    // agent_review only: the pass under way
	ReviewRound    int           `json:"reviewRound"`   // addressing_review only: the report the implementer addresses
	ReportMissing  bool          `json:"reportMissing"` // agent_review only: the reviewer rests without the report of the pass
	Reports        []StepReport  `json:"reports"`       // the reports of the agent review, by pass; never nil
	Reviewer       *StepReviewer `json:"reviewer"`      // nil while the step has no reviewer conversation open
}

// StepReport is one pass of the agent review of a step.
type StepReport struct {
	Pass  int    `json:"pass"`
	File  string `json:"file"` // name inside the step-reviews folder, for ReadArtifact
	Clean bool   `json:"clean"`
	// Findings is how many findings the report lists; -1 when unknown.
	Findings int `json:"findings"`
}

// StepReviewer is the conversation that reviews a step, with the state of its
// session. It has the shape the chat takes from a task and a repository.
type StepReviewer struct {
	SessionStage string `json:"sessionStage"` // step_review:<n>
	// SessionStatus is working, waiting, needs_permission, needs_answer, paused
	// or error.
	SessionStatus  string `json:"sessionStatus"`
	SessionModel   string `json:"sessionModel"`
	SessionEffort  string `json:"sessionEffort"`
	TurnRunning    bool   `json:"turnRunning"`
	ProcessRunning bool   `json:"processRunning"`
	RetryAttempt   int    `json:"retryAttempt"`
	// RetryMax, RetryAt (RFC 3339) and RetryReason (overloaded, rate_limit,
	// server, connection or other) go with RetryAttempt; zero without a retry.
	RetryMax    int    `json:"retryMax"`
	RetryAt     string `json:"retryAt"`
	RetryReason string `json:"retryReason"`
	// TurnFailed says the last turn ended in an error the CLI survived; the
	// session is at rest all the same.
	TurnFailed bool `json:"turnFailed"`
	// TurnStartedAt is when the turn in progress started, RFC 3339; "" without
	// a turn.
	TurnStartedAt string `json:"turnStartedAt"`
	PausedAt      string `json:"pausedAt"` // when the session was paused, RFC 3339; "" when it is not, or the time is unknown
	// ActionLabel and ActionTarget are the action the agent runs now, as the
	// conversation words it ("Reading", "internal/app/state.go"); "" when none
	// runs.
	ActionLabel    string `json:"actionLabel"`
	ActionTarget   string `json:"actionTarget"`
	ContextPercent int    `json:"contextPercent"`
	PendingCount   int    `json:"pendingCount"`
	LastError      string `json:"lastError"`
}

// PRBlock is why the pull request stage of a task cannot go on.
type PRBlock struct {
	// Reason is gh_missing, gh_unauthenticated, gh_failed, git_failed or
	// no_worktree, a string for the same reason as State.Theme.
	Reason string `json:"reason"`
	Detail string `json:"detail"` // what gh or git said, verbatim
}

// PRDraft is the description of a pull request the agent wrote and the user
// edits.
type PRDraft struct {
	Title string `json:"title"`
	Body  string `json:"body"`
	File  string `json:"file"` // name inside the pr folder, for ReadArtifact
}

// PRReport is one pass of the review of a pull request.
type PRReport struct {
	Pass  int    `json:"pass"`
	File  string `json:"file"` // name inside the pr folder, for ReadArtifact
	Clean bool   `json:"clean"`
}

// CloseStep is one part of the closing of a task.
type CloseStep struct {
	// Outcome is done, skipped or failed, a string for the same reason as
	// State.Theme.
	Outcome string `json:"outcome"`
	// Reason is missing, not_merged, not_checked_out, dirty, no_upstream,
	// diverged or up_to_date; skipped only.
	Reason string `json:"reason"`
	Detail string `json:"detail"`
}

// CloseResult is what closing a task did.
type CloseResult struct {
	Worktree     CloseStep `json:"worktree"`
	Branch       CloseStep `json:"branch"`
	Base         CloseStep `json:"base"`
	WorktreePath string    `json:"worktreePath"`
	BranchName   string    `json:"branchName"`
	BaseBranch   string    `json:"baseBranch"`
	BaseCommits  int       `json:"baseCommits"`
	ClosedAt     string    `json:"closedAt"`
}

// PullRequest is the PR stage of a task, with its conversation and its state.
type PullRequest struct {
	// Status is preparing, blocked, drafting, draft_ready, awaiting_reply,
	// opening, reviewing, waiting_checks, awaiting_decision, in_review,
	// ready_to_approve, committing, done, trouble, merged, pr_closed, closing or
	// closed, a string for the same reason as State.Theme.
	Status       string   `json:"status"`
	Block        *PRBlock `json:"block"` // blocked only
	WorktreePath string   `json:"worktreePath"`
	Branch       string   `json:"branch"`
	BaseBranch   string   `json:"baseBranch"`

	Draft   *PRDraft   `json:"draft"`   // nil until the draft is written
	Reports []PRReport `json:"reports"` // never nil
	Review  *Review    `json:"review"`  // the review states and committing only
	// CommitFailed says the last approval of the review ended without a commit.
	CommitFailed bool `json:"commitFailed"`

	PRNumber int    `json:"prNumber"`
	PRURL    string `json:"prUrl"`
	PRState  string `json:"prState"` // open, merged or closed; "" when unknown
	// CheckedAt is when gh last reported the pull request; "" before that.
	CheckedAt string `json:"checkedAt"`
	// PRBase is the branch the pull request merges into; "" until read.
	PRBase string `json:"prBase"`
	// CheckError is what the last automatic reading said when it failed; ""
	// otherwise.
	CheckError string `json:"checkError"`
	// Trouble is what went wrong since the last review pass; meaningful in
	// trouble.
	Trouble PRTrouble `json:"trouble"`
	Checks  []PRCheck `json:"checks"` // the last reading, in GitHub's order; never nil
	// Mergeable is mergeable, conflicting or unknown; "" before the first
	// reading.
	Mergeable string `json:"mergeable"`
	// MergedBy is the login of who merged the pull request and MergedAt when,
	// RFC 3339; "" before the merge and for a merge read before they were
	// recorded.
	MergedBy string `json:"mergedBy"`
	MergedAt string `json:"mergedAt"`
	CanClose bool   `json:"canClose"` // the user may close the task now
	// CloneMissing says the closing waits for the clone of the repository.
	CloneMissing bool         `json:"cloneMissing"`
	Close        *CloseResult `json:"close"` // closed only

	SessionStage string `json:"sessionStage"` // "" when the stage has no conversation
	// SessionStatus is working, waiting, needs_permission, needs_answer, paused
	// or error.
	SessionStatus string `json:"sessionStatus"`
	// SessionModel and SessionEffort are what the session of the stage runs
	// with from its next message on; "" without a session.
	SessionModel   string `json:"sessionModel"`
	SessionEffort  string `json:"sessionEffort"`
	TurnRunning    bool   `json:"turnRunning"`
	ProcessRunning bool   `json:"processRunning"`
	RetryAttempt   int    `json:"retryAttempt"`
	// RetryMax, RetryAt (RFC 3339) and RetryReason (overloaded, rate_limit,
	// server, connection or other) go with RetryAttempt; zero without a retry.
	RetryMax    int    `json:"retryMax"`
	RetryAt     string `json:"retryAt"`
	RetryReason string `json:"retryReason"`
	// TurnFailed says the last turn ended in an error the CLI survived; the
	// session is at rest all the same.
	TurnFailed bool `json:"turnFailed"`
	// TurnStartedAt is when the turn in progress started, RFC 3339; "" without
	// a turn.
	TurnStartedAt string `json:"turnStartedAt"`
	PausedAt      string `json:"pausedAt"` // when the session was paused, RFC 3339; "" when it is not, or the time is unknown
	// ActionLabel and ActionTarget are the action the agent runs now, as the
	// conversation words it ("Reading", "internal/app/state.go"); "" when none
	// runs.
	ActionLabel    string `json:"actionLabel"`
	ActionTarget   string `json:"actionTarget"`
	ContextPercent int    `json:"contextPercent"`
	PendingCount   int    `json:"pendingCount"`
	LastError      string `json:"lastError"`
}

// PRCheck is one check of the pull request at the last reading.
type PRCheck struct {
	Name        string `json:"name"`
	State       string `json:"state"`       // passed, skipped, neutral, failed, running or queued
	Conclusion  string `json:"conclusion"`  // what GitHub concluded, lower case; "" while it runs
	StartedAt   string `json:"startedAt"`   // RFC 3339; "" when GitHub gave none
	CompletedAt string `json:"completedAt"` // RFC 3339; "" while it runs or when GitHub gave none
	URL         string `json:"url"`
}

// PRTrouble is what went wrong with a pull request after its review: the
// checks that failed, by name, and a conflict with its base.
type PRTrouble struct {
	FailedChecks []string `json:"failedChecks"` // never nil
	Conflict     bool     `json:"conflict"`
}

// PlanProblem is one reason the step files are not a valid plan.
type PlanProblem struct {
	File    string `json:"file"` // "" for the plan as a whole
	Message string `json:"message"`
}

// Place is where in a task a situation is.
type Place struct {
	// Kind is stage, step, step_review, pr, review or discussion, a string for
	// the same reason as State.Theme.
	Kind  string `json:"kind"`
	Stage string `json:"stage"` // stage only: prd, tech_spec, plan or one_shot
	Step  int    `json:"step"`  // step and step_review only
}

// Situation is something a task cannot go on without the user for.
type Situation struct {
	ID     string `json:"id"`
	TaskID string `json:"taskId"`
	// Kind is session_error, step_blocked, worktree_unreadable, pr_blocked,
	// plan_invalid, pr_closed, permission, question, reply, ready_to_continue,
	// step_review, step_empty, draft, findings, changes_review, merge,
	// review_report, new_commits, publish_failed, pass_blocked or drafts, a
	// string for the same reason as State.Theme.
	Kind string `json:"kind"`
	// Group is error, waiting or closing, from the most urgent, a string for
	// the same reason as State.Theme.
	Group string `json:"group"`
	// Form is review, staged or approve for step_review and changes_review,
	// merge or close for merge, decide, publish or apply for review_report,
	// and "" for every other kind, a string for the same reason as
	// State.Theme.
	Form      string `json:"form"`
	Percent   int    `json:"percent"` // staged form only
	Place     Place  `json:"place"`
	StartedAt string `json:"startedAt"`
}

// EventSituationStarted carries a SituationStarted every time a situation
// starts after the app loaded the tasks.
const EventSituationStarted = "situation:started"

// SituationStarted is a situation that just started, and whether the window
// was in front of the user when it did.
type SituationStarted struct {
	Situation Situation `json:"situation"`
	Focused   bool      `json:"focused"`
}

// EventSituationOpen carries a SituationOpen when the user clicks a
// notification.
const EventSituationOpen = "situation:open"

// SituationOpen asks the interface for the place a notification leads to.
type SituationOpen struct {
	TaskID string `json:"taskId"`
	Place  Place  `json:"place"`
}

// TaskSummary is an active task with the state of its session.
type TaskSummary struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	RepositoryID string    `json:"repositoryId"`
	Repository   string    `json:"repository"` // owner/name
	Card         *TaskCard `json:"card"`       // nil for a task without one
	// Mode is structured or one_shot, a string for the same reason as
	// State.Theme.
	Mode string `json:"mode"`
	// Stage is prd, tech_spec, plan, one_shot, implementation or pr, a string
	// for the same reason as State.Theme.
	Stage string `json:"stage"`
	// Revisiting is a stage reopened by the user, which moves on only when
	// they say so.
	Revisiting bool `json:"revisiting"`
	// ReviewMode is manual or agent: the mode of the task, which the steps
	// without a mode of their own take.
	ReviewMode         string `json:"reviewMode"`
	ReviewModeEditable bool   `json:"reviewModeEditable"` // a change of the mode still reaches a step
	// SessionStatus is working, waiting, needs_permission, needs_answer, paused
	// or error.
	SessionStatus string `json:"sessionStatus"`
	// SessionModel and SessionEffort are what the session the task screen shows
	// runs with from its next message on; "" without a session.
	SessionModel   string `json:"sessionModel"`
	SessionEffort  string `json:"sessionEffort"`
	TurnRunning    bool   `json:"turnRunning"`
	ProcessRunning bool   `json:"processRunning"`
	RetryAttempt   int    `json:"retryAttempt"`
	// RetryMax, RetryAt (RFC 3339) and RetryReason (overloaded, rate_limit,
	// server, connection or other) go with RetryAttempt; zero without a retry.
	RetryMax    int    `json:"retryMax"`
	RetryAt     string `json:"retryAt"`
	RetryReason string `json:"retryReason"`
	// TurnFailed says the last turn ended in an error the CLI survived; the
	// session is at rest all the same.
	TurnFailed bool `json:"turnFailed"`
	// TurnStartedAt is when the turn in progress started, RFC 3339; "" without
	// a turn.
	TurnStartedAt string `json:"turnStartedAt"`
	PausedAt      string `json:"pausedAt"` // when the session was paused, RFC 3339; "" when it is not, or the time is unknown
	// ActionLabel and ActionTarget are the action the agent runs now, as the
	// conversation words it ("Reading", "internal/app/state.go"); "" when none
	// runs.
	ActionLabel    string           `json:"actionLabel"`
	ActionTarget   string           `json:"actionTarget"`
	ContextPercent int              `json:"contextPercent"`
	PendingCount   int              `json:"pendingCount"`
	Corrections    int              `json:"corrections"`
	HasPRD         bool             `json:"hasPrd"`
	HasTechSpec    bool             `json:"hasTechSpec"`
	HasOneShot     bool             `json:"hasOneShot"`
	Steps          []Step           `json:"steps"`        // never nil
	CurrentStep    int              `json:"currentStep"`  // the step that runs or runs next; 0 when the task has no steps
	PR             *PullRequest     `json:"pr"`           // nil outside the pull request stage
	PlanProblems   []PlanProblem    `json:"planProblems"` // never nil
	Situations     []Situation      `json:"situations"`   // what the task waits on the user for, the most urgent first; never nil
	Models         []TaskStageModel `json:"models"`       // every stage, in workflow order; never nil
	// Conversations is every session the task has, open or closed, by start;
	// never nil.
	Conversations   []TaskConversation `json:"conversations"`
	Branch          string             `json:"branch"`       // the branch of the worktree of the task; "" before it exists
	BaseBranch      string             `json:"baseBranch"`   // as the worktree keeps it, origin/<base>; "" before it exists
	WorktreePath    string             `json:"worktreePath"` // "" before the worktree exists
	CanContinue     bool               `json:"canContinue"`
	ArtifactVersion int                `json:"artifactVersion"`
	LastError       string             `json:"lastError"`
	CreatedAt       string             `json:"createdAt"`
	UpdatedAt       string             `json:"updatedAt"`
}

// TaskConversation is a conversation a task has had, open or closed.
type TaskConversation struct {
	Stage     string `json:"stage"`     // the session stage: prd, tech_spec, plan, one_shot, step:<n>, step_review:<n>, pr or pr_review
	StartedAt string `json:"startedAt"` // RFC 3339
}

// ArchivedStep is one step of an archived task, as the plan wrote it.
type ArchivedStep struct {
	Number  int          `json:"number"`
	File    string       `json:"file"` // name inside steps/, the artifact is "steps/" + File; one-shot.md for the single step of a One-Shot task
	Title   string       `json:"title"`
	Reports []StepReport `json:"reports"` // never nil
}

// ArchivedPR is the pull request an archived task opened.
type ArchivedPR struct {
	Number int    `json:"number"`
	URL    string `json:"url"`
	State  string `json:"state"`
}

// ArchivedTask is a finished task, as the history shows it: its artifacts and
// what it touched, and nothing that runs.
type ArchivedTask struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	RepositoryID string    `json:"repositoryId"`
	Repository   string    `json:"repository"` // owner/name
	Card         *TaskCard `json:"card"`       // nil for a task without one
	// Mode is structured or one_shot, a string for the same reason as
	// State.Theme.
	Mode            string         `json:"mode"`
	HasPRD          bool           `json:"hasPrd"`
	HasTechSpec     bool           `json:"hasTechSpec"`
	HasOneShot      bool           `json:"hasOneShot"`
	Steps           []ArchivedStep `json:"steps"` // never nil
	PR              *ArchivedPR    `json:"pr"`    // nil when the task opened none
	ArtifactVersion int            `json:"artifactVersion"`
	CreatedAt       string         `json:"createdAt"`
	ArchivedAt      string         `json:"archivedAt"`
}

// WorktreePreview is the worktree the deletion of a task would remove, and
// whether it holds work.
type WorktreePreview struct {
	Path  string `json:"path"`
	Dirty bool   `json:"dirty"`
	Files int    `json:"files"` // changed files; dirty only
	Error string `json:"error"` // what git said when the worktree could not be read
}

// BranchPreview is the branch the deletion of a task would delete, and whether
// its commits are safe elsewhere.
type BranchPreview struct {
	Name   string `json:"name"`
	Merged bool   `json:"merged"`
	Error  string `json:"error"`
}

// PRPreview is a pull request the app leaves on GitHub when the task goes.
type PRPreview struct {
	Number int    `json:"number"`
	URL    string `json:"url"`
	// State is open, merged or closed; "" when unknown.
	State string `json:"state"`
}

// DeletePreview is what deleting a task would destroy, as the confirmation
// dialog spells it out.
type DeletePreview struct {
	SessionRunning bool             `json:"sessionRunning"`
	Worktree       *WorktreePreview `json:"worktree"` // nil when there is none
	Branch         *BranchPreview   `json:"branch"`   // nil when there is none
	PR             *PRPreview       `json:"pr"`       // nil when there is none
}

// Leftover is what git could not remove when a task was deleted.
type Leftover struct {
	Path   string `json:"path"`   // "" when the folder went
	Branch string `json:"branch"` // "" when the branch went
	Error  string `json:"error"`
}

// DeleteResult is what deleting a task left behind.
type DeleteResult struct {
	Leftover *Leftover `json:"leftover"` // nil when git removed everything
}

// UserEntry is a message sent to the agent: one the user wrote, or one the app
// sent on their behalf.
type UserEntry struct {
	Text    string `json:"text"`
	Pending bool   `json:"pending"`
	Prompt  bool   `json:"prompt"`
	App     bool   `json:"app"`
	// Sent is the rendered prompt the CLI got, for a prompt entry of the tech
	// spec, the plan, the pull request and the pull request review; "" for
	// every other entry.
	Sent string `json:"sent"`
	// AppKind is which message of the workflow the app sent: report, pass,
	// commit, commit_all, commit_push, correction, open, pr_pass or apply; ""
	// for every other entry. AppPass belongs to report, pass and pr_pass;
	// AppRound and AppRounds to report (the round of MaxReviewRounds) and
	// correction (the attempt of MaxCorrections); AppCount to report (the
	// findings, -1 when unknown), correction (the problems) and apply (the
	// approved findings).
	AppKind   string `json:"appKind"`
	AppPass   int    `json:"appPass"`
	AppRound  int    `json:"appRound"`
	AppRounds int    `json:"appRounds"`
	AppCount  int    `json:"appCount"`
}

// AssistantEntry is one content block of an assistant message.
type AssistantEntry struct {
	MessageID   string `json:"messageId"`
	BlockIndex  int    `json:"blockIndex"`
	Text        string `json:"text"`
	Complete    bool   `json:"complete"`
	Interrupted bool   `json:"interrupted"`
	// ParentToolUseID is the Agent/Task action of the subagent that wrote it;
	// "" in the main thread.
	ParentToolUseID string `json:"parentToolUseId"`
	// InterruptedBy is user or crash when the text was cut short, "" otherwise.
	InterruptedBy string `json:"interruptedBy"`
}

// ActionEntry is a tool call the agent made.
type ActionEntry struct {
	ToolUseID string `json:"toolUseId"`
	Tool      string `json:"tool"`
	Label     string `json:"label"`
	Target    string `json:"target"`
	// Status is running, done, error or interrupted.
	Status string `json:"status"`
	// Description is what the agent wrote the call is for; "" when none.
	Description string `json:"description"`
	// CommandLines counts the lines of a Bash command; 0 when unknown.
	CommandLines int `json:"commandLines"`
	// StartedAt and FinishedAt are RFC 3339, "" when unknown.
	StartedAt  string `json:"startedAt"`
	FinishedAt string `json:"finishedAt"`
	// ExitCode is the code a failed Bash command exited with, -1 when unknown.
	ExitCode int `json:"exitCode"`
	// ParentToolUseID is the Agent/Task action of the subagent that made it;
	// "" in the main thread.
	ParentToolUseID string `json:"parentToolUseId"`
	// OutputLines counts the lines of the whole output, 0 when it has none;
	// GetActionOutput reads it.
	OutputLines int `json:"outputLines"`
	// OutputTail is the end of the output the conversation shows.
	OutputTail string `json:"outputTail"`
	// OutputTruncated says the whole output is only the end of a longer one.
	OutputTruncated bool `json:"outputTruncated"`
	// InterruptedBy is user or crash when the status is interrupted, ""
	// otherwise.
	InterruptedBy string `json:"interruptedBy"`
}

// ActionOutput is the whole output of a tool call: ANSI stripped, at most its
// last 64 KiB.
type ActionOutput struct {
	Text      string `json:"text"`
	Lines     int    `json:"lines"`
	Truncated bool   `json:"truncated"`
}

// PermissionEntry is a tool the agent asked to use. Input and Suggestions carry
// raw JSON as a string, because the bindings generator has no stable type for
// json.RawMessage; the frontend parses them.
type PermissionEntry struct {
	RequestID           string `json:"requestId"`
	ToolUseID           string `json:"toolUseId"`
	Tool                string `json:"tool"`
	DisplayName         string `json:"displayName"`
	Description         string `json:"description"`
	Input               string `json:"input"`       // JSON object
	Suggestions         string `json:"suggestions"` // JSON array, "" when absent
	BlockedPath         string `json:"blockedPath"`
	DecisionReason      string `json:"decisionReason"`
	SuppressAlwaysAllow bool   `json:"suppressAlwaysAllow"`
	DefaultToNo         bool   `json:"defaultToNo"`
	// Status is pending, allowed, allowed_session, denied or cancelled.
	Status      string `json:"status"`
	DenyMessage string `json:"denyMessage"`
	AnsweredAt  string `json:"answeredAt"` // "" while pending
}

// QuestionOption is one answer offered for a question.
type QuestionOption struct {
	Label       string `json:"label"`
	Description string `json:"description"`
}

// Question is one of the questions of an AskUserQuestion call.
type Question struct {
	Question    string           `json:"question"`
	Header      string           `json:"header"`
	Options     []QuestionOption `json:"options"` // never nil
	MultiSelect bool             `json:"multiSelect"`
}

// QuestionEntry is a structured question the agent asked.
type QuestionEntry struct {
	RequestID string            `json:"requestId"`
	ToolUseID string            `json:"toolUseId"`
	Questions []Question        `json:"questions"` // never nil
	Answers   map[string]string `json:"answers"`   // question text -> label(s); nil while pending
	// Status is pending, allowed or cancelled.
	Status     string `json:"status"`
	AnsweredAt string `json:"answeredAt"` // RFC 3339; "" while pending, when cancelled or unknown
}

// MarkerEntry is a milestone of the conversation.
type MarkerEntry struct {
	// Type is prd_written, prd_updated, tech_spec_written, tech_spec_updated,
	// plan_written, plan_updated, one_shot_written, one_shot_updated,
	// pr_review_written, pr_review_revised, findings_decided,
	// review_published, new_commits, step_review_started,
	// step_review_written, review_started, discussion_started, stage_started,
	// step_started, compacted, interrupted, retried, committed, pr_opened,
	// checks_read, draft_approved, changes_approved, paused or plan_invalid.
	Type      string `json:"type"`
	PreTokens int    `json:"preTokens"`
	// Stage belongs to stage_started alone, Step to the markers of a step
	// (step_started, step_review_started), Pass to the markers of a review
	// (pr_review_written, pr_review_revised, step_review_written) with Clean;
	// Findings belongs to pr_review_written, pr_review_revised and
	// step_review_written, -1 when unknown; Restarted belongs to
	// stage_started and step_started.
	Stage     string `json:"stage"`
	Step      int    `json:"step"`
	Pass      int    `json:"pass"`
	Clean     bool   `json:"clean"`
	Findings  int    `json:"findings"`
	Restarted bool   `json:"restarted"`
	// Percent belongs to compacted: how full the context was, 0 when unknown.
	// Attempts and Reason (overloaded, rate_limit, server, connection or
	// other) belong to retried; InterruptedBy (user) to interrupted.
	Percent       int    `json:"percent"`
	Attempts      int    `json:"attempts"`
	Reason        string `json:"reason"`
	InterruptedBy string `json:"interruptedBy"`
	// SHA (short), Subject and Pushed belong to committed; Number to committed
	// with a push and to pr_opened, Base to pr_opened; Pass, Passed, Total,
	// Failed (never nil) and Conflict to checks_read; Title to draft_approved;
	// Files to changes_approved; Problems (never nil) to plan_invalid.
	SHA      string        `json:"sha"`
	Subject  string        `json:"subject"`
	Pushed   bool          `json:"pushed"`
	Number   int           `json:"number"`
	Base     string        `json:"base"`
	Passed   int           `json:"passed"`
	Total    int           `json:"total"`
	Failed   []string      `json:"failed"`
	Conflict bool          `json:"conflict"`
	Title    string        `json:"title"`
	Files    int           `json:"files"`
	Problems []PlanProblem `json:"problems"`
	// Model, Effort and Mode (publish or apply) belong to review_started;
	// Approved and Discarded to findings_decided; Verdict, Inline, Body,
	// Summary, Minimal and URL to review_published; Commits (never nil) and
	// Count (-1 when the head before is not among the ones read) to
	// new_commits.
	Model     string         `json:"model"`
	Effort    string         `json:"effort"`
	Mode      string         `json:"mode"`
	Approved  int            `json:"approved"`
	Discarded int            `json:"discarded"`
	Verdict   string         `json:"verdict"`
	Inline    int            `json:"inline"`
	Body      int            `json:"body"`
	Summary   bool           `json:"summary"`
	Minimal   bool           `json:"minimal"`
	URL       string         `json:"url"`
	Commits   []MarkerCommit `json:"commits"`
	Count     int            `json:"count"`
}

// MarkerCommit is a commit of a new_commits marker; the SHA is the short one.
type MarkerCommit struct {
	SHA     string `json:"sha"`
	Subject string `json:"subject"`
	Author  string `json:"author"`
}

// ErrorEntry is a failure shown in the conversation.
type ErrorEntry struct {
	// Kind is process_exit, start_failed, not_found, not_logged_in or
	// turn_error.
	Kind      string `json:"kind"`
	Message   string `json:"message"`
	Retryable bool   `json:"retryable"`
}

// Entry is one item of a conversation. Exactly one payload is set, the one
// matching Kind.
type Entry struct {
	ID  string `json:"id"`
	Seq int    `json:"seq"`
	// TurnID is the id of the user entry that started the turn of this entry.
	TurnID string `json:"turnId"`
	// Kind is user, assistant, action, permission, question, marker or error.
	Kind       string           `json:"kind"`
	CreatedAt  string           `json:"createdAt"`
	User       *UserEntry       `json:"user"`
	Assistant  *AssistantEntry  `json:"assistant"`
	Action     *ActionEntry     `json:"action"`
	Permission *PermissionEntry `json:"permission"`
	Question   *QuestionEntry   `json:"question"`
	Marker     *MarkerEntry     `json:"marker"`
	Error      *ErrorEntry      `json:"error"`
}

// Transcript is the whole conversation of a task.
type Transcript struct {
	TaskID    string `json:"taskId"`
	SessionID string `json:"sessionId"`
	// Stage is the stage of the session the conversation belongs to.
	Stage   string  `json:"stage"`
	Entries []Entry `json:"entries"` // never nil
	Pending []Entry `json:"pending"` // never nil
}

// TranscriptEvent is one change to the conversation of a task.
type TranscriptEvent struct {
	TaskID string `json:"taskId"`
	Stage  string `json:"stage"`
	// Kind is entry, text, remove or reset.
	Kind    string `json:"kind"`
	Entry   *Entry `json:"entry"`
	EntryID string `json:"entryId"`
	Text    string `json:"text"`
}

// StageModel is the model and effort of one stage.
type StageModel struct {
	// Stage is prd, tech_spec, plan, one_shot, implementation, step_review, pr,
	// pr_review or discussion, a string for the same reason as State.Theme.
	Stage  string `json:"stage"`
	Model  string `json:"model"`  // the full name of the model, as the catalog gives it
	Effort string `json:"effort"` // an effort level of the model, or "" for a model that takes none
}

// ModelCatalog is what the installed Claude Code offers: the models the
// pickers list and the effort levels of each. It is read once per app run and
// kept from the last successful reading of this machine.
type ModelCatalog struct {
	// Models are the models the pickers offer, in the order the CLI lists
	// them; never nil. Empty while no reading ever succeeded on this machine.
	Models []CatalogModel `json:"models"`
	// Failure is why there is no catalog: not_found, unsupported or failed; ""
	// while the reading runs and whenever there is a catalog, a string for the
	// same reason as State.Theme.
	Failure string `json:"failure"`
}

// CatalogModel is one model of the catalog.
type CatalogModel struct {
	Name    string   `json:"name"`    // the full name, as --model takes it: claude-opus-5-5[1m]
	Efforts []string `json:"efforts"` // the effort levels it accepts, from the least; never nil; empty for a model that takes none
}

// TaskStageModel is the model and effort of one stage of a task, with what the
// user can still do about it.
type TaskStageModel struct {
	Stage    string `json:"stage"` // as StageModel.Stage
	Model    string `json:"model"`
	Effort   string `json:"effort"`
	Editable bool   `json:"editable"` // a session of the stage is still to start
	Live     bool   `json:"live"`     // a session of the stage runs now: it changes in its conversation
}

// Prompt is the text a kind of session opens with, as the settings show it.
type Prompt struct {
	// Stage is prd, tech_spec, plan, one_shot, step_review, commit, pr,
	// pr_review or discussion, a string for the same reason as State.Theme.
	Stage    string `json:"stage"`
	Text     string `json:"text"`
	Modified bool   `json:"modified"` // the user edited it: it no longer follows the default of the app
	// Placeholders are the placeholders the default of the prompt uses, in the
	// order the settings list them; never nil.
	Placeholders []string `json:"placeholders"`
}

// CreateTaskRequest is the task the user filled in the creation dialog.
type CreateTaskRequest struct {
	Name           string `json:"name"`
	RepositoryID   string `json:"repositoryId"`
	InitialContext string `json:"initialContext"`
	Mode           string `json:"mode"` // structured or one_shot; "" is structured
	// Models are the choices of the creation dialog. A stage left out takes the
	// default of the app.
	Models     []StageModel `json:"models"`
	ReviewMode string       `json:"reviewMode"` // manual or agent; "" takes the default of the app
	// Card is the card the task is created from; nil for a task without one. With
	// a card, RepositoryID is ignored, and InitialContext is the text the user
	// added.
	Card *CreateTaskCard `json:"card"`
}

// CreateTaskCard is the card of a board a task is created from.
type CreateTaskCard struct {
	BoardID string `json:"boardId"`
	Key     string `json:"key"`
}

// BoardStatus is one option of the Status field of a board.
type BoardStatus struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Final bool   `json:"final"`
}

// BoardFailure is why the last reading of a board failed.
type BoardFailure struct {
	// Reason is gh_missing, gh_unauthenticated, missing_scope, not_found,
	// rate_limited or failed, a string for the same reason as State.Theme.
	Reason   string `json:"reason"`
	Message  string `json:"message"`
	FailedAt string `json:"failedAt"`
}

// Board is a registered board with its last reading.
type Board struct {
	ID    string `json:"id"`
	Owner string `json:"owner"`
	// OwnerType is organization or user, a string for the same reason as
	// State.Theme.
	OwnerType     string        `json:"ownerType"`
	Number        int           `json:"number"`
	Title         string        `json:"title"`
	URL           string        `json:"url"`
	HasStatus     bool          `json:"hasStatus"`
	Statuses      []BoardStatus `json:"statuses"`      // board order; never nil
	RepositoryIDs []string      `json:"repositoryIds"` // never nil
	ReadAt        string        `json:"readAt"`        // "" before a reading succeeded
	Reading       bool          `json:"reading"`
	Failure       *BoardFailure `json:"failure"`
	Viewer        string        `json:"viewer"` // the login of gh at the last reading
	Cards         []BoardCard   `json:"cards"`  // never nil
	// NewCardStatus is the option id of the Status field a card created by a
	// discussion gets; "" for none.
	NewCardStatus string `json:"newCardStatus"`
}

// CardIssue is an issue of GitHub a board shows.
type CardIssue struct {
	Key        string `json:"key"`
	Repository string `json:"repository"` // owner/name
	Number     int    `json:"number"`
	Title      string `json:"title"`
	URL        string `json:"url"`
	State      string `json:"state"` // open or closed
}

// CardPullRequest is a pull request linked to an issue.
type CardPullRequest struct {
	Repository string `json:"repository"`
	Number     int    `json:"number"`
	URL        string `json:"url"`
	State      string `json:"state"` // open, merged or closed
}

// CardRelated is an issue next to a card: a sibling or a dependency.
type CardRelated struct {
	CardIssue
	Status  string `json:"status"`
	OnBoard bool   `json:"onBoard"`
}

// CardDependency is an issue a card depends on, with the pull requests that
// close it.
type CardDependency struct {
	CardRelated
	PullRequests []CardPullRequest `json:"pullRequests"` // never nil
	Satisfied    bool              `json:"satisfied"`
}

// CardField is a board field of a card with its value.
type CardField struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

// CardAssignee is a person a card is assigned to.
type CardAssignee struct {
	Login     string `json:"login"`
	AvatarURL string `json:"avatarUrl"`
}

// BoardCard is one card of a board, with what the user can do with it.
type BoardCard struct {
	CardIssue
	Body           string            `json:"body"`
	StatusID       string            `json:"statusId"`
	Status         string            `json:"status"`
	Final          bool              `json:"final"`        // the status is final, or the issue is closed
	Assignees      []CardAssignee    `json:"assignees"`    // never nil
	Fields         []CardField       `json:"fields"`       // never nil
	PullRequests   []CardPullRequest `json:"pullRequests"` // never nil
	Epic           *CardIssue        `json:"epic"`
	EpicBody       string            `json:"epicBody"`
	Siblings       []CardRelated     `json:"siblings"`     // never nil
	Dependencies   []CardDependency  `json:"dependencies"` // never nil
	ReadAt         string            `json:"readAt"`
	SuggestedName  string            `json:"suggestedName"`
	RepositoryID   string            `json:"repositoryId"`   // the registered repository of the card; "" when not registered
	ActiveTaskID   string            `json:"activeTaskId"`   // "" without one
	ArchivedTaskID string            `json:"archivedTaskId"` // the most recently archived; "" without one
	// Action is start, clone, clone_missing, add_to_board, other_board,
	// has_task or closed: what Start task does for the card, a string for the
	// same reason as State.Theme.
	Action     string `json:"action"`
	OtherBoard string `json:"otherBoard"` // other_board: the title of that board
	// WrittenBy is the discussion that wrote the card; nil for none.
	WrittenBy *WritingDiscussion `json:"writtenBy"`
}

// TaskCard is the card a task was created from.
type TaskCard struct {
	BoardID    string     `json:"boardId"`
	Key        string     `json:"key"`
	Repository string     `json:"repository"`
	Number     int        `json:"number"`
	Title      string     `json:"title"`
	URL        string     `json:"url"`
	Status     string     `json:"status"`
	State      string     `json:"state"`
	Epic       *CardIssue `json:"epic"` // State of the epic is ""; the task does not keep it
}

// WritingDiscussion is the discussion that wrote a card.
type WritingDiscussion struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Archived bool   `json:"archived"`
}

// BoardRepositoryOption is a repository the board dialog offers, with how it
// would tie to the app.
type BoardRepositoryOption struct {
	Owner    string `json:"owner"`
	Name     string `json:"name"`
	FullName string `json:"fullName"`
	Cards    int    `json:"cards"`
	Checked  bool   `json:"checked"`
	// Link is registered, clone, uncloned or other_board, a string for the same
	// reason as State.Theme.
	Link         string   `json:"link"`
	RepositoryID string   `json:"repositoryId"`
	Path         string   `json:"path"`
	Clones       []string `json:"clones"` // never nil
	OtherBoard   string   `json:"otherBoard"`
}

// BoardPreview is what registering or editing a board shows before saving.
type BoardPreview struct {
	URL          string                  `json:"url"`
	Owner        string                  `json:"owner"`
	OwnerType    string                  `json:"ownerType"`
	Number       int                     `json:"number"`
	Title        string                  `json:"title"`
	HasStatus    bool                    `json:"hasStatus"`
	Statuses     []BoardStatus           `json:"statuses"`     // never nil
	Repositories []BoardRepositoryOption `json:"repositories"` // never nil
	// NewCardStatus is the option a card created by a discussion gets; "" for
	// none.
	NewCardStatus string `json:"newCardStatus"`
}

// BoardRepositoryChoice is a repository the user checked in the board dialog.
type BoardRepositoryChoice struct {
	Owner string `json:"owner"`
	Name  string `json:"name"`
	Path  string `json:"path"`
}

// SaveBoardRequest is what the user chose in the board dialog.
type SaveBoardRequest struct {
	FinalStatuses []string                `json:"finalStatuses"`
	Repositories  []BoardRepositoryChoice `json:"repositories"`
	// NewCardStatus is the option a card created by a discussion gets; "" for
	// none.
	NewCardStatus string `json:"newCardStatus"`
}

// BoardRemoval is what removing a board does to its repositories: how many go
// to no board and how many are removed.
type BoardRemoval struct {
	ToNoBoard int `json:"toNoBoard"`
	Removed   int `json:"removed"`
}

// ReviewCenter is the Reviews view: the open pull requests of every registered
// repository, as the last reading found them, and the filters the view shows
// them through.
type ReviewCenter struct {
	// PullRequests are the pull requests of the last reading, the pending ones
	// first and then the most recently updated; never nil.
	PullRequests []PullRequestRow `json:"pullRequests"`
	// Failures are the repositories the last reading could not read; never nil.
	Failures []PullsFailure `json:"failures"`
	ReadAt   string         `json:"readAt"` // "" before the first reading
	Reading  bool           `json:"reading"`
	Filters  ReviewFilters  `json:"filters"`
	// PendingCount is how many pending pull requests pass the filters.
	PendingCount int `json:"pendingCount"`
	// Authors and Labels are what the reading found, of every pull request and
	// not only the ones the filters keep, in alphabetical order; never nil.
	Authors []string `json:"authors"`
	Labels  []string `json:"labels"`
}

// PullsFailure is why the last reading of one repository failed.
type PullsFailure struct {
	RepositoryID string `json:"repositoryId"`
	Repository   string `json:"repository"` // owner/name
	Message      string `json:"message"`
	FailedAt     string `json:"failedAt"` // RFC 3339: the first failing reading of the run
}

// ReviewFilters is what the Reviews view shows. The zero value shows
// everything.
type ReviewFilters struct {
	BoardID string `json:"boardId"` // "" for any; __none__ for the repositories without one
	// RepositoryID is the repository the view shows; "" for any.
	RepositoryID   string   `json:"repositoryId"`
	AuthorsInclude []string `json:"authorsInclude"` // never nil
	AuthorsExclude []string `json:"authorsExclude"` // never nil
	LabelsInclude  []string `json:"labelsInclude"`  // never nil
	LabelsExclude  []string `json:"labelsExclude"`  // never nil
	// BoardName and RepositoryName are the names of the board or the repository
	// when it was chosen, which the chip of one that left shows.
	BoardName      string `json:"boardName"`
	RepositoryName string `json:"repositoryName"`
}

// PullLabel is a label of a pull request, as GitHub colours it.
type PullLabel struct {
	Name  string `json:"name"`
	Color string `json:"color"`
}

// PullCard is the card a pull request is linked to.
type PullCard struct {
	BoardID string `json:"boardId"`
	Number  int    `json:"number"`
	Title   string `json:"title"`
	URL     string `json:"url"`
	Status  string `json:"status"` // the Status of the card on its board; "" for none
}

// PullRequestRow is one open pull request in the Reviews view.
type PullRequestRow struct {
	Key          string      `json:"key"` // owner/name#number, in lower case
	RepositoryID string      `json:"repositoryId"`
	Repository   string      `json:"repository"` // owner/name
	BoardID      string      `json:"boardId"`    // "" when the repository has no board
	Number       int         `json:"number"`
	Title        string      `json:"title"`
	URL          string      `json:"url"`
	Author       string      `json:"author"`
	Labels       []PullLabel `json:"labels"` // never nil
	Draft        bool        `json:"draft"`
	Own          bool        `json:"own"` // the author is the account of gh
	Card         *PullCard   `json:"card"`
	// Reviewed says the account of gh submitted a review of it, and NewCommits
	// that the pull request moved since that review.
	Reviewed   bool `json:"reviewed"`
	NewCommits bool `json:"newCommits"`
	Pending    bool `json:"pending"`  // it waits for the review of the user
	Filtered   bool `json:"filtered"` // the filters of the view hide it
	// TaskID is the task of the product the pull request belongs to; "" when it
	// belongs to none.
	TaskID string `json:"taskId"`
	// ReviewID is the active review of the pull request; "" when there is none.
	ReviewID string `json:"reviewId"`
	// Action is review, open_review, open_task, clone, clone_missing or fork,
	// a string for the same reason as State.Theme.
	Action    string `json:"action"`
	UpdatedAt string `json:"updatedAt"`
	// HeadBranch and BaseBranch are the branch of the pull request and the one
	// it merges into.
	HeadBranch string    `json:"headBranch"`
	BaseBranch string    `json:"baseBranch"`
	Body       string    `json:"body"`   // the description, Markdown; "" without one
	Checks     []PRCheck `json:"checks"` // never nil
	// Mergeable is mergeable, conflicting, unknown or "", a string for the same
	// reason as State.Theme.
	Mergeable string `json:"mergeable"`
	// YourReview is the last review the account of gh submitted; null without
	// one.
	YourReview *PullReview `json:"yourReview"`
	// NewCommitCount is how many commits came after that review; -1 when its
	// commit is not among the last 100.
	NewCommitCount int `json:"newCommitCount"`
}

// PullReview is a review the account of gh submitted: its state and when.
type PullReview struct {
	// State is approved, changes_requested, commented or dismissed, a string for
	// the same reason as State.Theme.
	State string `json:"state"`
	At    string `json:"at"` // RFC 3339
}

// ReviewFinding is one numbered finding of a pass of a review.
type ReviewFinding struct {
	Number int    `json:"number"`
	Title  string `json:"title"`
	Path   string `json:"path"` // the file it is anchored to; "" for a general finding
	Line   int    `json:"line"` // the line of the new side of the diff; 0 for a general finding
	// LineURL is the line in Files changed on GitHub; "" for a general finding.
	LineURL string `json:"lineUrl"`
	Text    string `json:"text"`
	// Decision is "", approved or discarded, a string for the same reason as
	// State.Theme.
	Decision string `json:"decision"`
	// Placement is "", inline or body: where the finding went when the pass was
	// published.
	Placement string `json:"placement"`
}

// ReviewPass is one pass of the agent over the pull request, with the report it
// wrote and what the user did with it.
type ReviewPass struct {
	Pass         int             `json:"pass"`
	File         string          `json:"file"` // the report inside the artifact folder: review-<n>.md
	Recorded     bool            `json:"recorded"`
	Clean        bool            `json:"clean"`
	Instructions string          `json:"instructions"` // what the user wrote when asking for the pass
	Summary      string          `json:"summary"`
	Findings     []ReviewFinding `json:"findings"` // never nil
	// Revision is bumped every time the report is read again and differs, which
	// is what tells the interface to drop the drafts of the user.
	Revision     int    `json:"revision"`
	Published    bool   `json:"published"`
	PublishedAt  string `json:"publishedAt"`  // "" when the pass was not published
	PublishedURL string `json:"publishedUrl"` // "" when the pass was not published
	// Verdict is approve, request_changes or comment; "" when the pass was not
	// published.
	Verdict string `json:"verdict"`
	// Edited is whether the user changed the summary or the text of a finding
	// from what the report has, which another pass would discard.
	Edited bool `json:"edited"`
	// Checks, Mergeable and ChecksReadAt are the checks of the reading that let
	// the pass start, whether the branch merged into the base then, and when it
	// was made (RFC 3339); empty for a pass sent before they were kept.
	Checks           []PRCheck `json:"checks"` // never nil
	Mergeable        string    `json:"mergeable"`
	ChecksReadAt     string    `json:"checksReadAt"`
	RecordedAt       string    `json:"recordedAt"`       // when the report was first recorded, RFC 3339; "" when unknown
	SentAt           string    `json:"sentAt"`           // when the approved findings went to the agent, RFC 3339; "" when unknown
	Sent             bool      `json:"sent"`             // the approved findings went to the agent (apply mode)
	SummaryPublished bool      `json:"summaryPublished"` // the summary went with the published review
}

// ReviewSummary is an active review of a pull request, with the state of its
// conversation.
type ReviewSummary struct {
	ID           string `json:"id"`
	RepositoryID string `json:"repositoryId"`
	Repository   string `json:"repository"` // owner/name
	Number       int    `json:"number"`
	Title        string `json:"title"`
	Author       string `json:"author"`
	URL          string `json:"url"`
	HeadBranch   string `json:"headBranch"`
	BaseBranch   string `json:"baseBranch"` // as GitHub names it, without origin/
	Own          bool   `json:"own"`        // the author is the account of gh
	// Mode is publish or apply, a string for the same reason as State.Theme.
	Mode string `json:"mode"`
	// Status is reviewing, waiting_checks, pass_blocked, awaiting_reply,
	// awaiting_decision, ready_to_publish, publish_failed, published,
	// new_commits, ready_to_apply, applying, in_review, ready_to_approve,
	// committing, ready_to_merge or trouble.
	Status       string       `json:"status"`
	Card         *PullCard    `json:"card"` // nil when the pull request has no card
	WorktreePath string       `json:"worktreePath"`
	Passes       []ReviewPass `json:"passes"` // in pass order; never nil
	// StalePass says the pull request moved since the pass the user is
	// deciding on.
	StalePass bool `json:"stalePass"`
	// CheckError is what the last automatic reading of the pull request said
	// when it failed, as the user reads it; "" otherwise. CheckErrorAt is the
	// first failing reading of the run (RFC 3339); "" when the last one worked.
	CheckError   string `json:"checkError"`
	CheckErrorAt string `json:"checkErrorAt"`
	// Checks and Mergeable are the live checks and the merge of the last
	// reading; CheckedAt is when it was made (RFC 3339), "" before one since
	// the app started.
	Checks    []PRCheck `json:"checks"` // never nil
	Mergeable string    `json:"mergeable"`
	CheckedAt string    `json:"checkedAt"`
	// NewCommits is how many commits came since the published commit, -1 when
	// unknown, 0 outside new_commits; StaleCommits, since the pass being
	// decided, -1 when unknown, 0 when the pass isn't stale.
	NewCommits   int `json:"newCommits"`
	StaleCommits int `json:"staleCommits"`
	// Trouble is what went wrong since the last review pass; meaningful in
	// trouble.
	Trouble PRTrouble `json:"trouble"`
	// PublishError is why the last publication failed; "" otherwise.
	PublishError string `json:"publishError"`
	PassBlocked  string `json:"passBlocked"` // why the pass the app asked for could not start; "" otherwise
	// UnreadableReport is why the report of the pass the app asked for could
	// not be read; "" otherwise.
	UnreadableReport string `json:"unreadableReport"`
	// CommitFailed says the last approval of apply mode ended without a commit.
	CommitFailed bool `json:"commitFailed"`
	// Review is the last reading of the worktree; apply mode only.
	Review *Review `json:"review"`
	// Verdicts are the verdicts this review can be published with, in the order
	// the dialog offers them; never nil.
	Verdicts       []string `json:"verdicts"`
	CanPublish     bool     `json:"canPublish"`
	CanApply       bool     `json:"canApply"`
	CanApprove     bool     `json:"canApprove"`
	CanReviewAgain bool     `json:"canReviewAgain"`

	SessionStage string `json:"sessionStage"` // review, or "" without a conversation
	// SessionStatus is working, waiting, needs_permission, needs_answer, paused
	// or error.
	SessionStatus string `json:"sessionStatus"`
	// SessionModel and SessionEffort are what the conversation runs with from
	// its next message on; "" without a session.
	SessionModel   string `json:"sessionModel"`
	SessionEffort  string `json:"sessionEffort"`
	TurnRunning    bool   `json:"turnRunning"`
	ProcessRunning bool   `json:"processRunning"`
	RetryAttempt   int    `json:"retryAttempt"`
	// RetryMax, RetryAt (RFC 3339) and RetryReason (overloaded, rate_limit,
	// server, connection or other) go with RetryAttempt; zero without a retry.
	RetryMax    int    `json:"retryMax"`
	RetryAt     string `json:"retryAt"`
	RetryReason string `json:"retryReason"`
	// TurnFailed says the last turn ended in an error the CLI survived; the
	// session is at rest all the same.
	TurnFailed bool `json:"turnFailed"`
	// TurnStartedAt is when the turn in progress started, RFC 3339; "" without
	// a turn.
	TurnStartedAt string `json:"turnStartedAt"`
	PausedAt      string `json:"pausedAt"` // when the session was paused, RFC 3339; "" when it is not, or the time is unknown
	// ActionLabel and ActionTarget are the action the agent runs now, as the
	// conversation words it ("Reading", "internal/app/state.go"); "" when none
	// runs.
	ActionLabel    string      `json:"actionLabel"`
	ActionTarget   string      `json:"actionTarget"`
	ContextPercent int         `json:"contextPercent"`
	PendingCount   int         `json:"pendingCount"`
	LastError      string      `json:"lastError"`
	Situations     []Situation `json:"situations"` // what the review waits on the user for; never nil
	CreatedAt      string      `json:"createdAt"`
}

// ArchivedReview is a review whose pull request was merged or closed, as the
// history shows it.
type ArchivedReview struct {
	ID           string `json:"id"`
	RepositoryID string `json:"repositoryId"`
	Repository   string `json:"repository"` // owner/name
	Number       int    `json:"number"`
	Title        string `json:"title"`
	Author       string `json:"author"`
	URL          string `json:"url"`
	// Mode is publish or apply, a string for the same reason as State.Theme.
	Mode string `json:"mode"`
	// Outcome is merged or closed: what became of the pull request.
	Outcome    string       `json:"outcome"`
	BaseBranch string       `json:"baseBranch"` // as GitHub names it, without origin/
	Card       *PullCard    `json:"card"`       // nil when the pull request had no card
	Passes     []ReviewPass `json:"passes"`
	// MergedBy is the login of who merged the pull request, MergedAt when, and
	// ClosedAt when it closed (RFC 3339); "" when it did not happen or was not
	// kept.
	MergedBy   string `json:"mergedBy"`
	MergedAt   string `json:"mergedAt"`
	ClosedAt   string `json:"closedAt"`
	CreatedAt  string `json:"createdAt"`
	ArchivedAt string `json:"archivedAt"`
}

// StartReviewRequest is what the user chose in the dialog that starts a review.
type StartReviewRequest struct {
	RepositoryID string `json:"repositoryId"`
	Number       int    `json:"number"`
	Instructions string `json:"instructions"` // what to look at in this pass; "" for none
	Model        string `json:"model"`
	Effort       string `json:"effort"`
	// Mode is publish or apply, a string for the same reason as State.Theme.
	Mode string `json:"mode"`
}

// DiscussionCard is an issue of the board a discussion started from.
type DiscussionCard struct {
	Key        string `json:"key"`        // owner/name#number in lower case
	Repository string `json:"repository"` // owner/name
	Number     int    `json:"number"`
	Title      string `json:"title"`
	URL        string `json:"url"`
}

// DraftRef is what a draft points at: another draft, or an issue on GitHub.
type DraftRef struct {
	Draft     string `json:"draft"`     // the id of a draft of the discussion; "" for an issue
	Key       string `json:"key"`       // owner/name#number in lower case; "" for a draft
	Reference string `json:"reference"` // owner/name#number as GitHub writes it; "" for a draft
	Title     string `json:"title"`     // the title of the draft, or of the issue when the reading has it
	URL       string `json:"url"`       // the issue; "" for a draft or an issue the reading lacks
}

// DraftDependency is a card a draft can only start after, with what became of
// it on GitHub.
type DraftDependency struct {
	DraftRef
	Linked bool `json:"linked"` // GitHub has the relation
	// Dropped is "", discarded or unavailable, a string for the same reason as
	// State.Theme.
	Dropped string `json:"dropped"`
	Detail  string `json:"detail"` // unavailable only: what gh said
}

// DraftCurrent is the card an update draft changes, as the stored reading has
// it.
type DraftCurrent struct {
	Title        string     `json:"title"`
	Body         string     `json:"body"`
	Module       string     `json:"module"`       // the value of the module field; "" for none
	Status       string     `json:"status"`       // the option of the Status field; "" for none
	Epic         *DraftRef  `json:"epic"`         // nil without an epic
	Dependencies []DraftRef `json:"dependencies"` // never nil
	ReadAt       string     `json:"readAt"`
}

// Draft is one card a discussion produced: as the user left it, and what
// became of it on GitHub.
type Draft struct {
	ID       string `json:"id"`
	Position int    `json:"position"`
	// Kind is new, update or epic, a string for the same reason as State.Theme.
	Kind string `json:"kind"`
	// Source is agent or user: who the draft came from.
	Source string `json:"source"`
	// Repository is owner/name, and RepositoryID the registered repository of
	// it; "" when it is not registered or left the board.
	Repository   string            `json:"repository"`
	RepositoryID string            `json:"repositoryId"`
	Card         *DiscussionCard   `json:"card"` // update only; nil otherwise
	Title        string            `json:"title"`
	Body         string            `json:"body"`
	Module       string            `json:"module"`       // the name of the option; "" for none
	Epic         *DraftRef         `json:"epic"`         // nil without an epic
	Dependencies []DraftDependency `json:"dependencies"` // never nil
	Current      *DraftCurrent     `json:"current"`      // update only; nil otherwise
	// Decision is "", approved or discarded, a string for the same reason as
	// State.Theme.
	Decision string   `json:"decision"`
	Revision int      `json:"revision"` // bumped every time the artifact changes the draft
	Warnings []string `json:"warnings"` // never nil
	// Outcome is "", created or updated: what the publication did on GitHub.
	Outcome      string `json:"outcome"`
	Number       int    `json:"number"`
	URL          string `json:"url"`
	Published    bool   `json:"published"` // every step of the publication is done
	PublishedAt  string `json:"publishedAt"`
	Publishing   bool   `json:"publishing"`   // the draft is in the publication under way
	PublishError string `json:"publishError"` // why the last publication failed; "" otherwise
	// Waits is the title of the draft this one waits for before it is
	// published; "" when it waits for none.
	Waits string `json:"waits"`
	// CanPublish says Publish epic is enabled; epics only.
	CanPublish bool `json:"canPublish"`
	// Hint is why an epic can't be published, or why a card of a discarded
	// epic goes nowhere.
	Hint string `json:"hint"`
}

// DiscussionRepository is a repository of the board a new card can be created
// in.
type DiscussionRepository struct {
	ID       string `json:"id"`
	FullName string `json:"fullName"` // owner/name
	Cloned   bool   `json:"cloned"`
	Missing  bool   `json:"missing"`
}

// DiscussionSummary is an active discussion of a demand of a board, as the
// interface shows it.
type DiscussionSummary struct {
	ID      string `json:"id"`
	BoardID string `json:"boardId"`
	Board   string `json:"board"` // the title of the board
	Title   string `json:"title"`
	Text    string `json:"text"` // what the user wrote when creating it; "" for none
	// Status is discussing, awaiting_drafts, deciding, publishing,
	// publish_failed or published, a string for the same reason as State.Theme.
	Status string           `json:"status"`
	Cards  []DiscussionCard `json:"cards"`  // the cards it started from; never nil
	Drafts []Draft          `json:"drafts"` // in position order; never nil
	// DraftsRead says a readable drafts artifact was recorded, and
	// DraftsRevision changes every time the artifact is read again and differs.
	DraftsRead     bool `json:"draftsRead"`
	DraftsRevision int  `json:"draftsRevision"`
	// UnreadableDrafts is why the drafts artifact could not be read; ""
	// otherwise.
	UnreadableDrafts string `json:"unreadableDrafts"`
	// HasDocument says the agent wrote the document of the discussion, and
	// DocumentRevision changes every time it does.
	HasDocument      bool `json:"hasDocument"`
	DocumentRevision int  `json:"documentRevision"`
	// ModuleField is the name of the module field of the board; "" without one.
	ModuleField   string   `json:"moduleField"`
	ModuleOptions []string `json:"moduleOptions"` // the names of the options; never nil
	// Repositories are the repositories of the board, by owner/name; never nil.
	Repositories []DiscussionRepository `json:"repositories"`
	// CanArchive says the discussion can leave the list for the history, and
	// ArchiveHint is why it cannot.
	CanArchive  bool   `json:"canArchive"`
	ArchiveHint string `json:"archiveHint"`

	SessionStage string `json:"sessionStage"` // discussion, or "" without a conversation
	// SessionStatus is working, waiting, needs_permission, needs_answer, paused
	// or error.
	SessionStatus string `json:"sessionStatus"`
	// SessionModel and SessionEffort are what the conversation runs with from
	// its next message on; "" without a session.
	SessionModel   string `json:"sessionModel"`
	SessionEffort  string `json:"sessionEffort"`
	TurnRunning    bool   `json:"turnRunning"`
	ProcessRunning bool   `json:"processRunning"`
	RetryAttempt   int    `json:"retryAttempt"`
	// RetryMax, RetryAt (RFC 3339) and RetryReason (overloaded, rate_limit,
	// server, connection or other) go with RetryAttempt; zero without a retry.
	RetryMax    int    `json:"retryMax"`
	RetryAt     string `json:"retryAt"`
	RetryReason string `json:"retryReason"`
	// TurnFailed says the last turn ended in an error the CLI survived; the
	// session is at rest all the same.
	TurnFailed bool `json:"turnFailed"`
	// TurnStartedAt is when the turn in progress started, RFC 3339; "" without
	// a turn.
	TurnStartedAt string `json:"turnStartedAt"`
	PausedAt      string `json:"pausedAt"` // when the session was paused, RFC 3339; "" when it is not, or the time is unknown
	// ActionLabel and ActionTarget are the action the agent runs now, as the
	// conversation words it ("Reading", "internal/app/state.go"); "" when none
	// runs.
	ActionLabel    string      `json:"actionLabel"`
	ActionTarget   string      `json:"actionTarget"`
	ContextPercent int         `json:"contextPercent"`
	PendingCount   int         `json:"pendingCount"`
	LastError      string      `json:"lastError"`
	Situations     []Situation `json:"situations"` // what the discussion waits on the user for; never nil
	CreatedAt      string      `json:"createdAt"`
}

// ArchivedDiscussion is a discussion of the history, with what it produced.
type ArchivedDiscussion struct {
	ID      string           `json:"id"`
	BoardID string           `json:"boardId"`
	Board   string           `json:"board"` // the title of the board
	Title   string           `json:"title"`
	Cards   []DiscussionCard `json:"cards"`  // never nil
	Drafts  []Draft          `json:"drafts"` // in position order; never nil
	// PublishedCount is how many drafts went to GitHub.
	PublishedCount int `json:"publishedCount"`
	// RepositoryIDs are the registered repositories of the cards it started
	// from and of the cards it published; never nil.
	RepositoryIDs []string `json:"repositoryIds"`
	CreatedAt     string   `json:"createdAt"`
	ArchivedAt    string   `json:"archivedAt"`
}

// StartDiscussionRequest is what the user chose in the dialog that starts a
// discussion.
type StartDiscussionRequest struct {
	BoardID string   `json:"boardId"`
	Title   string   `json:"title"`
	Text    string   `json:"text"`  // what to discuss; "" for none
	Cards   []string `json:"cards"` // the keys of the cards of the board
	Model   string   `json:"model"`
	Effort  string   `json:"effort"`
}

// DiscussionContextRequest is what the dialog of a discussion shows the
// context of, before anything is created.
type DiscussionContextRequest struct {
	BoardID string   `json:"boardId"`
	Text    string   `json:"text"`
	Cards   []string `json:"cards"`
}
