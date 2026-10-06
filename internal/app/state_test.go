package app_test

import (
	"path/filepath"
	"slices"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/app"
	"github.com/guilhermt/myspec/internal/bindings"
	"github.com/guilhermt/myspec/internal/board"
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

func TestTheStateCarriesTheTaskAndTheDiscussionThatWroteACardOfABoard(t *testing.T) {
	t.Parallel()
	at := time.Date(2026, 9, 24, 14, 0, 0, 0, time.UTC)
	dataDir := t.TempDir()
	seed(t, dataDir, func(st *store.Store) {
		ctx := t.Context()
		b := board.Board{
			ID: "board-1", Owner: "acme", OwnerType: board.OwnerOrganization, Number: 1, Title: "Roadmap",
			URL: "https://github.com/orgs/acme/projects/1", FinalStatuses: []string{}, CreatedAt: at,
		}
		if err := st.Boards.InsertBoard(ctx, b, nil); err != nil {
			t.Fatalf("insert the board: %v", err)
		}
		repo := repository.Repository{
			ID: "repo-1", Owner: "acme", Name: "web", Path: "/nowhere/web", BoardID: "board-1", CreatedAt: at,
		}
		if err := st.Repositories.Insert(ctx, repo); err != nil {
			t.Fatalf("insert the repository: %v", err)
		}
		card := func(number int) board.Card {
			return board.Card{
				Issue: board.Issue{
					Owner: "acme", Name: "web", Number: number, Title: "Card",
					URL: "https://github.com/acme/web/issues/1", State: task.IssueOpen,
				},
				ReadAt: at,
			}
		}
		reading := board.Reading{Title: "Roadmap", Cards: []board.Card{card(7), card(8), card(9)}}
		if err := st.Boards.SaveReading(ctx, b.ID, reading.Title, reading, at); err != nil {
			t.Fatalf("save the reading: %v", err)
		}
		fromCard := task.Task{
			ID: "task-1", RepositoryID: repo.ID, Name: "card-7", Stage: task.StagePRD, Mode: task.ModeStructured,
			Card: &task.Card{
				BoardID: b.ID, Owner: "acme", Name: "web", Number: 7, Title: "Card", State: task.IssueOpen, ReadAt: at,
			},
			CreatedAt: at, UpdatedAt: at,
		}
		if err := st.Tasks.Insert(ctx, fromCard); err != nil {
			t.Fatalf("insert the task: %v", err)
		}
		writer := discussion.Discussion{ID: "discussion-1", Title: "Pricing", CreatedAt: at, UpdatedAt: at}
		if err := st.Discussions.Insert(ctx, writer); err != nil {
			t.Fatalf("insert the discussion: %v", err)
		}
		draft := discussion.Draft{
			DiscussionID: writer.ID, ID: "draft-1", Kind: discussion.KindNew, Source: discussion.SourceAgent,
			Owner: "acme", Name: "web", Title: "Card",
			Published: discussion.Publication{Outcome: discussion.OutcomeCreated, Number: 8, At: at},
		}
		if err := st.Discussions.WriteDrafts(ctx, writer.ID, []discussion.Draft{draft}, nil); err != nil {
			t.Fatalf("write the draft: %v", err)
		}
	})
	a, published := newApp(t, app.AppOptions{DataDir: dataDir})

	a.Start()
	waitFor(t, published, phaseIs("ready"))
	state := a.State()

	if len(state.Boards) != 1 || len(state.Boards[0].Cards) != 3 {
		t.Fatalf("Boards = %+v, want the one board with its 3 cards", state.Boards)
	}
	cards := state.Boards[0].Cards
	if got := cards[0].ActiveTaskID; got != "task-1" {
		t.Errorf("card 7 ActiveTaskID = %q, want the task created from it", got)
	}
	if cards[0].WrittenBy != nil {
		t.Errorf("card 7 WrittenBy = %+v, want nil: no discussion wrote it", cards[0].WrittenBy)
	}
	want := &bindings.WritingDiscussion{ID: "discussion-1", Title: "Pricing"}
	if diff := cmp.Diff(want, cards[1].WrittenBy); diff != "" {
		t.Errorf("card 8 WrittenBy (-want +got):\n%s", diff)
	}
	if cards[1].ActiveTaskID != "" || cards[2].ActiveTaskID != "" || cards[2].WrittenBy != nil {
		t.Errorf("cards 8 and 9 = %+v and %+v, want neither a task nor a writer beyond card 8's", cards[1], cards[2])
	}
}
