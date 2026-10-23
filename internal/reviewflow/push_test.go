package reviewflow_test

import (
	"errors"
	"fmt"
	"slices"
	"testing"

	"github.com/guilhermt/myspec/internal/divergence"
	"github.com/guilhermt/myspec/internal/git"
	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/review"
	"github.com/guilhermt/myspec/internal/reviewflow"
	"github.com/guilhermt/myspec/internal/session"
)

// committed is a review whose commit turn left a commit the app has to push,
// with the push held as err says; nil lets it land.
func committed(t *testing.T, f *fixture, pushErr error) string {
	t.Helper()

	f.worktrees.failPush(pushErr)
	id := committing(t, f)
	f.watch.setSnapshot(review.Snapshot{Head: commitHash})
	f.sessions.goIdle(id)
	f.service.Check(id)
	return id
}

var errRemote = errors.New("git: could not read from the remote")

func TestAPushThatLandsAsksForTheNextPassAfterTheChecks(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := committed(t, f, nil)

	waitFor(t, "the next pass to be asked for", func() bool { return f.state(t, id).Review.AskedPass == 2 })
	if got := f.worktrees.pushed(); !slices.Equal(got, []string{"cache-boards"}) {
		t.Errorf("pushes = %v, want the branch of the pull request", got)
	}
	if stored, _ := f.reviews.Get(id); stored.AskedPass != 2 {
		t.Errorf("asked pass = %d, want 2", stored.AskedPass)
	}
}

func TestAPushTheRemoteRejectsIsADivergenceThatCheckAgainRetries(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	rejected := fmt.Errorf("%w: ! HEAD:refs/heads/cache-boards [rejected]", git.ErrPushRejected)
	id := committed(t, f, rejected)

	waitFor(t, "the divergence of the rejected push", func() bool { return f.state(t, id).Divergence != nil })
	state := f.state(t, id)
	if state.Status != reviewflow.StatusDiverged || state.Review.Phase != prreview.PhasePushing {
		t.Errorf("status, phase = %q, %q, want diverged, pushing", state.Status, state.Review.Phase)
	}
	if d := state.Divergence; d.Kind != divergence.KindPushRejected || d.Facts.Branch != "cache-boards" || d.Facts.Commit == "" {
		t.Errorf("divergence = %+v, want push_rejected on cache-boards with the commit", d)
	}
	// A rejection again leaves the one divergence, marked once.
	if err := f.service.CheckAgain(t.Context(), id); err != nil {
		t.Fatalf("check again: %v", err)
	}
	waitFor(t, "the second push", func() bool { return len(f.worktrees.pushed()) == 2 })
	if got := f.sessions.markersOf(session.MarkerDivergence); len(got) != 1 {
		t.Errorf("divergence markers = %+v, want one", got)
	}

	f.worktrees.failPush(nil)
	// A check that comes while the push before it still runs is not queued, so
	// the user asks until the push goes.
	waitFor(t, "the divergence to end with the push", func() bool {
		_ = f.service.CheckAgain(t.Context(), id)
		s := f.state(t, id)
		return s.Review.Phase != prreview.PhasePushing && (s.Divergence == nil || s.Divergence.Kind != divergence.KindPushRejected)
	})
}

func TestAPushThatFailsBlocksTheReviewUntilTheUserTriesAgain(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := committed(t, f, errRemote)

	waitFor(t, "the push to be blocked", func() bool {
		return f.state(t, id).Status == reviewflow.StatusPassBlocked
	})
	if got := f.state(t, id).PassBlocked; got != errRemote.Error() {
		t.Errorf("pass blocked = %q, want what git said", got)
	}

	f.worktrees.failPush(nil)
	if err := f.service.RetryPush(t.Context(), id); err != nil {
		t.Fatalf("retry push: %v", err)
	}
	waitFor(t, "the next pass to be asked for", func() bool { return f.state(t, id).Review.AskedPass == 2 })
}

func TestRetryPushRefusesAReviewThatIsNotPushing(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := applyDecided(t, f)

	wantErrIs(t, f.service.RetryPush(t.Context(), id), reviewflow.ErrNotPushing)
}

func TestAReviewThatWasPushingWhenTheAppClosedPushesWhenItOpens(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := committed(t, f, errRemote)
	waitFor(t, "the push to be blocked", func() bool {
		return f.state(t, id).Status == reviewflow.StatusPassBlocked
	})

	f.worktrees.failPush(nil)
	service := f.newService(t)
	service.Sync(t.Context())

	waitFor(t, "the next pass to be asked for", func() bool { return f.state(t, id).Review.AskedPass == 2 })
}
