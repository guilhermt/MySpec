package gh_test

import (
	"errors"
	"testing"

	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/gh/ghtest"
)

func TestCloneClonesTheRepositoryIntoTheFolder(t *testing.T) {
	t.Parallel()
	r, fake := runner(t, map[string]ghtest.Reply{"repo": {}})

	if err := r.Clone(t.Context(), "acme/api", "/home/someone/code/api"); err != nil {
		t.Fatalf("Clone() = %v, want nil", err)
	}
	calls := fake.Calls(t)
	if len(calls) != 1 || calls[0].Args != "repo clone acme/api /home/someone/code/api" {
		t.Errorf("calls = %+v, want gh repo clone acme/api /home/someone/code/api", calls)
	}
}

func TestCloneReportsAFailureAsGhWroteIt(t *testing.T) {
	t.Parallel()
	said := "GraphQL: Could not resolve to a Repository with the name 'acme/api'."
	r, _ := runner(t, map[string]ghtest.Reply{"repo": {Stderr: said, Exit: 1}})

	err := r.Clone(t.Context(), "acme/api", t.TempDir()+"/api")
	var ghErr *gh.Error
	if !errors.As(err, &ghErr) || ghErr.Output != said {
		t.Errorf("Clone() = %v, want the gh error carrying %q", err, said)
	}
}
