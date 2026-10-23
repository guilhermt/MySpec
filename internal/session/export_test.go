package session

import "github.com/guilhermt/myspec/internal/contract"

// OutputOf exposes outputOf to the external tests of the package.
var OutputOf = outputOf

// TailOf exposes tailOf to the external tests of the package.
var TailOf = tailOf

// RetryReasonOf exposes retryReasonOf to the external tests of the package.
var RetryReasonOf = retryReasonOf

// ArtifactOf exposes artifactOf to the external tests of the package.
var ArtifactOf = artifactOf

// WakeOf exposes wakeOf to the external tests of the package.
var WakeOf = wakeOf

// FileOutput exposes fileOutput.
var FileOutput = fileOutput

// RoleOf exposes roleOf.
var RoleOf = roleOf

// TurnOf exposes turnOf.
var TurnOf = turnOf

// StateOf exposes stateOf for the task of a session.
func StateOf(t TaskInfo, turn contract.Turn) contract.State {
	return stateOf(&run{task: t}, turn)
}
