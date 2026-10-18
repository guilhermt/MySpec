package update

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"time"
)

// runnerWaitDelay is how long Run waits for a script that was killed to exit
// before it kills it again.
const runnerWaitDelay = 5 * time.Second

// scriptRunner runs the install script with /bin/sh, in a process group of its
// own that the app closing never stops: an installation cut in the middle is
// worse than one that ends after the app. Only the deadline kills it.
type scriptRunner struct{}

// Run implements Runner.
func (scriptRunner) Run(ctx context.Context, script, result string) ([]byte, error) {
	cmd := exec.CommandContext(ctx, "/bin/sh", script)
	cmd.Env = append(os.Environ(), "MYSPEC_INSTALL_RESULT="+result)
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	// The deadline kills the group: the sh, the curl and the tar.
	cmd.Cancel = func() error { return syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL) }
	cmd.WaitDelay = runnerWaitDelay
	// The output goes to a file next to the script, never to a pipe of the app:
	// a script that prints after the app closed would die on the closed pipe.
	outputPath := filepath.Join(filepath.Dir(script), "output")
	file, err := os.Create(outputPath)
	if err != nil {
		return nil, fmt.Errorf("create the output of %s: %w", script, err)
	}
	cmd.Stdout, cmd.Stderr = file, file

	runErr := cmd.Run()
	_ = file.Close()
	output, _ := os.ReadFile(outputPath)
	if runErr != nil {
		return output, fmt.Errorf("run %s: %w", script, runErr)
	}
	return output, nil
}
