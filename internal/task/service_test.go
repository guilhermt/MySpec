package task_test

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/task"
)

func TestCreateStoresTheTaskAndItsFolder(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created, err := f.service.Create(t.Context(), task.CreateParams{
		Name:           "add-login",
		InitialContext: "a login screen",
	})
	if err != nil {
		t.Fatalf("Create() = %v, want nil", err)
	}

	want := task.Task{
		ID:             "task-1",
		WorkspacePath:  f.workspace,
		Name:           "add-login",
		InitialContext: "a login screen",
		Stage:          task.StagePRD,
		ArtifactsDir:   task.ArtifactsDir(f.dataDir, f.workspace, "add-login"),
		CreatedAt:      base,
		UpdatedAt:      base,
	}
	if diff := cmp.Diff(want, created); diff != "" {
		t.Errorf("Create() task mismatch (-want +got):\n%s", diff)
	}
	if !exists(created.ArtifactsDir) {
		t.Errorf("artifacts directory %s does not exist", created.ArtifactsDir)
	}
	if diff := cmp.Diff([]task.Task{want}, f.service.List()); diff != "" {
		t.Errorf("List() mismatch (-want +got):\n%s", diff)
	}
	if got := f.changeCount(); got != 1 {
		t.Errorf("OnChange ran %d times, want 1", got)
	}
	if got := f.logs.count(t, "task created"); got != 1 {
		t.Errorf("task created records = %d, want 1", got)
	}
}

func TestCreateTrimsTheNameAndTheContext(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created, err := f.service.Create(t.Context(), task.CreateParams{
		Name:           "  add-login\n",
		InitialContext: "\n a login screen \n",
	})
	if err != nil {
		t.Fatalf("Create() = %v, want nil", err)
	}

	if created.Name != "add-login" {
		t.Errorf("Name = %q, want %q", created.Name, "add-login")
	}
	if created.InitialContext != "a login screen" {
		t.Errorf("InitialContext = %q, want %q", created.InitialContext, "a login screen")
	}
}

func TestCreateKeepsTheContextAsTheUserWroteIt(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	const context = "line one\n\n  indented line\nline three"
	created, err := f.service.Create(t.Context(), task.CreateParams{
		Name:           "add-login",
		InitialContext: context,
	})
	if err != nil {
		t.Fatalf("Create() = %v, want nil", err)
	}

	if created.InitialContext != context {
		t.Errorf("InitialContext = %q, want %q", created.InitialContext, context)
	}
}

func TestCreateRejectsAnInvalidName(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	_, err := f.service.Create(t.Context(), task.CreateParams{
		Name:           "Add Login",
		InitialContext: "a login screen",
	})
	wantErrIs(t, err, task.ErrInvalidName)

	if got := len(f.service.List()); got != 0 {
		t.Errorf("List() has %d tasks, want 0", got)
	}
}

func TestCreateRejectsAnEmptyContext(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	_, err := f.service.Create(t.Context(), task.CreateParams{
		Name:           "add-login",
		InitialContext: "   \n\t ",
	})
	wantErrIs(t, err, task.ErrEmptyContext)
}

func TestCreateRejectsARepositoryOutsideTheWorkspace(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	_, err := f.service.Create(t.Context(), task.CreateParams{
		Name:           "add-login",
		RepoPath:       filepath.Join(f.workspace, "elsewhere"),
		InitialContext: "a login screen",
	})
	wantErrIs(t, err, task.ErrRepoOutside)
}

func TestCreateAcceptsARepositoryOfTheWorkspace(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	repo := f.repos[0]
	created := f.create(t, "add-login", repo+string(filepath.Separator))

	if created.RepoPath != repo {
		t.Errorf("RepoPath = %q, want %q", created.RepoPath, repo)
	}
	if got := created.Dir(); got != repo {
		t.Errorf("Dir() = %q, want %q", got, repo)
	}
}

func TestCreateRejectsANameAlreadyUsed(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	first := f.create(t, "add-login", "")

	_, err := f.service.Create(t.Context(), task.CreateParams{
		Name:           "add-login",
		InitialContext: "another login screen",
	})
	wantErrIs(t, err, task.ErrNameTaken)

	if got := len(f.service.List()); got != 1 {
		t.Errorf("List() has %d tasks, want 1", got)
	}
	if !exists(first.ArtifactsDir) {
		t.Error("the folder of the first task was removed")
	}
}

func TestCreateKeepsTheArtifactsOfTheTaskThatOwnsTheName(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	first := f.create(t, "add-login", "")
	writePRD(t, first, "# PRD")

	_, err := f.service.Create(t.Context(), task.CreateParams{
		Name:           "add-login",
		InitialContext: "another login screen",
	})
	wantErrIs(t, err, task.ErrNameTaken)

	if !exists(first.PRDPath()) {
		t.Error("the PRD of the first task was removed")
	}
}

func TestCreateRemovesTheFolderItMadeWhenTheTaskCannotBeStored(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.repo.insertErr = errors.New("database is locked")

	_, err := f.service.Create(t.Context(), task.CreateParams{
		Name:           "add-login",
		InitialContext: "a login screen",
	})
	if err == nil {
		t.Fatal("Create() = nil, want an error")
	}

	dir := task.ArtifactsDir(f.dataDir, f.workspace, "add-login")
	if exists(dir) {
		t.Errorf("artifacts directory %s survived a failed create", dir)
	}
	if got := len(f.service.List()); got != 0 {
		t.Errorf("List() has %d tasks, want 0", got)
	}
}

func TestCreateAdoptsAFolderLeftBehindByAnInterruptedCreate(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	dir := task.ArtifactsDir(f.dataDir, f.workspace, "add-login")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatalf("create artifacts directory: %v", err)
	}

	created := f.create(t, "add-login", "")
	if created.ArtifactsDir != dir {
		t.Errorf("ArtifactsDir = %q, want %q", created.ArtifactsDir, dir)
	}
}

func TestCreateFailsWithoutAWorkspace(t *testing.T) {
	t.Parallel()

	service, err := task.New(task.Deps{Repo: &memRepo{}, DataDir: t.TempDir(), Log: newLogCapture().log})
	if err != nil {
		t.Fatalf("New() = %v, want nil", err)
	}
	t.Cleanup(func() { _ = service.Close() })

	if _, err := service.Create(t.Context(), task.CreateParams{
		Name:           "add-login",
		InitialContext: "a login screen",
	}); err == nil {
		t.Error("Create() = nil, want an error")
	}
}

func TestGetReturnsALoadedTask(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")

	got, ok := f.service.Get(created.ID)
	if !ok {
		t.Fatalf("Get(%s) not found, want the task", created.ID)
	}
	if diff := cmp.Diff(created, got); diff != "" {
		t.Errorf("Get() mismatch (-want +got):\n%s", diff)
	}

	if _, ok := f.service.Get("nope"); ok {
		t.Error("Get(nope) found a task, want none")
	}
}

func TestListIsACopy(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")

	list := f.service.List()
	list[0].Name = "changed"

	if got, _ := f.service.Get(created.ID); got.Name != "add-login" {
		t.Errorf("Name = %q, want the service untouched by the caller", got.Name)
	}
}

func TestDeleteRemovesTheTaskTheRowAndTheFolder(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")
	writePRD(t, created, "# PRD")

	if err := f.service.Delete(t.Context(), created.ID); err != nil {
		t.Fatalf("Delete() = %v, want nil", err)
	}

	if got := len(f.service.List()); got != 0 {
		t.Errorf("List() has %d tasks, want 0", got)
	}
	if exists(created.ArtifactsDir) {
		t.Errorf("artifacts directory %s still exists", created.ArtifactsDir)
	}
	if _, err := f.repo.Get(t.Context(), created.ID); !errors.Is(err, task.ErrNotFound) {
		t.Errorf("repo.Get() = %v, want ErrNotFound", err)
	}
	if got := f.changeCount(); got != 2 {
		t.Errorf("OnChange ran %d times, want 2", got)
	}
	if got := f.logs.count(t, "task deleted"); got != 1 {
		t.Errorf("task deleted records = %d, want 1", got)
	}
}

func TestDeleteReportsAnUnknownTask(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	wantErrIs(t, f.service.Delete(t.Context(), "nope"), task.ErrNotFound)
}

func TestDeleteFailsWhenTheRowSurvives(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")
	f.repo.deleteErr = errors.New("database is locked")

	if err := f.service.Delete(t.Context(), created.ID); err == nil {
		t.Fatal("Delete() = nil, want an error")
	}
	if got := len(f.service.List()); got != 1 {
		t.Errorf("List() has %d tasks, want the task kept", got)
	}
	if !exists(created.ArtifactsDir) {
		t.Error("the artifacts directory was removed although the row survived")
	}
}

func TestReadArtifactReturnsThePRD(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")
	writePRD(t, created, "# PRD\n")

	got, err := f.service.ReadArtifact(created.ID, task.PRDFile)
	if err != nil {
		t.Fatalf("ReadArtifact() = %v, want nil", err)
	}
	if want := "# PRD\n"; got != want {
		t.Errorf("ReadArtifact() = %q, want %q", got, want)
	}
}

func TestReadArtifactRefusesAnythingButThePRD(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")

	tests := map[string]struct{ id, name string }{
		"another file":   {id: created.ID, name: "notes.md"},
		"a path":         {id: created.ID, name: "../PRD.md"},
		"unknown task":   {id: "nope", name: task.PRDFile},
		"missing file":   {id: created.ID, name: task.PRDFile},
		"empty artifact": {id: created.ID, name: ""},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			_, err := f.service.ReadArtifact(tc.id, tc.name)
			wantErrIs(t, err, task.ErrNotFound)
		})
	}
}

func TestSyncLoadsTheTasksOfTheWorkspace(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.repo.seed(task.Task{
		ID:            "elsewhere",
		WorkspacePath: "/other",
		Name:          "other-task",
		Stage:         task.StagePRD,
		ArtifactsDir:  filepath.Join(f.dataDir, "other"),
		CreatedAt:     base,
		UpdatedAt:     base,
	})
	mine := task.Task{
		ID:            "mine",
		WorkspacePath: f.workspace,
		Name:          "add-login",
		Stage:         task.StagePRD,
		ArtifactsDir:  task.ArtifactsDir(f.dataDir, f.workspace, "add-login"),
		CreatedAt:     base,
		UpdatedAt:     base,
	}
	f.repo.seed(mine)

	service := f.service
	if err := service.Sync(t.Context(), f.workspace); err != nil {
		t.Fatalf("Sync() = %v, want nil", err)
	}

	// The first Sync of the fixture already claimed this path, so nothing was
	// reloaded: the second call is the no-op the contract promises.
	if got := len(service.List()); got != 0 {
		t.Errorf("List() has %d tasks, want the repeated Sync to be a no-op", got)
	}

	other := t.TempDir()
	if err := service.Sync(t.Context(), other); err != nil {
		t.Fatalf("Sync(other) = %v, want nil", err)
	}
	if err := service.Sync(t.Context(), f.workspace); err != nil {
		t.Fatalf("Sync(back) = %v, want nil", err)
	}
	if diff := cmp.Diff([]task.Task{mine}, service.List()); diff != "" {
		t.Errorf("List() mismatch (-want +got):\n%s", diff)
	}
	if got := f.changeCount(); got != 0 {
		t.Errorf("OnChange ran %d times, want Sync to be silent", got)
	}
}

func TestSyncReconcilesTheStageWithTheDisk(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	written := f.create(t, "written", "")
	thrownAway := f.create(t, "thrown-away", "")
	writePRD(t, written, "# PRD")

	// The stage of a task the app never saw finish is caught by the reload.
	if err := f.repo.UpdateStage(t.Context(), thrownAway.ID, string(task.StagePRDDone), 3, base); err != nil {
		t.Fatalf("UpdateStage() = %v, want nil", err)
	}

	reopened := newService(t, f)
	if err := reopened.Sync(t.Context(), f.workspace); err != nil {
		t.Fatalf("Sync() = %v, want nil", err)
	}

	got := map[string]task.Stage{}
	for _, tk := range reopened.List() {
		got[tk.Name] = tk.Stage
	}
	want := map[string]task.Stage{"written": task.StagePRDDone, "thrown-away": task.StagePRD}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("stages mismatch (-want +got):\n%s", diff)
	}

	if stored := f.repo.get(t, written.ID); stored.Stage != task.StagePRDDone {
		t.Errorf("stored stage = %q, want %q", stored.Stage, task.StagePRDDone)
	}
	if stored := f.repo.get(t, thrownAway.ID); stored.ArtifactVersion != 3 {
		t.Errorf("artifact version = %d, want the reconcile to leave it alone", stored.ArtifactVersion)
	}
	if got := f.artifactCalls(); len(got) != 0 {
		t.Errorf("OnArtifact ran %d times, want Sync to be silent", len(got))
	}
}

func TestSyncTreatsAnEmptyPRDAsUnfinished(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")
	writePRD(t, created, "")

	reopened := newService(t, f)
	if err := reopened.Sync(t.Context(), f.workspace); err != nil {
		t.Fatalf("Sync() = %v, want nil", err)
	}

	if got := reopened.List()[0].Stage; got != task.StagePRD {
		t.Errorf("Stage = %q, want %q", got, task.StagePRD)
	}
}

func TestSyncRecreatesAFolderThatIsGone(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")
	if err := os.RemoveAll(created.ArtifactsDir); err != nil {
		t.Fatalf("remove artifacts directory: %v", err)
	}

	reopened := newService(t, f)
	if err := reopened.Sync(t.Context(), f.workspace); err != nil {
		t.Fatalf("Sync() = %v, want nil", err)
	}

	if !exists(created.ArtifactsDir) {
		t.Errorf("artifacts directory %s was not recreated", created.ArtifactsDir)
	}
}

func TestSyncFailsWhenTheTasksCannotBeListed(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.repo.listErr = errors.New("database is locked")

	if err := f.service.Sync(t.Context(), t.TempDir()); err == nil {
		t.Error("Sync() = nil, want an error")
	}
}

func TestSyncFailsWhenTheStageCannotBeReconciled(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")
	writePRD(t, created, "# PRD")
	f.repo.updateErr = errors.New("database is locked")

	reopened := newService(t, f)
	if err := reopened.Sync(t.Context(), f.workspace); err == nil {
		t.Error("Sync() = nil, want an error")
	}
}

// newService builds a second Service over the collaborators of a fixture, the
// way reopening the app builds one over the same database.
func newService(t *testing.T, f *fixture) *task.Service {
	t.Helper()

	service, err := task.New(task.Deps{
		Repo:       f.repo,
		DataDir:    f.dataDir,
		Log:        f.logs.log,
		Now:        func() time.Time { return base.Add(time.Hour) },
		Repos:      func() []string { return f.repos },
		OnChange:   f.onChange,
		OnArtifact: f.onArtifact,
	})
	if err != nil {
		t.Fatalf("New() = %v, want nil", err)
	}
	t.Cleanup(func() {
		if err := service.Close(); err != nil {
			t.Errorf("Close() = %v, want nil", err)
		}
	})
	return service
}

func TestNewDefaultsTheIdentityAndTheClock(t *testing.T) {
	t.Parallel()

	repo := &memRepo{}
	service, err := task.New(task.Deps{Repo: repo, DataDir: t.TempDir(), Log: newLogCapture().log})
	if err != nil {
		t.Fatalf("New() = %v, want nil", err)
	}
	t.Cleanup(func() { _ = service.Close() })

	workspace := t.TempDir()
	if syncErr := service.Sync(t.Context(), workspace); syncErr != nil {
		t.Fatalf("Sync() = %v, want nil", syncErr)
	}
	created, err := service.Create(t.Context(), task.CreateParams{
		Name:           "add-login",
		InitialContext: "a login screen",
	})
	if err != nil {
		t.Fatalf("Create() = %v, want nil", err)
	}

	if len(created.ID) != len("00000000-0000-0000-0000-000000000000") {
		t.Errorf("ID = %q, want a uuid", created.ID)
	}
	if created.CreatedAt.IsZero() || created.CreatedAt.Location() != time.UTC {
		t.Errorf("CreatedAt = %v, want an instant in UTC", created.CreatedAt)
	}
	if !strings.HasPrefix(created.ArtifactsDir, filepath.Join(created.ArtifactsDir, "..", "..", "..")) {
		t.Errorf("ArtifactsDir = %q, want it under the data directory", created.ArtifactsDir)
	}
}
