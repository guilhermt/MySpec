package deploys

// State is the main state of an environment, the most urgent fact it has.
type State string

// The states of an environment, from the most urgent.
const (
	StateProblem  State = "problem"    // the branch or the workflow is gone
	StateUnread   State = "unread"     // not read since the configuration changed
	StateRunning  State = "running"    // the deploy runs or waits for its run
	StateFailed   State = "failed"     // the last completed run failed
	StatePRReady  State = "pr_ready"   // a pull request of deploy waits for its merge
	StatePending  State = "pending"    // changes wait in the previous environment
	StateUpToDate State = "up_to_date" // the last completed run succeeded
	StateNoDeploy State = "no_deploy"  // no run yet
)

// Problem is what is wrong with the configuration of an environment.
type Problem string

// The problems of an environment.
const (
	ProblemNone            Problem = ""
	ProblemBranchMissing   Problem = "branch_missing"
	ProblemWorkflowMissing Problem = "workflow_missing"
)

// Available is the action an environment offers now.
type Available string

// The actions of an environment.
const (
	AvailableNone   Available = ""
	AvailableDeploy Available = "deploy"
	AvailableMerge  Available = "merge"
)

// Health is how the previous environment is doing, which the panel warns
// about next to the action.
type Health string

// The healths of the previous environment worth a warning.
const (
	HealthFine      Health = ""
	HealthDeploying Health = "deploying"
	HealthFailed    Health = "failed"
)

// View is what an environment is now, derived from its reading and the action
// in flight on it.
type View struct {
	State     State
	Problem   Problem
	Failed    bool // the last completed run failed; marked along with pending and pr_ready
	Pending   bool // only from the second environment on
	PRReady   bool
	Running   bool
	Busy      bool // an action of the app is in flight here
	Available Available
	Previous  Health
}

// Derive is the view of the environment at position from its reading (nil when
// unread), the reading of the previous environment (nil for the first, or
// unread) and the action in flight on it (nil for none).
func Derive(position int, env, previous *EnvironmentReading, action *Action) View {
	if env == nil {
		return View{State: StateUnread}
	}
	switch {
	case env.BranchMissing:
		return View{State: StateProblem, Problem: ProblemBranchMissing}
	case env.WorkflowMissing:
		return View{State: StateProblem, Problem: ProblemWorkflowMissing}
	}

	v := View{
		Failed: env.LastCompleted != nil && env.LastCompleted.Status == RunFailed,
		Busy:   action != nil && action.Phase != PhaseFailed,
		Running: (env.LastRun != nil && env.LastRun.Active()) ||
			(action != nil && (action.Phase == PhaseWaitingRun || action.Phase == PhaseRunning)),
	}
	if position >= 1 && env.Promotion != nil {
		v.PRReady = env.Promotion.DeployPR != nil
		v.Pending = !v.PRReady && env.Promotion.Commits > 0
	}

	// The action depends on the facts, not on the main state: an environment
	// that runs with changes waiting still offers Deploy.
	switch {
	case position == 0 || v.Busy:
		v.Available = AvailableNone
	case v.PRReady:
		v.Available = AvailableMerge
	case v.Pending:
		v.Available = AvailableDeploy
	}

	switch {
	case v.Running:
		v.State = StateRunning
	case v.Failed:
		v.State = StateFailed
	case v.PRReady:
		v.State = StatePRReady
	case v.Pending:
		v.State = StatePending
	case env.LastCompleted != nil:
		v.State = StateUpToDate
	default:
		v.State = StateNoDeploy
	}

	if position >= 1 && previous != nil && !previous.BranchMissing && !previous.WorkflowMissing {
		switch {
		case previous.LastRun != nil && previous.LastRun.Active():
			v.Previous = HealthDeploying
		case previous.LastCompleted != nil && previous.LastCompleted.Status == RunFailed:
			v.Previous = HealthFailed
		}
	}
	return v
}

// Waiting reports whether the environment has something to deploy: it counts
// in the node of the sidebar. A problem or an unread environment doesn't.
func Waiting(v View) bool { return v.Pending || v.PRReady }
