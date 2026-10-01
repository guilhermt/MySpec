package gh_test

import (
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/gh"
)

func TestParseChecksGivesEachCheckItsState(t *testing.T) {
	t.Parallel()

	run := func(status, conclusion string) gh.CheckNode {
		return gh.CheckNode{Typename: "CheckRun", Name: "test", Status: status, Conclusion: conclusion}
	}
	context := func(state string) gh.CheckNode {
		return gh.CheckNode{Typename: "StatusContext", Context: "ci/build", State: state}
	}
	tests := []struct {
		name string
		node gh.CheckNode
		want gh.CheckState
	}{
		{"a check run that succeeded", run("COMPLETED", "SUCCESS"), gh.CheckPassed},
		{"a check run skipped", run("COMPLETED", "SKIPPED"), gh.CheckSkipped},
		{"a check run neutral", run("COMPLETED", "NEUTRAL"), gh.CheckNeutral},
		{"a check run that failed", run("COMPLETED", "FAILURE"), gh.CheckFailed},
		{"a check run cancelled", run("COMPLETED", "CANCELLED"), gh.CheckFailed},
		{"a check run timed out", run("COMPLETED", "TIMED_OUT"), gh.CheckFailed},
		{"a check run with a conclusion the app does not know", run("COMPLETED", "STALE"), gh.CheckFailed},
		{"a check run in progress", run("IN_PROGRESS", ""), gh.CheckRunning},
		{"a check run queued", run("QUEUED", ""), gh.CheckQueued},
		{"a check run waiting", run("WAITING", ""), gh.CheckQueued},
		{"a check run requested", run("REQUESTED", ""), gh.CheckQueued},
		{"a check run pending", run("PENDING", ""), gh.CheckQueued},
		{"a check run with a status the app does not know", run("SOMETHING", ""), gh.CheckQueued},
		{"a status context that succeeded", context("SUCCESS"), gh.CheckPassed},
		{"a status context that failed", context("FAILURE"), gh.CheckFailed},
		{"a status context that errored", context("ERROR"), gh.CheckFailed},
		{"a status context pending", context("PENDING"), gh.CheckRunning},
		{"a status context expected", context("EXPECTED"), gh.CheckQueued},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			check := gh.ParseChecks([]gh.CheckNode{test.node}, "").Checks[0]
			if check.State != test.want {
				t.Errorf("State = %q, want %q", check.State, test.want)
			}
			if (check.State == gh.CheckFailed) != check.Failed() {
				t.Errorf("State = %q but Failed() = %v, want the two to agree", check.State, check.Failed())
			}
		})
	}
}

func TestParseChecksReadsTheTimesOfACheck(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name                   string
		node                   gh.CheckNode
		wantStarted, wantEnded time.Time
	}{
		{
			name: "a finished check run",
			node: gh.CheckNode{
				Typename: "CheckRun", Name: "test", Status: "COMPLETED", Conclusion: "SUCCESS",
				StartedAt: "2026-09-27T23:56:08Z", CompletedAt: "2026-09-28T00:03:30Z",
			},
			wantStarted: time.Date(2026, 9, 27, 23, 56, 8, 0, time.UTC),
			wantEnded:   time.Date(2026, 9, 28, 0, 3, 30, 0, time.UTC),
		},
		{
			name:        "a check run that runs",
			node:        gh.CheckNode{Typename: "CheckRun", Name: "test", Status: "IN_PROGRESS", StartedAt: "2026-09-27T23:56:08Z"},
			wantStarted: time.Date(2026, 9, 27, 23, 56, 8, 0, time.UTC),
		},
		{
			name: "a node without times",
			node: gh.CheckNode{Typename: "StatusContext", Context: "ci/build", State: "SUCCESS"},
		},
		{
			name: "a node with times the app cannot read",
			node: gh.CheckNode{Typename: "CheckRun", Name: "test", Status: "COMPLETED", StartedAt: "yesterday", CompletedAt: "0001"},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			check := gh.ParseChecks([]gh.CheckNode{test.node}, "").Checks[0]
			if !check.StartedAt.Equal(test.wantStarted) {
				t.Errorf("StartedAt = %v, want %v", check.StartedAt, test.wantStarted)
			}
			if !check.CompletedAt.Equal(test.wantEnded) {
				t.Errorf("CompletedAt = %v, want %v", check.CompletedAt, test.wantEnded)
			}
		})
	}
}

func TestParseChecksReadsWhatGitHubAnswers(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		node      gh.CheckNode
		mergeable string
		want      gh.PRChecks
	}{
		{
			name:      "a check run that succeeded",
			node:      gh.CheckNode{Typename: "CheckRun", Name: "test", Status: "COMPLETED", Conclusion: "SUCCESS", DetailsURL: "https://github.com/acme/api/actions/runs/1"},
			mergeable: "MERGEABLE",
			want: gh.PRChecks{
				Checks:    []gh.Check{{Name: "test", URL: "https://github.com/acme/api/actions/runs/1", Conclusion: "success", State: gh.CheckPassed}},
				Mergeable: gh.MergeableClean,
			},
		},
		{
			name:      "a check run in progress",
			node:      gh.CheckNode{Typename: "CheckRun", Name: "test", Status: "IN_PROGRESS", DetailsURL: "u"},
			mergeable: "CONFLICTING",
			want: gh.PRChecks{
				Checks:    []gh.Check{{Name: "test", URL: "u", Pending: true, State: gh.CheckRunning}},
				Mergeable: gh.MergeableConflicting,
			},
		},
		{
			name:      "a check run that failed",
			node:      gh.CheckNode{Typename: "CheckRun", Name: "lint", Status: "COMPLETED", Conclusion: "FAILURE"},
			mergeable: "UNKNOWN",
			want: gh.PRChecks{
				Checks:    []gh.Check{{Name: "lint", Conclusion: "failure", State: gh.CheckFailed}},
				Mergeable: gh.MergeableUnknown,
			},
		},
		{
			name:      "a status context that succeeded",
			node:      gh.CheckNode{Typename: "StatusContext", Context: "ci/build", State: "SUCCESS", TargetURL: "https://ci.example.com/1"},
			mergeable: "",
			want: gh.PRChecks{
				Checks:    []gh.Check{{Name: "ci/build", URL: "https://ci.example.com/1", Conclusion: "success", State: gh.CheckPassed}},
				Mergeable: gh.MergeableUnknown,
			},
		},
		{
			name:      "a status context pending",
			node:      gh.CheckNode{Typename: "StatusContext", Context: "ci/build", State: "PENDING"},
			mergeable: "mergeable",
			want: gh.PRChecks{
				Checks:    []gh.Check{{Name: "ci/build", Pending: true, State: gh.CheckRunning}},
				Mergeable: gh.MergeableClean,
			},
		},
		{
			name:      "a status context that errored, without its type",
			node:      gh.CheckNode{Context: "ci/build", State: "ERROR"},
			mergeable: "MERGEABLE",
			want: gh.PRChecks{
				Checks:    []gh.Check{{Name: "ci/build", Conclusion: "error", State: gh.CheckFailed}},
				Mergeable: gh.MergeableClean,
			},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			got := gh.ParseChecks([]gh.CheckNode{test.node}, test.mergeable)
			if diff := cmp.Diff(test.want, got); diff != "" {
				t.Errorf("ParseChecks() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestParseChecksWithoutChecksIsAnEmptyList(t *testing.T) {
	t.Parallel()

	got := gh.ParseChecks(nil, "MERGEABLE")
	if got.Checks == nil || len(got.Checks) != 0 {
		t.Errorf("Checks = %#v, want an empty list", got.Checks)
	}
}

func TestACheckFailsWithAnyConclusionButAPassingOne(t *testing.T) {
	t.Parallel()

	tests := []struct {
		conclusion string
		want       bool
	}{
		{"success", false},
		{"skipped", false},
		{"neutral", false},
		{"failure", true},
		{"cancelled", true},
		{"timed_out", true},
		{"action_required", true},
		{"startup_failure", true},
		{"stale", true},
	}
	for _, test := range tests {
		t.Run(test.conclusion, func(t *testing.T) {
			t.Parallel()
			if got := (gh.Check{Conclusion: test.conclusion}).Failed(); got != test.want {
				t.Errorf("Failed() = %v, want %v", got, test.want)
			}
		})
	}

	if (gh.Check{Pending: true}).Failed() {
		t.Error("Failed() = true for a pending check, want false")
	}
}

func TestPRChecksArePendingWhileAnyCheckIsOrTheMergeIsUnknown(t *testing.T) {
	t.Parallel()

	done := gh.Check{Name: "test", Conclusion: "success"}
	running := gh.Check{Name: "lint", Pending: true}
	tests := []struct {
		name   string
		checks gh.PRChecks
		want   bool
	}{
		{"all finished and the merge known", gh.PRChecks{Checks: []gh.Check{done}, Mergeable: gh.MergeableClean}, false},
		{"no checks and a conflict", gh.PRChecks{Checks: []gh.Check{}, Mergeable: gh.MergeableConflicting}, false},
		{"a check running", gh.PRChecks{Checks: []gh.Check{done, running}, Mergeable: gh.MergeableClean}, true},
		{"the merge unknown", gh.PRChecks{Checks: []gh.Check{done}, Mergeable: gh.MergeableUnknown}, true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			if got := test.checks.Pending(); got != test.want {
				t.Errorf("Pending() = %v, want %v", got, test.want)
			}
		})
	}
}

func TestPRChecksListTheFailedInOrderAndTheConflict(t *testing.T) {
	t.Parallel()

	checks := gh.PRChecks{
		Checks: []gh.Check{
			{Name: "build", Conclusion: "failure"},
			{Name: "test", Conclusion: "success"},
			{Name: "deploy", Pending: true},
			{Name: "lint", Conclusion: "cancelled"},
		},
		Mergeable: gh.MergeableConflicting,
	}
	want := []gh.Check{{Name: "build", Conclusion: "failure"}, {Name: "lint", Conclusion: "cancelled"}}
	if diff := cmp.Diff(want, checks.Failed()); diff != "" {
		t.Errorf("Failed() mismatch (-want +got):\n%s", diff)
	}
	if !checks.Conflicting() {
		t.Error("Conflicting() = false, want true")
	}
	if got := checks.Passed(); got != 1 {
		t.Errorf("Passed() = %d, want 1: neither the failed nor the pending ones passed", got)
	}
	if got := (gh.PRChecks{Mergeable: gh.MergeableClean}).Failed(); got == nil {
		t.Error("Failed() = nil, want an empty list")
	}
}

func TestTroubleNamesTheFailedChecksSortedOnceAndTheConflict(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		checks gh.PRChecks
		want   gh.Trouble
	}{
		{
			name: "failed checks repeated and out of order",
			checks: gh.PRChecks{
				Checks: []gh.Check{
					{Name: "test", Conclusion: "failure"},
					{Name: "build", Conclusion: "success"},
					{Name: "lint", Conclusion: "cancelled"},
					{Name: "test", Conclusion: "timed_out"},
					{Name: "deploy", Pending: true},
				},
				Mergeable: gh.MergeableClean,
			},
			want: gh.Trouble{FailedChecks: []string{"lint", "test"}},
		},
		{
			name:   "a conflict and no failed checks",
			checks: gh.PRChecks{Checks: []gh.Check{{Name: "test", Conclusion: "success"}}, Mergeable: gh.MergeableConflicting},
			want:   gh.Trouble{FailedChecks: []string{}, Conflict: true},
		},
		{
			name:   "nothing wrong",
			checks: gh.PRChecks{Checks: []gh.Check{}, Mergeable: gh.MergeableUnknown},
			want:   gh.Trouble{FailedChecks: []string{}},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			got := test.checks.Trouble()
			if diff := cmp.Diff(test.want, got); diff != "" {
				t.Errorf("Trouble() mismatch (-want +got):\n%s", diff)
			}
			if got.FailedChecks == nil {
				t.Error("FailedChecks = nil, want a list")
			}
		})
	}
}

func TestNextTroubleIsWhatWentWrongSinceTheBaseline(t *testing.T) {
	t.Parallel()

	failed := func(name string) gh.Check { return gh.Check{Name: name, Conclusion: "failure"} }
	passed := func(name string) gh.Check { return gh.Check{Name: name, Conclusion: "success"} }
	pending := func(name string) gh.Check { return gh.Check{Name: name, Pending: true} }
	tests := []struct {
		name     string
		baseline gh.Trouble
		open     gh.Trouble
		reading  gh.PRChecks
		want     gh.Trouble
	}{
		{
			name:    "a check that failed since",
			reading: gh.PRChecks{Checks: []gh.Check{passed("build"), failed("test")}, Mergeable: gh.MergeableClean},
			want:    gh.Trouble{FailedChecks: []string{"test"}},
		},
		{
			name:     "a check that already failed in the baseline",
			baseline: gh.Trouble{FailedChecks: []string{"test"}},
			reading:  gh.PRChecks{Checks: []gh.Check{failed("test")}, Mergeable: gh.MergeableClean},
			want:     gh.Trouble{FailedChecks: []string{}},
		},
		{
			name:    "a pending check that was open keeps it",
			open:    gh.Trouble{FailedChecks: []string{"test"}},
			reading: gh.PRChecks{Checks: []gh.Check{pending("test")}, Mergeable: gh.MergeableClean},
			want:    gh.Trouble{FailedChecks: []string{"test"}},
		},
		{
			name:    "a pending check that was not open stays out",
			reading: gh.PRChecks{Checks: []gh.Check{pending("test")}, Mergeable: gh.MergeableClean},
			want:    gh.Trouble{FailedChecks: []string{}},
		},
		{
			name:    "an open check that passed leaves",
			open:    gh.Trouble{FailedChecks: []string{"lint", "test"}},
			reading: gh.PRChecks{Checks: []gh.Check{passed("test"), failed("lint")}, Mergeable: gh.MergeableClean},
			want:    gh.Trouble{FailedChecks: []string{"lint"}},
		},
		{
			name:    "an open check gone from the reading leaves",
			open:    gh.Trouble{FailedChecks: []string{"test"}},
			reading: gh.PRChecks{Checks: []gh.Check{}, Mergeable: gh.MergeableClean},
			want:    gh.Trouble{FailedChecks: []string{}},
		},
		{
			name:    "a conflict that came up since",
			reading: gh.PRChecks{Checks: []gh.Check{}, Mergeable: gh.MergeableConflicting},
			want:    gh.Trouble{FailedChecks: []string{}, Conflict: true},
		},
		{
			name:     "a conflict already in the baseline",
			baseline: gh.Trouble{Conflict: true},
			reading:  gh.PRChecks{Checks: []gh.Check{}, Mergeable: gh.MergeableConflicting},
			want:     gh.Trouble{FailedChecks: []string{}},
		},
		{
			name:    "a merge not computed keeps the open conflict",
			open:    gh.Trouble{Conflict: true},
			reading: gh.PRChecks{Checks: []gh.Check{}, Mergeable: gh.MergeableUnknown},
			want:    gh.Trouble{FailedChecks: []string{}, Conflict: true},
		},
		{
			name:    "a clean merge clears the open conflict",
			open:    gh.Trouble{Conflict: true},
			reading: gh.PRChecks{Checks: []gh.Check{}, Mergeable: gh.MergeableClean},
			want:    gh.Trouble{FailedChecks: []string{}},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			got := gh.NextTrouble(test.baseline, test.open, test.reading)
			if diff := cmp.Diff(test.want, got); diff != "" {
				t.Errorf("NextTrouble() mismatch (-want +got):\n%s", diff)
			}
			if got.FailedChecks == nil {
				t.Error("FailedChecks = nil, want a list")
			}
		})
	}
}

func TestTroubleIsAnyFailedCheckOrAConflict(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		trouble gh.Trouble
		want    bool
	}{
		{"nothing", gh.Trouble{}, false},
		{"an empty list", gh.Trouble{FailedChecks: []string{}}, false},
		{"a failed check", gh.Trouble{FailedChecks: []string{"test"}}, true},
		{"a conflict", gh.Trouble{Conflict: true}, true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			if got := test.trouble.Any(); got != test.want {
				t.Errorf("Any() = %v, want %v", got, test.want)
			}
		})
	}
}

func TestTroublesAreEqualWithTheSameChecksAndConflict(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		a, b gh.Trouble
		want bool
	}{
		{"a nil list and an empty one", gh.Trouble{}, gh.Trouble{FailedChecks: []string{}}, true},
		{"the same checks", gh.Trouble{FailedChecks: []string{"lint", "test"}}, gh.Trouble{FailedChecks: []string{"lint", "test"}}, true},
		{"different checks", gh.Trouble{FailedChecks: []string{"lint"}}, gh.Trouble{FailedChecks: []string{"test"}}, false},
		{"a check more", gh.Trouble{FailedChecks: []string{"lint"}}, gh.Trouble{FailedChecks: []string{"lint", "test"}}, false},
		{"a different conflict", gh.Trouble{Conflict: true}, gh.Trouble{}, false},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			if got := test.a.Equal(test.b); got != test.want {
				t.Errorf("Equal() = %v, want %v", got, test.want)
			}
		})
	}
}
