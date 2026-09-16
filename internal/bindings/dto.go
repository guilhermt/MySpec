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
	Missing       bool   `json:"missing"` // the clone was not at Path at the last check
	ActiveTasks   int    `json:"activeTasks"`
	ArchivedTasks int    `json:"archivedTasks"`
}

// State is everything the interface renders, produced by Go and never derived
// on the frontend.
type State struct {
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
	// ReviewModeDefault is manual or agent: who reviews the steps of a new
	// task, a string for the same reason as State.Theme.
	ReviewModeDefault string `json:"reviewModeDefault"`
	// Tasks are the active tasks of every repository, in creation order; never
	// nil.
	Tasks []TaskSummary `json:"tasks"`
	// History are the archived tasks of every repository, newest first; never
	// nil.
	History []ArchivedTask `json:"history"`
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
	Kind   string `json:"kind"`
	Staged bool   `json:"staged"` // nothing of it is left outside the index
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
	// opening, reviewing, awaiting_decision, in_review, ready_to_approve,
	// committing, done, merged, pr_closed, closing or closed, a string for the
	// same reason as State.Theme.
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
	CanClose   bool   `json:"canClose"` // the user may close the task now
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
	ContextPercent int    `json:"contextPercent"`
	PendingCount   int    `json:"pendingCount"`
	LastError      string `json:"lastError"`
}

// PlanProblem is one reason the step files are not a valid plan.
type PlanProblem struct {
	File    string `json:"file"` // "" for the plan as a whole
	Message string `json:"message"`
}

// Place is where in a task a situation is.
type Place struct {
	// Kind is stage, step, step_review or pr, a string for the same reason as
	// State.Theme.
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
	// step_review, step_empty, draft, findings, changes_review or merge, a
	// string for the same reason as State.Theme.
	Kind string `json:"kind"`
	// Group is error, waiting or closing, from the most urgent, a string for
	// the same reason as State.Theme.
	Group string `json:"group"`
	// Form is review, staged or approve for step_review and changes_review,
	// merge or close for merge, and "" for every other kind, a string for the
	// same reason as State.Theme.
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
	ID           string `json:"id"`
	Name         string `json:"name"`
	RepositoryID string `json:"repositoryId"`
	Repository   string `json:"repository"` // owner/name
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
	SessionModel    string           `json:"sessionModel"`
	SessionEffort   string           `json:"sessionEffort"`
	TurnRunning     bool             `json:"turnRunning"`
	ProcessRunning  bool             `json:"processRunning"`
	RetryAttempt    int              `json:"retryAttempt"`
	ContextPercent  int              `json:"contextPercent"`
	PendingCount    int              `json:"pendingCount"`
	Corrections     int              `json:"corrections"`
	HasPRD          bool             `json:"hasPrd"`
	HasTechSpec     bool             `json:"hasTechSpec"`
	HasOneShot      bool             `json:"hasOneShot"`
	Steps           []Step           `json:"steps"`        // never nil
	CurrentStep     int              `json:"currentStep"`  // the step that runs or runs next; 0 when the task has no steps
	PR              *PullRequest     `json:"pr"`           // nil outside the pull request stage
	PlanProblems    []PlanProblem    `json:"planProblems"` // never nil
	Situations      []Situation      `json:"situations"`   // what the task waits on the user for, the most urgent first; never nil
	Models          []TaskStageModel `json:"models"`       // every stage, in workflow order; never nil
	CanContinue     bool             `json:"canContinue"`
	ArtifactVersion int              `json:"artifactVersion"`
	LastError       string           `json:"lastError"`
	CreatedAt       string           `json:"createdAt"`
	UpdatedAt       string           `json:"updatedAt"`
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
	ID           string `json:"id"`
	Name         string `json:"name"`
	RepositoryID string `json:"repositoryId"`
	Repository   string `json:"repository"` // owner/name
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
}

// AssistantEntry is one content block of an assistant message.
type AssistantEntry struct {
	MessageID   string `json:"messageId"`
	BlockIndex  int    `json:"blockIndex"`
	Text        string `json:"text"`
	Complete    bool   `json:"complete"`
	Interrupted bool   `json:"interrupted"`
}

// ActionEntry is a tool call the agent made.
type ActionEntry struct {
	ToolUseID string `json:"toolUseId"`
	Tool      string `json:"tool"`
	Label     string `json:"label"`
	Target    string `json:"target"`
	// Status is running, done, error or interrupted.
	Status string `json:"status"`
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
	Status string `json:"status"`
}

// MarkerEntry is a milestone of the conversation.
type MarkerEntry struct {
	// Type is prd_written, prd_updated, tech_spec_written, tech_spec_updated,
	// plan_written, plan_updated, one_shot_written, one_shot_updated,
	// pr_review_written, step_review_started, step_review_written,
	// stage_started, step_started, compacted or interrupted.
	Type      string `json:"type"`
	PreTokens int    `json:"preTokens"`
	// Stage belongs to stage_started alone, Step to the markers of a step
	// (step_started, step_review_started), Pass to the markers of a review
	// (pr_review_written, step_review_written) and Clean to
	// step_review_written alone; Restarted belongs to stage_started and
	// step_started.
	Stage     string `json:"stage"`
	Step      int    `json:"step"`
	Pass      int    `json:"pass"`
	Clean     bool   `json:"clean"`
	Restarted bool   `json:"restarted"`
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
	// Stage is prd, tech_spec, plan, one_shot, implementation, step_review, pr
	// or pr_review, a string for the same reason as State.Theme.
	Stage  string `json:"stage"`
	Model  string `json:"model"`  // claude-fable-5-1, claude-opus-5 or claude-sonnet-5
	Effort string `json:"effort"` // low, medium, high, xhigh or max
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
	// Stage is prd, tech_spec, plan, one_shot, step_review, commit, pr or
	// pr_review, a string for the same reason as State.Theme.
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
}
