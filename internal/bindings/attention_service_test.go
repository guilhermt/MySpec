package bindings_test

import (
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/attention"
	"github.com/guilhermt/myspec/internal/bindings"
	"github.com/guilhermt/myspec/internal/task"
)

func TestViewSituationWithdrawsItsNotification(t *testing.T) {
	t.Parallel()

	clock := &fakeClock{now: time.Date(2026, 9, 11, 9, 0, 0, 0, time.UTC)}
	notifier := &fakeNotifier{}
	situations := attention.New(attention.Deps{
		Store:    fakeSituationStore{},
		Notifier: notifier,
		Focused:  func() bool { return false },
		Now:      clock.Now,
		NewID:    func() string { return "s1" },
	})
	service := bindings.NewAttentionService(situations)

	// A question in the PRD, seen once and again once it has held for Settle,
	// starts with the window away and is notified.
	found := []attention.Found{{
		TaskID: "task-1",
		Place:  attention.Place{Kind: attention.PlaceStage, Stage: task.StagePRD},
		Kind:   attention.KindQuestion,
		Title:  "login-screen",
		Body:   "The agent has a question in PRD.",
	}}
	situations.Update(found)
	clock.now = clock.now.Add(attention.Settle)
	situations.Update(found)
	if diff := cmp.Diff([]string{"send:s1"}, notifier.calls); diff != "" {
		t.Fatalf("notifier calls before the view mismatch (-want +got):\n%s", diff)
	}

	service.ViewSituation("s1")

	if diff := cmp.Diff([]string{"send:s1", "withdraw:s1"}, notifier.calls); diff != "" {
		t.Errorf("notifier calls after the view mismatch (-want +got):\n%s", diff)
	}
}
