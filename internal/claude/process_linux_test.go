package claude_test

import (
	"testing"

	"github.com/guilhermt/myspec/internal/claude"
)

func TestTerminateAndKillStopTheProcess(t *testing.T) {
	t.Parallel()

	tests := map[string]struct {
		stop func(*claude.Process) error
		want string
	}{
		"terminate": {stop: (*claude.Process).Terminate, want: "SIGTERM"},
		"kill":      {stop: (*claude.Process).Kill, want: "SIGKILL"},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			p := start(t, fakeConfig(t, "slow"))

			send(t, p, "keep going")
			nextEvent(t, p, "the first text delta", isTextDelta)

			if err := tc.stop(p); err != nil {
				t.Fatalf("stopping the process = %v, want nil", err)
			}

			exit := exitOf(t, p)
			if exit.Signal != tc.want {
				t.Errorf("Signal = %q, want %q", exit.Signal, tc.want)
			}
			if exit.Code != -1 {
				t.Errorf("Code = %d, want -1 for a signalled process", exit.Code)
			}
		})
	}
}
