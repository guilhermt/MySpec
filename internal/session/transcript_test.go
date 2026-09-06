package session_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/session"
)

// answeredAt is a fixed instant for the payloads carrying one.
var answeredAt = time.Date(2026, time.September, 6, 12, 0, 0, 0, time.UTC)

// roundTrip cases cover every kind, so the payload column never loses a field.
func roundTripCases() map[string]session.Entry {
	return map[string]session.Entry{
		"user": {
			Kind: session.KindUser,
			User: &session.UserEntry{Text: "add a login screen", Pending: true, Prompt: true},
		},
		"assistant": {
			Kind: session.KindAssistant,
			Assistant: &session.AssistantEntry{
				MessageID: "msg_1", BlockIndex: 2, Text: "here it is", Complete: true, Interrupted: true,
			},
		},
		"action": {
			Kind: session.KindAction,
			Action: &session.ActionEntry{
				ToolUseID: "toolu_1", Tool: "Read", Label: "Reading", Target: "main.go", Status: session.ActionDone,
			},
		},
		"permission": {
			Kind: session.KindPermission,
			Permission: &session.PermissionEntry{
				RequestID: "req_1", ToolUseID: "toolu_2", Tool: "Bash", DisplayName: "Bash",
				Description:         "write a file",
				Input:               json.RawMessage(`{"command":"echo hi"}`),
				Suggestions:         json.RawMessage(`[{"type":"addRules"}]`),
				BlockedPath:         "/tmp/hello.txt",
				DecisionReason:      "outside the workspace",
				SuppressAlwaysAllow: true,
				DefaultToNo:         true,
				Status:              session.PermissionDenied,
				DenyMessage:         "not this time",
				AnsweredAt:          &answeredAt,
			},
		},
		// An absent input or suggestion list comes back as the JSON null it was
		// stored as, which is what the interface reads.
		"permission without optional fields": {
			Kind: session.KindPermission,
			Permission: &session.PermissionEntry{
				RequestID: "req_2", Tool: "Read", Status: session.PermissionPending,
				Input:       json.RawMessage("null"),
				Suggestions: json.RawMessage("null"),
			},
		},
		"question": {
			Kind: session.KindQuestion,
			Question: &session.QuestionEntry{
				RequestID: "req_3", ToolUseID: "toolu_3",
				Questions: []session.Question{{
					Question: "Which database?",
					Header:   "Database",
					Options: []session.QuestionOption{
						{Label: "SQLite", Description: "embedded"},
						{Label: "Postgres", Description: "server"},
					},
					MultiSelect: true,
				}},
				Answers: map[string]string{"Which database?": "SQLite"},
				Status:  session.PermissionAllowed,
			},
		},
		"marker": {
			Kind:   session.KindMarker,
			Marker: &session.MarkerEntry{Type: session.MarkerCompacted, PreTokens: 120_000},
		},
		"error": {
			Kind:  session.KindError,
			Error: &session.ErrorEntry{Kind: session.ErrorProcessExit, Message: "boom", Retryable: true},
		},
	}
}

func TestPayloadRoundTrip(t *testing.T) {
	t.Parallel()

	for name, entry := range roundTripCases() {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			data, err := entry.MarshalPayload()
			if err != nil {
				t.Fatalf("MarshalPayload() = %v, want nil", err)
			}

			got, err := session.UnmarshalPayload(entry.Kind, data)
			if err != nil {
				t.Fatalf("UnmarshalPayload() = %v, want nil", err)
			}
			if diff := cmp.Diff(entry, got); diff != "" {
				t.Errorf("round trip mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestMarshalPayloadRejectsAnEntryWithoutItsPayload(t *testing.T) {
	t.Parallel()

	for _, kind := range []session.Kind{
		session.KindUser, session.KindAssistant, session.KindAction, session.KindPermission,
		session.KindQuestion, session.KindMarker, session.KindError,
	} {
		t.Run(string(kind), func(t *testing.T) {
			t.Parallel()

			if _, err := (session.Entry{Kind: kind}).MarshalPayload(); err == nil {
				t.Errorf("MarshalPayload() = nil, want error for kind %q with no payload", kind)
			}
		})
	}
}

func TestMarshalPayloadRejectsAnUnknownKind(t *testing.T) {
	t.Parallel()

	if _, err := (session.Entry{Kind: "nope"}).MarshalPayload(); err == nil {
		t.Error("MarshalPayload() = nil, want error")
	}
}

func TestUnmarshalPayloadRejectsAnUnknownKind(t *testing.T) {
	t.Parallel()

	if _, err := session.UnmarshalPayload("nope", []byte(`{}`)); err == nil {
		t.Error("UnmarshalPayload() = nil, want error")
	}
}

func TestUnmarshalPayloadRejectsBrokenJSON(t *testing.T) {
	t.Parallel()

	if _, err := session.UnmarshalPayload(session.KindUser, []byte(`{`)); err == nil {
		t.Error("UnmarshalPayload() = nil, want error")
	}
}
