package deploys_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/guilhermt/myspec/internal/deploys"
)

// runOf is a run in status.
func runOf(status deploys.RunStatus) *deploys.Run {
	return &deploys.Run{ID: 1, Status: status}
}

// reading is an environment read with the given runs and promotion.
func reading(last, completed *deploys.Run, promotion *deploys.Promotion) *deploys.EnvironmentReading {
	return &deploys.EnvironmentReading{Branch: "staging", PreviousBranch: "dev", WorkflowID: 20, LastRun: last, LastCompleted: completed, Promotion: promotion}
}

// waiting is a promotion with n commits to deploy and no pull request.
func waiting(n int) *deploys.Promotion {
	return &deploys.Promotion{Commits: n, Ahead: n, PullRequests: []deploys.PullRequest{}}
}

// withPR is a promotion with an open pull request of deploy.
func withPR(draft bool) *deploys.Promotion {
	return &deploys.Promotion{Commits: 2, Ahead: 2, PullRequests: []deploys.PullRequest{}, DeployPR: &deploys.DeployPR{Number: 9, Draft: draft}, OpenDeployPRs: 1}
}

func TestDeriveTheViewOfAnEnvironment(t *testing.T) {
	t.Parallel()

	succeeded, failed, running := runOf(deploys.RunSucceeded), runOf(deploys.RunFailed), runOf(deploys.RunRunning)
	tests := []struct {
		name     string
		position int
		env      *deploys.EnvironmentReading
		previous *deploys.EnvironmentReading
		action   *deploys.Action
		want     deploys.View
	}{
		{
			name: "an environment not read yet is unread",
			env:  nil,
			want: deploys.View{State: deploys.StateUnread},
		},
		{
			name:     "a branch that is gone is a problem with no action",
			position: 1,
			env:      &deploys.EnvironmentReading{BranchMissing: true, WorkflowMissing: true, LastRun: running, Promotion: waiting(3)},
			want:     deploys.View{State: deploys.StateProblem, Problem: deploys.ProblemBranchMissing},
		},
		{
			name:     "a workflow that is gone is a problem with no action",
			position: 1,
			env:      &deploys.EnvironmentReading{WorkflowMissing: true, Promotion: waiting(3)},
			want:     deploys.View{State: deploys.StateProblem, Problem: deploys.ProblemWorkflowMissing},
		},
		{
			name: "the first environment running",
			env:  reading(running, succeeded, nil),
			want: deploys.View{State: deploys.StateRunning, Running: true},
		},
		{
			name: "the first environment whose last run failed",
			env:  reading(failed, failed, nil),
			want: deploys.View{State: deploys.StateFailed, Failed: true},
		},
		{
			name: "the first environment up to date",
			env:  reading(succeeded, succeeded, nil),
			want: deploys.View{State: deploys.StateUpToDate},
		},
		{
			name: "the first environment with no deploy yet",
			env:  reading(nil, nil, nil),
			want: deploys.View{State: deploys.StateNoDeploy},
		},
		{
			name:     "changes waiting are pending and offer Deploy",
			position: 1,
			env:      reading(succeeded, succeeded, waiting(2)),
			want:     deploys.View{State: deploys.StatePending, Pending: true, Available: deploys.AvailableDeploy},
		},
		{
			name:     "a pull request of deploy is ready and offers Merge",
			position: 1,
			env:      reading(succeeded, succeeded, withPR(false)),
			want:     deploys.View{State: deploys.StatePRReady, PRReady: true, Available: deploys.AvailableMerge},
		},
		{
			name:     "a pull request in draft is ready too",
			position: 1,
			env:      reading(succeeded, succeeded, withPR(true)),
			want:     deploys.View{State: deploys.StatePRReady, PRReady: true, Available: deploys.AvailableMerge},
		},
		{
			name:     "a pull request of deploy with no commit waiting is still ready",
			position: 1,
			env:      reading(nil, nil, &deploys.Promotion{DeployPR: &deploys.DeployPR{Number: 9}, OpenDeployPRs: 1}),
			want:     deploys.View{State: deploys.StatePRReady, PRReady: true, Available: deploys.AvailableMerge},
		},
		{
			name:     "an environment up to date has nothing to offer",
			position: 1,
			env:      reading(succeeded, succeeded, waiting(0)),
			want:     deploys.View{State: deploys.StateUpToDate},
		},
		{
			name:     "running with changes waiting is running and offers Deploy",
			position: 1,
			env:      reading(running, succeeded, waiting(2)),
			want:     deploys.View{State: deploys.StateRunning, Running: true, Pending: true, Available: deploys.AvailableDeploy},
		},
		{
			name:     "failed with changes waiting is failed and pending",
			position: 1,
			env:      reading(failed, failed, waiting(2)),
			want:     deploys.View{State: deploys.StateFailed, Failed: true, Pending: true, Available: deploys.AvailableDeploy},
		},
		{
			name:     "failed with a pull request ready is failed and ready",
			position: 1,
			env:      reading(failed, failed, withPR(false)),
			want:     deploys.View{State: deploys.StateFailed, Failed: true, PRReady: true, Available: deploys.AvailableMerge},
		},
		{
			name:     "a run active over an older failure is running, not failed",
			position: 1,
			env:      reading(runOf(deploys.RunQueued), failed, nil),
			want:     deploys.View{State: deploys.StateRunning, Running: true, Failed: true},
		},
		{
			name:     "an action in flight makes the environment busy with no action",
			position: 1,
			env:      reading(succeeded, succeeded, waiting(2)),
			action:   &deploys.Action{Kind: deploys.KindDeploy, Phase: deploys.PhaseCreating},
			want:     deploys.View{State: deploys.StatePending, Pending: true, Busy: true},
		},
		{
			name:     "the phase waiting for the run counts as running",
			position: 1,
			env:      reading(succeeded, succeeded, nil),
			action:   &deploys.Action{Kind: deploys.KindMerge, Phase: deploys.PhaseWaitingRun},
			want:     deploys.View{State: deploys.StateRunning, Running: true, Busy: true},
		},
		{
			name:     "the phase running counts as running",
			position: 1,
			env:      reading(succeeded, succeeded, nil),
			action:   &deploys.Action{Kind: deploys.KindMerge, Phase: deploys.PhaseRunning},
			want:     deploys.View{State: deploys.StateRunning, Running: true, Busy: true},
		},
		{
			name:     "an action that failed is not busy",
			position: 1,
			env:      reading(succeeded, succeeded, waiting(2)),
			action:   &deploys.Action{Kind: deploys.KindDeploy, Phase: deploys.PhaseFailed},
			want:     deploys.View{State: deploys.StatePending, Pending: true, Available: deploys.AvailableDeploy},
		},
		{
			name:     "the first environment never has changes waiting",
			position: 0,
			env:      reading(succeeded, succeeded, waiting(2)),
			want:     deploys.View{State: deploys.StateUpToDate},
		},
		{
			name:     "the previous environment deploying is a warning",
			position: 1,
			env:      reading(succeeded, succeeded, waiting(2)),
			previous: reading(running, failed, nil),
			want:     deploys.View{State: deploys.StatePending, Pending: true, Available: deploys.AvailableDeploy, Previous: deploys.HealthDeploying},
		},
		{
			name:     "the previous environment whose last run failed is a warning",
			position: 1,
			env:      reading(succeeded, succeeded, waiting(2)),
			previous: reading(failed, failed, nil),
			want:     deploys.View{State: deploys.StatePending, Pending: true, Available: deploys.AvailableDeploy, Previous: deploys.HealthFailed},
		},
		{
			name:     "a previous environment with a problem warns of nothing",
			position: 1,
			env:      reading(succeeded, succeeded, waiting(2)),
			previous: &deploys.EnvironmentReading{WorkflowMissing: true, LastRun: running},
			want:     deploys.View{State: deploys.StatePending, Pending: true, Available: deploys.AvailableDeploy},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if diff := cmp.Diff(tt.want, deploys.Derive(tt.position, tt.env, tt.previous, tt.action)); diff != "" {
				t.Errorf("Derive() (-want +got):\n%s", diff)
			}
		})
	}
}

func TestOnlyWhatIsWaitingToBeDeployedCounts(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		view deploys.View
		want bool
	}{
		{"pending", deploys.View{State: deploys.StatePending, Pending: true}, true},
		{"pull request ready", deploys.View{State: deploys.StatePRReady, PRReady: true}, true},
		{"failed with nothing waiting", deploys.View{State: deploys.StateFailed, Failed: true}, false},
		{"problem", deploys.View{State: deploys.StateProblem, Problem: deploys.ProblemBranchMissing}, false},
		{"unread", deploys.View{State: deploys.StateUnread}, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if got := deploys.Waiting(tt.view); got != tt.want {
				t.Errorf("Waiting() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestAReadingHoldsOnlyForTheConfigurationItRead(t *testing.T) {
	t.Parallel()

	read := deploys.EnvironmentReading{Branch: "staging", PreviousBranch: "dev", WorkflowID: 20}
	staging := deploys.Environment{Name: "Staging", Branch: "staging", WorkflowID: 20}
	tests := []struct {
		name     string
		env      deploys.Environment
		previous string
		want     bool
	}{
		{"nothing changed", staging, "dev", true},
		{"the name changed", deploys.Environment{Name: "QA", Branch: "staging", WorkflowID: 20}, "dev", true},
		{"the branch changed", deploys.Environment{Branch: "qa", WorkflowID: 20}, "dev", false},
		{"the previous branch changed", staging, "qa", false},
		{"the workflow changed", deploys.Environment{Branch: "staging", WorkflowID: 21}, "dev", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if got := read.Holds(tt.env, tt.previous); got != tt.want {
				t.Errorf("Holds() = %v, want %v", got, tt.want)
			}
		})
	}
}
