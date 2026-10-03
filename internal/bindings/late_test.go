package bindings_test

import (
	"sync"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/bindings"
)

// startingMessage is what the interface shows for a call before the app is
// ready.
const startingMessage = "MySpec is starting."

// calls is one method of each service that answers with an error, called with
// arguments that make a built service fail for another reason.
func calls(s *bindings.Services) map[string]func() error {
	return map[string]func() error{
		"repository": func() error { return s.Repository.RemoveRepository("nope") },
		"settings":   func() error { return s.Settings.SetTheme("nope") },
		"task":       func() error { return s.Task.CloseTask("nope") },
		"board":      func() error { return s.Board.RefreshBoard("nope") },
		"review":     func() error { return s.Review.ApplyReview("nope") },
		"discussion": func() error { return s.Discussion.ArchiveDiscussion("nope") },
	}
}

// builtServices are the services of a fixture, except the attention one.
func builtServices(f *fixture) bindings.Services {
	return bindings.Services{
		State:      f.state,
		Repository: f.repoService,
		Settings:   f.settings,
		Task:       f.tasks,
		Board:      f.boardService,
		Review:     f.reviewSvc,
		Discussion: f.discussionSvc,
	}
}

func TestAPlaceholderAnswersThatTheAppIsStarting(t *testing.T) {
	t.Parallel()
	services := bindings.NewWaitingServices()

	for name, call := range calls(services) {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			err := call()

			if err == nil || err.Error() != startingMessage {
				t.Errorf("%s call = %v, want %q", name, err, startingMessage)
			}
		})
	}
}

func TestAPlaceholderWithoutAnErrorAnswersNothing(t *testing.T) {
	t.Parallel()
	services := bindings.NewWaitingServices()

	if diff := cmp.Diff(bindings.State{}, services.State.GetState()); diff != "" {
		t.Errorf("GetState() mismatch (-want +got):\n%s", diff)
	}
	services.Attention.ViewSituation("s1")
	services.Review.RefreshPullRequests()
}

func TestAPlaceholderAnswersAsTheServiceBoundToIt(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	f.register(t, t.TempDir())
	services := bindings.NewWaitingServices()

	services.Bind(builtServices(f))

	for name, call := range calls(services) {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			err := call()

			if err == nil || err.Error() == startingMessage {
				t.Errorf("%s call = %v, want the error of the built service", name, err)
			}
		})
	}
	if diff := cmp.Diff(f.state.GetState().Repositories, services.State.GetState().Repositories); diff != "" {
		t.Errorf("GetState() repositories mismatch (-built +placeholder):\n%s", diff)
	}
}

func TestBindLeavesWaitingTheServiceLeftNil(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	services := bindings.NewWaitingServices()

	services.Bind(builtServices(f))

	// The attention service was not built: it still waits, and answers nothing.
	services.Attention.ViewSituation("s1")
	if err := services.Board.RefreshBoard("nope"); err == nil || err.Error() == startingMessage {
		t.Errorf("RefreshBoard() = %v, want the error of the built service", err)
	}
}

func TestAServiceBuiltByNewAnswersWithoutBind(t *testing.T) {
	t.Parallel()
	f := newFixture(t)

	err := f.boardService.RefreshBoard("nope")

	if err == nil || err.Error() == startingMessage {
		t.Errorf("RefreshBoard() = %v, want the error of the service itself", err)
	}
}

func TestACallRacesWithBind(t *testing.T) {
	t.Parallel()
	f := newFixture(t)
	services := bindings.NewWaitingServices()

	var wg sync.WaitGroup
	for range 8 {
		wg.Go(func() {
			for range 50 {
				_ = services.Board.RefreshBoard("nope")
			}
		})
	}
	wg.Go(func() { services.Bind(builtServices(f)) })
	wg.Wait()

	if err := services.Board.RefreshBoard("nope"); err == nil || err.Error() == startingMessage {
		t.Errorf("RefreshBoard() after Bind = %v, want the error of the built service", err)
	}
}

func TestWailsListsEveryPlaceholderInOrder(t *testing.T) {
	t.Parallel()
	services := bindings.NewWaitingServices()

	got := services.Wails()

	want := []any{
		services.State, services.Repository, services.Settings, services.Task,
		services.Board, services.Review, services.Discussion, services.Attention,
	}
	if len(got) != len(want) {
		t.Fatalf("len(Wails()) = %d, want %d", len(got), len(want))
	}
	for i, service := range got {
		if service.Instance() != want[i] {
			t.Errorf("Wails()[%d] = %T %p, want %T %p", i, service.Instance(), service.Instance(), want[i], want[i])
		}
	}
}

func TestBindHandsTheAttentionServiceToItsPlaceholder(t *testing.T) {
	t.Parallel()
	situations, notifier := notifiedSituation(t)
	services := bindings.NewWaitingServices()

	services.Bind(bindings.Services{Attention: bindings.NewAttentionService(situations)})
	services.Attention.ViewSituation("s1")

	if diff := cmp.Diff([]string{"send:s1", "withdraw:s1"}, notifier.calls); diff != "" {
		t.Errorf("notifier calls after the view mismatch (-want +got):\n%s", diff)
	}
}
