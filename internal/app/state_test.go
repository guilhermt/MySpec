package app_test

import (
	"path/filepath"
	"slices"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/app"
	"github.com/guilhermt/myspec/internal/bindings"
	"github.com/guilhermt/myspec/internal/claude"
	"github.com/guilhermt/myspec/internal/discussion"
	"github.com/guilhermt/myspec/internal/models"
	"github.com/guilhermt/myspec/internal/platform/xdg"
	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/repository"
	"github.com/guilhermt/myspec/internal/store"
	"github.com/guilhermt/myspec/internal/task"
)

// The app reads the environment of the process, so this test changes it and
// cannot run in parallel: no claude, no gh and no desktop bus, so that nothing
// it starts in the background reaches outside the test.
func TestTheStateCarriesTheFactoryDefaultsBesideTheDefaultsOfTheUser(t *testing.T) {
	root := t.TempDir()
	t.Setenv("PATH", t.TempDir())
	t.Setenv(claude.EnvPath, filepath.Join(root, "no-claude"))
	t.Setenv("DBUS_SESSION_BUS_ADDRESS", "unix:path="+filepath.Join(root, "no-bus"))
	services := app.StartedForTest(t, xdg.Dirs{Data: filepath.Join(root, "data"), State: filepath.Join(root, "state")})

	if err := services.Settings.SetModelDefault(string(models.PRD), string(models.Opus55), string(models.Medium)); err != nil {
		t.Fatalf("SetModelDefault() = %v, want nil", err)
	}
	state := services.State.GetState()

	if diff := cmp.Diff(bindings.FromModelSet(models.Factory()), state.ModelFactory); diff != "" {
		t.Errorf("ModelFactory (-want +got):\n%s", diff)
	}
	prd := bindings.StageModel{Stage: string(models.PRD), Model: string(models.Opus55), Effort: string(models.Medium)}
	if !slices.Contains(state.ModelDefaults, prd) {
		t.Errorf("ModelDefaults = %+v, want the default of the PRD the user set", state.ModelDefaults)
	}
}

func TestTheStateCarriesTheHistoryFromTheStartOfTheWindowAndCountsTheWholeOfIt(t *testing.T) {
	t.Parallel()
	start := bindings.WindowStart(time.Now())
	before := start.Add(-time.Second)
	dataDir := t.TempDir()
	seed(t, dataDir, func(st *store.Store) {
		repo := repository.Repository{ID: "repo-1", Owner: "acme", Name: "web", Path: "/nowhere/web", CreatedAt: before}
		if err := st.Repositories.Insert(t.Context(), repo); err != nil {
			t.Fatalf("insert the repository: %v", err)
		}
		for id, archivedAt := range map[string]time.Time{
			"task-recent": start.Add(48 * time.Hour), "task-first": start, "task-before": before,
		} {
			archived := task.Task{
				ID: id, RepositoryID: repo.ID, Name: id, Stage: task.StagePRD, Mode: task.ModeStructured,
				ArchivedAt: archivedAt, CreatedAt: before.Add(-time.Hour), UpdatedAt: archivedAt,
			}
			if err := st.Tasks.Insert(t.Context(), archived); err != nil {
				t.Fatalf("insert %s: %v", id, err)
			}
		}
		for id, archivedAt := range map[string]time.Time{"discussion-first": start, "discussion-before": before} {
			archived := discussion.Discussion{
				ID: id, Title: id, Cards: []discussion.InputCard{{Owner: "acme", Name: "web", Number: 7, Title: "Pricing"}},
				ArchivedAt: archivedAt, CreatedAt: before.Add(-time.Hour), UpdatedAt: archivedAt,
			}
			if err := st.Discussions.Insert(t.Context(), archived); err != nil {
				t.Fatalf("insert %s: %v", id, err)
			}
		}
		number := 7
		for id, archivedAt := range map[string]time.Time{"review-first": start, "review-before": before} {
			number++
			archived := prreview.Review{
				ID: id, RepositoryID: repo.ID, Number: number, Title: id, Mode: prreview.ModePublish,
				PRState: prreview.PRMerged, ArchivedAt: archivedAt, CreatedAt: before.Add(-time.Hour), UpdatedAt: archivedAt,
			}
			if err := st.Reviews.Insert(t.Context(), archived); err != nil {
				t.Fatalf("insert %s: %v", id, err)
			}
		}
	})
	a, published := newApp(t, app.AppOptions{DataDir: dataDir})

	a.Start()
	waitFor(t, published, phaseIs("ready"))
	state := a.State()
	if !bindings.WindowStart(time.Now()).Equal(start) {
		t.Skip("the day turned while the test ran, and the window with it")
	}

	tasks := make([]string, 0, len(state.History))
	for _, archived := range state.History {
		tasks = append(tasks, archived.ID)
	}
	if diff := cmp.Diff([]string{"task-recent", "task-first"}, tasks); diff != "" {
		t.Errorf("History mismatch (-want +got):\n%s", diff)
	}
	discussions := make([]string, 0, len(state.DiscussionHistory))
	for _, archived := range state.DiscussionHistory {
		discussions = append(discussions, archived.ID)
	}
	if diff := cmp.Diff([]string{"discussion-first"}, discussions); diff != "" {
		t.Errorf("DiscussionHistory mismatch (-want +got):\n%s", diff)
	}
	reviews := make([]string, 0, len(state.ReviewHistory))
	for _, archived := range state.ReviewHistory {
		reviews = append(reviews, archived.ID)
	}
	if diff := cmp.Diff([]string{"review-first"}, reviews); diff != "" {
		t.Errorf("ReviewHistory mismatch (-want +got):\n%s", diff)
	}
	summary := bindings.HistorySummary{
		Tasks: 3, Reviews: 2, Discussions: 2,
		Oldest: before.UTC().Format(time.RFC3339), WindowStart: start.UTC().Format(time.RFC3339),
	}
	if diff := cmp.Diff(summary, state.HistorySummary); diff != "" {
		t.Errorf("HistorySummary mismatch (-want +got):\n%s", diff)
	}
	// The repository counts every archived discussion it was in, inside the
	// window or not.
	if len(state.Repositories) != 1 || state.Repositories[0].ArchivedDiscussions != 2 {
		t.Errorf("Repositories = %+v, want acme/web with its 2 archived discussions", state.Repositories)
	}
}
