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

// TaskSummary is a task of the open workspace with the state of its session.
type TaskSummary struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	RepoPath string `json:"repoPath"` // "" for a root task
	Dir      string `json:"dir"`
	// Stage is prd or prd_done, a string for the same reason as Notice.Reason.
	Stage string `json:"stage"`
	// SessionStatus is working, waiting, needs_permission, paused or error.
	SessionStatus   string `json:"sessionStatus"`
	TurnRunning     bool   `json:"turnRunning"`
	ProcessRunning  bool   `json:"processRunning"`
	RetryAttempt    int    `json:"retryAttempt"`
	ContextPercent  int    `json:"contextPercent"`
	PendingCount    int    `json:"pendingCount"`
	HasPRD          bool   `json:"hasPrd"`
	ArtifactVersion int    `json:"artifactVersion"`
	LastError       string `json:"lastError"`
	CreatedAt       string `json:"createdAt"`
	UpdatedAt       string `json:"updatedAt"`
}

// UserEntry is a message the user wrote.
type UserEntry struct {
	Text    string `json:"text"`
	Pending bool   `json:"pending"`
	Prompt  bool   `json:"prompt"`
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
	// Type is prd_written, prd_updated, compacted or interrupted.
	Type      string `json:"type"`
	PreTokens int    `json:"preTokens"`
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
	TaskID    string  `json:"taskId"`
	SessionID string  `json:"sessionId"`
	Entries   []Entry `json:"entries"` // never nil
	Pending   []Entry `json:"pending"` // never nil
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
