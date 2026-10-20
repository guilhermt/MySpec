package bindings

import (
	"errors"
	"fmt"
	"log/slog"
	"testing"

	"github.com/guilhermt/myspec/internal/discussionflow"
	"github.com/guilhermt/myspec/internal/flow"
)

func TestARunningPublicationGetsItsSentence(t *testing.T) {
	t.Parallel()

	err := failure(slog.New(slog.DiscardHandler), "DecideDraft", discussionflow.ErrPublishing)

	if want := "A publication is running."; err == nil || err.Error() != want {
		t.Errorf("failure(ErrPublishing) = %v, want %q", err, want)
	}
}

func TestUndoneFailureSaysTheTaskWasUndoneOnlyWhenItWas(t *testing.T) {
	t.Parallel()

	// The messages of the product are sentences, which the error-strings rule refuses in a literal.
	const message = "Claude Code didn't start."
	failed := errors.New(message)
	tests := []struct {
		name      string
		raw       string
		deleteErr error
		want      string
	}{
		{name: "the deletion worked", want: message + " The task was undone."},
		{name: "a raw error gets its own sentence", raw: "exec: claude not found", want: "exec: claude not found. The task was undone."},
		{name: "the deletion failed", deleteErr: errors.New("disk full"), want: message},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			failed := failed
			if tt.raw != "" {
				failed = errors.New(tt.raw)
			}
			if got := undoneFailure(failed, tt.deleteErr, "The task was undone.").Error(); got != tt.want {
				t.Errorf("undoneFailure() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestThePullRequestReviewRefusalsGetTheirSentences(t *testing.T) {
	t.Parallel()

	tests := []struct {
		err  error
		want string
	}{
		{flow.ErrPRReviewModeLocked, "The review of this pull request has already started."},
		{flow.ErrAgentReviewsPR, "The agent is reviewing this pull request. Take it over with Review myself first."},
		{flow.ErrNoAgentPRReview, "The agent isn't reviewing this pull request."},
	}
	for _, tt := range tests {
		wrapped := fmt.Errorf("do it: %w", tt.err)
		if got := failure(slog.New(slog.DiscardHandler), "ReviewPRMyself", wrapped); got == nil || got.Error() != tt.want {
			t.Errorf("failure(%v) = %v, want %q", tt.err, got, tt.want)
		}
	}
}
