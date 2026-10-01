package gh

import (
	"slices"
	"strings"
	"time"
)

// Check is one check of the head of a pull request: a check run of GitHub
// Actions or a commit status of another system, which GitHub lists alike.
type Check struct {
	Name        string     `json:"name"`
	URL         string     `json:"url"`         // the check on GitHub; "" when GitHub gave none
	Pending     bool       `json:"pending"`     // not finished yet
	Conclusion  string     `json:"conclusion"`  // lower case, as GitHub wrote it: success, failure, cancelled...; "" while pending
	State       CheckState `json:"state"`       // passed, skipped, neutral, failed, running or queued
	StartedAt   time.Time  `json:"startedAt"`   // zero when GitHub gave none
	CompletedAt time.Time  `json:"completedAt"` // zero while it runs, or when GitHub gave none
}

// CheckState is where a check stands, as the app shows it.
type CheckState string

// The states a check is in.
const (
	CheckPassed  CheckState = "passed"
	CheckSkipped CheckState = "skipped"
	CheckNeutral CheckState = "neutral"
	CheckFailed  CheckState = "failed"
	CheckRunning CheckState = "running"
	CheckQueued  CheckState = "queued"
)

// Mergeable is whether GitHub says the branch merges clean into its base.
type Mergeable string

// The answers GitHub gives about a merge.
const (
	MergeableClean       Mergeable = "mergeable"
	MergeableConflicting Mergeable = "conflicting"
	MergeableUnknown     Mergeable = "unknown" // GitHub has not computed it yet
)

// PRChecks is what GitHub says about the head of a pull request beyond its
// state: its checks and whether it merges clean into the base.
type PRChecks struct {
	Checks    []Check // never nil once read
	Mergeable Mergeable
}

// CheckNode is a check as GitHub answers it, in `gh pr view --json
// statusCheckRollup` and in the contexts of a GraphQL statusCheckRollup
// alike: a CheckRun names itself with name, status and conclusion, a
// StatusContext with context and state.
type CheckNode struct {
	Typename   string `json:"__typename"`
	Name       string `json:"name"`
	Status     string `json:"status"`
	Conclusion string `json:"conclusion"`
	DetailsURL string `json:"detailsUrl"`
	Context    string `json:"context"`
	State      string `json:"state"`
	TargetURL  string `json:"targetUrl"`
	// StartedAt and CompletedAt are RFC 3339, given for a CheckRun; a
	// StatusContext may come without them.
	StartedAt   string `json:"startedAt"`
	CompletedAt string `json:"completedAt"`
}

// passingConclusions are the conclusions of a finished check that do not fail
// it. Any other conclusion counts as a failure, startup_failure, stale and
// whatever GitHub adds included: a check that failed for a reason that does
// not matter is a finding the user discards.
var passingConclusions = []string{"success", "skipped", "neutral"}

// ParseChecks reads the checks and the merge state GitHub answers about the
// head of a pull request. A mergeable the app does not know, empty included,
// is MergeableUnknown: GitHub has not computed it yet.
func ParseChecks(nodes []CheckNode, mergeable string) PRChecks {
	checks := make([]Check, 0, len(nodes))
	for _, n := range nodes {
		checks = append(checks, checkOf(n))
	}
	return PRChecks{Checks: checks, Mergeable: mergeableOf(mergeable)}
}

// checkOf reads one node, a StatusContext or a CheckRun. A node that does not
// say its type is a StatusContext when it names a context.
func checkOf(n CheckNode) Check {
	c := Check{StartedAt: timeOf(n.StartedAt), CompletedAt: timeOf(n.CompletedAt)}
	if n.Typename == "StatusContext" || (n.Typename == "" && n.Context != "") {
		c.Name, c.URL = n.Context, n.TargetURL
		state := strings.ToUpper(n.State)
		switch state {
		case "PENDING", "EXPECTED":
			c.Pending = true
		default:
			c.Conclusion = strings.ToLower(n.State)
		}
		c.State = contextState(state)
		return c
	}

	c.Name, c.URL = n.Name, n.DetailsURL
	switch n.Status {
	case "COMPLETED":
		c.Conclusion = strings.ToLower(n.Conclusion)
		c.State = conclusionState(c.Conclusion)
	case "IN_PROGRESS":
		c.Pending, c.State = true, CheckRunning
	default:
		c.Pending, c.State = true, CheckQueued
	}
	return c
}

// conclusionState is the state of a finished CheckRun: any conclusion that
// does not pass it fails it.
func conclusionState(conclusion string) CheckState {
	switch conclusion {
	case "success":
		return CheckPassed
	case "skipped":
		return CheckSkipped
	case "neutral":
		return CheckNeutral
	default:
		return CheckFailed
	}
}

// contextState is the state of a StatusContext by its upper-case state.
func contextState(state string) CheckState {
	switch state {
	case "SUCCESS":
		return CheckPassed
	case "PENDING":
		return CheckRunning
	case "EXPECTED":
		return CheckQueued
	default:
		return CheckFailed
	}
}

// timeOf reads a time GitHub gave, zero when it gave none or one the app
// cannot read.
func timeOf(value string) time.Time {
	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		return time.Time{}
	}
	return parsed
}

// mergeableOf normalizes the merge state GitHub writes in upper case.
func mergeableOf(mergeable string) Mergeable {
	switch strings.ToUpper(mergeable) {
	case "MERGEABLE":
		return MergeableClean
	case "CONFLICTING":
		return MergeableConflicting
	default:
		return MergeableUnknown
	}
}

// Failed reports whether the check finished with a conclusion that does not
// pass it.
func (c Check) Failed() bool {
	return !c.Pending && !slices.Contains(passingConclusions, c.Conclusion)
}

// Pending reports whether GitHub has anything left to say: a check not
// finished yet, or a merge state not computed yet.
func (c PRChecks) Pending() bool {
	return c.Mergeable == MergeableUnknown || slices.ContainsFunc(c.Checks, func(check Check) bool { return check.Pending })
}

// Failed is the checks that failed, in the order GitHub listed them; never
// nil.
func (c PRChecks) Failed() []Check {
	failed := []Check{}
	for _, check := range c.Checks {
		if check.Failed() {
			failed = append(failed, check)
		}
	}
	return failed
}

// Passed is how many checks finished without failing; a pending check has
// not passed yet.
func (c PRChecks) Passed() int {
	passed := 0
	for _, check := range c.Checks {
		if !check.Failed() && !check.Pending {
			passed++
		}
	}
	return passed
}

// Conflicting reports whether the branch has conflicts with its base.
func (c PRChecks) Conflicting() bool {
	return c.Mergeable == MergeableConflicting
}

// Trouble is what keeps a pull request from being ready to merge: the checks
// of its head that failed, by name, and a conflict with its base.
type Trouble struct {
	FailedChecks []string `json:"failedChecks"` // sorted, without repeats
	Conflict     bool     `json:"conflict"`
}

// Any reports whether there is any trouble at all.
func (t Trouble) Any() bool { return len(t.FailedChecks) > 0 || t.Conflict }

// Equal reports whether two troubles name the same checks and the same
// conflict. A nil list and an empty one are equal.
func (t Trouble) Equal(other Trouble) bool {
	return t.Conflict == other.Conflict && slices.Equal(t.FailedChecks, other.FailedChecks)
}

// Trouble is what a reading shows wrong: every check that failed and the
// conflict with the base.
func (c PRChecks) Trouble() Trouble {
	failed := c.Failed()
	names := make([]string, 0, len(failed))
	for _, check := range failed {
		names = append(names, check.Name)
	}
	return Trouble{FailedChecks: sortedNames(names), Conflict: c.Conflicting()}
}

// NextTrouble is the trouble a pull request has after a reading, measured
// against baseline, the trouble of the reading its last review pass started
// from; open is the trouble it had before this reading. A check that failed
// and was not failing in the baseline is trouble; a check still pending keeps
// what it was in open; a merge GitHub has not computed keeps the conflict of
// open, and a conflict is trouble only when the baseline had none.
func NextTrouble(baseline, open Trouble, reading PRChecks) Trouble {
	names := []string{}
	for _, check := range reading.Checks {
		isNew := check.Failed() && !slices.Contains(baseline.FailedChecks, check.Name)
		stillOpen := check.Pending && slices.Contains(open.FailedChecks, check.Name)
		if isNew || stillOpen {
			names = append(names, check.Name)
		}
	}

	var conflict bool
	switch reading.Mergeable {
	case MergeableConflicting:
		conflict = !baseline.Conflict
	case MergeableClean:
		conflict = false
	case MergeableUnknown:
		conflict = open.Conflict
	}
	return Trouble{FailedChecks: sortedNames(names), Conflict: conflict}
}

// sortedNames sorts the names of checks and drops the repeats, as a trouble
// keeps them.
func sortedNames(names []string) []string {
	slices.Sort(names)
	return slices.Compact(names)
}
