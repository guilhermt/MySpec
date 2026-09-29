package session_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/guilhermt/myspec/internal/claude"
	"github.com/guilhermt/myspec/internal/session"
)

func TestRetryReasonOf(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		error string
		want  string
	}{
		{name: "overloaded", error: "overloaded", want: "overloaded"},
		{name: "529", error: "API Error: 529", want: "overloaded"},
		{name: "rate limit", error: "Rate limit exceeded", want: "rate_limit"},
		{name: "rate_limit_error", error: `{"type":"rate_limit_error"}`, want: "rate_limit"},
		{name: "ratelimit", error: "RateLimitError", want: "rate_limit"},
		{name: "429", error: "status 429", want: "rate_limit"},
		{name: "connection", error: "Connection error.", want: "connection"},
		{name: "timeout", error: "Request timed out", want: "connection"},
		{name: "econnreset", error: "ECONNRESET", want: "connection"},
		{name: "socket", error: "socket hang up", want: "connection"},
		{name: "server", error: "API Error: 500 Internal Server Error", want: "server"},
		{name: "502", error: "502 Bad Gateway", want: "server"},
		{name: "a word with rate in it", error: "API Error: 500 failed to generate a response", want: "server"},
		{name: "other", error: "invalid_request_error", want: "other"},
		{name: "empty", error: "", want: "other"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if got := session.RetryReasonOf(tt.error); got != tt.want {
				t.Errorf("retryReasonOf(%q) = %q, want %q", tt.error, got, tt.want)
			}
		})
	}
}

func TestRetryReasonOfTheRecordedRetry(t *testing.T) {
	t.Parallel()

	raw, err := os.ReadFile(filepath.Join("..", "claude", "testdata", "api-retry.jsonl"))
	if err != nil {
		t.Fatalf("ReadFile() = %v, want nil", err)
	}
	seen := 0
	for line := range strings.SplitSeq(strings.TrimRight(string(raw), "\n"), "\n") {
		event, err := claude.Decode([]byte(line))
		if err != nil {
			t.Fatalf("Decode() = %v, want nil", err)
		}
		if event.APIRetry == nil {
			continue
		}
		seen++
		if got := session.RetryReasonOf(event.APIRetry.Error); got != "overloaded" {
			t.Errorf("retryReasonOf(%q) = %q, want overloaded", event.APIRetry.Error, got)
		}
	}
	if seen == 0 {
		t.Error("the recording has no api_retry")
	}
}
