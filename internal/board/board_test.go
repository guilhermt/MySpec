package board_test

import (
	"testing"

	"github.com/guilhermt/myspec/internal/board"
)

func TestAnIssueIsNamedByItsRepositoryAndKeyedInLowerCase(t *testing.T) {
	t.Parallel()

	i := board.Issue{Owner: "Acme", Name: "Web", Number: 12}

	if got, want := i.Key(), "acme/web#12"; got != want {
		t.Errorf("Key() = %q, want %q", got, want)
	}
	if got, want := i.FullName(), "Acme/Web"; got != want {
		t.Errorf("FullName() = %q, want %q", got, want)
	}
}
