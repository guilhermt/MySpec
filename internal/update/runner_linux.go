package update

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"syscall"
	"time"
)

// runnerWaitDelay is how long Run waits for the output of a script that was
// killed, whose children may still hold the pipe.
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
	var output bytes.Buffer
	cmd.Stdout, cmd.Stderr = &output, &output

	if err := cmd.Run(); err != nil {
		return output.Bytes(), fmt.Errorf("run %s: %w", script, err)
	}
	return output.Bytes(), nil
}
