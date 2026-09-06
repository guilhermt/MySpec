package bindings_test

import (
	"errors"
	"path/filepath"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/bindings"
)

func TestGetStateStartsEmpty(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	got := f.workspace.GetState()

	want := bindings.State{Recents: []bindings.Recent{}, Theme: "system", Tasks: []bindings.TaskSummary{}}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("GetState() mismatch (-want +got):\n%s", diff)
	}
}

func TestOpenPathOpensTheWorkspace(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	root := t.TempDir()
	f.setScan([]string{filepath.Join(root, "api")}, nil)

	if err := f.workspace.OpenPath(root); err != nil {
		t.Fatalf("OpenPath() = %v, want nil", err)
	}

	got := f.workspace.GetState()
	want := bindings.State{
		Workspace: &bindings.Workspace{
			Name:  filepath.Base(root),
			Path:  root,
			Repos: []bindings.Repo{{Name: "api", Path: filepath.Join(root, "api")}},
		},
		Recents: []bindings.Recent{{Name: filepath.Base(root), Path: root}},
		Theme:   "system",
		Tasks:   []bindings.TaskSummary{},
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("GetState() mismatch (-want +got):\n%s", diff)
	}
}

func TestOpenPathTurnsAMissingPathIntoANotice(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	root := t.TempDir()
	if err := f.workspace.OpenPath(root); err != nil {
		t.Fatalf("OpenPath(%q) = %v, want nil", root, err)
	}

	gone := filepath.Join(t.TempDir(), "gone")
	if err := f.workspace.OpenPath(gone); err != nil {
		t.Fatalf("OpenPath(%q) = %v, want nil", gone, err)
	}

	got := f.workspace.GetState()
	want := &bindings.Notice{Path: gone, Reason: "not_found"}
	if diff := cmp.Diff(want, got.Notice); diff != "" {
		t.Errorf("Notice mismatch (-want +got):\n%s", diff)
	}
	if got.Workspace == nil || got.Workspace.Path != root {
		t.Errorf("Workspace = %v, want the one that was already open", got.Workspace)
	}
}

func TestOpenPathReturnsAScanFailure(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	wantErr := errors.New("disk on fire")
	f.setScan(nil, wantErr)

	err := f.workspace.OpenPath(t.TempDir())
	if !errors.Is(err, wantErr) {
		t.Errorf("OpenPath() = %v, want %v", err, wantErr)
	}
	if !f.logged(t, "binding failed") {
		t.Error("the failure was not logged as binding failed")
	}
}

func TestDismissNoticeClearsIt(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	if err := f.workspace.OpenPath(filepath.Join(t.TempDir(), "gone")); err != nil {
		t.Fatalf("OpenPath() = %v, want nil", err)
	}
	if f.workspace.GetState().Notice == nil {
		t.Fatal("Notice = nil, want the missing path")
	}

	f.workspace.DismissNotice()

	if got := f.workspace.GetState().Notice; got != nil {
		t.Errorf("Notice = %v, want nil", got)
	}
}

func TestRemoveRecentDropsIt(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	root := t.TempDir()
	if err := f.workspace.OpenPath(root); err != nil {
		t.Fatalf("OpenPath() = %v, want nil", err)
	}

	if err := f.workspace.RemoveRecent(root); err != nil {
		t.Fatalf("RemoveRecent() = %v, want nil", err)
	}

	if got := f.workspace.GetState().Recents; len(got) != 0 {
		t.Errorf("Recents = %v, want none", got)
	}
}

func TestRemoveRecentReportsADatabaseFailure(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	if err := f.store.Close(); err != nil {
		t.Fatalf("Close() = %v, want nil", err)
	}

	if err := f.workspace.RemoveRecent("/home/u/code"); err == nil {
		t.Error("RemoveRecent() = nil, want an error from the closed database")
	}
	if !f.logged(t, "binding failed") {
		t.Error("the failure was not logged as binding failed")
	}
}

func TestOpenFolderDialogOpensWhatWasPicked(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	root := t.TempDir()
	f.picker.path, f.picker.ok = root, true

	if err := f.workspace.OpenFolderDialog(); err != nil {
		t.Fatalf("OpenFolderDialog() = %v, want nil", err)
	}

	got := f.workspace.GetState().Workspace
	if got == nil || got.Path != root {
		t.Errorf("Workspace = %v, want the picked folder %q", got, root)
	}
}

func TestOpenFolderDialogCancelledChangesNothing(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	before := f.workspace.GetState()

	if err := f.workspace.OpenFolderDialog(); err != nil {
		t.Fatalf("OpenFolderDialog() = %v, want nil", err)
	}

	if diff := cmp.Diff(before, f.workspace.GetState()); diff != "" {
		t.Errorf("state changed after a cancelled dialog (-before +after):\n%s", diff)
	}
}

func TestOpenFolderDialogReturnsThePickerFailure(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	wantErr := errors.New("no display")
	f.picker.err = wantErr

	if err := f.workspace.OpenFolderDialog(); !errors.Is(err, wantErr) {
		t.Errorf("OpenFolderDialog() = %v, want %v", err, wantErr)
	}
	if !f.logged(t, "binding failed") {
		t.Error("the failure was not logged as binding failed")
	}
}

func TestOpenFolderDialogStartsAtHomeWithNoWorkspace(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	f := newFixture(t)

	if err := f.workspace.OpenFolderDialog(); err != nil {
		t.Fatalf("OpenFolderDialog() = %v, want nil", err)
	}

	if f.picker.startIn != home {
		t.Errorf("startIn = %q, want %q", f.picker.startIn, home)
	}
}

func TestOpenFolderDialogStartsNextToTheOpenWorkspace(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	root := t.TempDir()
	if err := f.workspace.OpenPath(root); err != nil {
		t.Fatalf("OpenPath() = %v, want nil", err)
	}

	if err := f.workspace.OpenFolderDialog(); err != nil {
		t.Fatalf("OpenFolderDialog() = %v, want nil", err)
	}

	if want := filepath.Dir(root); f.picker.startIn != want {
		t.Errorf("startIn = %q, want %q", f.picker.startIn, want)
	}
}
