// Package bindings exposes the app services to the frontend and owns the state
// snapshot they exchange.
package bindings

// EventStateChanged carries a whole State every time anything changes.
const EventStateChanged = "state:changed"

// Repo is a git repository inside the open workspace.
type Repo struct {
	Name string `json:"name"`
	Path string `json:"path"`
}

// Workspace is the open folder and the repositories found in it.
type Workspace struct {
	Name  string `json:"name"`
	Path  string `json:"path"`
	Repos []Repo `json:"repos"`
}

// Recent is a workspace the user opened before.
type Recent struct {
	Name string `json:"name"`
	Path string `json:"path"`
}

// Notice is a path the app refused to open.
type Notice struct {
	Path string `json:"path"`
	// Reason is not_found, not_directory, not_readable or last_recent_missing.
	// It stays a string so the generated bindings leave the narrowing to the
	// frontend union types instead of emitting a TypeScript enum.
	Reason string `json:"reason"`
}

// State is everything the interface renders, produced by Go and never derived
// on the frontend.
type State struct {
	Workspace *Workspace `json:"workspace"` // nil on the welcome screen
	Recents   []Recent   `json:"recents"`   // never nil
	// Theme is system, light or dark, a string for the same reason as
	// Notice.Reason.
	Theme      string        `json:"theme"`
	SystemDark bool          `json:"systemDark"`
	Notice     *Notice       `json:"notice"`
	Tasks      []TaskSummary `json:"tasks"` // tasks of the open workspace; never nil
}

// EventTranscriptChanged carries one TranscriptEvent every time a conversation
// changes.
const EventTranscriptChanged = "transcript:changed"

// Step is one step of the plan of a task.
type Step struct {
	Number int    `json:"number"`
	File   string `json:"file"` // name inside steps/, the artifact is "steps/" + File
	Title  string `json:"title"`
	// Repository is the value the file carries; RepoPath is "" when no
	// repository of the task matches it.
	Repository string `json:"repository"`
	RepoPath   string `json:"repoPath"`
	// Status is not_started; a string for the same reason as Notice.Reason.
	Status string `json:"status"`
}

// PlanProblem is one reason the step files are not a valid plan.
type PlanProblem struct {
	File    string `json:"file"` // "" for the plan as a whole
	Message string `json:"message"`
}

// TaskSummary is a task of the open workspace with the state of its session.
type TaskSummary struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	RepoPath string `json:"repoPath"` // "" for a root task
	Dir      string `json:"dir"`
	// Stage is prd, tech_spec, plan or implementation, a string for the same
	// reason as Notice.Reason.
	Stage string `json:"stage"`
	// Revisiting is a stage reopened by the user, which moves on only when
	// they say so.
	Revisiting bool `json:"revisiting"`
	// SessionStatus is working, waiting, needs_permission, paused or error.
	SessionStatus   string        `json:"sessionStatus"`
	TurnRunning     bool          `json:"turnRunning"`
	ProcessRunning  bool          `json:"processRunning"`
	RetryAttempt    int           `json:"retryAttempt"`
	ContextPercent  int           `json:"contextPercent"`
	PendingCount    int           `json:"pendingCount"`
	Corrections     int           `json:"corrections"`
	HasPRD          bool          `json:"hasPrd"`
	HasTechSpec     bool          `json:"hasTechSpec"`
	Steps           []Step        `json:"steps"`        // never nil
	PlanProblems    []PlanProblem `json:"planProblems"` // never nil
	CanContinue     bool          `json:"canContinue"`
	ArtifactVersion int           `json:"artifactVersion"`
	LastError       string        `json:"lastError"`
	CreatedAt       string        `json:"createdAt"`
	UpdatedAt       string        `json:"updatedAt"`
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
	// plan_written, plan_updated, stage_started, compacted or interrupted.
	Type      string `json:"type"`
	PreTokens int    `json:"preTokens"`
	// Stage and Restarted belong to stage_started alone.
	Stage     string `json:"stage"`
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
	// Kind is entry, text, remove or reset.
	Kind    string `json:"kind"`
	Entry   *Entry `json:"entry"`
	EntryID string `json:"entryId"`
	Text    string `json:"text"`
}

// CreateTaskRequest is the task the user filled in the creation dialog.
type CreateTaskRequest struct {
	Name           string `json:"name"`
	RepoPath       string `json:"repoPath"` // "" for root
	InitialContext string `json:"initialContext"`
}
