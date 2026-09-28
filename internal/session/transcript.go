// Package session owns the conversation of each task: the Claude Code process
// behind it, the transcript it produces and the state derived from both.
package session

import (
	"encoding/json"
	"fmt"
	"time"
)

// Kind says which payload an entry carries.
type Kind string

// The kinds of entry a conversation is made of.
const (
	KindUser       Kind = "user"
	KindAssistant  Kind = "assistant"
	KindAction     Kind = "action"
	KindPermission Kind = "permission"
	KindQuestion   Kind = "question"
	KindMarker     Kind = "marker"
	KindError      Kind = "error"
)

// Entry is one item of a conversation. Exactly one payload pointer is set,
// the one matching Kind; it is what gets serialized into the payload column.
type Entry struct {
	ID        string
	Seq       int
	TurnID    string // id of the user entry that started the turn this entry belongs to
	Kind      Kind
	CreatedAt time.Time

	User       *UserEntry
	Assistant  *AssistantEntry
	Action     *ActionEntry
	Permission *PermissionEntry
	Question   *QuestionEntry
	Marker     *MarkerEntry
	Error      *ErrorEntry
}

// UserEntry is a message sent to the agent: one the user wrote, or one the app
// sent on their behalf.
type UserEntry struct {
	Text    string `json:"text"`
	Pending bool   `json:"pending"` // queued, not yet delivered to the CLI
	Prompt  bool   `json:"prompt"`  // the first message of a stage: Text is the initial context, the CLI got the rendered prompt
	App     bool   `json:"app"`     // the app wrote it, not the user
	// Sent is the rendered prompt the CLI got, for a prompt entry of the tech
	// spec, the plan, the pull request and the pull request review; "" for
	// every other entry.
	Sent string `json:"sent"`
	// AppKind is which message of the workflow the app sent, and AppPass,
	// AppRound, AppRounds and AppCount its numbers, as in AppMessage; "" and
	// zero for every other entry.
	AppKind   AppKind `json:"appKind"`
	AppPass   int     `json:"appPass"`
	AppRound  int     `json:"appRound"`
	AppRounds int     `json:"appRounds"`
	AppCount  int     `json:"appCount"`
}

// AppKind says which message of the workflow the app sent.
type AppKind string

// The messages of the workflow.
const (
	AppReport     AppKind = "report"      // a step review report to the implementer
	AppPass       AppKind = "pass"        // the next pass to the step reviewer
	AppCommit     AppKind = "commit"      // commit the staged files
	AppCommitAll  AppKind = "commit_all"  // commit every change of the step, after a clean report
	AppCommitPush AppKind = "commit_push" // commit the staged files and push
	AppCorrection AppKind = "correction"  // the plan isn't valid yet
	AppOpen       AppKind = "open"        // open the pull request
	AppPRPass     AppKind = "pr_pass"     // the next pass of the pull request review
	AppApply      AppKind = "apply"       // apply the approved findings
)

// AppMessage is a message the app sends the agent on the user's behalf.
type AppMessage struct {
	Text   string
	Kind   AppKind
	Pass   int // report, pass, pr_pass
	Round  int // report: the round; correction: the attempt
	Rounds int // report: MaxReviewRounds; correction: MaxCorrections
	Count  int // report: findings (-1 unknown); correction: problems; apply: approved findings
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
	// InterruptedBy is who cut the text short: "user" or "crash"; "" when it
	// was not.
	InterruptedBy string `json:"interruptedBy"`
}

// ActionStatus is how far a tool call has gone.
type ActionStatus string

// The states of a tool call.
const (
	ActionRunning     ActionStatus = "running"
	ActionDone        ActionStatus = "done"
	ActionError       ActionStatus = "error"
	ActionInterrupted ActionStatus = "interrupted"
)

// ActionEntry is a tool call the agent made.
type ActionEntry struct {
	ToolUseID string       `json:"toolUseId"`
	Tool      string       `json:"tool"`
	Label     string       `json:"label"`  // "Reading", "Running", ... (labels.go)
	Target    string       `json:"target"` // path, command, pattern; "" when none
	Status    ActionStatus `json:"status"`
	// Description is the description the agent wrote (Bash, Agent/Task); ""
	// when none.
	Description string `json:"description"`
	// CommandLines counts the lines of the whole command, Bash only; 0 when
	// unknown.
	CommandLines int `json:"commandLines"`
	// StartedAt is when the input became complete; nil in old transcripts.
	StartedAt *time.Time `json:"startedAt"`
	// FinishedAt is when the result arrived; nil while running, when
	// interrupted and in old transcripts.
	FinishedAt *time.Time `json:"finishedAt"`
	// ExitCode is read from a failed Bash result; nil when unknown.
	ExitCode *int `json:"exitCode"`
	// ParentToolUseID is the Agent/Task action of the subagent that made it;
	// "" in the main thread.
	ParentToolUseID string `json:"parentToolUseId"`
	// OutputLines counts the lines of the whole output; 0 when it has none.
	// The whole output is kept apart (Output), the payload carries its tail.
	OutputLines int `json:"outputLines"`
	// OutputTail is the end of the output the conversation shows.
	OutputTail string `json:"outputTail"`
	// OutputTruncated says the output kept is only the end of a longer one.
	OutputTruncated bool `json:"outputTruncated"`
	// InterruptedBy is who stopped the action, interrupted only: "user" or
	// "crash".
	InterruptedBy string `json:"interruptedBy"`
}

// PermissionStatus is how a permission request or a question was answered.
type PermissionStatus string

// The states of a permission request.
const (
	PermissionPending        PermissionStatus = "pending"
	PermissionAllowed        PermissionStatus = "allowed"
	PermissionAllowedSession PermissionStatus = "allowed_session"
	PermissionDenied         PermissionStatus = "denied"
	PermissionCancelled      PermissionStatus = "cancelled" // the session stopped before an answer
)

// PermissionEntry is a tool the agent asked to use.
type PermissionEntry struct {
	RequestID           string           `json:"requestId"`
	ToolUseID           string           `json:"toolUseId"`
	Tool                string           `json:"tool"`
	DisplayName         string           `json:"displayName"`
	Description         string           `json:"description"`
	Input               json.RawMessage  `json:"input"`
	Suggestions         json.RawMessage  `json:"suggestions"` // permission_suggestions as received; null when absent
	BlockedPath         string           `json:"blockedPath"`
	DecisionReason      string           `json:"decisionReason"` // ANSI escapes stripped
	SuppressAlwaysAllow bool             `json:"suppressAlwaysAllow"`
	DefaultToNo         bool             `json:"defaultToNo"`
	Status              PermissionStatus `json:"status"`
	DenyMessage         string           `json:"denyMessage"`
	AnsweredAt          *time.Time       `json:"answeredAt"`
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
	Options     []QuestionOption `json:"options"`
	MultiSelect bool             `json:"multiSelect"`
}

// QuestionEntry is a structured question the agent asked.
type QuestionEntry struct {
	RequestID string            `json:"requestId"`
	ToolUseID string            `json:"toolUseId"`
	Questions []Question        `json:"questions"`
	Answers   map[string]string `json:"answers"` // question text -> label(s); nil while pending
	Status    PermissionStatus  `json:"status"`  // pending | allowed (answered) | cancelled
	// AnsweredAt is when the answer went to the CLI; nil while pending, when
	// cancelled and in old transcripts.
	AnsweredAt *time.Time `json:"answeredAt"`
}

// MarkerType is the event a marker records.
type MarkerType string

// The markers the conversation shows between messages.
const (
	MarkerPRDWritten        MarkerType = "prd_written"
	MarkerPRDUpdated        MarkerType = "prd_updated"
	MarkerTechSpecWritten   MarkerType = "tech_spec_written"
	MarkerTechSpecUpdated   MarkerType = "tech_spec_updated"
	MarkerPlanWritten       MarkerType = "plan_written"
	MarkerPlanUpdated       MarkerType = "plan_updated"
	MarkerOneShotWritten    MarkerType = "one_shot_written"
	MarkerOneShotUpdated    MarkerType = "one_shot_updated"
	MarkerPRReviewWritten   MarkerType = "pr_review_written"
	MarkerReviewStarted     MarkerType = "review_started"
	MarkerDiscussionStarted MarkerType = "discussion_started"
	MarkerStepReviewStarted MarkerType = "step_review_started"
	MarkerStepReviewWritten MarkerType = "step_review_written"
	MarkerStageStarted      MarkerType = "stage_started"
	MarkerStepStarted       MarkerType = "step_started"
	MarkerCompacted         MarkerType = "compacted"
	MarkerInterrupted       MarkerType = "interrupted"
	MarkerRetried           MarkerType = "retried"
	MarkerCommitted         MarkerType = "committed"
	MarkerPROpened          MarkerType = "pr_opened"
	MarkerChecksRead        MarkerType = "checks_read"
	MarkerDraftApproved     MarkerType = "draft_approved"
	MarkerChangesApproved   MarkerType = "changes_approved"
	MarkerPaused            MarkerType = "paused"
	MarkerPlanInvalid       MarkerType = "plan_invalid"
)

// ArtifactKind is the artifact a marker refers to. The values are the ones of
// task.ArtifactKind; internal/app converts between the two.
type ArtifactKind string

// The artifacts a conversation produces.
const (
	ArtifactPRD      ArtifactKind = "prd"
	ArtifactTechSpec ArtifactKind = "tech_spec"
	ArtifactPlan     ArtifactKind = "plan"
	ArtifactOneShot  ArtifactKind = "one_shot"
)

// writtenMarker is the marker of an artifact written for the first time.
func writtenMarker(kind ArtifactKind) MarkerType {
	switch kind {
	case ArtifactTechSpec:
		return MarkerTechSpecWritten
	case ArtifactPlan:
		return MarkerPlanWritten
	case ArtifactOneShot:
		return MarkerOneShotWritten
	default:
		return MarkerPRDWritten
	}
}

// updatedMarker is the marker of an artifact rewritten after the first time.
func updatedMarker(kind ArtifactKind) MarkerType {
	switch kind {
	case ArtifactTechSpec:
		return MarkerTechSpecUpdated
	case ArtifactPlan:
		return MarkerPlanUpdated
	case ArtifactOneShot:
		return MarkerOneShotUpdated
	default:
		return MarkerPRDUpdated
	}
}

// MarkerEntry is a milestone of the conversation.
type MarkerEntry struct {
	Type      MarkerType `json:"type"`
	PreTokens int        `json:"preTokens"` // compacted only
	Stage     string     `json:"stage"`     // stage_started only
	Step      int        `json:"step"`      // step_started and step_review_started only
	Pass      int        `json:"pass"`      // pr_review_written, step_review_written and checks_read only: the pass it closed or starts
	Clean     bool       `json:"clean"`     // pr_review_written and step_review_written only: the pass found nothing to change
	// Findings is how many findings the pass of a step review reported,
	// step_review_written only; nil when unknown.
	Findings  *int `json:"findings"`
	Restarted bool `json:"restarted"` // stage_started and step_started only: it was started again
	// Percent is how full the context was, compacted only; 0 when the window
	// is unknown.
	Percent int `json:"percent"`
	// Attempts and Reason are the retries of the API call, retried only.
	// Reason is one of the codes of retryReasonOf.
	Attempts int    `json:"attempts"`
	Reason   string `json:"reason"`
	// InterruptedBy is who interrupted the turn, interrupted only: "user".
	InterruptedBy string `json:"interruptedBy"`

	SHA      string        `json:"sha"`      // committed
	Subject  string        `json:"subject"`  // committed
	Pushed   bool          `json:"pushed"`   // committed: the commit went to the pull request
	Number   int           `json:"number"`   // pr_opened, committed with push
	Base     string        `json:"base"`     // pr_opened: the base branch
	Passed   int           `json:"passed"`   // checks_read
	Total    int           `json:"total"`    // checks_read
	Failed   []string      `json:"failed"`   // checks_read: names of the failed checks; nil when none
	Conflict bool          `json:"conflict"` // checks_read
	Title    string        `json:"title"`    // draft_approved
	Files    int           `json:"files"`    // changes_approved
	Problems []PlanProblem `json:"problems"` // plan_invalid
}

// PlanProblem is a problem of a plan that is not valid, plan_invalid only.
type PlanProblem struct {
	File    string `json:"file"`
	Message string `json:"message"`
}

// ErrorKind says what went wrong.
type ErrorKind string

// The failures the conversation reports.
const (
	ErrorProcessExit ErrorKind = "process_exit"
	ErrorStartFailed ErrorKind = "start_failed"
	ErrorNotFound    ErrorKind = "not_found"
	ErrorNotLoggedIn ErrorKind = "not_logged_in"
	ErrorTurn        ErrorKind = "turn_error" // the CLI reported a failed turn but is still alive
)

// ErrorEntry is a failure shown in the conversation.
type ErrorEntry struct {
	Kind      ErrorKind `json:"kind"`
	Message   string    `json:"message"`
	Retryable bool      `json:"retryable"`
}

// MarshalPayload encodes the payload matching the entry's kind.
func (e Entry) MarshalPayload() ([]byte, error) {
	payload, err := e.payload()
	if err != nil {
		return nil, err
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal %s payload: %w", e.Kind, err)
	}
	return data, nil
}

// payload returns the pointer matching the entry's kind, or an error when the
// entry carries no payload for it. A nil pointer would marshal as null and
// lose the payload silently, so it is rejected here.
func (e Entry) payload() (any, error) {
	var payload any
	switch e.Kind {
	case KindUser:
		if e.User != nil {
			payload = e.User
		}
	case KindAssistant:
		if e.Assistant != nil {
			payload = e.Assistant
		}
	case KindAction:
		if e.Action != nil {
			payload = e.Action
		}
	case KindPermission:
		if e.Permission != nil {
			payload = e.Permission
		}
	case KindQuestion:
		if e.Question != nil {
			payload = e.Question
		}
	case KindMarker:
		if e.Marker != nil {
			payload = e.Marker
		}
	case KindError:
		if e.Error != nil {
			payload = e.Error
		}
	default:
		return nil, fmt.Errorf("marshal payload: unknown kind %q", e.Kind)
	}

	if payload == nil {
		return nil, fmt.Errorf("marshal payload: kind %q has no payload", e.Kind)
	}
	return payload, nil
}

// UnmarshalPayload decodes a stored payload into an entry carrying only its
// kind and payload; the envelope fields stay zero.
func UnmarshalPayload(kind Kind, data []byte) (Entry, error) {
	entry := Entry{Kind: kind}

	var target any
	switch kind {
	case KindUser:
		entry.User = &UserEntry{}
		target = entry.User
	case KindAssistant:
		entry.Assistant = &AssistantEntry{}
		target = entry.Assistant
	case KindAction:
		entry.Action = &ActionEntry{}
		target = entry.Action
	case KindPermission:
		entry.Permission = &PermissionEntry{}
		target = entry.Permission
	case KindQuestion:
		entry.Question = &QuestionEntry{}
		target = entry.Question
	case KindMarker:
		entry.Marker = &MarkerEntry{}
		target = entry.Marker
	case KindError:
		entry.Error = &ErrorEntry{}
		target = entry.Error
	default:
		return Entry{}, fmt.Errorf("unmarshal payload: unknown kind %q", kind)
	}

	if err := json.Unmarshal(data, target); err != nil {
		return Entry{}, fmt.Errorf("unmarshal %s payload: %w", kind, err)
	}
	return entry, nil
}
