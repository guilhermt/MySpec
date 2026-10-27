package app

import (
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/deploys"
)

func TestDeployNotificationIDReadsBackToTheEnvironment(t *testing.T) {
	t.Parallel()

	f := deploys.Finished{RepositoryID: "6f1c2a9e-0000-4000-8000-000000000001", Branch: "release/next", RunID: 99}

	id := deployNotificationID(f)

	if want := "deploy:6f1c2a9e-0000-4000-8000-000000000001:release/next:99"; id != want {
		t.Errorf("deployNotificationID() = %q, want %q", id, want)
	}
	repositoryID, branch, ok := deployTarget(id)
	if !ok || repositoryID != f.RepositoryID || branch != f.Branch {
		t.Errorf("deployTarget(%q) = %q, %q, %v, want %q, %q, true", id, repositoryID, branch, ok, f.RepositoryID, f.Branch)
	}
}

func TestDeployTargetRejectsTheIDsThatAreNotADeploy(t *testing.T) {
	t.Parallel()

	for _, id := range []string{
		"",
		"6f1c2a9e-0000-4000-8000-000000000001",
		"situation:task-1:review",
		"deploy:",
		"deploy:repo-1:main",
		"deploy::main:1",
		"deploy:repo-1::1",
		"deploy:repo-1:main:1:2",
	} {
		if repositoryID, branch, ok := deployTarget(id); ok {
			t.Errorf("deployTarget(%q) = %q, %q, true, want false", id, repositoryID, branch)
		}
	}
}

func TestDeployDurationWritesTheTwoLargestUnits(t *testing.T) {
	t.Parallel()

	tests := []struct {
		d    time.Duration
		want string
	}{
		{0, "0s"},
		{45 * time.Second, "45s"},
		{59*time.Second + 600*time.Millisecond, "1m 0s"},
		{3*time.Minute + 12*time.Second, "3m 12s"},
		{time.Hour, "1h 0m"},
		{time.Hour + 2*time.Minute + 59*time.Second, "1h 2m"},
	}
	got := make([]string, len(tests))
	want := make([]string, len(tests))
	for i, tt := range tests {
		got[i], want[i] = deployDuration(tt.d), tt.want
	}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("deployDuration() mismatch (-want +got):\n%s", diff)
	}
}
