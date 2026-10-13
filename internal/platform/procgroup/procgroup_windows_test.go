package procgroup_test

import (
	"testing"

	"github.com/guilhermt/myspec/internal/platform/procgroup"
)

// On Linux a child of a command that ended on its own keeps running, as it
// always did; on Windows the job it ran in is closed with it.
func TestRunLeavesNothingTheCommandStartedRunning(t *testing.T) {
	t.Parallel()
	cmd, pidFile := command(t.Context(), t, "parent-exits")

	if err := procgroup.Run(cmd); err != nil {
		t.Fatalf("Run: %v", err)
	}
	gone(t, waitPid(t, pidFile))
}
