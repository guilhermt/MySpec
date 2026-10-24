package selfcontext

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/guilhermt/myspec/internal/divergence"
	"github.com/guilhermt/myspec/internal/session"
)

// reportPrefix is how the app starts the reason of a report it can't read.
var reportPrefix = regexp.MustCompile(`^The report can't be read:\s*`)

// plain trims the reason of a divergence down to a phrase: no prefix of the
// app, no final full stop.
func plain(reason string) string {
	reason = reportPrefix.ReplaceAllString(reason, "")
	return strings.TrimSpace(strings.TrimRight(reason, "."))
}

// plural picks the word that agrees with n.
func plural(n int, one, many string) string {
	if n == 1 {
		return one
	}
	return many
}

// baseName is what comes after the last slash of a path.
func baseName(path string) string {
	return path[strings.LastIndex(path, "/")+1:]
}

// list joins items as "a, b and c".
func list(items []string) string {
	if len(items) < 2 {
		return strings.Join(items, "")
	}
	return strings.Join(items[:len(items)-1], ", ") + " and " + items[len(items)-1]
}

// prNumbers are the numbers of the pull requests a divergence names.
func prNumbers(prs []divergence.PR) []string {
	numbers := make([]string, len(prs))
	for i, pr := range prs {
		numbers[i] = fmt.Sprintf("#%d", pr.Number)
	}
	return numbers
}

// divergenceText is what the app expected and what it found, as the bar, the
// marker and the sidebar say it; divergenceText in lib/divergences.ts.
func divergenceText(d divergence.Divergence) (expected, found string) {
	f := d.Facts
	report := fmt.Sprintf("the report of pass %d at %s", f.Pass, f.Path)
	var first divergence.PR
	if len(f.PRs) > 0 {
		first = f.PRs[0]
	}
	switch d.Kind {
	case divergence.KindCommitMissing:
		found = "no commit, and the worktree has no changes"
		if f.Files != 0 {
			found = fmt.Sprintf("no commit, and %d %s changed in the worktree", f.Files, plural(f.Files, "file", "files"))
		}
		return fmt.Sprintf("a commit on %s after %s", f.Branch, f.Commit), found
	case divergence.KindReportMissing:
		return report, "no report"
	case divergence.KindReportUnreadable:
		return report, "a report that can't be read: " + plain(f.Reason)
	case divergence.KindReportsAmbiguous:
		return report, fmt.Sprintf("%d files that could be it: %s", len(f.Candidates), strings.Join(f.Candidates, ", "))
	case divergence.KindDraftMissing:
		return "the draft of the pull request at " + f.Path, "no draft"
	case divergence.KindDraftUnreadable:
		return "the draft of the pull request at " + f.Path, "a draft that can't be read: " + plain(f.Reason)
	case divergence.KindNoChanges:
		findings := fmt.Sprintf("the %d approved findings", f.Approved)
		if f.Approved == 1 {
			findings = "the approved finding"
		}
		return fmt.Sprintf("changes for %s of pass %d", findings, f.Pass), "no file changed"
	case divergence.KindPRWrongBase:
		return "a pull request into " + f.Base, fmt.Sprintf("#%d into %s", first.Number, first.Base)
	case divergence.KindPROtherBranch:
		return "a pull request from " + f.Branch, fmt.Sprintf("#%d from %s, with the head of the task", first.Number, first.Head)
	case divergence.KindPRsAmbiguous:
		return "one pull request from " + f.Branch, list(prNumbers(f.PRs))
	case divergence.KindPRNotOpened:
		return fmt.Sprintf("the pull request into %s, approved in the draft", f.Base), "none on GitHub"
	case divergence.KindPushRejected:
		return fmt.Sprintf("%s on origin with %s", f.Branch, f.Commit), fmt.Sprintf("origin has commits %s doesn't", f.Branch)
	case divergence.KindDraftsUnreadable:
		return "drafts.md in the format of the discussion", plain(f.Reason)
	}
	return "", ""
}

// action is one way out of a divergence: its label on the screen and what it
// does.
type action struct {
	label string
	does  string
}

// divergenceActions are the ways out of a divergence, in the order of the
// buttons; divergenceActions in lib/divergences.ts.
func divergenceActions(d divergence.Divergence) []action {
	switch d.Kind {
	case divergence.KindPRNotOpened:
		return []action{
			{"Open the pull request", "opens the pull request with the draft the user approved"},
			checkAgain(d),
		}
	case divergence.KindPRWrongBase, divergence.KindPROtherBranch, divergence.KindPRsAmbiguous:
		actions := make([]action, 0, len(d.Facts.PRs)+1)
		for _, pr := range d.Facts.PRs {
			actions = append(actions, action{
				fmt.Sprintf("Adopt #%d", pr.Number),
				fmt.Sprintf("takes #%d as the pull request", pr.Number),
			})
		}
		return append(actions, checkAgain(d))
	case divergence.KindReportsAmbiguous:
		actions := make([]action, 0, len(d.Facts.Candidates)+1)
		for _, path := range d.Facts.Candidates {
			actions = append(actions, action{
				"Adopt " + baseName(path),
				fmt.Sprintf("takes %s as the report of pass %d", path, d.Facts.Pass),
			})
		}
		return append(actions, checkAgain(d))
	case divergence.KindNoChanges:
		return []action{
			{"Continue without changes", fmt.Sprintf("takes pass %d as applied with no change, and the flow goes on", d.Facts.Pass)},
			askAgain(d),
			checkAgain(d),
		}
	case divergence.KindPushRejected:
		return []action{checkAgain(d)}
	default:
		return []action{askAgain(d), checkAgain(d)}
	}
}

// checkAgain is the action that reads everything again.
func checkAgain(d divergence.Divergence) action {
	if d.Kind == divergence.KindPushRejected {
		return action{
			"Try the push again",
			fmt.Sprintf("lets the app push %s to %s once more, once origin and the branch agree", d.Facts.Commit, d.Facts.Branch),
		}
	}
	return action{"Check again", "reads git, the files and GitHub again, and the flow goes on if things are now as expected"}
}

// askAgain is the action that asks the agent again, named for who it asks.
func askAgain(d divergence.Divergence) action {
	f := d.Facts
	a := action{label: "Ask the agent again"}
	switch d.Kind {
	case divergence.KindCommitMissing:
		a.does = fmt.Sprintf("sends the commit request to %s again", conversationName(d.Stage))
	case divergence.KindReportMissing, divergence.KindReportUnreadable, divergence.KindReportsAmbiguous:
		a.does = fmt.Sprintf("asks the reviewer again for the report of pass %d at %s", f.Pass, f.Path)
	case divergence.KindDraftMissing, divergence.KindDraftUnreadable:
		a.does = "asks the PR agent again for the draft at " + f.Path
	case divergence.KindNoChanges:
		a.does = fmt.Sprintf("sends the approved findings of pass %d to the implementer again", f.Pass)
	case divergence.KindDraftsUnreadable:
		a.does = "asks the Discussion agent again to rewrite drafts.md in the format of the discussion"
	default: // the kinds with no instruction to an agent have no such action
	}
	switch {
	case strings.HasPrefix(string(d.Kind), "report"):
		a.label = "Ask the reviewer again"
	case ofPullRequest(d.Stage) && (d.Kind == divergence.KindCommitMissing || d.Kind == divergence.KindNoChanges):
		a.label = "Ask the implementer again"
	}
	return a
}

// ofPullRequest says whether a conversation is about a pull request.
func ofPullRequest(stage string) bool {
	return stage == session.PRFixStage || stage == session.PRReviewStage || stage == session.ReviewStage
}
