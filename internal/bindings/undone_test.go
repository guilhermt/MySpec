package bindings

import (
	"errors"
	"testing"
)

func TestUndoneFailureSaysTheTaskWasUndoneOnlyWhenItWas(t *testing.T) {
	t.Parallel()

	// The messages of the product are sentences, which the error-strings rule refuses in a literal.
	const message = "Claude Code didn't start."
	failed := errors.New(message)
	tests := []struct {
		name      string
		deleteErr error
		want      string
	}{
		{name: "the deletion worked", want: message + " The task was undone."},
		{name: "the deletion failed", deleteErr: errors.New("disk full"), want: message},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := undoneFailure(failed, tt.deleteErr).Error(); got != tt.want {
				t.Errorf("undoneFailure() = %q, want %q", got, tt.want)
			}
		})
	}
}
