// Package claude drives the Claude Code CLI as a subprocess speaking
// stream-json on both ends.
package claude

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
)

// Envelope is the first decoding phase: the fields every stdout line shares.
type Envelope struct {
	Type      string `json:"type"`
	Subtype   string `json:"subtype"`
	SessionID string `json:"session_id"`
	UUID      string `json:"uuid"`
}

// Event is one decoded stdout line. Exactly one pointer field is set; Raw is
// always the original line.
type Event struct {
	Type             string
	Subtype          string
	Init             *InitEvent
	Status           *StatusEvent
	CompactBoundary  *CompactBoundaryEvent
	APIRetry         *APIRetryEvent
	TaskStarted      *TaskStartedEvent
	TaskNotification *TaskNotificationEvent
	TaskUpdated      *TaskUpdatedEvent
	BackgroundTasks  *BackgroundTasksEvent
	Stream           *StreamEvent
	Assistant        *AssistantEvent
	User             *UserEvent
	Result           *ResultEvent
	ControlRequest   *ControlRequestEvent
	ControlResponse  *ControlResponseEvent
	Raw              json.RawMessage
}

// InitEvent opens every turn and describes the session the CLI is running.
type InitEvent struct {
	SessionID         string   `json:"session_id"`
	Model             string   `json:"model"`
	CWD               string   `json:"cwd"`
	Tools             []string `json:"tools"`
	Capabilities      []string `json:"capabilities"`
	ClaudeCodeVersion string   `json:"claude_code_version"`
	PermissionMode    string   `json:"permissionMode"`
}

// StatusEvent reports what the CLI is busy with.
type StatusEvent struct {
	Status string `json:"status"` // "requesting", ...
}

// CompactBoundaryEvent marks the point where the context was compacted.
type CompactBoundaryEvent struct {
	CompactMetadata struct {
		Trigger   string `json:"trigger"`
		PreTokens int    `json:"pre_tokens"`
	} `json:"compact_metadata"`
}

// APIRetryEvent reports a failed API call the CLI is retrying.
type APIRetryEvent struct {
	Attempt      int    `json:"attempt"`
	MaxRetries   int    `json:"max_retries"`
	RetryDelayMS int    `json:"retry_delay_ms"`
	Error        string `json:"error"`
}

// TaskStartedEvent is a task the CLI starts for a tool call: a background
// command, monitor or subagent, and also one in the foreground.
type TaskStartedEvent struct {
	TaskID         string `json:"task_id"`
	RunID          string `json:"run_id"`
	ToolUseID      string `json:"tool_use_id"`     // the call that started it
	Description    string `json:"description"`     // the name the agent gave it
	TaskType       string `json:"task_type"`       // local_bash (a command or a monitor), local_agent, ...
	IsBackgrounded bool   `json:"is_backgrounded"` // false for a task the turn waits for
}

// TaskNotificationEvent is the end of a task the CLI started.
type TaskNotificationEvent struct {
	TaskID    string `json:"task_id"`
	RunID     string `json:"run_id"`
	ToolUseID string `json:"tool_use_id"`
	Status    string `json:"status"`  // completed | failed | stopped
	Summary   string `json:"summary"` // `Background command "X" failed with exit code 1`, ...
	// OutputFile is the whole output on disk; "" when the CLI keeps none.
	OutputFile string `json:"output_file"`
}

// TaskUpdatedEvent is a change of a task the CLI started; the app reads only
// the move of a task to the background.
type TaskUpdatedEvent struct {
	TaskID string `json:"task_id"`
	RunID  string `json:"run_id"`
	Patch  struct {
		IsBackgrounded *bool `json:"is_backgrounded"` // nil when the patch does not say
	} `json:"patch"`
}

// BackgroundTasksEvent is every task the CLI runs in the background after a
// change, the whole set each time.
type BackgroundTasksEvent struct {
	Tasks []struct {
		TaskID string `json:"task_id"`
	} `json:"tasks"`
}

// ResultOrigin is what opened the turn a result closes; the result of a turn a
// message of the app opened has none.
type ResultOrigin struct {
	Kind         string `json:"kind"`         // task-notification | peer | ...
	RunID        string `json:"runId"`        // task-notification: the run of the task, "" for a monitor event
	SenderTaskID string `json:"senderTaskId"` // peer: the task of the subagent whose report it was
}

// Usage counts the tokens of one request.
type Usage struct {
	InputTokens              int `json:"input_tokens"`
	CacheCreationInputTokens int `json:"cache_creation_input_tokens"`
	CacheReadInputTokens     int `json:"cache_read_input_tokens"`
	OutputTokens             int `json:"output_tokens"`
}

// ContextTokens is the size of the context the request was made with.
func (u Usage) ContextTokens() int {
	return u.InputTokens + u.CacheCreationInputTokens + u.CacheReadInputTokens
}

// ContentBlock is one block of an assistant message.
type ContentBlock struct {
	Type     string          `json:"type"`     // thinking | redacted_thinking | text | tool_use
	ID       string          `json:"id"`       // tool_use
	Name     string          `json:"name"`     // tool_use
	Text     string          `json:"text"`     // text
	Thinking string          `json:"thinking"` // thinking; "" for internal reasoning, which carries only its signature
	Input    json.RawMessage `json:"input"`    // tool_use, complete only on AssistantEvent
}

// StreamEvent carries the partial messages of a turn in progress.
type StreamEvent struct {
	Event struct {
		Type    string `json:"type"`
		Index   int    `json:"index"`
		Message *struct {
			ID    string `json:"id"`
			Model string `json:"model"`
			Usage Usage  `json:"usage"`
		} `json:"message"`
		ContentBlock *ContentBlock `json:"content_block"`
		Delta        *struct {
			Type        string `json:"type"` // text_delta | input_json_delta | thinking_delta | signature_delta
			Text        string `json:"text"`
			Thinking    string `json:"thinking"` // thinking_delta
			PartialJSON string `json:"partial_json"`
			StopReason  string `json:"stop_reason"`
		} `json:"delta"`
		Usage *Usage `json:"usage"`
	} `json:"event"`
	ParentToolUseID *string `json:"parent_tool_use_id"`
}

// AssistantEvent is the authoritative version of one content block.
type AssistantEvent struct {
	Message struct {
		ID      string         `json:"id"`
		Model   string         `json:"model"`
		Content []ContentBlock `json:"content"`
	} `json:"message"`
	ParentToolUseID *string `json:"parent_tool_use_id"`
}

// ToolResult is what a tool returned to the agent.
type ToolResult struct {
	ToolUseID string          `json:"tool_use_id"`
	Content   json.RawMessage `json:"content"` // string or array; not interpreted
	IsError   bool            `json:"is_error"`
}

// Text is the content as text: the string itself, or the text blocks of an
// array joined by newlines; "" for any other shape.
func (r ToolResult) Text() string {
	var text string
	if err := json.Unmarshal(r.Content, &text); err == nil {
		return text
	}

	var blocks []textBlock
	if err := json.Unmarshal(r.Content, &blocks); err != nil {
		return ""
	}
	texts := make([]string, 0, len(blocks))
	for _, block := range blocks {
		if block.Type == "text" {
			texts = append(texts, block.Text)
		}
	}
	return strings.Join(texts, "\n")
}

// UserEvent is a user message the CLI echoes back, tool results included.
type UserEvent struct {
	Message struct {
		Content json.RawMessage `json:"content"`
	} `json:"message"`
	ParentToolUseID *string         `json:"parent_tool_use_id"`
	ToolUseResult   json.RawMessage `json:"tool_use_result"` // the structured result of the tool; not interpreted
}

// ToolResults returns the tool_result blocks of a user message, none when the
// content is a plain string.
func (u UserEvent) ToolResults() []ToolResult {
	var blocks []struct {
		Type string `json:"type"`
		ToolResult
	}
	if err := json.Unmarshal(u.Message.Content, &blocks); err != nil {
		return nil
	}

	var results []ToolResult
	for _, block := range blocks {
		if block.Type != "tool_result" {
			continue
		}
		results = append(results, block.ToolResult)
	}
	return results
}

// ResultEvent closes a turn.
type ResultEvent struct {
	Subtype        string        `json:"subtype"`
	IsError        bool          `json:"is_error"`
	Result         string        `json:"result"`
	StopReason     *string       `json:"stop_reason"`
	TerminalReason string        `json:"terminal_reason"`
	Origin         *ResultOrigin `json:"origin"`
	NumTurns       int           `json:"num_turns"`
	TotalCostUSD   float64       `json:"total_cost_usd"`
	Usage          Usage         `json:"usage"`
}

// ControlRequestEvent is what the CLI asks the app to decide, on the stdout
// side of the control channel.
type ControlRequestEvent struct {
	RequestID string `json:"request_id"`
	Request   struct {
		Subtype                 string          `json:"subtype"`
		ToolName                string          `json:"tool_name"`
		DisplayName             string          `json:"display_name"`
		Input                   json.RawMessage `json:"input"`
		Description             string          `json:"description"`
		Title                   string          `json:"title"`
		PermissionSuggestions   json.RawMessage `json:"permission_suggestions"`
		BlockedPath             string          `json:"blocked_path"`
		ToolUseID               string          `json:"tool_use_id"`
		DecisionReason          string          `json:"decision_reason"`
		SuppressAlwaysAllowRule bool            `json:"suppress_always_allow_rule"`
		DefaultToNo             bool            `json:"default_to_no"`
		RequiresUserInteraction bool            `json:"requires_user_interaction"`
		AgentID                 string          `json:"agent_id"` // the subagent that asks; "" for the main thread
	} `json:"request"`
}

// ControlResponseEvent is the CLI echoing back the answer to a control
// request, or its own answer to one the app made.
type ControlResponseEvent struct {
	Response struct {
		Subtype   string          `json:"subtype"` // success | error
		RequestID string          `json:"request_id"`
		Response  json.RawMessage `json:"response"`
		Error     string          `json:"error"`
	} `json:"response"`
}

// Decode parses one stdout line. Unknown types come back with only Type,
// Subtype and Raw set; a line that is not JSON is an error.
func Decode(line []byte) (Event, error) {
	var envelope Envelope
	if err := json.Unmarshal(line, &envelope); err != nil {
		return Event{}, fmt.Errorf("decode event envelope: %w", err)
	}

	event := Event{
		Type:    envelope.Type,
		Subtype: envelope.Subtype,
		Raw:     bytes.Clone(line),
	}

	var err error
	switch envelope.Type {
	case "system":
		err = decodeSystem(line, &event)
	case "stream_event":
		event.Stream, err = decodePayload[StreamEvent](line, "stream_event")
	case "assistant":
		event.Assistant, err = decodePayload[AssistantEvent](line, "assistant")
	case "user":
		event.User, err = decodePayload[UserEvent](line, "user")
	case "result":
		event.Result, err = decodePayload[ResultEvent](line, "result")
	case "control_request":
		event.ControlRequest, err = decodePayload[ControlRequestEvent](line, "control_request")
	case "control_response":
		event.ControlResponse, err = decodePayload[ControlResponseEvent](line, "control_response")
	default:
		// Unknown types keep Type, Subtype and Raw, and nothing else.
	}
	if err != nil {
		return Event{}, err
	}
	return event, nil
}

// decodeSystem fills the field matching the subtype of a system line.
func decodeSystem(line []byte, event *Event) error {
	var err error
	switch event.Subtype {
	case "init":
		event.Init, err = decodePayload[InitEvent](line, "system/init")
	case "status":
		event.Status, err = decodePayload[StatusEvent](line, "system/status")
	case "compact_boundary":
		event.CompactBoundary, err = decodePayload[CompactBoundaryEvent](line, "system/compact_boundary")
	case "api_retry":
		event.APIRetry, err = decodePayload[APIRetryEvent](line, "system/api_retry")
	case "task_started":
		event.TaskStarted, err = decodePayload[TaskStartedEvent](line, "system/task_started")
	case "task_notification":
		event.TaskNotification, err = decodePayload[TaskNotificationEvent](line, "system/task_notification")
	case "task_updated":
		event.TaskUpdated, err = decodePayload[TaskUpdatedEvent](line, "system/task_updated")
	case "background_tasks_changed":
		event.BackgroundTasks, err = decodePayload[BackgroundTasksEvent](line, "system/background_tasks_changed")
	default:
		// Unknown subtypes keep Type, Subtype and Raw, and nothing else.
	}
	return err
}

// decodePayload decodes the line into the struct of one event type.
func decodePayload[T any](line []byte, kind string) (*T, error) {
	payload := new(T)
	if err := json.Unmarshal(line, payload); err != nil {
		return nil, fmt.Errorf("decode %s event: %w", kind, err)
	}
	return payload, nil
}

// textBlock is a text block of a message written to the CLI.
type textBlock struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

// Image is an image of a user message: its media type, its bytes and, when it
// has one, the text block that introduces it to the agent.
type Image struct {
	MediaType string
	Data      []byte
	Label     string // "" for none
}

// imageSource is the base64 source of an image block.
type imageSource struct {
	Type      string `json:"type"` // base64
	MediaType string `json:"media_type"`
	Data      string `json:"data"`
}

// imageBlock is an image block of a message written to the CLI.
type imageBlock struct {
	Type   string      `json:"type"` // image
	Source imageSource `json:"source"`
}

// userMessageBody is the message field of a user input line.
type userMessageBody struct {
	Role    string `json:"role"`
	Content []any  `json:"content"`
}

// userMessageLine is a whole user input line.
type userMessageLine struct {
	Type            string          `json:"type"`
	Message         userMessageBody `json:"message"`
	ParentToolUseID *string         `json:"parent_tool_use_id"`
}

// UserMessage is what the app writes to ask for a turn. The images come first,
// each introduced by its label when it has one, and the text last, only when
// there is some: the API refuses an empty text block.
func UserMessage(text string, images []Image) []byte {
	content := make([]any, 0, 2*len(images)+1)
	for _, img := range images {
		if img.Label != "" {
			content = append(content, textBlock{Type: "text", Text: img.Label})
		}
		content = append(content, imageBlock{
			Type: "image",
			Source: imageSource{
				Type:      "base64",
				MediaType: img.MediaType,
				Data:      base64.StdEncoding.EncodeToString(img.Data),
			},
		})
	}
	if text != "" {
		content = append(content, textBlock{Type: "text", Text: text})
	}
	return mustMarshal("user message", userMessageLine{
		Type:    "user",
		Message: userMessageBody{Role: "user", Content: content},
	})
}

// controlRequestBody is the request field of a control request the app makes.
type controlRequestBody struct {
	Subtype               string `json:"subtype"`
	TaskID                string `json:"task_id,omitempty"`
	PerTaskStopAffordance bool   `json:"perTaskStopAffordance,omitempty"`
	ForwardSubagentText   bool   `json:"forwardSubagentText,omitempty"`
	Detail                string `json:"detail,omitempty"`
}

// controlRequestLine is a whole control request line written to the CLI.
type controlRequestLine struct {
	Type      string             `json:"type"`
	RequestID string             `json:"request_id"`
	Request   controlRequestBody `json:"request"`
}

// InterruptRequest asks the CLI to abort the running turn.
func InterruptRequest(requestID string) []byte {
	return mustMarshal("interrupt request", controlRequestLine{
		Type:      "control_request",
		RequestID: requestID,
		Request:   controlRequestBody{Subtype: "interrupt"},
	})
}

// ListModelsRequest asks the CLI for the catalog of models it offers.
func ListModelsRequest(requestID string) []byte {
	return mustMarshal("list_models request", controlRequestLine{
		Type:      "control_request",
		RequestID: requestID,
		Request:   controlRequestBody{Subtype: "list_models"},
	})
}

// InitializeRequest sets the options of the session. perTaskStopAffordance
// spares the work in the background from an interrupt and turns on stop_task;
// forwardSubagentText sends the speech of the subagents.
func InitializeRequest(requestID string) []byte {
	return mustMarshal("initialize request", controlRequestLine{
		Type:      "control_request",
		RequestID: requestID,
		Request: controlRequestBody{
			Subtype:               "initialize",
			PerTaskStopAffordance: true,
			ForwardSubagentText:   true,
		},
	})
}

// StopTaskRequest asks the CLI to stop one task it runs.
func StopTaskRequest(requestID, taskID string) []byte {
	return mustMarshal("stop_task request", controlRequestLine{
		Type:      "control_request",
		RequestID: requestID,
		Request:   controlRequestBody{Subtype: "stop_task", TaskID: taskID},
	})
}

// TaskOutputRequest asks the CLI for the end of the output of a task it runs.
func TaskOutputRequest(requestID, taskID string) []byte {
	return mustMarshal("get_task_output request", controlRequestLine{
		Type:      "control_request",
		RequestID: requestID,
		Request:   controlRequestBody{Subtype: "get_task_output", TaskID: taskID},
	})
}

// TaskOutput is the end of the output of a command or monitor the CLI runs,
// as get_task_output answers it.
type TaskOutput struct {
	Output     string `json:"output"` // at most the last 8 KiB, escapes included
	TotalBytes int    `json:"total_bytes"`
	Truncated  bool   `json:"truncated"`
}

// DecodeTaskOutput reads the success payload of a get_task_output answer.
func DecodeTaskOutput(raw json.RawMessage) (TaskOutput, error) {
	var out TaskOutput
	if err := json.Unmarshal(raw, &out); err != nil {
		return TaskOutput{}, fmt.Errorf("decode get_task_output answer: %w", err)
	}
	return out, nil
}

// ContextUsageRequest asks the CLI for the use of the context window, which it
// answers without calling the API.
func ContextUsageRequest(requestID string) []byte {
	return mustMarshal("get_context_usage request", controlRequestLine{
		Type:      "control_request",
		RequestID: requestID,
		Request:   controlRequestBody{Subtype: "get_context_usage", Detail: "summary"},
	})
}

// ContextUsage is what get_context_usage answers that the app reads: the
// tokens in the context, the CLI's estimate before the first response, and
// the whole window of the model.
type ContextUsage struct {
	TotalTokens  int `json:"totalTokens"`
	RawMaxTokens int `json:"rawMaxTokens"`
}

// DecodeContextUsage reads the success payload of a get_context_usage answer.
func DecodeContextUsage(raw json.RawMessage) (ContextUsage, error) {
	var usage ContextUsage
	if err := json.Unmarshal(raw, &usage); err != nil {
		return ContextUsage{}, fmt.Errorf("decode get_context_usage answer: %w", err)
	}
	return usage, nil
}

// ModelEntry is one model of the catalog the CLI reports with list_models.
type ModelEntry struct {
	Value                 string   `json:"value"`                 // the alias: default, opus[1m], sonnet, haiku
	ResolvedModel         string   `json:"resolvedModel"`         // the full name the alias resolves to: claude-opus-5-5[1m]
	SupportsEffort        bool     `json:"supportsEffort"`        // absent, so false, for a model that takes no effort
	SupportedEffortLevels []string `json:"supportedEffortLevels"` // nil for a model that takes no effort
	Disabled              bool     `json:"disabled"`
}

// listModelsResponse is the response field of a successful list_models answer.
type listModelsResponse struct {
	Models []ModelEntry `json:"models"`
}

// PermissionResponse is the answer to a can_use_tool request.
type PermissionResponse struct {
	Behavior           string          `json:"behavior"`                     // allow | deny
	UpdatedInput       json.RawMessage `json:"updatedInput,omitempty"`       // allow
	UpdatedPermissions json.RawMessage `json:"updatedPermissions,omitempty"` // allow, optional
	Message            string          `json:"message,omitempty"`            // deny
}

// controlResponseBody is the response field of a control response line.
type controlResponseBody struct {
	Subtype   string             `json:"subtype"`
	RequestID string             `json:"request_id"`
	Response  PermissionResponse `json:"response"`
}

// controlResponseLine is a whole control response line written to the CLI.
type controlResponseLine struct {
	Type     string              `json:"type"`
	Response controlResponseBody `json:"response"`
}

// ControlResponse wraps a PermissionResponse for the request it answers.
func ControlResponse(requestID string, resp PermissionResponse) ([]byte, error) {
	line, err := json.Marshal(controlResponseLine{
		Type: "control_response",
		Response: controlResponseBody{
			Subtype:   "success",
			RequestID: requestID,
			Response:  resp,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("marshal control response %s: %w", requestID, err)
	}
	return line, nil
}

// mustMarshal encodes a line whose fields are strings, slices of strings and
// the block structs above, none of which json can fail on. A failure here is a bug in this package, not a runtime condition.
func mustMarshal(what string, value any) []byte {
	line, err := json.Marshal(value)
	if err != nil {
		panic(fmt.Sprintf("claude: marshal %s: %v", what, err))
	}
	return line
}
