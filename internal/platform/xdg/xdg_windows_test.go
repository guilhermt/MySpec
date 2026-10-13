package xdg_test

import (
	"path/filepath"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/platform/xdg"
)

func TestResolvePutsDataAndStateInTheirOwnFoldersOfTheApp(t *testing.T) {
	root := t.TempDir()
	setBases(t, root)

	want := xdg.Dirs{
		Data:  filepath.Join(root, "data", "MySpec", "data"),
		State: filepath.Join(root, "state", "MySpec", "state"),
	}
	if diff := cmp.Diff(want, xdg.Resolve()); diff != "" {
		t.Errorf("Resolve() mismatch (-want +got):\n%s", diff)
	}
}
