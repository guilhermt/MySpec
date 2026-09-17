package board_test

import (
	"testing"

	"github.com/guilhermt/myspec/internal/board"
)

func TestRefusalMessageIsWhatTheUserReads(t *testing.T) {
	t.Parallel()

	tests := []struct {
		refusal board.Refusal
		want    string
	}{
		{board.Refusal{Reason: board.RefusalInvalidURL}, "This isn't the URL of a GitHub project."},
		{board.Refusal{Reason: board.RefusalRegistered, Title: "Roadmap"}, "Roadmap is already registered."},
		{board.Refusal{Reason: board.RefusalInvalidRepository}, "Type the repository as owner/name."},
		{board.Refusal{Reason: board.RefusalUnknownRepository, Repository: "acme/api"}, "acme/api doesn't exist or this account can't read it."},
		{board.Refusal{Reason: board.RefusalOtherBoard, Repository: "acme/api", Title: "Roadmap"}, "acme/api belongs to the board Roadmap."},
		{board.Refusal{Reason: board.RefusalNotManaged, Repository: "acme/api"}, "acme/api isn't managed by this board."},
	}
	for _, tt := range tests {
		t.Run(string(tt.refusal.Reason), func(t *testing.T) {
			t.Parallel()
			if got := tt.refusal.Message(); got != tt.want {
				t.Errorf("Message() = %q, want %q", got, tt.want)
			}
			if got, want := tt.refusal.Error(), "board: "+tt.want; got != want {
				t.Errorf("Error() = %q, want %q", got, want)
			}
		})
	}
}
