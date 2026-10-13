package xdg_test

import (
	"path/filepath"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/platform/xdg"
)

func TestResolve(t *testing.T) {
	root := t.TempDir()
	setBases(t, root)

	want := xdg.Dirs{
		Data:  filepath.Join(root, "data", "myspec"),
		State: filepath.Join(root, "state", "myspec"),
	}
	if diff := cmp.Diff(want, xdg.Resolve()); diff != "" {
		t.Errorf("Resolve() mismatch (-want +got):\n%s", diff)
	}
}
