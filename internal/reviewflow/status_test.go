package reviewflow_test

import (
	"testing"

	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/pulls"
	"github.com/guilhermt/myspec/internal/review"
	"github.com/guilhermt/myspec/internal/reviewflow"
)

// finding is a finding of a report, anchored to a line of the diff.
func finding(number int, path string, line int) prreview.ParsedFinding {
	return prreview.ParsedFinding{
		Number: number, Path: path, Line: line, Text: "this reading is never cached",
	}
}

// lintFailed is what went wrong with the pull request since the last pass:
// the lint check failed.
var lintFailed = gh.Trouble{FailedChecks: []string{"lint"}}

// cleanApply is a review in apply mode whose first pass found nothing to fix.
func cleanApply(t *testing.T, f *fixture) string {
	t.Helper()

	f.pulls.seed(ownPR())
	id := f.startMode(t, prreview.ModeApply, "")
	f.sessions.goIdle(id)
	f.record(t, id, cleanReport(1, "Nothing to change."), headHash)
	return id
}

// deciding is a review in publish mode whose first pass holds two findings,
// with the conversation at rest: what the user decides on.
func deciding(t *testing.T, f *fixture) string {
	t.Helper()

	id := f.start(t)
	f.sessions.goIdle(id)
	f.record(t, id, changesReport(1, "Two things to fix.",
		finding(1, "internal/board/service.go", 12), finding(2, "internal/board/read.go", 40)), headHash)
	return id
}

// applying is a review in apply mode whose first pass holds one finding, with
// the conversation at rest.
func applying(t *testing.T, f *fixture) string {
	t.Helper()

	f.pulls.seed(ownPR())
	id := f.startMode(t, prreview.ModeApply, "")
	f.sessions.goIdle(id)
	f.record(t, id, changesReport(1, "One thing to fix.", finding(1, "internal/board/service.go", 12)), headHash)
	return id
}

// published is a review whose first pass was published on GitHub.
func published(t *testing.T, f *fixture) string {
	t.Helper()

	id := deciding(t, f)
	f.decide(t, id, 1, 1, prreview.DecisionApproved)
	f.decide(t, id, 1, 2, prreview.DecisionDiscarded)
	err := f.reviews.MarkPublished(t.Context(), id, 1, prreview.VerdictRequestChanges, false,
		"https://github.com/dev/web/pull/42#pullrequestreview-1", headHash,
		map[int]prreview.Placement{1: prreview.PlacementInline})
	if err != nil {
		t.Fatalf("mark published: %v", err)
	}
	return id
}

func TestTheStatusOfAReviewIsWhatItsPassAndItsConversationSay(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name  string
		setup func(*testing.T, *fixture) string
		want  reviewflow.Status
	}{
		{
			name: "a conversation in the middle of a turn is reviewing",
			setup: func(t *testing.T, f *fixture) string {
				t.Helper()
				return f.start(t)
			},
			want: reviewflow.StatusReviewing,
		},
		{
			name: "a conversation working on the approved findings is applying",
			setup: func(t *testing.T, f *fixture) string {
				t.Helper()
				id := applying(t, f)
				f.update(t, id, func(r *prreview.Review) { r.Phase = prreview.PhaseApplying })
				f.sessions.goBusy(id)
				return id
			},
			want: reviewflow.StatusApplying,
		},
		{
			name: "a conversation writing the commit is committing",
			setup: func(t *testing.T, f *fixture) string {
				t.Helper()
				id := applying(t, f)
				f.update(t, id, func(r *prreview.Review) { r.Phase = prreview.PhaseCommitting })
				f.sessions.goBusy(id)
				return id
			},
			want: reviewflow.StatusCommitting,
		},
		{
			name: "a review created before its conversation is reviewing",
			setup: func(t *testing.T, f *fixture) string {
				t.Helper()
				created, err := f.reviews.Create(t.Context(), prreview.CreateParams{
					RepositoryID: repoID, Number: 7, Title: "Read the labels",
					Author: prAuthor, HeadBranch: "labels", BaseBranch: "main", Mode: prreview.ModePublish,
				})
				if err != nil {
					t.Fatalf("create review: %v", err)
				}
				return created.ID
			},
			want: reviewflow.StatusReviewing,
		},
		{
			name: "a pass that rested without a report waits for the user",
			setup: func(t *testing.T, f *fixture) string {
				t.Helper()
				id := deciding(t, f)
				if _, err := f.reviews.AskPass(t.Context(), id, 2, ""); err != nil {
					t.Fatalf("ask pass: %v", err)
				}
				f.sessions.goIdle(id)
				return id
			},
			want: reviewflow.StatusAwaitingReply,
		},
		{
			name:  "a report with findings nobody decided on awaits the decision",
			setup: deciding,
			want:  reviewflow.StatusAwaitingDecision,
		},
		{
			name: "a report whose every finding is decided is ready to publish",
			setup: func(t *testing.T, f *fixture) string {
				t.Helper()
				id := deciding(t, f)
				f.decide(t, id, 1, 1, prreview.DecisionApproved)
				f.decide(t, id, 1, 2, prreview.DecisionDiscarded)
				return id
			},
			want: reviewflow.StatusReadyToPublish,
		},
		{
			name: "a clean report is ready to publish",
			setup: func(t *testing.T, f *fixture) string {
				t.Helper()
				id := f.start(t)
				f.sessions.goIdle(id)
				f.record(t, id, cleanReport(1, "Nothing to change."), headHash)
				return id
			},
			want: reviewflow.StatusReadyToPublish,
		},
		{
			name:  "a published review rests",
			setup: published,
			want:  reviewflow.StatusPublished,
		},
		{
			name: "a published review whose pull request moved has new commits",
			setup: func(t *testing.T, f *fixture) string {
				t.Helper()
				id := published(t, f)
				f.update(t, id, func(r *prreview.Review) { r.HeadCommit = otherHash })
				return id
			},
			want: reviewflow.StatusNewCommits,
		},
		{
			name: "a published review whose pull request went wrong since is in trouble",
			setup: func(t *testing.T, f *fixture) string {
				t.Helper()
				id := published(t, f)
				f.update(t, id, func(r *prreview.Review) { r.Trouble = lintFailed })
				return id
			},
			want: reviewflow.StatusTrouble,
		},
		{
			name: "new commits come before the trouble of a published review",
			setup: func(t *testing.T, f *fixture) string {
				t.Helper()
				id := published(t, f)
				f.update(t, id, func(r *prreview.Review) {
					r.HeadCommit, r.Trouble = otherHash, gh.Trouble{Conflict: true}
				})
				return id
			},
			want: reviewflow.StatusNewCommits,
		},
		{
			name: "a publication that failed waits for the user",
			setup: func(t *testing.T, f *fixture) string {
				t.Helper()
				id := deciding(t, f)
				f.decide(t, id, 1, 1, prreview.DecisionApproved)
				f.decide(t, id, 1, 2, prreview.DecisionApproved)
				f.update(t, id, func(r *prreview.Review) { r.PublishError = "gh: cannot reach github" })
				return id
			},
			want: reviewflow.StatusPublishFailed,
		},
		{
			name:  "a clean report of apply mode leaves the pull request ready to merge",
			setup: cleanApply,
			want:  reviewflow.StatusReadyToMerge,
		},
		{
			name: "a clean report of apply mode whose pull request went wrong since is in trouble",
			setup: func(t *testing.T, f *fixture) string {
				t.Helper()
				id := cleanApply(t, f)
				f.update(t, id, func(r *prreview.Review) { r.Trouble = lintFailed })
				return id
			},
			want: reviewflow.StatusTrouble,
		},
		{
			name:  "a report of apply mode nobody decided on awaits the decision",
			setup: applying,
			want:  reviewflow.StatusAwaitingDecision,
		},
		{
			name: "a report of apply mode whose findings were all discarded is ready to merge",
			setup: func(t *testing.T, f *fixture) string {
				t.Helper()
				id := applying(t, f)
				f.decide(t, id, 1, 1, prreview.DecisionDiscarded)
				return id
			},
			want: reviewflow.StatusReadyToMerge,
		},
		{
			name: "a report of apply mode with every finding discarded is in trouble when the pull request went wrong",
			setup: func(t *testing.T, f *fixture) string {
				t.Helper()
				id := applying(t, f)
				f.decide(t, id, 1, 1, prreview.DecisionDiscarded)
				f.update(t, id, func(r *prreview.Review) { r.Trouble = gh.Trouble{Conflict: true} })
				return id
			},
			want: reviewflow.StatusTrouble,
		},
		{
			name: "an approved finding of apply mode is ready to apply",
			setup: func(t *testing.T, f *fixture) string {
				t.Helper()
				id := applying(t, f)
				f.decide(t, id, 1, 1, prreview.DecisionApproved)
				return id
			},
			want: reviewflow.StatusReadyToApply,
		},
		{
			name: "changes the watcher has not read yet are in review",
			setup: func(t *testing.T, f *fixture) string {
				t.Helper()
				id := applying(t, f)
				f.update(t, id, func(r *prreview.Review) { r.Phase = prreview.PhaseApplying })
				return id
			},
			want: reviewflow.StatusInReview,
		},
		{
			name: "a reading of the worktree that failed leaves the changes in review",
			setup: func(t *testing.T, f *fixture) string {
				t.Helper()
				id := applying(t, f)
				f.update(t, id, func(r *prreview.Review) { r.Phase = prreview.PhaseApplying })
				f.watch.setSnapshot(review.Snapshot{Err: "git: cannot read the worktree"})
				return id
			},
			want: reviewflow.StatusInReview,
		},
		{
			name: "a worktree the agent changed nothing in leaves the changes in review",
			setup: func(t *testing.T, f *fixture) string {
				t.Helper()
				id := applying(t, f)
				f.update(t, id, func(r *prreview.Review) { r.Phase = prreview.PhaseApplying })
				f.watch.setSnapshot(review.Snapshot{Head: headHash})
				return id
			},
			want: reviewflow.StatusInReview,
		},
		{
			name: "changes with a file left to stage are in review",
			setup: func(t *testing.T, f *fixture) string {
				t.Helper()
				id := applying(t, f)
				f.update(t, id, func(r *prreview.Review) { r.Phase = prreview.PhaseApplying })
				f.watch.setSnapshot(review.Snapshot{Head: headHash, Staged: 1, Total: 2})
				return id
			},
			want: reviewflow.StatusInReview,
		},
		{
			name: "changes with every file staged are ready to approve",
			setup: func(t *testing.T, f *fixture) string {
				t.Helper()
				id := applying(t, f)
				f.update(t, id, func(r *prreview.Review) { r.Phase = prreview.PhaseApplying })
				f.watch.setSnapshot(review.Snapshot{Head: headHash, Staged: 2, Total: 2})
				return id
			},
			want: reviewflow.StatusReadyToApprove,
		},
		{
			name: "a commit the agent is writing is committing",
			setup: func(t *testing.T, f *fixture) string {
				t.Helper()
				id := applying(t, f)
				f.update(t, id, func(r *prreview.Review) { r.Phase = prreview.PhaseCommitting })
				return id
			},
			want: reviewflow.StatusCommitting,
		},
		{
			name: "a pass that waits for the checks is waiting for them",
			setup: func(t *testing.T, f *fixture) string {
				t.Helper()
				f.pulls.seed(withChecks(openPR(), gh.MergeableClean, pendingCheck))
				return f.start(t)
			},
			want: reviewflow.StatusWaitingChecks,
		},
		{
			name: "a conversation in the middle of a turn during the wait is reviewing",
			setup: func(t *testing.T, f *fixture) string {
				t.Helper()
				f.pulls.seed(withChecks(openPR(), gh.MergeableClean, pendingCheck))
				id := f.start(t)
				f.sessions.goBusy(id)
				return id
			},
			want: reviewflow.StatusReviewing,
		},
		{
			name: "a pass whose wait could not read GitHub is blocked",
			setup: func(t *testing.T, f *fixture) string {
				t.Helper()
				f.pulls.seed(withChecks(openPR(), gh.MergeableClean, pendingCheck))
				id := f.start(t)
				f.pulls.failWith(errGitHub)
				f.polled(t, id, func(s reviewflow.State) bool { return s.PassBlocked != "" }, "the pass to be blocked")
				return id
			},
			want: reviewflow.StatusPassBlocked,
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			id := c.setup(t, f)
			if got := f.state(t, id).Status; got != c.want {
				t.Errorf("status = %q, want %q", got, c.want)
			}
		})
	}
}

func TestAReviewOfAnIdThatIsNoReviewHasNoState(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	if _, ok := f.service.State("task-1"); ok {
		t.Error("an id that is no review has a state")
	}
}

func TestAPassDecidedAfterANewCommitIsStale(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := deciding(t, f)

	if f.state(t, id).StalePass {
		t.Error("the pass is stale while the pull request is where it was")
	}

	f.update(t, id, func(r *prreview.Review) { r.HeadCommit = otherHash })

	state := f.state(t, id)
	if !state.StalePass {
		t.Error("the pass of a pull request that moved is not stale")
	}
	if state.Status != reviewflow.StatusAwaitingDecision {
		t.Errorf("status = %q, want %q", state.Status, reviewflow.StatusAwaitingDecision)
	}
}

func TestAPassWhoseCommitGitCouldNotSayIsNeverStale(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := f.start(t)
	f.sessions.goIdle(id)
	f.record(t, id, changesReport(1, "One thing to fix.", finding(1, "internal/board/service.go", 12)), "")

	if f.state(t, id).StalePass {
		t.Error("a pass whose commit git could not say is stale")
	}
}

func TestAPublishedPassIsNeverStale(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := published(t, f)
	f.update(t, id, func(r *prreview.Review) { r.HeadCommit = otherHash })

	if f.state(t, id).StalePass {
		t.Error("a published pass is stale")
	}
}

func TestTheStateOfAReviewCarriesItsPassesItsWorktreeAndItsConversation(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := deciding(t, f)

	state := f.state(t, id)
	if len(state.Passes) != 1 || len(state.Passes[0].Findings) != 2 {
		t.Fatalf("passes = %+v, want one pass with two findings", state.Passes)
	}
	if state.WorktreePath == "" {
		t.Error("the state carries no worktree path")
	}
	if !state.SessionOpen || !state.Session.Idle {
		t.Errorf("session = %+v, want an open session at rest", state.Session)
	}
	if state.Watch != nil {
		t.Error("a review in publish mode carries a reading of the worktree")
	}
}

func TestTheStateOfAReviewInApplyModeCarriesTheReadingOfItsWorktree(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := applying(t, f)
	f.watch.setSnapshot(review.Snapshot{Head: headHash, Staged: 1, Total: 2})

	state := f.state(t, id)
	if state.Watch == nil || state.Watch.Total != 2 {
		t.Errorf("watch = %+v, want the reading of the worktree", state.Watch)
	}
}

func TestTheStateCountsTheCommitsSinceThePublishedOne(t *testing.T) {
	t.Parallel()

	commit := func(sha string) pulls.Commit { return pulls.Commit{SHA: sha, Subject: sha, Author: "rsouza"} }
	cases := map[string]struct {
		recent []pulls.Commit
		want   int
	}{
		"the published commit among them": {[]pulls.Commit{commit("c0"), commit(headHash), commit("c2"), commit(otherHash)}, 2},
		"the published commit is not":     {[]pulls.Commit{commit("c2"), commit(otherHash)}, -1},
	}
	for name, c := range cases {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			f := newFixture(t)
			id := toPublish(t, f)
			if err := f.service.Publish(t.Context(), id, prreview.VerdictComment, true); err != nil {
				t.Fatalf("publish review: %v", err)
			}
			moved := openPR()
			moved.HeadCommit, moved.Commits = otherHash, c.recent
			f.pulls.seed(moved)

			f.polled(t, id, func(s reviewflow.State) bool {
				return s.Status == reviewflow.StatusNewCommits
			}, "the new commits to be noticed")

			if got := f.state(t, id).NewCommits; got != c.want {
				t.Errorf("new commits = %d, want %d", got, c.want)
			}
		})
	}
}

func TestTheStateCountsTheCommitsSinceThePassBeingDecided(t *testing.T) {
	t.Parallel()

	f := newFixture(t)
	id := deciding(t, f)

	if got := f.state(t, id); got.StaleCommits != 0 || got.NewCommits != 0 {
		t.Errorf("state = stale %d, new %d, want 0 and 0 while the pass is current", got.StaleCommits, got.NewCommits)
	}

	f.update(t, id, func(r *prreview.Review) { r.HeadCommit = otherHash })
	if got := f.state(t, id).StaleCommits; got != -1 {
		t.Errorf("stale commits = %d, want -1 before any reading says which commits came", got)
	}

	moved := openPR()
	moved.HeadCommit = otherHash
	moved.Commits = []pulls.Commit{{SHA: headHash}, {SHA: "c2"}, {SHA: otherHash}}
	f.pulls.seed(moved)
	f.polled(t, id, func(s reviewflow.State) bool { return !s.CheckedAt.IsZero() }, "the reading to reach the review")

	if got := f.state(t, id).StaleCommits; got != 2 {
		t.Errorf("stale commits = %d, want 2", got)
	}
}
