package task_test

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/reviewmode"
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
		ReviewModes:    task.ReviewModes{Task: reviewmode.Manual},
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

func TestCreateKeepsTheModelsOfTheTask(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	want := models.Factory()
	want[models.PRD] = models.Choice{Model: models.Fable51, Effort: models.XHigh}

	created, err := f.service.Create(t.Context(), task.CreateParams{
		Name:           "add-login",
		InitialContext: "a login screen",
		Models:         want,
	})
	if err != nil {
		t.Fatalf("Create() = %v, want nil", err)
	}

	if diff := cmp.Diff(want, created.Models.Stages); diff != "" {
		t.Errorf("Create() stages mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff(want, f.repo.get(t, created.ID).Models.Stages); diff != "" {
		t.Errorf("stored stages mismatch (-want +got):\n%s", diff)
	}
}

func TestCreateKeepsTheReviewModeOfTheTask(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created, err := f.service.Create(t.Context(), task.CreateParams{
		Name:           "add-login",
		InitialContext: "a login screen",
		ReviewMode:     reviewmode.Agent,
	})
	if err != nil {
		t.Fatalf("Create() = %v, want nil", err)
	}

	want := task.ReviewModes{Task: reviewmode.Agent}
	if diff := cmp.Diff(want, created.ReviewModes); diff != "" {
		t.Errorf("Create() review modes mismatch (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff(want, f.repo.get(t, created.ID).ReviewModes); diff != "" {
		t.Errorf("stored review modes mismatch (-want +got):\n%s", diff)
	}

	// A task created without a mode is reviewed by the user.
	plain := f.create(t, "add-logout", "")
	if diff := cmp.Diff(task.ReviewModes{Task: reviewmode.Manual}, plain.ReviewModes); diff != "" {
		t.Errorf("Create() without a mode mismatch (-want +got):\n%s", diff)
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

func TestArchiveMovesTheTaskToTheHistory(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")
	writePRD(t, created, "# PRD\n")
	if _, err := f.service.SetPRRun(t.Context(), created.ID, f.repos[0], task.PRDone, nil); err != nil {
		t.Fatalf("SetPRRun() = %v, want nil", err)
	}
	if _, err := f.service.Inspect(created.ID); err != nil {
		t.Fatalf("Inspect() = %v, want nil", err)
	}
	before := f.changeCount()

	archived, err := f.service.Archive(t.Context(), created.ID)
	if err != nil {
		t.Fatalf("Archive() = %v, want nil", err)
	}
	if !archived.Archived() || !archived.ArchivedAt.Equal(base) || !archived.UpdatedAt.Equal(base) {
		t.Errorf("Archive() = archived %t at %v, updated %v, want it archived at %v",
			archived.Archived(), archived.ArchivedAt, archived.UpdatedAt, base)
	}

	if got := len(f.service.List()); got != 0 {
		t.Errorf("List() has %d tasks, want the task out of the workspace", got)
	}
	if diff := cmp.Diff([]task.Task{archived}, f.service.ListArchived()); diff != "" {
		t.Errorf("ListArchived() mismatch (-want +got):\n%s", diff)
	}
	if _, ok := f.service.Get(created.ID); ok {
		t.Error("Get() found an archived task, want only the ones in the workspace")
	}
	found, ok := f.service.Lookup(created.ID)
	if !ok {
		t.Fatalf("Lookup(%s) not found, want the archived task", created.ID)
	}
	if diff := cmp.Diff(archived, found); diff != "" {
		t.Errorf("Lookup() mismatch (-want +got):\n%s", diff)
	}
	if stored := f.repo.get(t, created.ID); !stored.Archived() {
		t.Errorf("stored task = %+v, want the row archived", stored)
	}

	// What the history shows stays: the artifacts, the records and the reading
	// of every file.
	if a, ok := f.service.Artifacts(created.ID); !ok || !a.PRD {
		t.Errorf("Artifacts() = %+v, %t, want the PRD of the archived task", a, ok)
	}
	if got := len(f.service.PRRuns(created.ID)); got != 1 {
		t.Errorf("PRRuns() has %d runs, want the record of the repository", got)
	}
	content, err := f.service.ReadArtifact(created.ID, task.PRDFile)
	if err != nil || content != "# PRD\n" {
		t.Errorf("ReadArtifact() = %q, %v, want the PRD of the archived task", content, err)
	}

	if got := f.changeCount(); got != before+1 {
		t.Errorf("OnChange ran %d times, want 1", got-before)
	}
	if got := f.logs.count(t, "task archived"); got != 1 {
		t.Errorf("task archived records = %d, want 1", got)
	}
}

func TestArchiveKeepsTheNewestFirst(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	first := f.create(t, "add-login", "")
	second := f.create(t, "add-logout", "")

	for _, id := range []string{first.ID, second.ID} {
		if _, err := f.service.Archive(t.Context(), id); err != nil {
			t.Fatalf("Archive(%s) = %v, want nil", id, err)
		}
	}

	history := f.service.ListArchived()
	if len(history) != 2 {
		t.Fatalf("ListArchived() = %+v, want both tasks", history)
	}
	if history[0].ID != second.ID || history[1].ID != first.ID {
		t.Errorf("ListArchived() = %q, %q, want the last archived first", history[0].Name, history[1].Name)
	}
}

func TestArchiveOnlyTakesATaskOfTheWorkspace(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")

	_, err := f.service.Archive(t.Context(), "nope")
	wantErrIs(t, err, task.ErrNotFound)

	if _, archiveErr := f.service.Archive(t.Context(), created.ID); archiveErr != nil {
		t.Fatalf("Archive() = %v, want nil", archiveErr)
	}
	// A task is archived once: there is no way back and no second time.
	_, err = f.service.Archive(t.Context(), created.ID)
	wantErrIs(t, err, task.ErrNotFound)
}

func TestArchiveFailsWhenTheRowCannotBeWritten(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")
	f.repo.updateErr = errors.New("database is locked")

	if _, err := f.service.Archive(t.Context(), created.ID); err == nil {
		t.Fatal("Archive() = nil, want an error")
	}
	if got := len(f.service.List()); got != 1 {
		t.Errorf("List() has %d tasks, want the task kept in the workspace", got)
	}
	if got := len(f.service.ListArchived()); got != 0 {
		t.Errorf("ListArchived() has %d tasks, want none", got)
	}
}

func TestDeleteRemovesAnArchivedTask(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")
	writePRD(t, created, "# PRD\n")
	if _, err := f.service.Archive(t.Context(), created.ID); err != nil {
		t.Fatalf("Archive() = %v, want nil", err)
	}

	if err := f.service.Delete(t.Context(), created.ID); err != nil {
		t.Fatalf("Delete() = %v, want nil", err)
	}

	if got := len(f.service.ListArchived()); got != 0 {
		t.Errorf("ListArchived() has %d tasks, want none", got)
	}
	if _, ok := f.service.Lookup(created.ID); ok {
		t.Error("Lookup() found the task after Delete")
	}
	if exists(created.ArtifactsDir) {
		t.Errorf("artifacts directory %s still exists", created.ArtifactsDir)
	}
	if _, err := f.repo.Get(t.Context(), created.ID); !errors.Is(err, task.ErrNotFound) {
		t.Errorf("repo.Get() = %v, want ErrNotFound", err)
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

func TestReadArtifactReturnsTheArtifacts(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")
	writePRD(t, created, "# PRD\n")
	writeTechSpec(t, created, "# Tech spec\n")
	writeStep(t, created, "1-add-the-store.md", "api", "Step 1: Add the store")

	tests := map[string]struct{ name, want string }{
		"the PRD":       {name: task.PRDFile, want: "# PRD\n"},
		"the tech spec": {name: task.TechSpecFile, want: "# Tech spec\n"},
		"a step": {
			name: "steps/1-add-the-store.md",
			want: "---\nrepository: api\n---\n\n# Step 1: Add the store\n",
		},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			got, err := f.service.ReadArtifact(created.ID, tc.name)
			if err != nil {
				t.Fatalf("ReadArtifact(%q) = %v, want nil", tc.name, err)
			}
			if got != tc.want {
				t.Errorf("ReadArtifact(%q) = %q, want %q", tc.name, got, tc.want)
			}
		})
	}
}

func TestReadArtifactRefusesAnythingButTheArtifacts(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")

	tests := map[string]struct{ id, name string }{
		"another file":           {id: created.ID, name: "notes.md"},
		"a path":                 {id: created.ID, name: "../PRD.md"},
		"a path through steps":   {id: created.ID, name: "steps/../PRD.md"},
		"a step with a bad name": {id: created.ID, name: "steps/notes.md"},
		"a folder":               {id: created.ID, name: task.StepsDirName},
		"unknown task":           {id: "nope", name: task.PRDFile},
		"missing file":           {id: created.ID, name: task.PRDFile},
		"missing step":           {id: created.ID, name: "steps/1-add-the-store.md"},
		"empty artifact":         {id: created.ID, name: ""},
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

func TestSyncLoadsTheArchivedTasksOfTheWorkspace(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")
	writePRD(t, created, "# PRD\n")
	if _, err := f.service.SetPRRun(t.Context(), created.ID, f.repos[0], task.PRDone, nil); err != nil {
		t.Fatalf("SetPRRun() = %v, want nil", err)
	}
	if _, err := f.service.Archive(t.Context(), created.ID); err != nil {
		t.Fatalf("Archive() = %v, want nil", err)
	}

	reopened := newService(t, f)
	if err := reopened.Sync(t.Context(), f.workspace); err != nil {
		t.Fatalf("Sync() = %v, want nil", err)
	}

	if got := len(reopened.List()); got != 0 {
		t.Errorf("List() has %d tasks, want the archived one out of the workspace", got)
	}
	history := reopened.ListArchived()
	if len(history) != 1 || history[0].ID != created.ID {
		t.Fatalf("ListArchived() = %+v, want the archived task", history)
	}
	if a, ok := reopened.Artifacts(created.ID); !ok || !a.PRD {
		t.Errorf("Artifacts() = %+v, %t, want the artifacts of the archived task read", a, ok)
	}
	if got := len(reopened.PRRuns(created.ID)); got != 1 {
		t.Errorf("PRRuns() has %d runs, want the record of the repository", got)
	}
}

func TestSyncFailsWhenTheArchivedTasksCannotBeListed(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.repo.archivedErr = errors.New("database is locked")

	if err := f.service.Sync(t.Context(), t.TempDir()); err == nil {
		t.Error("Sync() = nil, want an error")
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

func TestArtifactsReportsWhatTheFolderHolds(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")

	if got, ok := f.service.Artifacts(created.ID); !ok || got.PRD || got.TechSpec || got.Plan.Present {
		t.Errorf("Artifacts() = %+v %t, want an empty folder", got, ok)
	}
	if _, ok := f.service.Artifacts("nope"); ok {
		t.Error("Artifacts(nope) found a task, want none")
	}

	writePRD(t, created, "# PRD")
	writeTechSpec(t, created, "# Tech spec")
	writeStep(t, created, "1-add-the-store.md", "api", "Step 1: Add the store")

	got, err := f.service.Inspect(created.ID)
	if err != nil {
		t.Fatalf("Inspect() = %v, want nil", err)
	}
	if !got.PRD || !got.TechSpec || !got.Plan.Valid() {
		t.Errorf("Inspect() = %+v, want the three artifacts", got)
	}
	if cached, _ := f.service.Artifacts(created.ID); !cached.PRD || !cached.Plan.Valid() {
		t.Errorf("Artifacts() = %+v, want Inspect to have refreshed the cache", cached)
	}
	if stored := f.repo.get(t, created.ID); stored.ArtifactVersion != 0 {
		t.Errorf("ArtifactVersion = %d, want Inspect to leave it alone", stored.ArtifactVersion)
	}
	if got := len(f.artifactCalls()); got != 0 {
		t.Errorf("OnArtifact ran %d times, want Inspect to be silent", got)
	}
}

func TestInspectReportsAnUnknownTask(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	_, err := f.service.Inspect("nope")
	wantErrIs(t, err, task.ErrNotFound)
}

func TestSetStageStoresTheStageAndTheRevisit(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")
	changes := f.changeCount()

	got, err := f.service.SetStage(t.Context(), created.ID, task.StageTechSpec, true)
	if err != nil {
		t.Fatalf("SetStage() = %v, want nil", err)
	}
	if got.Stage != task.StageTechSpec || !got.Revisiting {
		t.Errorf("SetStage() = %q revisiting=%t, want tech_spec revisiting=true", got.Stage, got.Revisiting)
	}

	if loaded, _ := f.service.Get(created.ID); loaded.Stage != task.StageTechSpec || !loaded.Revisiting {
		t.Errorf("Get() = %q revisiting=%t, want tech_spec revisiting=true", loaded.Stage, loaded.Revisiting)
	}
	if stored := f.repo.get(t, created.ID); stored.Stage != task.StageTechSpec || !stored.Revisiting {
		t.Errorf("stored = %q revisiting=%t, want tech_spec revisiting=true", stored.Stage, stored.Revisiting)
	}
	if f.changeCount() <= changes {
		t.Error("OnChange did not run for the new stage")
	}
	if got := f.logs.count(t, "task stage set"); got != 1 {
		t.Errorf("task stage set records = %d, want 1", got)
	}
}

func TestSetStageRefusesAnUnknownStageOrTask(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")

	_, err := f.service.SetStage(t.Context(), created.ID, task.Stage("prd_done"), false)
	wantErrIs(t, err, task.ErrUnknownStage)

	_, err = f.service.SetStage(t.Context(), "nope", task.StagePlan, false)
	wantErrIs(t, err, task.ErrNotFound)
}

func TestSetStageFailsWhenItCannotBeStored(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")
	f.repo.updateErr = errors.New("database is locked")

	if _, err := f.service.SetStage(t.Context(), created.ID, task.StagePlan, false); err == nil {
		t.Fatal("SetStage() = nil, want an error")
	}
	if loaded, _ := f.service.Get(created.ID); loaded.Stage != task.StagePRD {
		t.Errorf("Stage = %q, want the failed update to change nothing", loaded.Stage)
	}
}

func TestSetStageModelStoresTheChoice(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")
	changes := f.changeCount()
	want := models.Choice{Model: models.Sonnet5, Effort: models.Low}

	got, err := f.service.SetStageModel(t.Context(), created.ID, models.PR, want)
	if err != nil {
		t.Fatalf("SetStageModel() = %v, want nil", err)
	}
	if diff := cmp.Diff(want, got.Models.Stage(models.PR)); diff != "" {
		t.Errorf("SetStageModel() mismatch (-want +got):\n%s", diff)
	}

	loaded, _ := f.service.Get(created.ID)
	if diff := cmp.Diff(want, loaded.Models.Stage(models.PR)); diff != "" {
		t.Errorf("Get() mismatch (-want +got):\n%s", diff)
	}
	stored := f.repo.get(t, created.ID)
	if diff := cmp.Diff(want, stored.Models.Stage(models.PR)); diff != "" {
		t.Errorf("stored mismatch (-want +got):\n%s", diff)
	}
	if !stored.UpdatedAt.Equal(base) {
		t.Errorf("UpdatedAt = %v, want %v", stored.UpdatedAt, base)
	}
	if f.changeCount() <= changes {
		t.Error("OnChange did not run for the new choice")
	}
	if got := f.logs.count(t, "task model set"); got != 1 {
		t.Errorf("task model set records = %d, want 1", got)
	}
}

func TestSetStepModelMakesTheChoiceOfTheStepItsOwn(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")
	want := models.Choice{Model: models.Opus5, Effort: models.Max}

	got, err := f.service.SetStepModel(t.Context(), created.ID, 2, want)
	if err != nil {
		t.Fatalf("SetStepModel() = %v, want nil", err)
	}
	if !got.Models.Adjusted(2) {
		t.Error("Adjusted(2) = false, want the step to carry a choice of its own")
	}
	if diff := cmp.Diff(want, got.Models.Step(2)); diff != "" {
		t.Errorf("Step(2) mismatch (-want +got):\n%s", diff)
	}
	if got.Models.Adjusted(1) {
		t.Error("Adjusted(1) = true, want the other steps to follow implementation")
	}
	if records := f.logs.count(t, "task step model set"); records != 1 {
		t.Errorf("task step model set records = %d, want 1", records)
	}
}

func TestSetReviewModeStoresTheMode(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")
	changes := f.changeCount()

	got, err := f.service.SetReviewMode(t.Context(), created.ID, reviewmode.Agent)
	if err != nil {
		t.Fatalf("SetReviewMode() = %v, want nil", err)
	}
	if mode := got.ReviewModes.Default(); mode != reviewmode.Agent {
		t.Errorf("SetReviewMode() mode = %q, want %q", mode, reviewmode.Agent)
	}

	loaded, _ := f.service.Get(created.ID)
	if mode := loaded.ReviewModes.Default(); mode != reviewmode.Agent {
		t.Errorf("Get() mode = %q, want %q", mode, reviewmode.Agent)
	}
	stored := f.repo.get(t, created.ID)
	if mode := stored.ReviewModes.Default(); mode != reviewmode.Agent {
		t.Errorf("stored mode = %q, want %q", mode, reviewmode.Agent)
	}
	if !stored.UpdatedAt.Equal(base) {
		t.Errorf("UpdatedAt = %v, want %v", stored.UpdatedAt, base)
	}
	if f.changeCount() <= changes {
		t.Error("OnChange did not run for the new mode")
	}
	if records := f.logs.count(t, "task review mode set"); records != 1 {
		t.Errorf("task review mode set records = %d, want 1", records)
	}

	_, err = f.service.SetReviewMode(t.Context(), "nope", reviewmode.Agent)
	wantErrIs(t, err, task.ErrNotFound)
}

func TestSetStepReviewModeMakesTheModeOfTheStepItsOwn(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")

	got, err := f.service.SetStepReviewMode(t.Context(), created.ID, 2, reviewmode.Agent)
	if err != nil {
		t.Fatalf("SetStepReviewMode() = %v, want nil", err)
	}
	if !got.ReviewModes.Adjusted(2) {
		t.Error("Adjusted(2) = false, want the step to carry a mode of its own")
	}
	if mode := got.ReviewModes.Step(2); mode != reviewmode.Agent {
		t.Errorf("Step(2) = %q, want %q", mode, reviewmode.Agent)
	}
	if got.ReviewModes.Adjusted(1) {
		t.Error("Adjusted(1) = true, want the other steps to follow the task")
	}
	if mode := f.repo.get(t, created.ID).ReviewModes.Step(2); mode != reviewmode.Agent {
		t.Errorf("stored Step(2) = %q, want %q", mode, reviewmode.Agent)
	}
	if created.ReviewModes.Adjusted(2) {
		t.Error("Adjusted(2) = true, want the task the caller took before the change to be untouched")
	}
	if records := f.logs.count(t, "task step review mode set"); records != 1 {
		t.Errorf("task step review mode set records = %d, want 1", records)
	}

	_, err = f.service.SetStepReviewMode(t.Context(), "nope", 1, reviewmode.Agent)
	wantErrIs(t, err, task.ErrNotFound)
}

func TestSetModelOfAnUnknownTaskIsNotFound(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	choice := models.Choice{Model: models.Opus5, Effort: models.High}

	_, err := f.service.SetStageModel(t.Context(), "nope", models.PRD, choice)
	wantErrIs(t, err, task.ErrNotFound)

	_, err = f.service.SetStepModel(t.Context(), "nope", 1, choice)
	wantErrIs(t, err, task.ErrNotFound)
}

func TestSetModelFailsWhenItCannotBeStored(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")
	before, _ := f.service.Get(created.ID)
	f.repo.updateErr = errors.New("database is locked")
	choice := models.Choice{Model: models.Sonnet5, Effort: models.Low}

	if _, err := f.service.SetStageModel(t.Context(), created.ID, models.PR, choice); err == nil {
		t.Fatal("SetStageModel() = nil, want an error")
	}
	if _, err := f.service.SetStepModel(t.Context(), created.ID, 1, choice); err == nil {
		t.Fatal("SetStepModel() = nil, want an error")
	}

	loaded, _ := f.service.Get(created.ID)
	if diff := cmp.Diff(before.Models, loaded.Models); diff != "" {
		t.Errorf("models mismatch (-want +got):\n%s", diff)
	}
}

func TestAChangeOfModelLeavesATaskTakenBeforeAlone(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")

	if _, err := f.service.SetStepModel(t.Context(), created.ID, 1,
		models.Choice{Model: models.Opus5, Effort: models.Max}); err != nil {
		t.Fatalf("SetStepModel() = %v, want nil", err)
	}

	if created.Models.Adjusted(1) {
		t.Error("Adjusted(1) = true, want the task the caller took before the change to be untouched")
	}
}

func TestRemovingThePlanForgetsTheModelsOfTheSteps(t *testing.T) {
	t.Parallel()

	tests := map[string]struct {
		from     task.Stage
		wantStep bool
	}{
		"from the plan": {from: task.StagePlan},
		"from the PR":   {from: task.StagePR, wantStep: true},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			created := f.create(t, "add-login", "")
			stage := models.Choice{Model: models.Sonnet5, Effort: models.Low}
			if _, err := f.service.SetStageModel(t.Context(), created.ID, models.Implementation, stage); err != nil {
				t.Fatalf("SetStageModel() = %v, want nil", err)
			}
			if _, err := f.service.SetStepModel(t.Context(), created.ID, 1,
				models.Choice{Model: models.Opus5, Effort: models.Max}); err != nil {
				t.Fatalf("SetStepModel() = %v, want nil", err)
			}

			if err := f.service.RemoveArtifacts(t.Context(), created.ID, tc.from); err != nil {
				t.Fatalf("RemoveArtifacts(%q) = %v, want nil", tc.from, err)
			}

			loaded, _ := f.service.Get(created.ID)
			stored := f.repo.get(t, created.ID)
			for label, m := range map[string]task.Models{"service": loaded.Models, "repository": stored.Models} {
				if got := m.Adjusted(1); got != tc.wantStep {
					t.Errorf("%s Adjusted(1) = %t, want %t", label, got, tc.wantStep)
				}
				if diff := cmp.Diff(stage, m.Stage(models.Implementation)); diff != "" {
					t.Errorf("%s implementation mismatch (-want +got):\n%s", label, diff)
				}
			}
		})
	}
}

func TestRemovingThePlanForgetsTheModesOfTheSteps(t *testing.T) {
	t.Parallel()

	tests := map[string]struct {
		from     task.Stage
		wantStep bool
	}{
		"from the plan": {from: task.StagePlan},
		"from the PR":   {from: task.StagePR, wantStep: true},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			created := f.create(t, "add-login", "")
			if _, err := f.service.SetReviewMode(t.Context(), created.ID, reviewmode.Agent); err != nil {
				t.Fatalf("SetReviewMode() = %v, want nil", err)
			}
			if _, err := f.service.SetStepReviewMode(t.Context(), created.ID, 1, reviewmode.Manual); err != nil {
				t.Fatalf("SetStepReviewMode() = %v, want nil", err)
			}

			if err := f.service.RemoveArtifacts(t.Context(), created.ID, tc.from); err != nil {
				t.Fatalf("RemoveArtifacts(%q) = %v, want nil", tc.from, err)
			}

			loaded, _ := f.service.Get(created.ID)
			stored := f.repo.get(t, created.ID)
			for label, m := range map[string]task.ReviewModes{"service": loaded.ReviewModes, "repository": stored.ReviewModes} {
				if got := m.Adjusted(1); got != tc.wantStep {
					t.Errorf("%s Adjusted(1) = %t, want %t", label, got, tc.wantStep)
				}
				if got := m.Default(); got != reviewmode.Agent {
					t.Errorf("%s Default() = %q, want %q", label, got, reviewmode.Agent)
				}
			}
		})
	}
}

func TestRemoveArtifactsThrowsAwayTheStageAndTheOnesAfterIt(t *testing.T) {
	t.Parallel()

	tests := map[string]struct {
		from                         task.Stage
		wantPRD, wantSpec, wantSteps bool
	}{
		"from the PRD":       {from: task.StagePRD},
		"from the tech spec": {from: task.StageTechSpec, wantPRD: true},
		"from the plan":      {from: task.StagePlan, wantPRD: true, wantSpec: true},
		"from implementation": {
			from: task.StageImplementation, wantPRD: true, wantSpec: true, wantSteps: true,
		},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			created := f.create(t, "add-login", "")
			writePRD(t, created, "# PRD")
			writeTechSpec(t, created, "# Tech spec")
			writeStep(t, created, "1-add-the-store.md", "api", "Step 1: Add the store")

			if err := f.service.RemoveArtifacts(t.Context(), created.ID, tc.from); err != nil {
				t.Fatalf("RemoveArtifacts(%q) = %v, want nil", tc.from, err)
			}

			if got := exists(created.PRDPath()); got != tc.wantPRD {
				t.Errorf("PRD exists = %t, want %t", got, tc.wantPRD)
			}
			if got := exists(created.TechSpecPath()); got != tc.wantSpec {
				t.Errorf("tech spec exists = %t, want %t", got, tc.wantSpec)
			}
			if got := exists(created.StepsDir()); got != tc.wantSteps {
				t.Errorf("steps folder exists = %t, want %t", got, tc.wantSteps)
			}

			cached, _ := f.service.Artifacts(created.ID)
			if cached.PRD != tc.wantPRD || cached.TechSpec != tc.wantSpec || cached.Plan.Present != tc.wantSteps {
				t.Errorf("Artifacts() = %+v, want it to match the folder", cached)
			}
			if stored := f.repo.get(t, created.ID); stored.ArtifactVersion != 1 {
				t.Errorf("ArtifactVersion = %d, want 1", stored.ArtifactVersion)
			}
		})
	}
}

func TestRemoveArtifactsOfAFolderAlreadyEmpty(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	created := f.create(t, "add-login", "")

	if err := f.service.RemoveArtifacts(t.Context(), created.ID, task.StagePRD); err != nil {
		t.Errorf("RemoveArtifacts() = %v, want nil", err)
	}
	wantErrIs(t, f.service.RemoveArtifacts(t.Context(), "nope", task.StagePRD), task.ErrNotFound)
}
