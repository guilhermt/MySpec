package deploys

// Kind is an action of the app on an environment.
type Kind string

// The actions.
const (
	KindDeploy Kind = "deploy"
	KindMerge  Kind = "merge"
)

// Phase is where an action is.
type Phase string

// The phases of an action.
const (
	PhaseCreating   Phase = "creating"    // the pull request of the deploy is being created
	PhaseMerging    Phase = "merging"     // the merge is being made
	PhaseWaitingRun Phase = "waiting_run" // merged; the run of the merge commit hasn't shown up
	PhaseRunning    Phase = "running"     // that run is queued or running
	PhaseFailed     Phase = "failed"      // creating or merging failed
)

// Action is an action of the app on one promotion, from the previous branch to
// the branch of the environment.
type Action struct {
	Kind  Kind
	Phase Phase
}
