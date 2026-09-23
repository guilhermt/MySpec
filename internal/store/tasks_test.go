package store_test

import (
	"errors"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/reviewmode"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
)

func TestTasksInsertAndGet(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	want := newTask("task-1", webRepo, "one", fixedTime)
	if err := s.Tasks.Insert(t.Context(), want); err != nil {
		t.Fatalf("Insert() = %v, want nil", err)
	}

	got, err := s.Tasks.Get(t.Context(), want.ID)
	if err != nil {
		t.Fatalf("Get() = %v, want nil", err)
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("Get() mismatch (-want +got):\n%s", diff)
	}
}

func TestTasksKeepTheModeOfATask(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	want := newTask("task-1", webRepo, "one", fixedTime)
	want.Mode = task.ModeOneShot
	want.Stage = task.StageOneShot
	if err := s.Tasks.Insert(t.Context(), want); err != nil {
		t.Fatalf("Insert() = %v, want nil", err)
	}

	got, err := s.Tasks.Get(t.Context(), want.ID)
	if err != nil {
		t.Fatalf("Get() = %v, want nil", err)
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("Get() mismatch (-want +got):\n%s", diff)
	}

	listed, err := s.Tasks.ListActive(t.Context())
	if err != nil {
		t.Fatalf("ListActive() = %v, want nil", err)
	}
	if diff := cmp.Diff([]task.Task{want}, listed); diff != "" {
		t.Errorf("ListActive() mismatch (-want +got):\n%s", diff)
	}
}

func TestTasksGetMissingIsNotFound(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	if _, err := s.Tasks.Get(t.Context(), "nope"); !errors.Is(err, task.ErrNotFound) {
		t.Errorf("Get() = %v, want task.ErrNotFound", err)
	}
}

func TestTasksListActiveIsInCreationOrder(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	later := fixedTime.Add(time.Hour)
	for _, tk := range []task.Task{
		newTask("task-2", webRepo, "second", later),
		newTask("task-1", webRepo, "first", fixedTime),
		newTask("task-3", apiRepo, "elsewhere", later.Add(time.Hour)),
	} {
		if err := s.Tasks.Insert(t.Context(), tk); err != nil {
			t.Fatalf("Insert(%s) = %v, want nil", tk.Name, err)
		}
	}

	tasks, err := s.Tasks.ListActive(t.Context())
	if err != nil {
		t.Fatalf("ListActive() = %v, want nil", err)
	}

	got := make([]string, 0, len(tasks))
	for _, tk := range tasks {
		got = append(got, tk.Name)
	}
	if diff := cmp.Diff([]string{"first", "second", "elsewhere"}, got); diff != "" {
		t.Errorf("ListActive() mismatch (-want +got):\n%s", diff)
	}
}

func TestTasksArchivedLeaveTheListForTheHistory(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	for _, tk := range []task.Task{
		newTask("task-1", webRepo, "first", fixedTime),
		newTask("task-2", webRepo, "second", fixedTime),
		newTask("task-3", webRepo, "third", fixedTime),
	} {
		if err := s.Tasks.Insert(t.Context(), tk); err != nil {
			t.Fatalf("Insert(%s) = %v, want nil", tk.Name, err)
		}
	}

	archivedAt := fixedTime.Add(time.Hour)
	if err := s.Tasks.UpdateArchived(t.Context(), "task-1", archivedAt, archivedAt); err != nil {
		t.Fatalf("UpdateArchived(task-1) = %v, want nil", err)
	}
	later := archivedAt.Add(time.Hour)
	if err := s.Tasks.UpdateArchived(t.Context(), "task-2", later, later); err != nil {
		t.Fatalf("UpdateArchived(task-2) = %v, want nil", err)
	}

	active, err := s.Tasks.ListActive(t.Context())
	if err != nil {
		t.Fatalf("ListActive() = %v, want nil", err)
	}
	if diff := cmp.Diff([]string{"third"}, taskNames(active)); diff != "" {
		t.Errorf("ListActive() mismatch (-want +got):\n%s", diff)
	}

	history, err := s.Tasks.ListArchived(t.Context())
	if err != nil {
		t.Fatalf("ListArchived() = %v, want nil", err)
	}
	// The most recently archived comes first, which is the order the history
	// shows.
	if diff := cmp.Diff([]string{"second", "first"}, taskNames(history)); diff != "" {
		t.Errorf("ListArchived() mismatch (-want +got):\n%s", diff)
	}

	// An archived task is still read whole, artifacts and all.
	got, getErr := s.Tasks.Get(t.Context(), "task-1")
	if getErr != nil {
		t.Fatalf("Get() = %v, want nil", getErr)
	}
	if !got.Archived() || !got.ArchivedAt.Equal(archivedAt) || !got.UpdatedAt.Equal(archivedAt) {
		t.Errorf("Get() = archived %t at %v, updated %v, want it archived at %v",
			got.Archived(), got.ArchivedAt, got.UpdatedAt, archivedAt)
	}
	if third, err := s.Tasks.Get(t.Context(), "task-3"); err != nil || third.Archived() {
		t.Errorf("Get(task-3) = %+v, %v, want a task still active", third, err)
	}
}

// taskNames is the names of a list of tasks, in the order they came in.
func taskNames(tasks []task.Task) []string {
	names := make([]string, 0, len(tasks))
	for _, tk := range tasks {
		names = append(names, tk.Name)
	}
	return names
}

func TestTasksInsertRejectsARepeatedName(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	if err := s.Tasks.Insert(t.Context(), newTask("task-1", webRepo, "one", fixedTime)); err != nil {
		t.Fatalf("Insert() = %v, want nil", err)
	}

	err := s.Tasks.Insert(t.Context(), newTask("task-2", webRepo, "one", fixedTime))
	if !errors.Is(err, task.ErrNameTaken) {
		t.Errorf("Insert() = %v, want task.ErrNameTaken", err)
	}
}

func TestANameIsTakenOnlyInsideItsRepository(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	if err := s.Tasks.Insert(t.Context(), newTask("task-1", webRepo, "one", fixedTime)); err != nil {
		t.Fatalf("Insert() = %v, want nil", err)
	}
	if err := s.Tasks.Insert(t.Context(), newTask("task-2", apiRepo, "one", fixedTime)); err != nil {
		t.Errorf("Insert() = %v, want the same name in another repository accepted", err)
	}

	// An archived task of the repository holds its name all the same.
	archivedAt := fixedTime.Add(time.Hour)
	if err := s.Tasks.UpdateArchived(t.Context(), "task-1", archivedAt, archivedAt); err != nil {
		t.Fatalf("UpdateArchived() = %v, want nil", err)
	}
	err := s.Tasks.Insert(t.Context(), newTask("task-3", webRepo, "one", fixedTime))
	if !errors.Is(err, task.ErrNameTaken) {
		t.Errorf("Insert() = %v, want task.ErrNameTaken", err)
	}
}

func TestTasksUpdateStage(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	tk := newTask("task-1", webRepo, "one", fixedTime)
	tk.ArtifactVersion = 3
	if err := s.Tasks.Insert(t.Context(), tk); err != nil {
		t.Fatalf("Insert() = %v, want nil", err)
	}

	updatedAt := fixedTime.Add(time.Minute)
	if err := s.Tasks.UpdateStage(t.Context(), tk.ID, string(task.StageTechSpec), true, updatedAt); err != nil {
		t.Fatalf("UpdateStage() = %v, want nil", err)
	}

	got, err := s.Tasks.Get(t.Context(), tk.ID)
	if err != nil {
		t.Fatalf("Get() = %v, want nil", err)
	}
	if got.Stage != task.StageTechSpec || !got.Revisiting || !got.UpdatedAt.Equal(updatedAt) {
		t.Errorf("Get() = %q revisiting=%t %v, want %q revisiting=true %v",
			got.Stage, got.Revisiting, got.UpdatedAt, task.StageTechSpec, updatedAt)
	}
	if got.ArtifactVersion != 3 {
		t.Errorf("ArtifactVersion = %d, want the stage update to leave it alone", got.ArtifactVersion)
	}
}

func TestTasksUpdateArtifactVersion(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	tk := newTask("task-1", webRepo, "one", fixedTime)
	tk.Stage = task.StagePlan
	tk.Revisiting = true
	if err := s.Tasks.Insert(t.Context(), tk); err != nil {
		t.Fatalf("Insert() = %v, want nil", err)
	}

	updatedAt := fixedTime.Add(time.Minute)
	if err := s.Tasks.UpdateArtifactVersion(t.Context(), tk.ID, 7, updatedAt); err != nil {
		t.Fatalf("UpdateArtifactVersion() = %v, want nil", err)
	}

	got, err := s.Tasks.Get(t.Context(), tk.ID)
	if err != nil {
		t.Fatalf("Get() = %v, want nil", err)
	}
	if got.ArtifactVersion != 7 || !got.UpdatedAt.Equal(updatedAt) {
		t.Errorf("Get() = %d %v, want 7 %v", got.ArtifactVersion, got.UpdatedAt, updatedAt)
	}
	if got.Stage != task.StagePlan || !got.Revisiting {
		t.Errorf("Get() = %q revisiting=%t, want the stage left alone", got.Stage, got.Revisiting)
	}
}

func TestTasksUpdateModels(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	tk := newTask("task-1", webRepo, "one", fixedTime)
	if err := s.Tasks.Insert(t.Context(), tk); err != nil {
		t.Fatalf("Insert() = %v, want nil", err)
	}

	want := task.Models{Stages: models.Factory(), Steps: map[int]models.Choice{
		3: {Model: models.Opus55, Effort: models.XHigh},
	}}
	want.Stages[models.Plan] = models.Choice{Model: models.Sonnet5, Effort: models.Low}

	updatedAt := fixedTime.Add(time.Minute)
	if err := s.Tasks.UpdateModels(t.Context(), tk.ID, want, updatedAt); err != nil {
		t.Fatalf("UpdateModels() = %v, want nil", err)
	}

	got, err := s.Tasks.Get(t.Context(), tk.ID)
	if err != nil {
		t.Fatalf("Get() = %v, want nil", err)
	}
	if diff := cmp.Diff(want, got.Models); diff != "" {
		t.Errorf("Get() models mismatch (-want +got):\n%s", diff)
	}
	if !got.UpdatedAt.Equal(updatedAt) {
		t.Errorf("UpdatedAt = %v, want %v", got.UpdatedAt, updatedAt)
	}
}

func TestTasksUpdateReviewModes(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	tk := newTask("task-1", webRepo, "one", fixedTime)
	if err := s.Tasks.Insert(t.Context(), tk); err != nil {
		t.Fatalf("Insert() = %v, want nil", err)
	}

	want := task.ReviewModes{Task: reviewmode.Agent, Steps: map[int]reviewmode.Mode{2: reviewmode.Manual}}
	updatedAt := fixedTime.Add(time.Minute)
	if err := s.Tasks.UpdateReviewModes(t.Context(), tk.ID, want, updatedAt); err != nil {
		t.Fatalf("UpdateReviewModes() = %v, want nil", err)
	}

	got, err := s.Tasks.Get(t.Context(), tk.ID)
	if err != nil {
		t.Fatalf("Get() = %v, want nil", err)
	}
	if diff := cmp.Diff(want, got.ReviewModes); diff != "" {
		t.Errorf("Get() review modes mismatch (-want +got):\n%s", diff)
	}
	if !got.UpdatedAt.Equal(updatedAt) {
		t.Errorf("UpdatedAt = %v, want %v", got.UpdatedAt, updatedAt)
	}
}

func TestTasksDeleteCascadesToTheSessionAndItsEntries(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	taskID, sessionID := seedSession(t, s)
	if err := s.Entries.Insert(t.Context(), sessionID, newEntry("entry-1", 1, "hello")); err != nil {
		t.Fatalf("Entries.Insert() = %v, want nil", err)
	}

	if err := s.Tasks.Delete(t.Context(), taskID); err != nil {
		t.Fatalf("Delete() = %v, want nil", err)
	}

	if _, err := s.Tasks.Get(t.Context(), taskID); !errors.Is(err, task.ErrNotFound) {
		t.Errorf("Get() = %v, want task.ErrNotFound", err)
	}
	if _, err := s.Sessions.Get(t.Context(), taskID, string(task.StagePRD)); !errors.Is(err, session.ErrNotFound) {
		t.Errorf("Sessions.Get() = %v, want session.ErrNotFound", err)
	}
	entries, err := s.Entries.List(t.Context(), sessionID)
	if err != nil {
		t.Fatalf("Entries.List() = %v, want nil", err)
	}
	if len(entries) != 0 {
		t.Errorf("Entries.List() returned %d entries, want none", len(entries))
	}
}

func TestTasksDeleteMissingIsNotAnError(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	if err := s.Tasks.Delete(t.Context(), "nope"); err != nil {
		t.Errorf("Delete() = %v, want nil", err)
	}
}

// newCard builds a card of a board, with an epic.
func newCard(number int) *task.Card {
	return &task.Card{
		BoardID: "board-1",
		Owner:   "Dev",
		Name:    "Web",
		Number:  number,
		Title:   "Add login",
		Body:    "A login screen.",
		URL:     "https://github.com/Dev/Web/issues/12",
		Status:  "Todo",
		State:   task.IssueOpen,
		Epic:    &task.CardEpic{Owner: "Dev", Name: "Web", Number: 3, Title: "Auth", URL: "https://github.com/Dev/Web/issues/3"},
		ReadAt:  fixedTime,
	}
}

func TestTasksWithACardRoundTrip(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	withCard := newTask("task-1", webRepo, "one", fixedTime)
	withCard.Card = newCard(12)
	withoutEpic := newTask("task-2", webRepo, "two", fixedTime.Add(time.Second))
	withoutEpic.Card = newCard(13)
	withoutEpic.Card.Epic = nil
	withoutEpic.Card.Body = ""
	withoutEpic.ArchivedAt = fixedTime.Add(time.Minute)
	for _, tk := range []task.Task{withCard, withoutEpic} {
		if err := s.Tasks.Insert(t.Context(), tk); err != nil {
			t.Fatalf("Insert(%s) = %v, want nil", tk.Name, err)
		}
	}

	got, err := s.Tasks.Get(t.Context(), withCard.ID)
	if err != nil {
		t.Fatalf("Get() = %v, want nil", err)
	}
	if diff := cmp.Diff(withCard, got); diff != "" {
		t.Errorf("Get() mismatch (-want +got):\n%s", diff)
	}
	active, err := s.Tasks.ListActive(t.Context())
	if err != nil {
		t.Fatalf("ListActive() = %v, want nil", err)
	}
	if diff := cmp.Diff([]task.Task{withCard}, active); diff != "" {
		t.Errorf("ListActive() mismatch (-want +got):\n%s", diff)
	}
	archived, err := s.Tasks.ListArchived(t.Context())
	if err != nil {
		t.Fatalf("ListArchived() = %v, want nil", err)
	}
	if diff := cmp.Diff([]task.Task{withoutEpic}, archived); diff != "" {
		t.Errorf("ListArchived() mismatch (-want +got):\n%s", diff)
	}
}

func TestTasksWithoutACardHaveNone(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	if err := s.Tasks.Insert(t.Context(), newTask("task-1", webRepo, "one", fixedTime)); err != nil {
		t.Fatalf("Insert() = %v, want nil", err)
	}

	got, err := s.Tasks.Get(t.Context(), "task-1")
	if err != nil {
		t.Fatalf("Get() = %v, want nil", err)
	}
	if got.Card != nil {
		t.Errorf("Get() card = %+v, want nil", got.Card)
	}
}

func TestTasksUpdateCard(t *testing.T) {
	t.Parallel()
	s := newStoreWithRepositories(t)

	tk := newTask("task-1", webRepo, "one", fixedTime)
	tk.Card = newCard(12)
	if err := s.Tasks.Insert(t.Context(), tk); err != nil {
		t.Fatalf("Insert() = %v, want nil", err)
	}

	want := *tk.Card
	want.Title = "Add login and logout"
	want.Body = "Both."
	want.URL = "https://github.com/Dev/Web/issues/12#renamed"
	want.Status = "Done"
	want.State = task.IssueClosed
	want.Epic = nil
	want.ReadAt = fixedTime.Add(time.Hour)
	changed := want
	changed.BoardID, changed.Owner, changed.Name, changed.Number = "board-2", "other", "repo", 99
	if err := s.Tasks.UpdateCard(t.Context(), tk.ID, changed); err != nil {
		t.Fatalf("UpdateCard() = %v, want nil", err)
	}

	got, err := s.Tasks.Get(t.Context(), tk.ID)
	if err != nil {
		t.Fatalf("Get() = %v, want nil", err)
	}
	if diff := cmp.Diff(&want, got.Card); diff != "" {
		t.Errorf("Get() card mismatch (-want +got):\n%s", diff)
	}
}
