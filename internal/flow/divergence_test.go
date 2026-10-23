package flow_test

import (
	"testing"

	"github.com/guilhermt/myspec/internal/divergence"
	"github.com/guilhermt/myspec/internal/flow"
	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
)

func TestDiscardingAStepEndsItsDivergence(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	implementing(f, "task-1", twoStepPlan())
	f.service.Sync(t.Context())
	f.waitStep(t, "task-1", 1, flow.StepImplementing)
	f.waitStepSession(t, "task-1", 1)
	tk, _ := f.tasks.Get("task-1")
	f.diverge(t, tk, session.StepStage(1), divergence.KindCommitMissing, divergence.Facts{Files: 2})

	f.worktrees.setStatus(git.Status{})
	if err := f.service.DiscardStep(t.Context(), "task-1", false); err != nil {
		t.Fatalf("DiscardStep() = %v, want nil", err)
	}
	f.wantNoDivergence(t)
}

func TestDeletingATaskDropsItsDivergence(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	implementing(f, "task-1", twoStepPlan())
	f.service.Sync(t.Context())
	f.waitStep(t, "task-1", 1, flow.StepImplementing)
	f.waitStepSession(t, "task-1", 1)
	tk, _ := f.tasks.Get("task-1")
	f.diverge(t, tk, session.StepStage(1), divergence.KindCommitMissing, divergence.Facts{Files: 2})

	if _, err := f.service.Delete(t.Context(), "task-1"); err != nil {
		t.Fatalf("Delete() = %v, want nil", err)
	}
	f.wantNoDivergence(t)
}

func TestArchivingATaskEndsItsDivergence(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	awaitingClosing(f, "task-1", plan(), task.PRRun{Status: task.PRDone, PR: mergedPR()})
	tk, _ := f.tasks.Get("task-1")
	f.diverge(t, tk, session.PRStage, divergence.KindPRNotOpened, divergence.Facts{Base: "main"})

	if err := f.service.CloseTask(t.Context(), "task-1"); err != nil {
		t.Fatalf("CloseTask() = %v, want nil", err)
	}
	waitFor(t, "the task to be archived", func() bool {
		_, ok := f.tasks.Get("task-1")
		return !ok
	})
	f.wantNoDivergence(t)
}

func TestAStepShowsItsDivergenceOnceTheImplementerRests(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	f.reviews.setSnapshot(staged(0, 2))
	implementing(f, "task-1", twoStepPlan())
	f.service.Sync(t.Context())
	f.waitStep(t, "task-1", 1, flow.StepImplementing)
	f.waitStepSession(t, "task-1", 1)
	tk, _ := f.tasks.Get("task-1")
	f.diverge(t, tk, session.StepStage(1), divergence.KindCommitMissing, divergence.Facts{Files: 2})

	state := f.stepState(t, "task-1", 1)
	if state.Status != flow.StepImplementing || state.Divergence == nil {
		t.Errorf("step 1 = %+v, want it implementing, with the divergence at hand", state)
	}
	// Another step never carries it.
	if other := f.stepState(t, "task-1", 2); other.Divergence != nil {
		t.Errorf("step 2 divergence = %+v, want none", other.Divergence)
	}

	f.sessions.goIdle("task-1")
	f.waitStep(t, "task-1", 1, flow.StepDiverged)
}
