package selfcontext

import (
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/guilhermt/myspec/internal/divergence"
	"github.com/guilhermt/myspec/internal/gh"
	"github.com/guilhermt/myspec/internal/session"
	"github.com/guilhermt/myspec/internal/task"
)

// timeLayout is how every time of the state is written.
const timeLayout = "2006-01-02 15:04 -07:00"

// clock writes a time in the zone of the user.
func clock(t time.Time) string { return t.Local().Format(timeLayout) }

// header opens the state: what it is and when it was read.
func header(item string, now time.Time) string {
	return fmt.Sprintf("The state of this %s in MySpec, read at %s. It replaces every earlier state.", item, clock(now))
}

// block wraps the lines of a state in its tags, one per line and none empty.
func block(lines []string) string {
	kept := make([]string, 0, len(lines)+2)
	kept = append(kept, "<myspec-state>")
	for _, line := range lines {
		if line != "" {
			kept = append(kept, line)
		}
	}
	kept = append(kept, "</myspec-state>")
	return strings.Join(kept, "\n")
}

// sessionWord is what a session is doing, in a word or two.
func sessionWord(sum session.Summary) string {
	switch sum.Status {
	case session.StatusWorking:
		return "working"
	case session.StatusWaiting:
		return "idle"
	case session.StatusNeedsPermission:
		return "waiting for a permission"
	case session.StatusNeedsAnswer:
		return "waiting for an answer"
	case session.StatusPaused:
		return "paused"
	case session.StatusError:
		return "stopped on an error"
	}
	return string(sum.Status)
}

// stageRank orders the conversations of an item: the stages of a task, the
// steps by number with the implementer before its reviewer, then the pull
// request ones, the review and the discussion.
func stageRank(stage string) [3]int {
	if n, ok := session.ParseStepStage(stage); ok {
		return [3]int{4, n, 0}
	}
	if n, ok := session.ParseStepReviewStage(stage); ok {
		return [3]int{4, n, 1}
	}
	order := []string{
		string(task.StagePRD), string(task.StageTechSpec), string(task.StagePlan), string(task.StageOneShot),
		"", // the steps
		session.PRStage, session.PRReviewStage, session.PRFixStage, session.ReviewStage, session.DiscussionStage,
	}
	if i := slices.Index(order, stage); i >= 0 {
		return [3]int{i, 0, 0}
	}
	return [3]int{len(order), 0, 0}
}

// conversationsLine lists the open conversations of an item and says which one
// the state goes to.
func conversationsLine(itemID, stage string, sessions map[session.Key]session.Summary) string {
	var keys []session.Key
	for k := range sessions {
		if k.TaskID == itemID {
			keys = append(keys, k)
		}
	}
	if len(keys) == 0 {
		return "Conversations: none open"
	}
	slices.SortFunc(keys, func(a, b session.Key) int {
		ra, rb := stageRank(a.Stage), stageRank(b.Stage)
		return slices.Compare(ra[:], rb[:])
	})
	parts := make([]string, len(keys))
	for i, k := range keys {
		parts[i] = conversationName(k.Stage) + " · " + sessionWord(sessions[k])
		if k.Stage == stage {
			parts[i] += " · this conversation"
		}
	}
	return "Conversations: " + strings.Join(parts, "; ")
}

// checksText sums up the checks of a pull request; read says whether GitHub
// was asked at all.
func checksText(checks []gh.Check, read bool) string {
	if !read {
		return "not read yet"
	}
	if len(checks) == 0 {
		return "none"
	}
	var passed, running int
	var failed []string
	for _, c := range checks {
		switch c.State {
		case gh.CheckPassed, gh.CheckSkipped, gh.CheckNeutral:
			passed++
		case gh.CheckFailed:
			failed = append(failed, c.Name)
		case gh.CheckRunning, gh.CheckQueued:
			running++
		}
	}
	text := fmt.Sprintf("%d of %d passed", passed, len(checks))
	if len(failed) > 0 {
		text += ", failed: " + strings.Join(failed, ", ")
	}
	if running > 0 {
		text += fmt.Sprintf(", %d running", running)
	}
	return text
}

// mergeText says how a pull request merges into its base; "" when unknown.
func mergeText(m gh.Mergeable, base string) string {
	switch m {
	case gh.MergeableClean:
		return "merges clean into " + base
	case gh.MergeableConflicting:
		return "conflict with " + base
	default: // unknown says nothing yet
	}
	return ""
}

// divergenceLines tell the divergence that is open, what the app expected and
// found, and the ways out the interface offers.
func divergenceLines(d *divergence.Divergence) []string {
	if d == nil {
		return []string{"Divergence: none"}
	}
	expected, found := divergenceText(*d)
	lines := []string{
		fmt.Sprintf("Divergence: %s, shown as Not as expected, open since %s, in the conversation %s (%s)",
			d.Kind, clock(d.StartedAt), conversationName(d.Stage), d.Stage),
		"- Expected: " + expected,
		"- Found: " + found,
		"- Actions in the interface:",
	}
	for _, a := range divergenceActions(*d) {
		lines = append(lines, "  - "+a.label+": "+a.does)
	}
	return lines
}
