package workspace_test

import (
	"errors"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/workspace"
)

func TestBootstrapOpensAValidArgument(t *testing.T) {
	t.Parallel()
	root := t.TempDir()
	api := mkdir(t, root, "api")
	f := newFixture(t, scanStub{repos: []string{api}})

	if err := f.service.Bootstrap(t.Context(), ".", root); err != nil {
		t.Fatalf("Bootstrap() = %v, want nil", err)
	}

	want := &workspace.Workspace{
		Name:  filepath.Base(root),
		Path:  root,
		Repos: []workspace.Repo{{Name: "api", Path: api}},
	}
	if diff := cmp.Diff(want, f.service.Current()); diff != "" {
		t.Errorf("Current() mismatch (-want +got):\n%s", diff)
	}
	if got := f.service.Notice(); got != nil {
		t.Errorf("Notice() = %v, want nil", got)
	}
	if diff := cmp.Diff([]string{root}, paths(f.recents(t))); diff != "" {
		t.Errorf("recents mismatch (-want +got):\n%s", diff)
	}
}

func TestBootstrapRecordsANoticeForAnInvalidArgument(t *testing.T) {
	t.Parallel()
	root := t.TempDir()
	f := newFixture(t, scanStub{})

	if err := f.service.Bootstrap(t.Context(), "gone", root); err != nil {
		t.Fatalf("Bootstrap() = %v, want nil", err)
	}

	want := &workspace.Notice{Path: filepath.Join(root, "gone"), Reason: workspace.ReasonNotFound}
	if diff := cmp.Diff(want, f.service.Notice()); diff != "" {
		t.Errorf("Notice() mismatch (-want +got):\n%s", diff)
	}
	if got := f.service.Current(); got != nil {
		t.Errorf("Current() = %v, want nil", got)
	}
	if got := f.logs.count(t, "invalid workspace path"); got != 1 {
		t.Errorf("invalid paths logged = %d, want 1", got)
	}
}

func TestBootstrapWithoutRecentsOpensNothing(t *testing.T) {
	t.Parallel()
	f := newFixture(t, scanStub{})

	if err := f.service.Bootstrap(t.Context(), "", t.TempDir()); err != nil {
		t.Fatalf("Bootstrap() = %v, want nil", err)
	}

	if got := f.service.Current(); got != nil {
		t.Errorf("Current() = %v, want nil", got)
	}
	if got := f.service.Notice(); got != nil {
		t.Errorf("Notice() = %v, want nil", got)
	}
}

func TestBootstrapOpensTheMostRecentWorkspace(t *testing.T) {
	t.Parallel()
	parent := t.TempDir()
	newest := mkdir(t, parent, "newest")
	oldest := mkdir(t, parent, "oldest")
	f := newFixture(t, scanStub{})
	tempRepo(t, f.repo, oldest, -time.Hour)
	tempRepo(t, f.repo, newest, 0)

	if err := f.service.Bootstrap(t.Context(), "", parent); err != nil {
		t.Fatalf("Bootstrap() = %v, want nil", err)
	}

	current := f.service.Current()
	if current == nil || current.Path != newest {
		t.Fatalf("Current() = %v, want the workspace at %s", current, newest)
	}
}

func TestBootstrapPrunesTheMostRecentWorkspaceWhenItIsGone(t *testing.T) {
	t.Parallel()
	parent := t.TempDir()
	gone := filepath.Join(parent, "gone")
	kept := mkdir(t, parent, "kept")
	f := newFixture(t, scanStub{})
	tempRepo(t, f.repo, kept, -time.Hour)
	tempRepo(t, f.repo, gone, 0)

	if err := f.service.Bootstrap(t.Context(), "", parent); err != nil {
		t.Fatalf("Bootstrap() = %v, want nil", err)
	}

	if got := f.service.Current(); got != nil {
		t.Errorf("Current() = %v, want nil", got)
	}
	want := &workspace.Notice{Path: gone, Reason: workspace.ReasonLastRecentMissing}
	if diff := cmp.Diff(want, f.service.Notice()); diff != "" {
		t.Errorf("Notice() mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff([]string{kept}, paths(f.recents(t))); diff != "" {
		t.Errorf("recents mismatch (-want +got):\n%s", diff)
	}
	if got := f.logs.count(t, "recent pruned"); got != 1 {
		t.Errorf("pruned recents logged = %d, want 1", got)
	}
}

func TestOpenTouchesRecentsAndClearsTheNotice(t *testing.T) {
	t.Parallel()
	parent := t.TempDir()
	root := mkdir(t, parent, "work")
	f := newFixture(t, scanStub{})
	if err := f.service.Bootstrap(t.Context(), "gone", parent); err != nil {
		t.Fatalf("Bootstrap() = %v, want nil", err)
	}

	if err := f.service.Open(t.Context(), root); err != nil {
		t.Fatalf("Open() = %v, want nil", err)
	}

	if got := f.service.Notice(); got != nil {
		t.Errorf("Notice() = %v, want nil", got)
	}
	if diff := cmp.Diff([]string{root}, paths(f.recents(t))); diff != "" {
		t.Errorf("recents mismatch (-want +got):\n%s", diff)
	}
	if got := *f.changes; got != 2 {
		t.Errorf("OnChange calls = %d, want 2", got)
	}
	if got := f.logs.count(t, "workspace opened"); got != 1 {
		t.Errorf("workspaces opened logged = %d, want 1", got)
	}
}

func TestOpenScansTheSameWorkspaceAgain(t *testing.T) {
	t.Parallel()
	root := t.TempDir()
	f := newFixture(t, scanStub{})

	for range 2 {
		if err := f.service.Open(t.Context(), root); err != nil {
			t.Fatalf("Open() = %v, want nil", err)
		}
	}

	if diff := cmp.Diff([]string{root, root}, *f.scanned); diff != "" {
		t.Errorf("scanned roots mismatch (-want +got):\n%s", diff)
	}
	if got := f.recents(t); len(got) != 1 {
		t.Errorf("recents = %v, want a single entry", paths(got))
	}
}

func TestOpenRejectsAnInvalidPath(t *testing.T) {
	t.Parallel()
	f := newFixture(t, scanStub{})

	err := f.service.Open(t.Context(), filepath.Join(t.TempDir(), "gone"))

	wantErrIs(t, err, workspace.ErrNotFound)
	if got := *f.changes; got != 0 {
		t.Errorf("OnChange calls = %d, want 0", got)
	}
}

func TestOpenFailsWhenTheScanFails(t *testing.T) {
	t.Parallel()
	wantErr := errors.New("unreadable root")
	f := newFixture(t, scanStub{err: wantErr})

	err := f.service.Open(t.Context(), t.TempDir())

	wantErrIs(t, err, wantErr)
	if got := f.service.Current(); got != nil {
		t.Errorf("Current() = %v, want nil", got)
	}
}

func TestOpenArgKeepsTheWorkspaceAndRecordsANoticeOnAnInvalidPath(t *testing.T) {
	t.Parallel()
	parent := t.TempDir()
	root := mkdir(t, parent, "work")
	f := newFixture(t, scanStub{})
	if err := f.service.Open(t.Context(), root); err != nil {
		t.Fatalf("Open() = %v, want nil", err)
	}

	if err := f.service.OpenArg(t.Context(), "gone", parent); err != nil {
		t.Fatalf("OpenArg() = %v, want nil", err)
	}

	current := f.service.Current()
	if current == nil || current.Path != root {
		t.Fatalf("Current() = %v, want the workspace at %s", current, root)
	}
	want := &workspace.Notice{Path: filepath.Join(parent, "gone"), Reason: workspace.ReasonNotFound}
	if diff := cmp.Diff(want, f.service.Notice()); diff != "" {
		t.Errorf("Notice() mismatch (-want +got):\n%s", diff)
	}
	if got := *f.changes; got != 2 {
		t.Errorf("OnChange calls = %d, want 2", got)
	}
}

func TestOpenArgReturnsFailuresThatAreNotAboutThePath(t *testing.T) {
	t.Parallel()
	wantErr := errors.New("unreadable root")
	f := newFixture(t, scanStub{err: wantErr})

	err := f.service.OpenArg(t.Context(), ".", t.TempDir())

	wantErrIs(t, err, wantErr)
	if got := f.service.Notice(); got != nil {
		t.Errorf("Notice() = %v, want nil", got)
	}
}

func TestDismissNoticeClearsTheNotice(t *testing.T) {
	t.Parallel()
	f := newFixture(t, scanStub{})
	if err := f.service.Bootstrap(t.Context(), "gone", t.TempDir()); err != nil {
		t.Fatalf("Bootstrap() = %v, want nil", err)
	}

	f.service.DismissNotice()

	if got := f.service.Notice(); got != nil {
		t.Errorf("Notice() = %v, want nil", got)
	}
	if got := *f.changes; got != 2 {
		t.Errorf("OnChange calls = %d, want 2", got)
	}
}

func TestRecentsPrunesEntriesThatAreGone(t *testing.T) {
	t.Parallel()
	parent := t.TempDir()
	kept := mkdir(t, parent, "kept")
	gone := filepath.Join(parent, "gone")
	f := newFixture(t, scanStub{})
	tempRepo(t, f.repo, kept, 0)
	tempRepo(t, f.repo, gone, -time.Hour)

	if diff := cmp.Diff([]string{kept}, paths(f.recents(t))); diff != "" {
		t.Errorf("recents mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff([]string{kept}, paths(f.recents(t))); diff != "" {
		t.Errorf("recents after pruning mismatch (-want +got):\n%s", diff)
	}
	if got := f.logs.count(t, "recent pruned"); got != 1 {
		t.Errorf("pruned recents logged = %d, want 1", got)
	}
}

func TestRecentsFailsWhenTheRepositoryFails(t *testing.T) {
	t.Parallel()
	wantErr := errors.New("database is closed")
	f := newFixture(t, scanStub{})
	f.repo.listErr = wantErr

	_, err := f.service.Recents(t.Context())

	wantErrIs(t, err, wantErr)
}

func TestRemoveRecentDropsTheEntry(t *testing.T) {
	t.Parallel()
	parent := t.TempDir()
	kept := mkdir(t, parent, "kept")
	dropped := mkdir(t, parent, "dropped")
	f := newFixture(t, scanStub{})
	tempRepo(t, f.repo, kept, 0)
	tempRepo(t, f.repo, dropped, -time.Hour)

	if err := f.service.RemoveRecent(t.Context(), dropped); err != nil {
		t.Fatalf("RemoveRecent() = %v, want nil", err)
	}

	if diff := cmp.Diff([]string{kept}, paths(f.recents(t))); diff != "" {
		t.Errorf("recents mismatch (-want +got):\n%s", diff)
	}
	if got := *f.changes; got != 1 {
		t.Errorf("OnChange calls = %d, want 1", got)
	}
}

func TestOpenKeepsAtMostMaxRecentsEntries(t *testing.T) {
	t.Parallel()
	parent := t.TempDir()
	f := newFixture(t, scanStub{})
	for i := range workspace.MaxRecents + 2 {
		tempRepo(t, f.repo, mkdir(t, parent, string(rune('a'+i))), -time.Duration(i+1)*time.Minute)
	}

	if err := f.service.Open(t.Context(), mkdir(t, parent, "newest")); err != nil {
		t.Fatalf("Open() = %v, want nil", err)
	}

	got := f.recents(t)
	if len(got) != workspace.MaxRecents {
		t.Fatalf("recents = %v, want %d entries", paths(got), workspace.MaxRecents)
	}
	if got[0].Path != filepath.Join(parent, "newest") {
		t.Errorf("recents[0] = %q, want the workspace just opened", got[0].Path)
	}
}
