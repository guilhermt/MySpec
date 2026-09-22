package gh_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/gh"
)

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
				Checks:    []gh.Check{{Name: "test", URL: "https://github.com/acme/api/actions/runs/1", Conclusion: "success"}},
				Mergeable: gh.MergeableClean,
			},
		},
		{
			name:      "a check run in progress",
			node:      gh.CheckNode{Typename: "CheckRun", Name: "test", Status: "IN_PROGRESS", DetailsURL: "u"},
			mergeable: "CONFLICTING",
			want: gh.PRChecks{
				Checks:    []gh.Check{{Name: "test", URL: "u", Pending: true}},
				Mergeable: gh.MergeableConflicting,
			},
		},
		{
			name:      "a check run that failed",
			node:      gh.CheckNode{Typename: "CheckRun", Name: "lint", Status: "COMPLETED", Conclusion: "FAILURE"},
			mergeable: "UNKNOWN",
			want: gh.PRChecks{
				Checks:    []gh.Check{{Name: "lint", Conclusion: "failure"}},
				Mergeable: gh.MergeableUnknown,
			},
		},
		{
			name:      "a status context that succeeded",
			node:      gh.CheckNode{Typename: "StatusContext", Context: "ci/build", State: "SUCCESS", TargetURL: "https://ci.example.com/1"},
			mergeable: "",
			want: gh.PRChecks{
				Checks:    []gh.Check{{Name: "ci/build", URL: "https://ci.example.com/1", Conclusion: "success"}},
				Mergeable: gh.MergeableUnknown,
			},
		},
		{
			name:      "a status context pending",
			node:      gh.CheckNode{Typename: "StatusContext", Context: "ci/build", State: "PENDING"},
			mergeable: "mergeable",
			want: gh.PRChecks{
				Checks:    []gh.Check{{Name: "ci/build", Pending: true}},
				Mergeable: gh.MergeableClean,
			},
		},
		{
			name:      "a status context that errored, without its type",
			node:      gh.CheckNode{Context: "ci/build", State: "ERROR"},
			mergeable: "MERGEABLE",
			want: gh.PRChecks{
				Checks:    []gh.Check{{Name: "ci/build", Conclusion: "error"}},
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
	if got := (gh.PRChecks{Mergeable: gh.MergeableClean}).Failed(); got == nil {
		t.Error("Failed() = nil, want an empty list")
	}
}
