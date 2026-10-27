// Package deploys owns the deploys of the repositories of a board: the environments the user configured, the last reading of each environment on GitHub, the pull requests of promotion and their merges, and the runs those merges start. It reads and writes GitHub through gh, keeps its readings in memory and reports what changed by callbacks; it knows nothing about tasks.
package deploys

import "time"

// Environment is one environment of a repository, as the user configured it.
type Environment struct {
	Name         string `json:"name"`         // Development
	Branch       string `json:"branch"`       // dev
	WorkflowID   int64  `json:"workflowId"`   // the id GitHub gives the workflow
	WorkflowName string `json:"workflowName"` // as GitHub named it when chosen
	WorkflowPath string `json:"workflowPath"` // .github/workflows/deploy.yml
}

// RepositoryConfig is the environments of one managed repository, in order.
type RepositoryConfig struct {
	RepositoryID string
	Environments []Environment // MinEnvironments at least
}

// BoardConfig is the deploys of one board.
type BoardConfig struct {
	BoardID      string
	Enabled      bool
	Repositories []RepositoryConfig // never nil
}

// MinEnvironments is how many environments a repository needs: one alone
// promotes nothing.
const MinEnvironments = 2

// DefaultEnvironments are the environments a repository starts with when the
// user checks it.
func DefaultEnvironments() []Environment {
	return []Environment{
		{Name: "Development", Branch: "dev"},
		{Name: "Staging", Branch: "staging"},
		{Name: "Production", Branch: "main"},
	}
}

// RunStatus is where a run of a deploy workflow is.
type RunStatus string

// The statuses of a run, as the app reads them.
const (
	RunQueued    RunStatus = "queued"    // queued, requested, waiting, pending
	RunRunning   RunStatus = "running"   // in_progress
	RunSucceeded RunStatus = "succeeded" // completed with success
	RunFailed    RunStatus = "failed"    // completed with failure, cancelled, timed_out, startup_failure, action_required
)

// The statuses and conclusions GitHub writes that the app tells apart.
const (
	githubCompleted  = "completed"
	githubInProgress = "in_progress"
	githubSuccess    = "success"
)

// statusOf is the status the app gives a run GitHub wrote status and conclusion
// for, and whether the run counts. A run concluded as skipped, neutral or stale
// is not a deploy, and changes neither the failure nor the success.
func statusOf(status, conclusion string) (RunStatus, bool) {
	switch status {
	case githubCompleted:
		switch conclusion {
		case githubSuccess:
			return RunSucceeded, true
		case "skipped", "neutral", "stale":
			return "", false
		default:
			return RunFailed, true
		}
	case githubInProgress:
		return RunRunning, true
	default:
		return RunQueued, true
	}
}

// Run is one run of the deploy workflow of an environment.
type Run struct {
	ID         int64
	Status     RunStatus
	Conclusion string // as GitHub writes it; "" while not completed
	HeadSHA    string
	URL        string
	CreatedAt  time.Time
	StartedAt  time.Time // run_started_at; CreatedAt when GitHub gives none
	UpdatedAt  time.Time // the end of a completed run
}

// Active reports whether the run is queued or running.
func (r Run) Active() bool { return r.Status == RunQueued || r.Status == RunRunning }

// PullRequest is a pull request that enters a deploy: merged into an earlier
// environment and not yet in this one.
type PullRequest struct {
	Number int
	Title  string
	URL    string
	Author string // the login, "ghost" when the account is gone
}

// DeployPR is an open pull request from the branch of the previous environment
// to the branch of this one.
type DeployPR struct {
	Number    int
	Title     string
	URL       string
	Draft     bool
	CreatedAt time.Time
}

// Promotion is what the branch of the previous environment has that the branch
// of this one doesn't.
type Promotion struct {
	// Commits are the commits waiting, without the merge commits.
	Commits int
	// Ahead is aheadBy as GitHub counts it, merge commits included.
	Ahead int
	// Partial reports that more commits wait than a reading reads (compareLimit):
	// the pull requests and the age come from the ones read.
	Partial bool
	// PendingSince is when the oldest change waiting reached the previous
	// branch; zero when Commits is 0.
	PendingSince time.Time
	PullRequests []PullRequest // by number, newest first; never nil
	DeployPR     *DeployPR     // the most recent open one; nil when none
	// OpenDeployPRs is how many are open; 0 with DeployPR nil.
	OpenDeployPRs int
}

// EnvironmentReading is what the last reading found of one environment.
type EnvironmentReading struct {
	Branch          string
	PreviousBranch  string // "" for the first environment
	WorkflowID      int64
	BranchMissing   bool
	WorkflowMissing bool
	Head            string     // the tip of the branch; "" when it is missing
	LastRun         *Run       // the most recent run that counts; nil when none
	LastCompleted   *Run       // the most recent completed run that counts; nil when none
	Promotion       *Promotion // nil for the first environment, or with a branch of the pair missing
}

// Holds reports whether the reading is still of the environment env, whose
// previous environment has the branch previousBranch ("" for the first). A
// reading holds while the branches and the workflow are the ones it read; when
// the configuration changes them, the environment is unread until the next
// reading.
func (e EnvironmentReading) Holds(env Environment, previousBranch string) bool {
	return e.Branch == env.Branch && e.PreviousBranch == previousBranch && e.WorkflowID == env.WorkflowID
}

// RepositoryReading is what the last reading found of one repository.
type RepositoryReading struct {
	RepositoryID string
	Environments []EnvironmentReading // never nil
	ReadAt       time.Time            // when Environments were read
	// Failure is why the last reading of this repository failed; Environments
	// are then the ones of the reading before it, or none.
	Failure *Failure
}
