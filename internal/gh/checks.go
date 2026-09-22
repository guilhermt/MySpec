package gh

import (
	"slices"
	"strings"
)

// Check is one check of the head of a pull request: a check run of GitHub
// Actions or a commit status of another system, which GitHub lists alike.
type Check struct {
	Name       string
	URL        string // the check on GitHub; "" when GitHub gave none
	Pending    bool   // not finished yet
	Conclusion string // lower case, as GitHub wrote it: success, failure, cancelled...; "" while pending
}

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
	if n.Typename == "StatusContext" || (n.Typename == "" && n.Context != "") {
		c := Check{Name: n.Context, URL: n.TargetURL}
		switch strings.ToUpper(n.State) {
		case "PENDING", "EXPECTED":
			c.Pending = true
		default:
			c.Conclusion = strings.ToLower(n.State)
		}
		return c
	}

	c := Check{Name: n.Name, URL: n.DetailsURL}
	if n.Status != "COMPLETED" {
		c.Pending = true
	} else {
		c.Conclusion = strings.ToLower(n.Conclusion)
	}
	return c
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

// Conflicting reports whether the branch has conflicts with its base.
func (c PRChecks) Conflicting() bool {
	return c.Mergeable == MergeableConflicting
}
