// Package claude drives the Claude Code CLI as a subprocess speaking
// stream-json on both ends.
package claude

import (
	"bytes"
	"encoding/json"
	"fmt"
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
	Type            string
	Subtype         string
	Init            *InitEvent
	Status          *StatusEvent
	CompactBoundary *CompactBoundaryEvent
	APIRetry        *APIRetryEvent
	Stream          *StreamEvent
	Assistant       *AssistantEvent
	User            *UserEvent
	Result          *ResultEvent
	ControlRequest  *ControlRequestEvent
	ControlResponse *ControlResponseEvent
	Raw             json.RawMessage
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
	Type  string          `json:"type"`  // thinking | text | tool_use
	ID    string          `json:"id"`    // tool_use
	Name  string          `json:"name"`  // tool_use
	Text  string          `json:"text"`  // text
	Input json.RawMessage `json:"input"` // tool_use, complete only on AssistantEvent
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
			PartialJSON string `json:"partial_json"`
			StopReason  string `json:"stop_reason"`
		} `json:"delta"`
		Usage *Usage `json:"usage"`
	} `json:"event"`
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

// UserEvent is a user message the CLI echoes back, tool results included.
type UserEvent struct {
	Message struct {
		Content json.RawMessage `json:"content"`
	} `json:"message"`
	ParentToolUseID *string `json:"parent_tool_use_id"`
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
	Subtype        string  `json:"subtype"`
	IsError        bool    `json:"is_error"`
	Result         string  `json:"result"`
	StopReason     *string `json:"stop_reason"`
	TerminalReason string  `json:"terminal_reason"`
	NumTurns       int     `json:"num_turns"`
	TotalCostUSD   float64 `json:"total_cost_usd"`
	Usage          Usage   `json:"usage"`
	ModelUsage     map[string]struct {
		ContextWindow int `json:"contextWindow"`
	} `json:"modelUsage"`
}

// ContextWindow is the largest window among the models used, 0 when unknown.
func (r ResultEvent) ContextWindow() int {
	largest := 0
	for _, usage := range r.ModelUsage {
		largest = max(largest, usage.ContextWindow)
	}
	return largest
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

// userMessageBody is the message field of a user input line.
type userMessageBody struct {
	Role    string      `json:"role"`
	Content []textBlock `json:"content"`
}

// userMessageLine is a whole user input line.
type userMessageLine struct {
	Type            string          `json:"type"`
	Message         userMessageBody `json:"message"`
	ParentToolUseID *string         `json:"parent_tool_use_id"`
}

// UserMessage is what the app writes to ask for a turn.
func UserMessage(text string) []byte {
	return mustMarshal("user message", userMessageLine{
		Type: "user",
		Message: userMessageBody{
			Role:    "user",
			Content: []textBlock{{Type: "text", Text: text}},
		},
	})
}

// interruptBody is the request field of an interrupt control request.
type interruptBody struct {
	Subtype string `json:"subtype"`
}

// controlRequestLine is a whole control request line written to the CLI.
type controlRequestLine struct {
	Type      string        `json:"type"`
	RequestID string        `json:"request_id"`
	Request   interruptBody `json:"request"`
}

// InterruptRequest asks the CLI to abort the running turn.
func InterruptRequest(requestID string) []byte {
	return mustMarshal("interrupt request", controlRequestLine{
		Type:      "control_request",
		RequestID: requestID,
		Request:   interruptBody{Subtype: "interrupt"},
	})
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

// mustMarshal encodes a line whose every field is a string, which json cannot
// fail on. A failure here is a bug in this package, not a runtime condition.
func mustMarshal(what string, value any) []byte {
	line, err := json.Marshal(value)
	if err != nil {
		panic(fmt.Sprintf("claude: marshal %s: %v", what, err))
	}
	return line
}
