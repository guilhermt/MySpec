package prompts_test

import (
	"os"
	"testing"

	"github.com/guilhermt/myspec/internal/prompts"
)

func TestListFailsWhenAnEditCannotBeLookedAt(t *testing.T) {
	t.Parallel()

	// A file where the prompts directory goes makes every stat fail with
	// ENOTDIR, which is not a prompt without an edit.
	dataDir := t.TempDir()
	if err := os.WriteFile(prompts.Dir(dataDir), []byte("not a directory"), 0o600); err != nil {
		t.Fatalf("write the file: %v", err)
	}

	if got, err := prompts.List(dataDir); err == nil {
		t.Errorf("List() = %+v, nil, want the error of the stat", got)
	}
}
