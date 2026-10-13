package claude_test

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"github.com/guilhermt/myspec/internal/claude"
	"github.com/guilhermt/myspec/internal/claude/claudetest"
)

func TestTerminateAndKillStopTheProcessAndWhatItStarted(t *testing.T) {
	t.Parallel()

	tests := map[string]struct {
		stop func(*claude.Process) error
	}{
		"terminate": {stop: (*claude.Process).Terminate},
		"kill":      {stop: (*claude.Process).Kill},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			pidFile := filepath.Join(t.TempDir(), "pid")
			cfg := fakeConfig(t, "spawn")
			cfg.Env = append(cfg.Env, claudetest.EnvPidFile+"="+pidFile)
			p := start(t, cfg)

			send(t, p, "keep going")
			nextEvent(t, p, "the first text delta", isTextDelta)
			raw, err := os.ReadFile(pidFile)
			if err != nil {
				t.Fatalf("ReadFile(%s) = %v, want nil", pidFile, err)
			}
			pid, err := strconv.Atoi(strings.TrimSpace(string(raw)))
			if err != nil {
				t.Fatalf("pid file = %q, want a pid", raw)
			}

			if err := tc.stop(p); err != nil {
				t.Fatalf("stopping the process = %v, want nil", err)
			}

			exit := exitOf(t, p)
			if exit.Signal != "" {
				t.Errorf("Signal = %q, want none on Windows", exit.Signal)
			}
			if exit.Code != 1 {
				t.Errorf("Code = %d, want 1 for a process the app killed", exit.Code)
			}
			gone(t, pid)
		})
	}
}
