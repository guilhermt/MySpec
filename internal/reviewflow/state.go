package reviewflow

import (
	"slices"
	"time"

	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/pulls"
	"github.com/guilhermt/myspec/internal/review"
	"github.com/guilhermt/myspec/internal/session"
)

// Status is what the interface shows about a review of a pull request.
type Status string

// The states a review is shown in. The ones marked apply belong to the cycle
// that applies the findings to a pull request of the user's own.
const (
	StatusReviewing        Status = "reviewing"         // a pass is under way
	StatusAwaitingReply    Status = "awaiting_reply"    // the agent rested without a report the app can read
	StatusAwaitingDecision Status = "awaiting_decision" // a finding is still to decide
	StatusReadyToPublish   Status = "ready_to_publish"  // publish: everything is decided, or the report is clean
	StatusPublishFailed    Status = "publish_failed"
	StatusPublished        Status = "published"
	StatusNewCommits       Status = "new_commits"      // the pull request moved since the published review
	StatusReadyToApply     Status = "ready_to_apply"   // apply: everything is decided and something was approved
	StatusApplying         Status = "applying"         // apply: the agent is fixing what was approved
	StatusInReview         Status = "in_review"        // apply: the changes await the review of the user
	StatusReadyToApprove   Status = "ready_to_approve" // apply: every changed file is staged
	StatusCommitting       Status = "committing"       // apply: the agent is committing
	StatusReadyToMerge     Status = "ready_to_merge"   // apply: nothing is left to fix
	StatusTrouble          Status = "trouble"          // published or ready to merge, and a check failed or a conflict with the base came up since
	StatusWaitingChecks    Status = "waiting_checks"   // a pass was asked for and waits for the checks of the head
	StatusPassBlocked      Status = "pass_blocked"     // the pass could not start: GitHub could not be read, or the worktree updated
)

// State is everything the app knows about a review: what it recorded, what
// the passes hold, what the conversation is doing and what GitHub last said.
type State struct {
	Review       prreview.Review
	Status       Status
	Passes       []prreview.Pass
	WorktreePath string
	Session      session.Summary
	SessionOpen  bool
	// Watch is the last reading of the worktree, in apply mode only.
	Watch *review.Snapshot
	// StalePass says commits arrived after the pass the user is deciding on,
	// which publishing warns about; publish mode only.
	StalePass bool
	// CheckError is what the last reading of the pull request said when it
	// failed.
	CheckError string
	// Checks are the live checks and the merge of the last reading.
	Checks gh.PRChecks
	// CheckedAt is when that reading was made; zero before one since the app
	// started.
	CheckedAt time.Time
	// CheckErrorAt is the first failing reading of the run of failures; zero
	// when the last one worked.
	CheckErrorAt time.Time
	// NewCommits is how many commits came since the published commit, -1 when
	// it is not among the recent ones; 0 outside StatusNewCommits.
	NewCommits int
	// StaleCommits is how many commits came since the commit of the pass being
	// decided, -1 when unknown; 0 when the pass is not stale.
	StaleCommits int
	// UnreadableReport is why the report of the pass the app asked for could
	// not be read; "" when that is not the case.
	UnreadableReport string
	// CommitFailed says the last approval of apply mode ended without a
	// commit.
	CommitFailed bool
	// PassBlocked is why the pass the app asked for could not start; "" when
	// nothing blocks it.
	PassBlocked string
}

// State is everything the app knows about an active review, false for an id
// that is no review of its own.
func (s *Service) State(id string) (State, bool) {
	stored, ok := s.reviews.Get(id)
	if !ok {
		return State{}, false
	}
	passes := s.reviews.Passes(id)
	sum, open := s.sessions.Summary(sessionKey(id))

	l := s.lockOf(id)

	s.mu.Lock()
	recent := l.recent
	state := State{
		Review:           stored,
		Passes:           passes,
		Session:          sum,
		SessionOpen:      open,
		CheckError:       l.checkError,
		CheckedAt:        l.checkedAt,
		CheckErrorAt:     l.checkErrorAt,
		Checks:           l.checks,
		UnreadableReport: l.unreadable,
		CommitFailed:     l.commitFailed,
		PassBlocked:      l.passBlocked,
	}
	s.mu.Unlock()

	if wt, found := s.worktrees.Get(id); found {
		state.WorktreePath = wt.Path
	}
	last := lastPass(passes)
	snap, watched := review.Snapshot{}, false
	if stored.Mode == prreview.ModeApply {
		if read, has := s.watch.Snapshot(id); has {
			snap, watched = read, true
			state.Watch = &read
		}
	}
	state.Status = status(statusInput{
		Review: stored, Last: last,
		Session: sum, SessionOpen: open, Watch: snap, Watched: watched,
		PassBlocked: state.PassBlocked,
	})
	state.StalePass = stale(stored, last)
	if state.Status == StatusNewCommits {
		state.NewCommits = commitsSince(recent, stored.PublishedCommit)
	}
	if state.StalePass {
		state.StaleCommits = commitsSince(recent, stored.PassCommit)
	}
	return state, true
}

// statusInput is everything the status of a review is decided from.
type statusInput struct {
	Review      prreview.Review
	Last        prreview.Pass // the last pass whose report was recorded; the zero value when none was
	Session     session.Summary
	SessionOpen bool
	Watch       review.Snapshot
	Watched     bool   // the watcher has a reading of the worktree
	PassBlocked string // why the pass the app asked for could not start
}

// status is the state a review is shown in. The conversation comes first:
// while the agent works, what it works on is what the review is.
func status(in statusInput) Status {
	if in.SessionOpen && !in.Session.Idle {
		switch in.Review.Phase {
		case prreview.PhaseCommitting:
			return StatusCommitting
		case prreview.PhaseApplying:
			return StatusApplying
		default:
			return StatusReviewing
		}
	}
	if in.Review.Phase == prreview.PhaseWaitingChecks {
		// The pass was asked for and has not reached the agent yet.
		if in.PassBlocked != "" {
			return StatusPassBlocked
		}
		return StatusWaitingChecks
	}
	if in.Review.AskedPass > in.Review.ReportedPass {
		// The agent rested without the report of the pass it was asked for.
		return StatusAwaitingReply
	}
	if !in.Last.Recorded {
		// The conversation has not opened yet: Start, Sync and ReviewAgain
		// open it, and the evaluation that follows records the report.
		return StatusReviewing
	}
	if in.Review.Mode == prreview.ModeApply {
		return applyStatus(in)
	}
	return publishStatus(in.Review, in.Last)
}

// publishStatus is a review whose findings go to GitHub: the user decides on
// them, publishes, and the review rests until the pull request moves.
func publishStatus(stored prreview.Review, last prreview.Pass) Status {
	switch {
	case stored.PublishError != "":
		return StatusPublishFailed
	case last.Published():
		if stored.HeadCommit != "" && stored.HeadCommit != stored.PublishedCommit {
			return StatusNewCommits
		}
		if stored.Trouble.Any() {
			return StatusTrouble
		}
		return StatusPublished
	case !last.Decided():
		return StatusAwaitingDecision
	default:
		return StatusReadyToPublish
	}
}

// applyStatus is a review that fixes a pull request of the user's own: the
// cycle of a step, with the report of a pass in place of a step file.
func applyStatus(in statusInput) Status {
	switch in.Review.Phase {
	case prreview.PhaseCommitting:
		return StatusCommitting
	case prreview.PhaseApplying:
		// The changes of the agent are reviewed file by file, on the reading
		// of the worktree the watcher has.
		if !in.Watched || in.Watch.Err != "" || in.Watch.Total == 0 || in.Watch.Staged < in.Watch.Total {
			return StatusInReview
		}
		return StatusReadyToApprove
	default:
		switch {
		case in.Last.Clean:
			return readyToMerge(in.Review)
		case !in.Last.Decided():
			return StatusAwaitingDecision
		case len(in.Last.Approved()) == 0:
			// Every finding was discarded: there is nothing to fix.
			return readyToMerge(in.Review)
		default:
			return StatusReadyToApply
		}
	}
}

// readyToMerge is a review of apply mode with nothing left to fix: ready to
// merge, unless something went wrong with the pull request since the pass.
func readyToMerge(stored prreview.Review) Status {
	if stored.Trouble.Any() {
		return StatusTrouble
	}
	return StatusReadyToMerge
}

// stale reports whether the pull request moved since the pass the user is
// deciding on, which only matters while nothing was published yet. A pass
// whose commit git could not say is never stale: nothing tells that it moved.
func stale(stored prreview.Review, last prreview.Pass) bool {
	if stored.Mode != prreview.ModePublish || !last.Recorded || last.Published() {
		return false
	}
	return stored.PassCommit != "" && stored.HeadCommit != "" && stored.HeadCommit != stored.PassCommit
}

// lastPass is the pass whose report was recorded last, the zero value when no
// pass was recorded yet.
func lastPass(passes []prreview.Pass) prreview.Pass {
	for _, pass := range slices.Backward(passes) {
		if pass.Recorded {
			return pass
		}
	}
	return prreview.Pass{}
}

// commitsSince is how many of the recent commits, oldest first, came after the
// commit sha: 0 for no commit or when it is the last one, -1 when it is not
// among them.
func commitsSince(recent []pulls.Commit, sha string) int {
	if sha == "" {
		return 0
	}
	if len(recent) == 0 {
		return -1
	}
	i := slices.IndexFunc(recent, func(c pulls.Commit) bool { return c.SHA == sha })
	if i < 0 {
		return -1
	}
	return len(recent) - 1 - i
}
