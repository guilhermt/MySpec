package selfcontext

import (
	"fmt"
	"time"

	"github.com/guilhermt/myspec/internal/prreport"
	"github.com/guilhermt/myspec/internal/prreview"
	"github.com/guilhermt/myspec/internal/reviewflow"
	"github.com/guilhermt/myspec/internal/session"
)

// ReviewInput is what the state of a review is rendered from.
type ReviewInput struct {
	State      reviewflow.State
	Repository string // owner/name; "" when the repository is no longer registered
	Stage      string
	Sessions   map[session.Key]session.Summary
	Now        time.Time
}

// Review is the state of a review of a pull request for its session.
func Review(in ReviewInput) string {
	s, r := in.State, in.State.Review
	title := r.Reference(in.Repository)
	if r.Title != "" {
		title += " · " + r.Title
	}
	lines := []string{
		header("review", in.Now),
		"Review: " + title,
		reviewPRLine(r),
		reviewModeLine(r.Mode),
		fmt.Sprintf("This conversation: %s (%s)", conversationName(in.Stage), in.Stage),
		reviewStatusLine(s),
		reviewChecksLine(s),
	}
	lines = append(lines, blockLines(s)...)
	if s.WorktreePath != "" {
		lines = append(lines, "Worktree: "+s.WorktreePath+" · detached HEAD")
	}
	lines = append(lines, passLines(s.Passes)...)
	lines = append(lines, conversationsLine(r.ID, in.Stage, in.Sessions))
	return block(append(lines, divergenceLines(s.Divergence)...))
}

// reviewPRLine is the pull request under review.
func reviewPRLine(r prreview.Review) string {
	line := fmt.Sprintf("Pull request: %s · by %s · %s into %s", r.URL, r.Author, r.HeadBranch, r.BaseBranch)
	if r.HeadCommit != "" {
		line += " · head " + shortSHA(r.HeadCommit)
	}
	return line + " · " + string(r.PRState)
}

// reviewModeLine says what becomes of the approved findings.
func reviewModeLine(m prreview.Mode) string {
	if m == prreview.ModePublish {
		return "Mode: Publish · the app publishes the approved findings on GitHub"
	}
	return "Mode: Apply · the approved findings are fixed in the worktree, and the app pushes the commit"
}

// reviewStatusLine is where the review stands.
func reviewStatusLine(s reviewflow.State) string {
	label := labelOf(reviewStatusLabels, s.Status)
	if s.Status == reviewflow.StatusTrouble {
		label = troubleText(s.Review.Trouble, s.Review.BaseBranch)
	}
	line := "Status: " + label
	if s.Review.AskedPass > 0 {
		line += fmt.Sprintf(" · pass %d", s.Review.AskedPass)
	}
	return line
}

// reviewChecksLine is the last reading of the checks of the pull request.
func reviewChecksLine(s reviewflow.State) string {
	if s.CheckError != "" {
		return "Checks: the last reading failed: " + s.CheckError
	}
	line := "Checks: " + checksText(s.Checks.Checks, !s.CheckedAt.IsZero())
	if merge := mergeText(s.Checks.Mergeable, s.Review.BaseBranch); merge != "" {
		line += " · " + merge
	}
	return line
}

// blockLines are what holds the review back, one line for each thing that does.
func blockLines(s reviewflow.State) []string {
	var lines []string
	if s.PassBlocked != "" {
		lines = append(lines, "Pass blocked: "+s.PassBlocked)
	}
	if s.Review.PublishError != "" {
		lines = append(lines, "Publish failed: "+s.Review.PublishError)
	}
	if s.UnreadableReport != "" {
		lines = append(lines, "Report unreadable: "+s.UnreadableReport)
	}
	return lines
}

// passLines list the passes of the review, one per line; none without passes.
func passLines(passes []prreview.Pass) []string {
	if len(passes) == 0 {
		return nil
	}
	lines := []string{"Passes:"}
	for _, p := range passes {
		lines = append(lines, passLine(p))
	}
	return lines
}

// passLine is one pass: its report and where it went.
func passLine(p prreview.Pass) string {
	line := fmt.Sprintf("- Pass %d · %s", p.Number, reportText(p))
	switch {
	case p.Published():
		line += fmt.Sprintf(" · published at %s as %s %s", clock(p.PublishedAt), verdictText(p.Verdict), p.PublishedURL)
	case p.Applied:
		line += " · applied"
	case !p.SentAt.IsZero():
		line += " · sent to the agent"
	}
	return line
}

// reportText sums up the report of a pass and what the user decided on it.
func reportText(p prreview.Pass) string {
	switch {
	case !p.Recorded:
		return "no report yet"
	case p.Clean:
		return "clean"
	}
	var approved, discarded, undecided int
	for _, f := range p.Findings {
		switch f.Decision {
		case prreport.DecisionApproved:
			approved++
		case prreport.DecisionDiscarded:
			discarded++
		default:
			undecided++
		}
	}
	return fmt.Sprintf("%d findings: %d approved, %d discarded, %d to decide", len(p.Findings), approved, discarded, undecided)
}

// verdictText is what a published review said, as GitHub does.
func verdictText(v prreview.Verdict) string {
	switch v {
	case prreview.VerdictApprove:
		return "Approve"
	case prreview.VerdictRequestChanges:
		return "Request changes"
	default: // a comment
	}
	return "Comment"
}
